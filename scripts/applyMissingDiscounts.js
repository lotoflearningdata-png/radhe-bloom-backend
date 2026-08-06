// backend/scripts/applyMissingDiscounts.js
//
// One-off: apply the standard 10% discount to the handful of products that
// currently have no live discount — either missing `originalPrice` entirely,
// or `originalPrice` equal to `price`. Sets/keeps originalPrice as the MRP
// and computes price as true 10% off, rounded to the nearest half rupee.
//
// Usage (from the backend/ folder):
//   node scripts/applyMissingDiscounts.js        # dry run, prints changes
//   node scripts/applyMissingDiscounts.js --apply  # actually writes changes

require('dotenv').config()
const mongoose = require('mongoose')
const Product = require('../models/Product')

function discountPrice(price) {
  const raw = price * 0.9
  return Math.round(raw * 2) / 2
}

async function main() {
  const apply = process.argv.includes('--apply')

  await mongoose.connect(process.env.MONGO_URI)

  const products = await Product.find({
    $or: [
      { originalPrice: { $exists: false } },
      { originalPrice: null },
      { $expr: { $eq: ['$price', '$originalPrice'] } },
    ],
  })

  let changed = 0
  for (const p of products) {
    const mrp = p.originalPrice || p.price
    const newPrice = discountPrice(mrp)
    console.log(`${p.name}: originalPrice ${p.originalPrice ?? '(none)'} -> ${mrp}, price ${p.price} -> ${newPrice}`)
    if (apply) {
      p.originalPrice = mrp
      p.price = newPrice
      await p.save()
    }
    changed++
  }

  console.log(`\n${apply ? 'Updated' : 'Would update'} ${changed} products.`)
  await mongoose.disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
