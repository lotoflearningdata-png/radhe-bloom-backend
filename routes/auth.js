// backend/routes/auth.js
const router   = require('express').Router()
const jwt      = require('jsonwebtoken')
const bcrypt   = require('bcryptjs')
const crypto   = require('crypto')
const { OAuth2Client } = require('google-auth-library')
const User     = require('../models/User')
const protect  = require('../middleware/auth')

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

// ── Helpers ───────────────────────────────────────────────────────
const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '30d' })

const userResponse = (user) => ({
  _id: user._id, name: user.name, email: user.email,
  phone: user.phone, role: user.role, avatar: user.avatar,
  authProvider: user.authProvider,
})

// ══════════════════════════════════════════════════════════════════
// REGISTER (email + password) — no phone required anymore
// ══════════════════════════════════════════════════════════════════
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' })
    }

    const exists = await User.findOne({ email: email.toLowerCase() })
    if (exists) return res.status(400).json({ message: 'Email already registered' })

    const hashed = await bcrypt.hash(password, 12)
    const user   = await User.create({
      name, email: email.toLowerCase(), password: hashed, authProvider: 'local',
    })
    const token  = signToken(user._id)

    // Send welcome email (non-blocking)
    try {
      const { sendWelcomeEmail } = require('../services/email')
      sendWelcomeEmail(user).catch(err => console.error('Welcome email failed:', err.message))
    } catch {}

    res.status(201).json({ token, user: userResponse(user) })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ══════════════════════════════════════════════════════════════════
// LOGIN (email + password)
// ══════════════════════════════════════════════════════════════════
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' })

    const user = await User.findOne({ email: email.toLowerCase() })
    if (!user) return res.status(401).json({ message: 'Invalid email or password' })

    if (user.authProvider === 'google' && !user.password) {
      return res.status(401).json({ message: 'This account uses Google Sign-In. Please continue with Google.' })
    }

    const match = await bcrypt.compare(password, user.password)
    if (!match) return res.status(401).json({ message: 'Invalid email or password' })

    const token = signToken(user._id)
    res.json({ token, user: userResponse(user) })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ══════════════════════════════════════════════════════════════════
// GOOGLE SIGN-IN
// ══════════════════════════════════════════════════════════════════
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body
    if (!credential) return res.status(400).json({ message: 'Google credential is required' })

    // Verify the token with Google
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    })
    const payload = ticket.getPayload()
    const { sub: googleId, email, name, picture } = payload

    if (!email) return res.status(400).json({ message: 'Could not retrieve email from Google' })

    // Find existing user by googleId or email
    let user = await User.findOne({ $or: [{ googleId }, { email: email.toLowerCase() }] })

    if (user) {
      // Link Google to existing account if not already linked
      if (!user.googleId) {
        user.googleId = googleId
        user.authProvider = user.authProvider === 'local' ? 'local' : 'google' // keep local if they have a password
        user.avatar = user.avatar || picture
        await user.save()
      }
    } else {
      // Create new user via Google
      user = await User.create({
        name,
        email: email.toLowerCase(),
        googleId,
        authProvider: 'google',
        avatar: picture,
      })

      // Send welcome email
      try {
        const { sendWelcomeEmail } = require('../services/email')
        sendWelcomeEmail(user).catch(err => console.error('Welcome email failed:', err.message))
      } catch {}
    }

    const token = signToken(user._id)
    res.json({ token, user: userResponse(user) })
  } catch (err) {
    console.error('Google auth error:', err.message)
    res.status(401).json({ message: 'Google sign-in failed. Please try again.' })
  }
})

// ══════════════════════════════════════════════════════════════════
// FORGOT PASSWORD — Step 1: Request reset link
// ══════════════════════════════════════════════════════════════════
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ message: 'Email is required' })

    const user = await User.findOne({ email: email.toLowerCase() })

    // Always respond success even if user not found (prevents email enumeration)
    if (!user) {
      return res.json({ message: 'If an account exists with this email, a reset link has been sent.' })
    }

    if (user.authProvider === 'google' && !user.password) {
      return res.status(400).json({ message: 'This account uses Google Sign-In. Please continue with Google to log in.' })
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex')
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex')

    user.resetPasswordToken   = hashedToken
    user.resetPasswordExpires = Date.now() + 30 * 60 * 1000 // 30 minutes
    await user.save()

    // Send reset email
    try {
      const { sendPasswordResetEmail } = require('../services/email')
      const resetUrl = `${process.env.FRONTEND_URL || 'https://radhebloom.in'}/reset-password/${resetToken}`
      await sendPasswordResetEmail(user, resetUrl)
      console.log('✅ Password reset email sent to', user.email)
    } catch (err) {
      console.error('⚠️ Reset email failed:', err.message)
      user.resetPasswordToken   = undefined
      user.resetPasswordExpires = undefined
      await user.save()
      return res.status(500).json({ message: 'Failed to send reset email. Please try again.' })
    }

    res.json({ message: 'If an account exists with this email, a reset link has been sent.' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ══════════════════════════════════════════════════════════════════
// FORGOT PASSWORD — Step 2: Reset password with token
// ══════════════════════════════════════════════════════════════════
router.post('/reset-password/:token', async (req, res) => {
  try {
    const { token } = req.params
    const { password } = req.body

    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' })
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    })

    if (!user) {
      return res.status(400).json({ message: 'Reset link is invalid or has expired. Please request a new one.' })
    }

    user.password = await bcrypt.hash(password, 12)
    user.resetPasswordToken   = undefined
    user.resetPasswordExpires = undefined
    user.authProvider = 'local' // they now have a password, can use email login
    await user.save()

    res.json({ message: 'Password reset successfully. You can now log in.' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ══════════════════════════════════════════════════════════════════
// VALIDATE RESET TOKEN — used by frontend before showing the form
// ══════════════════════════════════════════════════════════════════
router.get('/reset-password/:token/validate', async (req, res) => {
  try {
    const { token } = req.params
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    })

    res.json({ valid: !!user })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ══════════════════════════════════════════════════════════════════
// GET CURRENT USER
// ══════════════════════════════════════════════════════════════════
router.get('/me', protect, async (req, res) => {
  res.json({ user: req.user })
})

// ══════════════════════════════════════════════════════════════════
// UPDATE PROFILE (including phone — collected at checkout)
// ══════════════════════════════════════════════════════════════════
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

// ══════════════════════════════════════════════════════════════════
// GET ALL USERS (admin)
// ══════════════════════════════════════════════════════════════════
router.get('/users', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' })
    const users = await User.find({}, '-password').sort({ createdAt: -1 })
    res.json({ users })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router