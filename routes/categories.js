const router = require('express').Router()
const Category = require('../models/Category')
const Product = require('../models/Product')
const protect = require('../middleware/auth')

// One-time seed of the categories that used to be hardcoded (runs on first boot
// against an empty collection; mongoose buffers this until the DB connects)
const DEFAULTS = [
  { name: 'Janmashtami',         slug: 'janmashtami' },
  { name: 'Divine Idols',        slug: 'divine-idols' },
  { name: 'Wooden MDF Idols',    slug: 'wooden-mdf-idols' },
  { name: 'Festive Sets',        slug: 'festive-sets' },
  { name: 'Home Décor',          slug: 'home-decor' },
  { name: 'Candles & Fragrance', slug: 'candles' },
  { name: 'Gift Sets',           slug: 'gift-sets' },
  { name: 'Kids & Toys',         slug: 'kids-toys' },
  { name: 'Rangoli & Decor',     slug: 'rangoli' },
  { name: 'Summer Collection',   slug: 'summer', hidden: true },
]
Category.estimatedDocumentCount()
  .then(count => {
    if (count === 0) {
      return Category.insertMany(DEFAULTS.map((c, i) => ({ ...c, order: i })))
        .then(() => console.log('✅ Seeded default categories'))
    }
  })
  .catch(err => console.error('⚠️ Category seed check failed:', err.message))

// GET all categories (public). ?includeHidden=true shows hidden ones,
// ?counts=true adds productCount per category (for the admin page)
router.get('/', async (req, res) => {
  try {
    const filter = req.query.includeHidden === 'true' ? {} : { hidden: { $ne: true } }
    let categories = await Category.find(filter).sort({ order: 1, createdAt: 1 })

    if (req.query.counts === 'true') {
      categories = await Promise.all(categories.map(async c => ({
        ...c.toObject(),
        productCount: await Product.countDocuments({ $or: [{ category: c.slug }, { categories: c.slug }] }),
      })))
    }

    res.json({ categories })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST create category (admin)
router.post('/', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' })
    const category = await Category.create({ name: req.body.name, hidden: !!req.body.hidden })
    res.status(201).json({ category })
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'A category with this name already exists' })
    res.status(400).json({ message: err.message })
  }
})

// PUT update category — name, hidden, order (admin). Slug stays stable so
// existing links and products keep working.
router.put('/:id', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' })
    const updates = {}
    if (req.body.name !== undefined) updates.name = req.body.name
    if (req.body.hidden !== undefined) updates.hidden = req.body.hidden
    if (req.body.order !== undefined) updates.order = req.body.order
    const category = await Category.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true })
    if (!category) return res.status(404).json({ message: 'Category not found' })
    res.json({ category })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
})

// DELETE category (admin) — blocked while products still use it
router.delete('/:id', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' })
    const category = await Category.findById(req.params.id)
    if (!category) return res.status(404).json({ message: 'Category not found' })
    const inUse = await Product.countDocuments({ $or: [{ category: category.slug }, { categories: category.slug }] })
    if (inUse > 0) {
      return res.status(400).json({ message: `${inUse} product(s) still use this category. Move them to another category first, or hide this category instead.` })
    }
    await category.deleteOne()
    res.json({ message: 'Category deleted' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
