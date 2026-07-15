const router  = require('express').Router()
const Cart    = require('../models/Cart')
const protect = require('../middleware/auth')

const populate = { path: 'items.product', select: 'name price originalPrice images category stock' }

// GET cart
router.get('/', protect, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id }).populate(populate) || { items: [] }
    res.json({ items: cart.items })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// ADD to cart
router.post('/add', protect, async (req, res) => {
  try {
    const { productId, qty = 1, color } = req.body
    let cart = await Cart.findOne({ user: req.user._id })
    if (!cart) cart = new Cart({ user: req.user._id, items: [] })
    const idx = cart.items.findIndex(i => i.product.toString() === productId && (i.color || '') === (color || ''))
    if (idx > -1) cart.items[idx].qty += qty
    else cart.items.push({ product: productId, qty, color: color || undefined })
    await cart.save()
    await cart.populate(populate)
    res.json({ items: cart.items })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// UPDATE qty
router.put('/update', protect, async (req, res) => {
  try {
    const { productId, qty, color } = req.body
    const cart = await Cart.findOne({ user: req.user._id })
    if (!cart) return res.status(404).json({ message: 'Cart not found' })
    const idx = cart.items.findIndex(i => i.product.toString() === productId && (i.color || '') === (color || ''))
    if (idx > -1) {
      if (qty < 1) cart.items.splice(idx, 1)
      else cart.items[idx].qty = qty
    }
    await cart.save()
    await cart.populate(populate)
    res.json({ items: cart.items })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// REMOVE item
router.delete('/remove/:productId', protect, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id })
    if (!cart) return res.status(404).json({ message: 'Cart not found' })
    const color = req.query.color || ''
    cart.items = cart.items.filter(i => !(i.product.toString() === req.params.productId && (i.color || '') === color))
    await cart.save()
    await cart.populate(populate)
    res.json({ items: cart.items })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// CLEAR cart
router.delete('/clear', protect, async (req, res) => {
  try {
    await Cart.findOneAndUpdate({ user: req.user._id }, { items: [] })
    res.json({ items: [] })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

module.exports = router
