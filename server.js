require('dotenv').config()
const express  = require('express')
const cors     = require('cors')
const mongoose = require('mongoose')
const path     = require('path')

const app = express()

// 1. Define allowed origins (including a regex for Vercel)
const allowedOrigins = [
  'http://localhost:5173',                          // Local Dev
  'http://localhost:3000',                          // Alternative Local
  'https://radhebloom.in',                          // Your main domain
  'https://radhebloom.com',                         // Your other main domain
  /\.vercel\.app$/                                  // ANY Vercel preview URL (Regex)
];

// Middleware
// 2. Configure CORS with dynamic origin check
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);

    // Check if origin matches any string or regex in the allowedOrigins array
    const isAllowed = allowedOrigins.some((allowed) => {
      if (allowed instanceof RegExp) {
        return allowed.test(origin);
      }
      return allowed === origin;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      console.error(`🚫 CORS blocked for origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
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


