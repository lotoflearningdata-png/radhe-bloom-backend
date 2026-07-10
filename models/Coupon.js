const mongoose = require('mongoose')

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
  },
  discountType: {
    type: String,
    enum: ['percentage', 'flat'],
    required: true,
  },
  discountValue: {
    type: Number,
    required: true, // e.g. 20 (for 20%) or 100 (for ₹100 off)
  },
  minOrderValue: {
    type: Number,
    default: 0, // 0 means no minimum
  },
  maxDiscount: {
    type: Number, // cap for percentage discounts, e.g. max ₹500 off even if 20% is more
  },
  usageLimit: {
    type: Number,
    default: null, // null = unlimited
  },
  usedCount: {
    type: Number,
    default: 0,
  },
  perUserLimit: {
    type: Number,
    default: 1, // how many times ONE user can use this coupon
  },
  validFrom: {
    type: Date,
    default: Date.now,
  },
  validUntil: {
    type: Date,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  description: {
    type: String, // e.g. "Launch offer - 20% off"
  },
  usedBy: [{
    user:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    order:   { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    usedAt:  { type: Date, default: Date.now },
  }],
}, { timestamps: true })

// Helper method: check if coupon is currently valid (time/usage wise)
couponSchema.methods.isValidNow = function() {
  const now = new Date()
  if (!this.isActive) return { valid: false, reason: 'Coupon is no longer active' }
  if (this.validFrom && now < this.validFrom) return { valid: false, reason: 'Coupon is not active yet' }
  if (this.validUntil && now > this.validUntil) return { valid: false, reason: 'Coupon has expired' }
  if (this.usageLimit !== null && this.usedCount >= this.usageLimit) {
    return { valid: false, reason: 'Coupon usage limit reached' }
  }
  return { valid: true }
}

// Helper method: calculate discount amount for a given order total
couponSchema.methods.calculateDiscount = function(orderTotal) {
  if (orderTotal < this.minOrderValue) {
    return { discount: 0, error: `Minimum order value is ₹${this.minOrderValue}` }
  }

  let discount = 0
  if (this.discountType === 'percentage') {
    discount = (orderTotal * this.discountValue) / 100
    if (this.maxDiscount && discount > this.maxDiscount) {
      discount = this.maxDiscount
    }
  } else {
    discount = this.discountValue
  }

  // Discount can't exceed order total
  if (discount > orderTotal) discount = orderTotal

  return { discount: Math.round(discount * 100) / 100, error: null }
}

module.exports = mongoose.model('Coupon', couponSchema)