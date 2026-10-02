// backend/models/Settings.js
// Singleton document holding site-wide homepage settings editable from the admin panel.
const mongoose = require('mongoose')

const settingsSchema = new mongoose.Schema({
  navDurgaHeroImage: { type: String, default: '' },
  // Legacy key — the seasonal hero used to be Janmashtami. Kept so an image
  // pinned before the switch isn't lost; migrated on first read below.
  janmashtamiHeroImage: { type: String, default: '' },
}, { timestamps: true })

module.exports = mongoose.model('Settings', settingsSchema)
