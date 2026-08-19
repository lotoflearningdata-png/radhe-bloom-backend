// backend/models/CountryPricing.js
const mongoose = require('mongoose')

// Pricing tiers: IN (base ₹), US ($), OTHER ($ for every other country)
const SUPPORTED_COUNTRIES = ['IN', 'US', 'OTHER']

const countryPriceSchema = new mongoose.Schema({
  product:    { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  prices: {
    IN:    { type: Number }, // INR — base price (same as product.price)
    US:    { type: Number }, // USD — shown to US customers
    OTHER: { type: Number }, // USD — shown to all other non-India countries
  },
}, { timestamps: true })

countryPriceSchema.index({ product: 1 }, { unique: true })

module.exports = mongoose.model('CountryPricing', countryPriceSchema)
module.exports.SUPPORTED_COUNTRIES = SUPPORTED_COUNTRIES