// backend/models/User.js
const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
  name:     { type: String, required: true },
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String }, // not required — Google users won't have one
  phone:    { type: String }, // collected at checkout, not at signup
  role:     { type: String, enum: ['user', 'admin'], default: 'user' },

  // Google OAuth
  googleId: { type: String },
  authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
  avatar:   { type: String },

  // Password reset
  resetPasswordToken:   { type: String },
  resetPasswordExpires: { type: Date },

}, { timestamps: true })

module.exports = mongoose.model('User', userSchema)