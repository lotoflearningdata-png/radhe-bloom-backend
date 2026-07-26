const router   = require('express').Router()
const Wishlist = require('../models/Wishlist')
const protect  = require('../middleware/auth')

const populate = { path: 'products', select: 'name price originalPrice images category stock rating reviewCount badge colorVariants sizeVariants' }

// GET wishlist
router.get('/', protect, async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({ user: req.user._id }).populate(populate) || { products: [] }
    res.json({ products: wishlist.products })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// TOGGLE product in wishlist
router.post('/toggle', protect, async (req, res) => {
  try {
    const { productId } = req.body
    if (!productId) return res.status(400).json({ message: 'productId is required' })
    let wishlist = await Wishlist.findOne({ user: req.user._id })
    if (!wishlist) wishlist = new Wishlist({ user: req.user._id, products: [] })
    const idx = wishlist.products.findIndex(p => p.toString() === productId)
    if (idx > -1) wishlist.products.splice(idx, 1)
    else wishlist.products.push(productId)
    await wishlist.save()
    await wishlist.populate(populate)
    res.json({ products: wishlist.products })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// REMOVE product
router.delete('/remove/:productId', protect, async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({ user: req.user._id })
    if (!wishlist) return res.status(404).json({ message: 'Wishlist not found' })
    wishlist.products = wishlist.products.filter(p => p.toString() !== req.params.productId)
    await wishlist.save()
    await wishlist.populate(populate)
    res.json({ products: wishlist.products })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

module.exports = router
