const router   = require('express').Router()
const Settings = require('../models/Settings')
const protect  = require('../middleware/auth')

async function getSingleton() {
  let doc = await Settings.findOne()
  if (!doc) doc = await Settings.create({})
  return doc
}

// PUBLIC — read site settings (used by the homepage)
router.get('/', async (req, res) => {
  try {
    const settings = await getSingleton()
    res.json({ settings })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ADMIN — update site settings
router.put('/', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' })
    const settings = await getSingleton()
    if (req.body.janmashtamiHeroImage !== undefined) {
      settings.janmashtamiHeroImage = req.body.janmashtamiHeroImage
    }
    await settings.save()
    res.json({ settings })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
