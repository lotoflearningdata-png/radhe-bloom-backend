// backend/routes/contact.js
const router  = require('express').Router()
const Contact = require('../models/Contact')
const protect = require('../middleware/auth')

// Submit contact form — sends email alert to admin
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body
    if (!name || !email || !message) {
      return res.status(400).json({ message: 'Name, email and message are required' })
    }

    // Save to DB
    const contact = await Contact.create({ name, email, phone, subject, message })

    // Send email to admin (non-blocking)
    try {
      const { sendContactAlert } = require('../services/email')
      sendContactAlert(contact).catch(err => console.error('Contact alert failed:', err.message))
    } catch {}

    res.status(201).json({ message: 'Message sent successfully', id: contact._id })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// Get all contacts (admin)
router.get('/', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' })
    const contacts = await Contact.find().sort({ createdAt: -1 })
    res.json({ contacts })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// Update status (admin)
router.put('/:id/status', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' })
    const contact = await Contact.findByIdAndUpdate(
      req.params.id, { status: req.body.status }, { new: true }
    )
    res.json({ contact })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router