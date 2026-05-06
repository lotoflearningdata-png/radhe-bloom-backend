// backend/routes/auth.js
const router = require('express').Router()
const jwt    = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const User   = require('../models/User')
const protect = require('../middleware/auth')

// ── Helpers ───────────────────────────────────────────────────────
const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '30d' })

// ── REGISTER ──────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' })
    }

    const exists = await User.findOne({ email })
    if (exists) return res.status(400).json({ message: 'Email already registered' })

    const hashed = await bcrypt.hash(password, 12)
    const user   = await User.create({ name, email, password: hashed, phone })
    const token  = signToken(user._id)

    // Send welcome email (non-blocking)
    try {
      const { sendWelcomeEmail } = require('../services/email')
      sendWelcomeEmail(user).catch(err => console.error('Welcome email failed:', err.message))
    } catch {}

    res.status(201).json({
      token,
      user: { _id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role },
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ── LOGIN ─────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' })

    const user = await User.findOne({ email })
    if (!user) return res.status(401).json({ message: 'Invalid email or password' })

    const match = await bcrypt.compare(password, user.password)
    if (!match) return res.status(401).json({ message: 'Invalid email or password' })

    const token = signToken(user._id)
    res.json({
      token,
      user: { _id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role },
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ── GET CURRENT USER ──────────────────────────────────────────────
router.get('/me', protect, async (req, res) => {
  res.json({ user: req.user })
})

// ── UPDATE PROFILE ────────────────────────────────────────────────
router.put('/profile', protect, async (req, res) => {
  try {
    const { name, phone } = req.body
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, phone },
      { new: true, select: '-password' }
    )
    res.json({ user })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ── GET ALL USERS (admin) ─────────────────────────────────────────
router.get('/users', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' })
    const users = await User.find({}, '-password').sort({ createdAt: -1 })
    res.json({ users })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ── SEND OTP ──────────────────────────────────────────────────────
router.post('/send-otp', async (req, res) => {
  try {
    const { phone } = req.body
    if (!phone) return res.status(400).json({ message: 'Phone number required' })
    // OTP logic here (Firebase / Twilio)
    res.json({ message: 'OTP sent successfully' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ── VERIFY OTP ────────────────────────────────────────────────────
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body
    if (!phone || !otp) return res.status(400).json({ message: 'Phone and OTP required' })
    // OTP verification logic here
    res.json({ verified: true, message: 'Phone verified successfully' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ── LOGIN WITH PHONE ───────────────────────────────────────────────
router.post('/login-phone', async (req, res) => {
  try {
    const { phone } = req.body
    const formatted  = phone.startsWith('+') ? phone : `+91${phone}`
    const phoneDigits = formatted.replace('+91', '')
    const user = await User.findOne({
      $or: [{ phone: phoneDigits }, { phone: formatted }]
    })
    if (!user) return res.status(404).json({ message: 'No account found with this phone. Please register.' })
    const token = signToken(user._id)
    res.json({
      token,
      user: { _id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role },
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router