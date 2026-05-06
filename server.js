require('dotenv').config()
const express  = require('express')
const cors     = require('cors')
const mongoose = require('mongoose')
const path     = require('path')

const app = express()

// Middleware
app.use(cors({ origin: process.env.NODE_ENV === 'production' ? 'https://yourdomain.com' : 'http://localhost:5173', credentials: true }))
app.use(express.json())

// DB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => { console.error('❌ MongoDB error:', err); process.exit(1) })

// Routes
app.use('/api/auth',     require('./routes/auth'))
app.use('/api/products', require('./routes/products'))
app.use('/api/cart',     require('./routes/cart'))
app.use('/api/orders',   require('./routes/orders'))

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', message: '🌸 Radhe Bloom API running' }))

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')))
  app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../frontend/dist/index.html')))
}


const PORT = process.env.PORT || 5000
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`))

// Robots.txt
app.get('/robots.txt', (req, res) => {
  res.type('text/plain')
  res.send(`User-agent: *
Allow: /
Disallow: /api/
Disallow: /checkout
Disallow: /orders

Sitemap: https://radhebloom.in/sitemap.xml`)
})


