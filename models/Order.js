const mongoose = require('mongoose')

const trackingEventSchema = new mongoose.Schema({
  status:      { type: String },
  description: { type: String },
  date:        { type: Date, default: Date.now },
  location:    { type: String },
})

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    qty:     { type: Number, required: true },
    price:   { type: Number, required: true },
  }],
  shippingAddress: {
    name: String, email: String, phone: String,
    address: String, city: String, state: String,
    pincode: String, country: { type: String, default: 'India' },
  },
  total:             { type: Number, required: true },
  status:            { type: String, enum: ['pending','confirmed','processing','shipped','delivered','cancelled'], default: 'pending' },
  paymentMethod:     { type: String, enum: ['razorpay','payoneer','cod'], default: 'razorpay' },
  paymentStatus:     { type: String, enum: ['pending','paid','failed'], default: 'pending' },
  paymentId:         { type: String },
  razorpayOrderId:   { type: String },
  razorpaySignature: { type: String },
  payoneerReference: { type: String },
  shiprocketOrderId: { type: String },
  shipmentId:        { type: String },
  awbCode:           { type: String },
  courierName:       { type: String },
  trackingUrl:       { type: String },
  trackingEvents:    [trackingEventSchema],
  emailSent:         { type: Boolean, default: false },
  isInternational:   { type: Boolean, default: false },
}, { timestamps: true })

module.exports = mongoose.model('Order', orderSchema)