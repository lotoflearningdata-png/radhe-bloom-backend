const router  = require('express').Router()
const Coupon  = require('../models/Coupon')
const protect = require('../middleware/auth')

// ══════════════════════════════════════════════════════════════════
// PUBLIC — Validate & apply a coupon code at checkout
// ══════════════════════════════════════════════════════════════════
router.post('/validate', async (req, res) => {
  try {
    const { code, orderTotal } = req.body
    if (!code) return res.status(400).json({ message: 'Coupon code is required' })

    const coupon = await Coupon.findOne({ code: code.trim().toUpperCase() })
    if (!coupon) return res.status(404).json({ message: 'Invalid coupon code' })

    const validity = coupon.isValidNow()
    if (!validity.valid) return res.status(400).json({ message: validity.reason })

    // Check per-user limit (only if logged in)
    let userId = null
    if (req.headers.authorization) {
      try {
        const jwt = require('jsonwebtoken')
        const decoded = jwt.verify(req.headers.authorization.split(' ')[1], process.env.JWT_SECRET)
        userId = decoded.id
      } catch {}
    }

    if (userId) {
      const userUsageCount = coupon.usedBy.filter(u => u.user?.toString() === userId).length
      if (userUsageCount >= coupon.perUserLimit) {
        return res.status(400).json({ message: 'You have already used this coupon the maximum number of times' })
      }
    }

    const { discount, error } = coupon.calculateDiscount(orderTotal || 0)
    if (error) return res.status(400).json({ message: error })

    res.json({
      valid: true,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discount,
      finalTotal: Math.max(0, (orderTotal || 0) - discount),
      description: coupon.description,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ══════════════════════════════════════════════════════════════════
// ADMIN — Create a new coupon
// ══════════════════════════════════════════════════════════════════
router.post('/', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' })

    const {
      code, discountType, discountValue, minOrderValue,
      maxDiscount, usageLimit, perUserLimit, validFrom, validUntil, description,
    } = req.body

    if (!code || !discountType || !discountValue) {
      return res.status(400).json({ message: 'Code, discount type and discount value are required' })
    }

    const exists = await Coupon.findOne({ code: code.trim().toUpperCase() })
    if (exists) return res.status(400).json({ message: 'Coupon code already exists' })

    const coupon = await Coupon.create({
      code: code.trim().toUpperCase(),
      discountType,
      discountValue,
      minOrderValue: minOrderValue || 0,
      maxDiscount: maxDiscount || undefined,
      usageLimit: usageLimit || null,
      perUserLimit: perUserLimit || 1,
      validFrom: validFrom || Date.now(),
      validUntil: validUntil || undefined,
      description,
    })

    res.status(201).json({ coupon })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ══════════════════════════════════════════════════════════════════
// ADMIN — Get all coupons
// ══════════════════════════════════════════════════════════════════
router.get('/', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' })
    const coupons = await Coupon.find().sort({ createdAt: -1 })
    res.json({ coupons })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ══════════════════════════════════════════════════════════════════
// ADMIN — Update coupon (e.g. toggle active/inactive)
// ══════════════════════════════════════════════════════════════════
router.put('/:id', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' })
    const coupon = await Coupon.findByIdAndUpdate(req.params.id, req.body, { new: true })
    res.json({ coupon })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ══════════════════════════════════════════════════════════════════
// ADMIN — Delete coupon
// ══════════════════════════════════════════════════════════════════
router.delete('/:id', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' })
    await Coupon.findByIdAndDelete(req.params.id)
    res.json({ message: 'Coupon deleted' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ══════════════════════════════════════════════════════════════════
// INTERNAL — Mark coupon as used (called from orders.js after payment)
// ══════════════════════════════════════════════════════════════════
async function markCouponUsed(code, userId, orderId) {
  try {
    const coupon = await Coupon.findOne({ code: code?.trim().toUpperCase() })
    if (!coupon) return
    coupon.usedCount += 1
    coupon.usedBy.push({ user: userId, order: orderId })
    await coupon.save()
  } catch (err) {
    console.error('Failed to mark coupon as used:', err.message)
  }
}

module.exports = router
module.exports.markCouponUsed = markCouponUsed