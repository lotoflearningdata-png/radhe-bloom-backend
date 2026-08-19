// backend/routes/pricing.js
const router         = require('express').Router()
const CountryPricing = require('../models/CountryPricing')
const Product        = require('../models/Product')
const protect        = require('../middleware/auth')

// ── GET prices for a single product ──────────────────────────────
router.get('/product/:productId', async (req, res) => {
  try {
    const pricing = await CountryPricing.findOne({ product: req.params.productId })
    res.json({ pricing: pricing || null })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ── GET all products with their country prices (admin) ───────────
router.get('/all', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' })

    const products = await Product.find({}, 'name price category images').sort({ name: 1 })
    const pricings = await CountryPricing.find({})

    // Merge product data with pricing data
    const result = products.map(p => {
      const pricing = pricings.find(pr => pr.product.toString() === p._id.toString())
      return {
        _id:      p._id,
        name:     p.name,
        price:    p.price,
        category: p.category,
        image:    p.images?.[0],
        prices:   pricing?.prices || {},
      }
    })

    res.json({ products: result })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ── SET/UPDATE prices for a product (admin) ───────────────────────
router.post('/product/:productId', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' })

    const { prices } = req.body // { IN: 699, US: 12.99, GB: 10.99, AE: 47, AU: 19.99 }

    const pricing = await CountryPricing.findOneAndUpdate(
      { product: req.params.productId },
      { product: req.params.productId, prices },
      { upsert: true, new: true }
    )

    res.json({ pricing })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ── BULK SET prices for multiple products (admin) ─────────────────
router.post('/bulk', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' })

    const { items } = req.body // [{ productId, prices }]
    if (!Array.isArray(items)) return res.status(400).json({ message: 'items must be array' })

    const ops = items.map(item => ({
      updateOne: {
        filter: { product: item.productId },
        update: { product: item.productId, prices: item.prices },
        upsert: true,
      }
    }))

    await CountryPricing.bulkWrite(ops)
    res.json({ message: `Updated ${items.length} products` })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ── GET price for specific product + country ──────────────────────
router.get('/product/:productId/country/:countryCode', async (req, res) => {
  try {
    const { productId, countryCode } = req.params
    const pricing = await CountryPricing.findOne({ product: productId })

    const price = pricing?.prices?.[countryCode.toUpperCase()]
    res.json({ price: price || null, countryCode: countryCode.toUpperCase() })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ── DELETE pricing for a product (admin) ─────────────────────────
router.delete('/product/:productId', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' })
    await CountryPricing.findOneAndDelete({ product: req.params.productId })
    res.json({ message: 'Pricing deleted' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router