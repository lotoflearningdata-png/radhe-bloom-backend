const mongoose = require('mongoose')

// Atomic sequence counter, e.g. one per financial year for invoice numbers
const counterSchema = new mongoose.Schema({
  _id: { type: String },
  seq: { type: Number, default: 0 },
})

module.exports = mongoose.model('Counter', counterSchema)
