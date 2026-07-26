const mongoose = require('mongoose')

const productSchema = new mongoose.Schema({
  name:          { type: String, required: true },
  slug:          { type: String, unique: true },
  description:   { type: String, required: true },
  price:         { type: Number, required: true },
  originalPrice: { type: Number },
  // category slugs are managed dynamically in the Category collection
  category:      { type: String, required: true },
  categories:    [{ type: String }], // optional additional categories
  images:        [{ type: String }],
  videoUrl:      { type: String },
  colour:        { type: String },
  colorVariants: [{ type: String }],
  sizeVariants:  [{
    label: { type: String, required: true },
    price: { type: Number, required: true },
  }],
  material:      { type: String },
  dimensions:    { type: String },
  stock:         { type: Number, default: 50 },
  featured:      { type: Boolean, default: false },
  hidden:        { type: Boolean, default: false },
  hsnCode:       { type: String },
  gstRate:       { type: Number, default: 18 },
  rating:        { type: Number, default: 4.2 },
  reviewCount:   { type: Number, default: 0 },
}, { timestamps: true })

productSchema.pre('save', function(next) {
  if (!this.slug) {
    this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now()
  }
  next()
})

productSchema.index({ name: 'text', description: 'text' })

module.exports = mongoose.model('Product', productSchema)
