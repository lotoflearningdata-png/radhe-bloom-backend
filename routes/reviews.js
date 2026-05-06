// File: backend/routes/reviews.js

const router  = require('express').Router()
const Review  = require('../models/Review')
const Order   = require('../models/Order')
const protect = require('../middleware/auth')

// Check if user can review a product (must have ordered it)
router.get('/can-review/:productId', protect, async (req, res) => {
  try {
    const { productId } = req.params

    // Check if user has a delivered order with this product
    const order = await Order.findOne({
      user:   req.user._id,
      status: 'delivered',
      'items.product': productId,
    })

    // Check if already reviewed
    const existing = await Review.findOne({
      user:    req.user._id,
      product: productId,
    })

    res.json({
      canReview:    !!order && !existing,
      hasOrdered:   !!order,
      hasReviewed:  !!existing,
      orderId:      order?._id,
      existingReview: existing,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// Submit a review
router.post('/', protect, async (req, res) => {
  try {
    const { productId, orderId, rating, title, comment } = req.body

    if (!productId || !rating) return res.status(400).json({ message: 'Product and rating are required' })
    if (rating < 1 || rating > 5) return res.status(400).json({ message: 'Rating must be between 1 and 5' })

    // Verify user has ordered this product
    const order = await Order.findOne({
      _id:             orderId,
      user:            req.user._id,
      'items.product': productId,
    })
    if (!order) return res.status(403).json({ message: 'You can only review products you have ordered' })

    // Check if already reviewed
    const existing = await Review.findOne({ user: req.user._id, product: productId })
    if (existing) return res.status(400).json({ message: 'You have already reviewed this product' })

    const review = await Review.create({
      product: productId,
      user:    req.user._id,
      order:   orderId,
      rating,
      title,
      comment,
    })

    await review.populate('user', 'name')
    res.status(201).json({ review, message: 'Review submitted successfully!' })
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'You have already reviewed this product' })
    res.status(500).json({ message: err.message })
  }
})

// Get all reviews for a product
router.get('/product/:productId', async (req, res) => {
  try {
    const reviews = await Review.find({ product: req.params.productId })
      .populate('user', 'name')
      .sort({ createdAt: -1 })
    const avgRating = reviews.length
      ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
      : 0
    res.json({ reviews, avgRating: Number(avgRating), total: reviews.length })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// Delete a review (admin or own)
router.delete('/:id', protect, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id)
    if (!review) return res.status(404).json({ message: 'Review not found' })
    if (review.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' })
    }
    await review.deleteOne()
    res.json({ message: 'Review deleted' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router