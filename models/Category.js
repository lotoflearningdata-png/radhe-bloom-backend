const mongoose = require('mongoose')

const categorySchema = new mongoose.Schema({
  name:   { type: String, required: true, trim: true },
  slug:   { type: String, unique: true },
  hidden: { type: Boolean, default: false },
  order:  { type: Number, default: 0 },
}, { timestamps: true })

categorySchema.pre('validate', function(next) {
  if (!this.slug && this.name) {
    this.slug = this.name.toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
  }
  next()
})

module.exports = mongoose.model('Category', categorySchema)
