// backend/routes/orders.js
const router   = require('express').Router()
const crypto   = require('crypto')
const Razorpay = require('razorpay')
const Order    = require('../models/Order')
const Cart     = require('../models/Cart')
const protect  = require('../middleware/auth')
const shiprocket = require('../services/shiprocket')
const { generateInvoice, nextInvoiceNumber } = require('../services/invoice')
const { markCouponUsed }           = require('./coupons')
const {
  sendOrderConfirmation,
  sendAdminOrderAlert,
  sendShippingUpdate,
  sendDeliveryConfirmation,
} = require('../services/email')

const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
})

// ── Helper: get user ID from token ────────────────────────────────
async function getUserFromToken(req) {
  try {
    const jwt     = require('jsonwebtoken')
    const token   = req.headers.authorization?.split(' ')[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    return decoded.id
  } catch { return undefined }
}

// ── Helper: block checkout for logged-in but unverified accounts ──
async function checkEmailVerified(req, res) {
  const userId = await getUserFromToken(req)
  if (!userId) return true // guest checkout — nothing to verify
  const User = require('../models/User')
  const user = await User.findById(userId).select('emailVerified authProvider')
  if (user && user.authProvider === 'local' && !user.emailVerified) {
    res.status(403).json({
      code: 'EMAIL_NOT_VERIFIED',
      message: 'Please verify your email before placing an order. Check your inbox for the verification link.',
    })
    return false
  }
  return true
}

// ── Helper: full post-payment flow ────────────────────────────────
async function processOrderAfterPayment(order) {
  try {
    // 1. Generate PDF invoice
    let invoiceBuffer = null
    try {
      if (!order.invoiceNumber) {
        order.invoiceNumber = await nextInvoiceNumber()
        await order.save()
      }
      invoiceBuffer = await generateInvoice(order)
      console.log('✅ Invoice generated')
    } catch (err) {
      console.error('⚠️ Invoice generation failed (non-fatal):', err.message)
    }

    // 2. Send order confirmation to customer (with invoice attached)
    try {
      await sendOrderConfirmation(order, invoiceBuffer)
      console.log('✅ Order confirmation email sent')
    } catch (err) {
      console.error('⚠️ Customer email failed (non-fatal):', err.message)
    }

    // 3. Send new order alert to admin
    try {
      await sendAdminOrderAlert(order)
      console.log('✅ Admin alert sent')
    } catch (err) {
      console.error('⚠️ Admin alert failed (non-fatal):', err.message)
    }

    // 4. Create Shiprocket order (domestic only)
    if (!order.isInternational) {
      try {
        const srData = await shiprocket.createShiprocketOrder(order)
        order.shiprocketOrderId = srData.shiprocketOrderId
        order.shipmentId        = srData.shipmentId
        order.awbCode           = srData.awbCode
        order.courierName       = srData.courierName
        await order.save()
        console.log('✅ Shiprocket order created:', srData.shiprocketOrderId)
      } catch (err) {
        console.error('⚠️ Shiprocket failed (non-fatal):', err.message)
      }
    }

    // 5. Mark email as sent
    order.emailSent = true
    await order.save()

  } catch (err) {
    console.error('❌ Post-payment processing error:', err.message)
  }
}

// ══════════════════════════════════════════════════════════════════
// RAZORPAY
// ══════════════════════════════════════════════════════════════════

// Create Razorpay order
router.post('/create-razorpay', async (req, res) => {
  try {
    if (!(await checkEmailVerified(req, res))) return
    const { amount } = req.body
    const amountPaise = Math.round(Number(amount) * 100)
    if (!Number.isFinite(amountPaise) || amountPaise < 100) {
      return res.status(400).json({ message: 'Amount must be at least ₹1 (100 paise)' })
    }
    const rpOrder = await razorpay.orders.create({
      amount:   amountPaise,
      currency: 'INR',
      receipt:  `receipt_${Date.now()}`,
    })
    res.json({ orderId: rpOrder.id, amount: rpOrder.amount, currency: rpOrder.currency, keyId: process.env.RAZORPAY_KEY_ID })
  } catch (err) {
    if (err.statusCode === 401) {
      return res.status(401).json({ message: 'Payment gateway authentication failed — check Razorpay keys' })
    }
    res.status(500).json({ message: 'Could not create payment order', error: err.error?.description || err.message })
  }
})

// Verify Razorpay payment & save order
router.post('/verify', async (req, res) => {
  try {
    const {
      razorpay_order_id, razorpay_payment_id, razorpay_signature,
      shippingAddress, items, total, couponCode, discount,
    } = req.body

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: 'Missing payment verification fields' })
    }

    // Verify signature
    const body     = razorpay_order_id + '|' + razorpay_payment_id
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body).digest('hex')
    if (expected !== razorpay_signature) {
      return res.status(400).json({ message: 'Invalid payment signature' })
    }

    const userId = await getUserFromToken(req)

    // Save order to DB
    const order = await Order.create({
      user:              userId,
      items,
      shippingAddress,
      total,
      couponCode:        couponCode || undefined,
      discount:          discount || 0,
      paymentMethod:     'razorpay',
      paymentStatus:     'paid',
      status:            'confirmed',
      paymentId:         razorpay_payment_id,
      razorpayOrderId:   razorpay_order_id,
      razorpaySignature: razorpay_signature,
      isInternational:   false,
    })

    // Populate product details for emails/invoice
    await order.populate('items.product', 'name images price category hsnCode gstRate')

    // Mark coupon as used (if one was applied)
    if (couponCode) {
      try {
        await markCouponUsed(couponCode, userId, order._id)
        console.log('✅ Coupon marked as used:', couponCode)
      } catch (err) {
        console.error('⚠️ Failed to mark coupon used (non-fatal):', err.message)
      }
    }

    // Clear cart if logged in
    if (req.headers.authorization) {
      try {
        const jwt     = require('jsonwebtoken')
        const decoded = jwt.verify(req.headers.authorization.split(' ')[1], process.env.JWT_SECRET)
        await Cart.findOneAndUpdate({ user: decoded.id }, { items: [] })
      } catch {}
    }

    // Respond immediately — process emails/invoice in background
    res.status(201).json(order)

    // Run async (don't await — fire and forget)
    processOrderAfterPayment(order)

  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ══════════════════════════════════════════════════════════════════
// PAYONEER (International)
// ══════════════════════════════════════════════════════════════════

router.post('/create-international', async (req, res) => {
  try {
    if (!(await checkEmailVerified(req, res))) return
    const { shippingAddress, items, total, payoneerReference, couponCode, discount } = req.body
    const userId = await getUserFromToken(req)

    const order = await Order.create({
      user:              userId,
      items,
      shippingAddress,
      total,
      couponCode:        couponCode || undefined,
      discount:          discount || 0,
      paymentMethod:     'payoneer',
      paymentStatus:     payoneerReference ? 'paid' : 'pending',
      status:            payoneerReference ? 'confirmed' : 'pending',
      payoneerReference,
      isInternational:   true,
    })
    await order.populate('items.product', 'name images price category hsnCode gstRate')

    res.status(201).json(order)

    // Only mark coupon used + run post-payment flow if payment is actually confirmed
    if (payoneerReference) {
      if (couponCode) {
        try {
          await markCouponUsed(couponCode, userId, order._id)
          console.log('✅ Coupon marked as used (international):', couponCode)
        } catch (err) {
          console.error('⚠️ Failed to mark coupon used (non-fatal):', err.message)
        }
      }
      processOrderAfterPayment(order)
    }
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// Admin confirms Payoneer payment manually
router.put('/:id/confirm-payoneer', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' })
    const order = await Order.findById(req.params.id)
      .populate('items.product', 'name images price category hsnCode gstRate')
    if (!order) return res.status(404).json({ message: 'Order not found' })

    order.paymentStatus     = 'paid'
    order.status            = 'confirmed'
    order.payoneerReference = req.body.reference || order.payoneerReference
    await order.save()

    res.json({ order })

    // Mark coupon used now that payment is confirmed (if not already done)
    if (order.couponCode) {
      try {
        await markCouponUsed(order.couponCode, order.user, order._id)
        console.log('✅ Coupon marked as used (Payoneer confirmed):', order.couponCode)
      } catch (err) {
        console.error('⚠️ Failed to mark coupon used (non-fatal):', err.message)
      }
    }

    processOrderAfterPayment(order)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ══════════════════════════════════════════════════════════════════
// DOWNLOAD INVOICE
// ══════════════════════════════════════════════════════════════════

router.get('/:id/invoice', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('items.product', 'name images price category hsnCode gstRate')

    if (!order) return res.status(404).json({ message: 'Order not found' })

    if (order.user?.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' })
    }

    const pdfBuffer = await generateInvoice(order)

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="Invoice_${order._id.toString().slice(-8).toUpperCase()}.pdf"`)
    res.setHeader('Content-Length', pdfBuffer.length)
    res.end(pdfBuffer)
  } catch (err) {
    res.status(500).json({ message: 'Failed to generate invoice: ' + err.message })
  }
})

// ══════════════════════════════════════════════════════════════════
// TRACKING
// ══════════════════════════════════════════════════════════════════

router.get('/:id/tracking', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
    if (!order) return res.status(404).json({ message: 'Order not found' })
    let trackingData = null
    if (order.awbCode) {
      try { trackingData = await shiprocket.trackShipment(order.awbCode) } catch {}
    }
    res.json({
      order: {
        _id: order._id, status: order.status, awbCode: order.awbCode,
        courierName: order.courierName, isInternational: order.isInternational,
        createdAt: order.createdAt,
      },
      trackingData,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ══════════════════════════════════════════════════════════════════
// MY ORDERS (customer)
// ══════════════════════════════════════════════════════════════════

router.get('/my', protect, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .populate('items.product', 'name images price category hsnCode gstRate')
      .sort({ createdAt: -1 })
    res.json({ orders })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ══════════════════════════════════════════════════════════════════
// ADMIN — Get all orders
// ══════════════════════════════════════════════════════════════════

router.get('/all', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' })
    const { status, page = 1, limit = 20 } = req.query
    const query = status ? { status } : {}
    const orders = await Order.find(query)
      .populate('user', 'name email')
      .populate('items.product', 'name images price category hsnCode gstRate')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
    const total = await Order.countDocuments(query)
    res.json({ orders, total })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ══════════════════════════════════════════════════════════════════
// ADMIN — Update order status (triggers emails automatically)
// ══════════════════════════════════════════════════════════════════

router.put('/:id/status', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' })

    const { status } = req.body
    const order = await Order.findById(req.params.id)
      .populate('items.product', 'name images price category hsnCode gstRate')
    if (!order) return res.status(404).json({ message: 'Order not found' })

    const prevStatus = order.status
    order.status = status
    await order.save()

    res.json({ order })

    // Trigger emails based on new status
    if (prevStatus !== status) {
      if (status === 'shipped') {
        try {
          await sendShippingUpdate(order)
          console.log('✅ Shipping email sent for order', order._id)
        } catch (err) {
          console.error('⚠️ Shipping email failed:', err.message)
        }
      }
      if (status === 'delivered') {
        try {
          await sendDeliveryConfirmation(order)
          console.log('✅ Delivery confirmation sent for order', order._id)
        } catch (err) {
          console.error('⚠️ Delivery email failed:', err.message)
        }
      }
    }
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router