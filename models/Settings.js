// backend/models/Settings.js
// Singleton document holding site-wide homepage settings editable from the admin panel.
const mongoose = require('mongoose')

const settingsSchema = new mongoose.Schema({
  janmashtamiHeroImage: { type: String, default: '' },
}, { timestamps: true })

module.exports = mongoose.model('Settings', settingsSchema)
