const mongoose = require('mongoose')

const reviewSchema = new mongoose.Schema({
  product:  { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  user:     { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true },
  order:    { type: mongoose.Schema.Types.ObjectId, ref: 'Order',   required: true },
  rating:   { type: Number, required: true, min: 1, max: 5 },
  title:    { type: String, trim: true, maxlength: 100 },
  comment:  { type: String, trim: true, maxlength: 1000 },
  verified: { type: Boolean, default: true }, // verified purchase
}, { timestamps: true })

// One review per user per product
reviewSchema.index({ product: 1, user: 1 }, { unique: true })

// Auto-update product rating after save
reviewSchema.post('save', async function() {
  const Product = mongoose.model('Product')
  const stats = await mongoose.model('Review').aggregate([
    { $match: { product: this.product } },
    { $group: { _id: '$product', avgRating: { $avg: '$rating' }, count: { $sum: 1 } } }
  ])
  if (stats.length > 0) {
    await Product.findByIdAndUpdate(this.product, {
      rating:      Math.round(stats[0].avgRating * 10) / 10,
      reviewCount: stats[0].count,
    })
  }
})

module.exports = mongoose.model('Review', reviewSchema)