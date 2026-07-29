// backend/routes/orders.js
const router   = require('express').Router()
const crypto   = require('crypto')
const Razorpay = require('razorpay')
const Order    = require('../models/Order')
const Cart     = require('../models/Cart')
const Product  = require('../models/Product')
const Coupon   = require('../models/Coupon')
const protect  = require('../middleware/auth')
const shiprocket = require('../services/shiprocket')
const { generateInvoice, nextInvoiceNumber } = require('../services/invoice')
const { markCouponUsed }           = require('./coupons')
const {
  sendOrderConfirmation,
  sendAdminOrderAlert,
  sendShippingUpdate,
  sendCancellationEmail,
  sendReturnRequestAlert,
  sendReturnStatusEmail,
  sendDeliveryConfirmation,
} = require('../services/email')

const RETURN_WINDOW_MS = 2 * 24 * 60 * 60 * 1000 // 2 days

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

// ── Helper: recompute cart items, shipping and discount from trusted
// server-side data. Prices, totals and discounts are never trusted from the
// client — otherwise a manipulated request could check out a real cart for
// a fraction of its true price. ─────────────────────────────────────
async function computeVerifiedOrder(items, couponCode, userId) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Cart is empty')
  }

  const verifiedItems = []
  let subtotal = 0

  for (const item of items) {
    const product = await Product.findById(item.product)
    if (!product) throw new Error('One of the items in your cart is no longer available')

    let price = product.price
    if (item.size && product.sizeVariants?.length) {
      const variant = product.sizeVariants.find(v => v.label === item.size)
      if (variant) price = variant.price
    }

    const qty = Math.max(1, Number(item.qty) || 1)
    subtotal += price * qty
    verifiedItems.push({ product: product._id, qty, color: item.color || undefined, size: item.size || undefined, price })
  }

  const shipping = subtotal >= 999 ? 0 : 69

  let discount = 0
  let verifiedCouponCode
  if (couponCode) {
    const coupon = await Coupon.findOne({ code: couponCode.trim().toUpperCase() })
    if (coupon && coupon.isValidNow().valid) {
      const userUsageCount = userId ? coupon.usedBy.filter(u => u.user?.toString() === userId).length : 0
      if (!userId || userUsageCount < coupon.perUserLimit) {
        const result = coupon.calculateDiscount(subtotal + shipping)
        if (!result.error) {
          discount = result.discount
          verifiedCouponCode = coupon.code
        }
      }
    }
  }

  const total = Math.max(0, subtotal + shipping - discount)
  return { items: verifiedItems, subtotal, shipping, discount, total, couponCode: verifiedCouponCode }
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
        order.shippingStatus    = 'created'
        order.shiprocketError   = undefined
        await order.save()
        console.log('✅ Shiprocket order created:', srData.shiprocketOrderId)
      } catch (err) {
        console.error('⚠️ Shiprocket failed (non-fatal):', err.message)
        order.shippingStatus  = 'failed'
        order.shiprocketError = err.response?.data?.message || err.message
        await order.save()
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
      shippingAddress, items, couponCode,
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

    // Recompute prices/total from real product data — never trust the
    // client's cart contents or total.
    let verified
    try {
      verified = await computeVerifiedOrder(items, couponCode, userId)
    } catch (err) {
      return res.status(400).json({ message: err.message })
    }

    // Cross-check the amount actually captured by Razorpay against our
    // recomputed total. Without this, someone could pay for a cheap order
    // and attach that valid signature to a fake, expensive cart.
    const payment = await razorpay.payments.fetch(razorpay_payment_id)
    const expectedPaise = Math.round(verified.total * 100)
    if (payment.amount !== expectedPaise) {
      return res.status(400).json({ message: 'Payment amount does not match order total' })
    }

    // Save order to DB
    const order = await Order.create({
      user:              userId,
      items:             verified.items,
      shippingAddress,
      total:             verified.total,
      couponCode:        verified.couponCode,
      discount:          verified.discount,
      paymentMethod:     'razorpay',
      paymentStatus:     'paid',
      status:            'confirmed',
      paymentId:         razorpay_payment_id,
      razorpayOrderId:   razorpay_order_id,
      razorpaySignature: razorpay_signature,
      isInternational:   false,
    })

    // Populate product details for emails/invoice
    await order.populate('items.product', 'name images price category hsnCode gstRate weight packageLength packageBreadth packageHeight')

    // Mark coupon as used (if one was actually applied)
    if (verified.couponCode) {
      try {
        await markCouponUsed(verified.couponCode, userId, order._id)
        console.log('✅ Coupon marked as used:', verified.couponCode)
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
// CASH ON DELIVERY (Domestic)
// ══════════════════════════════════════════════════════════════════

router.post('/create-cod', async (req, res) => {
  try {
    if (!(await checkEmailVerified(req, res))) return
    const { shippingAddress, items, couponCode } = req.body
    const userId = await getUserFromToken(req)

    // Recompute prices/total from real product data — this is also what
    // determines the cash-on-delivery amount the courier collects, so it
    // must never be trusted from the client.
    let verified
    try {
      verified = await computeVerifiedOrder(items, couponCode, userId)
    } catch (err) {
      return res.status(400).json({ message: err.message })
    }

    const order = await Order.create({
      user:            userId,
      items:           verified.items,
      shippingAddress: { ...shippingAddress, country: 'India' },
      total:           verified.total,
      couponCode:      verified.couponCode,
      discount:        verified.discount,
      paymentMethod:   'cod',
      paymentStatus:   'pending',
      status:          'confirmed',
      isInternational: false,
    })

    await order.populate('items.product', 'name images price category hsnCode gstRate weight packageLength packageBreadth packageHeight')

    // Mark coupon as used (order is confirmed even though payment is collected on delivery)
    if (verified.couponCode) {
      try {
        await markCouponUsed(verified.couponCode, userId, order._id)
        console.log('✅ Coupon marked as used (COD):', verified.couponCode)
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

    res.status(201).json(order)

    // Run async (don't await — fire and forget)
    processOrderAfterPayment(order)

  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// Admin marks a COD order's cash as collected
router.put('/:id/confirm-cod', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' })
    const order = await Order.findById(req.params.id)
    if (!order) return res.status(404).json({ message: 'Order not found' })
    if (order.paymentMethod !== 'cod') return res.status(400).json({ message: 'Not a COD order' })

    order.paymentStatus = 'paid'
    await order.save()

    res.json({ order })
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
    const { shippingAddress, items, couponCode } = req.body
    const userId = await getUserFromToken(req)

    // Recompute prices/total from real product data so the admin sees the
    // true amount to expect when confirming payment — never trust the
    // client's cart contents or total.
    let verified
    try {
      verified = await computeVerifiedOrder(items, couponCode, userId)
    } catch (err) {
      return res.status(400).json({ message: err.message })
    }

    // Payment status is never trusted from the client — international orders
    // are always created pending, and only an admin's explicit
    // /confirm-payoneer action (after verifying payment out-of-band) marks
    // them paid. See PUT /:id/confirm-payoneer below.
    const order = await Order.create({
      user:              userId,
      items:             verified.items,
      shippingAddress,
      total:             verified.total,
      couponCode:        verified.couponCode,
      discount:          verified.discount,
      paymentMethod:     'payoneer',
      paymentStatus:     'pending',
      status:            'pending',
      isInternational:   true,
    })
    await order.populate('items.product', 'name images price category hsnCode gstRate weight packageLength packageBreadth packageHeight')

    res.status(201).json(order)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// Admin confirms Payoneer payment manually
router.put('/:id/confirm-payoneer', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' })
    const order = await Order.findById(req.params.id)
      .populate('items.product', 'name images price category hsnCode gstRate weight packageLength packageBreadth packageHeight')
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
      .populate('items.product', 'name images price category hsnCode gstRate weight packageLength packageBreadth packageHeight')

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
      .populate('items.product', 'name images price category hsnCode gstRate weight packageLength packageBreadth packageHeight')
      .sort({ createdAt: -1 })
    res.json({ orders })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// Customer cancels their own order — only while it hasn't shipped yet.
// Auto-refunds a captured Razorpay payment and cancels the Shiprocket
// shipment if one already exists.
router.put('/:id/cancel', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('items.product', 'name images price category hsnCode gstRate weight packageLength packageBreadth packageHeight')
    if (!order) return res.status(404).json({ message: 'Order not found' })

    if (order.user?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' })
    }

    if (!['pending', 'confirmed', 'processing'].includes(order.status)) {
      return res.status(400).json({ message: `This order can no longer be cancelled (status: ${order.status})` })
    }

    order.status = 'cancelled'

    // Cancel the Shiprocket shipment too, if one was already created (non-fatal)
    if (order.shiprocketOrderId) {
      try {
        await shiprocket.cancelOrder([order.shiprocketOrderId])
        order.shippingStatus = 'cancelled'
      } catch (err) {
        console.error('⚠️ Shiprocket cancel failed (non-fatal):', err.message)
      }
    }

    // Auto-refund a captured Razorpay payment
    let refunded = false
    if (order.paymentMethod === 'razorpay' && order.paymentStatus === 'paid') {
      try {
        await razorpay.payments.refund(order.paymentId, { amount: Math.round(order.total * 100) })
        order.paymentStatus = 'refunded'
        refunded = true
      } catch (err) {
        console.error('⚠️ Razorpay refund failed (non-fatal):', err.message)
      }
    }

    await order.save()
    res.json({ order, refunded })

    try {
      await sendCancellationEmail(order, refunded)
    } catch (err) {
      console.error('⚠️ Cancellation email failed (non-fatal):', err.message)
    }
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// Customer requests a return — only within 2 days of delivery
router.put('/:id/request-return', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
    if (!order) return res.status(404).json({ message: 'Order not found' })

    if (order.user?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' })
    }

    if (order.status !== 'delivered' || !order.deliveredAt) {
      return res.status(400).json({ message: 'Returns can only be requested for delivered orders' })
    }

    if (order.returnStatus !== 'none') {
      return res.status(400).json({ message: 'A return has already been requested for this order' })
    }

    if (Date.now() - new Date(order.deliveredAt).getTime() > RETURN_WINDOW_MS) {
      return res.status(400).json({ message: 'The 2-day return window for this order has passed' })
    }

    order.returnStatus      = 'requested'
    order.returnReason      = req.body.reason || ''
    order.returnRequestedAt = new Date()
    await order.save()

    res.json({ order })

    try {
      await sendReturnRequestAlert(order)
    } catch (err) {
      console.error('⚠️ Return request alert failed (non-fatal):', err.message)
    }
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// Admin approves a return — auto-refunds a captured Razorpay payment
router.put('/:id/approve-return', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' })
    const order = await Order.findById(req.params.id)
    if (!order) return res.status(404).json({ message: 'Order not found' })
    if (order.returnStatus !== 'requested') return res.status(400).json({ message: 'No pending return request on this order' })

    order.returnStatus = 'approved'

    let refunded = false
    if (order.paymentMethod === 'razorpay' && order.paymentStatus === 'paid') {
      try {
        await razorpay.payments.refund(order.paymentId, { amount: Math.round(order.total * 100) })
        order.paymentStatus = 'refunded'
        refunded = true
      } catch (err) {
        console.error('⚠️ Razorpay refund failed (non-fatal):', err.message)
      }
    }

    await order.save()
    res.json({ order, refunded })

    try {
      await sendReturnStatusEmail(order, true, refunded)
    } catch (err) {
      console.error('⚠️ Return status email failed (non-fatal):', err.message)
    }
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// Admin rejects a return
router.put('/:id/reject-return', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' })
    const order = await Order.findById(req.params.id)
    if (!order) return res.status(404).json({ message: 'Order not found' })
    if (order.returnStatus !== 'requested') return res.status(400).json({ message: 'No pending return request on this order' })

    order.returnStatus = 'rejected'
    await order.save()

    res.json({ order })

    try {
      await sendReturnStatusEmail(order, false, false)
    } catch (err) {
      console.error('⚠️ Return status email failed (non-fatal):', err.message)
    }
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
      .populate('items.product', 'name images price category hsnCode gstRate weight packageLength packageBreadth packageHeight')
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
      .populate('items.product', 'name images price category hsnCode gstRate weight packageLength packageBreadth packageHeight')
    if (!order) return res.status(404).json({ message: 'Order not found' })

    const prevStatus = order.status
    order.status = status
    if (status === 'delivered' && prevStatus !== 'delivered') {
      order.deliveredAt = new Date()
    }
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

// ══════════════════════════════════════════════════════════════════
// CHECKOUT — Pincode serviceability check (non-blocking helper)
// Requires SHIPROCKET_PICKUP_PINCODE to be set; otherwise reports
// "skipped" so the frontend doesn't block checkout on missing config.
// ══════════════════════════════════════════════════════════════════

router.get('/check-pincode', async (req, res) => {
  try {
    const { pincode } = req.query
    const pickupPincode = process.env.SHIPROCKET_PICKUP_PINCODE
    if (!pincode) return res.status(400).json({ message: 'Pincode is required' })
    if (!pickupPincode) return res.json({ skipped: true, serviceable: true })

    const couriers = await shiprocket.checkServiceability(pickupPincode, pincode)
    res.json({ skipped: false, serviceable: couriers.length > 0, courierCount: couriers.length })
  } catch (err) {
    // Fail open — never block checkout because the serviceability check itself broke
    res.json({ skipped: true, serviceable: true, error: err.message })
  }
})

// ══════════════════════════════════════════════════════════════════
// ADMIN — Retry Shiprocket order creation for a failed/pending shipment
// ══════════════════════════════════════════════════════════════════

router.post('/:id/retry-shiprocket', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' })
    const order = await Order.findById(req.params.id)
      .populate('items.product', 'name images price category hsnCode gstRate weight packageLength packageBreadth packageHeight')
    if (!order) return res.status(404).json({ message: 'Order not found' })

    const srData = await shiprocket.createShiprocketOrder(order)
    order.shiprocketOrderId = srData.shiprocketOrderId
    order.shipmentId        = srData.shipmentId
    order.awbCode           = srData.awbCode
    order.courierName       = srData.courierName
    order.shippingStatus    = 'created'
    order.shiprocketError   = undefined
    await order.save()

    res.json({ order })
  } catch (err) {
    const message = err.response?.data?.message || err.message
    try {
      await Order.findByIdAndUpdate(req.params.id, { shippingStatus: 'failed', shiprocketError: message })
    } catch {}
    res.status(500).json({ message })
  }
})

// ══════════════════════════════════════════════════════════════════
// ADMIN — Generate shipping label for an order's Shiprocket shipment
// ══════════════════════════════════════════════════════════════════

router.post('/:id/generate-label', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' })
    const order = await Order.findById(req.params.id)
    if (!order) return res.status(404).json({ message: 'Order not found' })
    if (!order.shipmentId) return res.status(400).json({ message: 'No Shiprocket shipment on this order yet' })

    const data = await shiprocket.generateLabel(order.shipmentId)
    res.json({ labelUrl: data.label_url || null, raw: data })
  } catch (err) {
    res.status(500).json({ message: err.response?.data?.message || err.message })
  }
})

// ══════════════════════════════════════════════════════════════════
// ADMIN — Cancel an order's Shiprocket shipment
// ══════════════════════════════════════════════════════════════════

router.post('/:id/cancel-shipment', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' })
    const order = await Order.findById(req.params.id)
    if (!order) return res.status(404).json({ message: 'Order not found' })
    if (!order.shiprocketOrderId) return res.status(400).json({ message: 'No Shiprocket order to cancel' })

    await shiprocket.cancelOrder([order.shiprocketOrderId])
    order.shippingStatus = 'cancelled'
    await order.save()

    res.json({ order })
  } catch (err) {
    res.status(500).json({ message: err.response?.data?.message || err.message })
  }
})

module.exports = router