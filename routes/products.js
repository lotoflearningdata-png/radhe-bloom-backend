const router = require('express').Router()
const Fuse = require('fuse.js')
const Product = require('../models/Product')
const protect = require('../middleware/auth')

// GET all products with filters
router.get('/', async (req, res) => {
  try {
    const { category, featured, sort, search, minPrice, maxPrice, limit = 12, page = 1, exclude, includeHidden, hasVideo } = req.query
    const query = {}
    const andConditions = []

    if (includeHidden !== 'true') query.hidden = { $ne: true }
    if (category) andConditions.push({ $or: [{ category }, { categories: category }] })
    if (!req.query.category) {
      query.category = { $ne: 'summer' }
    }
    if (featured === 'true') query.featured = true
    if (hasVideo === 'true') query.videoUrl = { $exists: true, $ne: '' }
    if (exclude) query._id = { $ne: exclude }
    if (andConditions.length) query.$and = andConditions
    if (minPrice || maxPrice) {
      query.price = {}
      if (minPrice) query.price.$gte = Number(minPrice)
      if (maxPrice) query.price.$lte = Number(maxPrice)
    }

    let sortObj = { createdAt: -1 }
    if (sort === 'price_asc') sortObj = { price: 1 }
    if (sort === 'price_desc') sortObj = { price: -1 }
    if (sort === 'popular') sortObj = { reviewCount: -1 }

    const skip = (Number(page) - 1) * Number(limit)

    if (search) {
      // Small catalog — fuzzy/typo-tolerant search done in-memory over the filtered set
      const candidates = await Product.find(query).sort(sortObj)
      const fuse = new Fuse(candidates, {
        keys: [{ name: 'name', weight: 3 }, { name: 'description', weight: 1 }],
        threshold: 0.4,
        minMatchCharLength: 3,
      })
      const matched = fuse.search(search).map(r => r.item)
      const total = matched.length
      const products = matched.slice(skip, skip + Number(limit))
      return res.json({ products, total, page: Number(page), pages: Math.ceil(total / Number(limit)) })
    }

    const [products, total] = await Promise.all([
      Product.find(query).sort(sortObj).skip(skip).limit(Number(limit)),
      Product.countDocuments(query),
    ])

    res.json({ products, total, page: Number(page), pages: Math.ceil(total / Number(limit)) })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// Sitemap XML — must be registered before GET /:id, or Express matches
// "sitemap.xml" as a product id and 500s trying to cast it to an ObjectId.
router.get('/sitemap.xml', async (req, res) => {
  try {
    const Category = require('../models/Category')
    const [products, cats] = await Promise.all([
      Product.find({ hidden: { $ne: true } }, '_id slug updatedAt').limit(500),
      Category.find({ hidden: { $ne: true } }, 'slug'),
    ])
    const baseUrl = 'https://radhebloom.in'
    const staticPages = ['', '/shop', ...cats.map(c => `/shop/${c.slug}`)]

    const urls = [
      ...staticPages.map(p => `
        <url>
          <loc>${baseUrl}${p}</loc>
          <changefreq>weekly</changefreq>
          <priority>${p === '' ? '1.0' : '0.8'}</priority>
        </url>`),
      ...products.map(p => `
        <url>
          <loc>${baseUrl}/product/${p._id}</loc>
          <lastmod>${new Date(p.updatedAt).toISOString()}</lastmod>
          <changefreq>monthly</changefreq>
          <priority>0.6</priority>
        </url>`),
    ]

    res.header('Content-Type', 'application/xml')
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${urls.join('')}
</urlset>`)
  } catch (err) {
    res.status(500).send('Sitemap error')
  }
})

// GET single product
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
    if (!product || (product.hidden && req.query.includeHidden !== 'true')) {
      return res.status(404).json({ message: 'Product not found' })
    }
    res.json({ product })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST create product (admin)
router.post('/', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' })
    const product = await Product.create(req.body)
    res.status(201).json({ product })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
})

// PUT update product (admin)
router.put('/:id', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' })
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
    if (!product) return res.status(404).json({ message: 'Product not found' })
    res.json({ product })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
})

// DELETE product (admin)
router.delete('/:id', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' })
    await Product.findByIdAndDelete(req.params.id)
    res.json({ message: 'Product deleted' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
