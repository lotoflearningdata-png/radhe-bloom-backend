const mongoose = require('mongoose')

const productSchema = new mongoose.Schema({
  name:          { type: String, required: true },
  slug:          { type: String, unique: true },
  description:   { type: String, required: true },
  price:         { type: Number, required: true },
  originalPrice: { type: Number },
  category: {
    type: String, required: true,
    enum: ['divine-idols','festive-sets','home-decor','kids-toys','candles','gift-sets','summer','rangoli'],
  },
  images:      [{ type: String }],
  colour:      { type: String },
  material:    { type: String },
  dimensions:  { type: String },
  weight:      { type: String },
  stock:       { type: Number, default: 50 },
  featured:    { type: Boolean, default: false },
  rating:      { type: Number, default: 4.2 },
  reviewCount: { type: Number, default: 0 },
  badge:       { type: String }, // 'Bestselling', 'New', 'Summer' etc
}, { timestamps: true })

productSchema.pre('save', function(next) {
  if (!this.slug) {
    this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now()
  }
  next()
})

productSchema.index({ name: 'text', description: 'text' })
module.exports = mongoose.model('Product', productSchema)