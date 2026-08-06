// backend/scripts/fixDiscountRounding.js
//
// One-off correction: bulkPricingMaterialDims.js originally floored every
// discounted price down to the nearest ₹X9 charm price, which pushed the
// effective discount above 10% (up to ~15.5%) for cheaper products. This
// recomputes `price` from the stored `originalPrice` as true 10% off,
// rounded to the nearest half rupee (no charm-pricing pattern).
//
// Usage (from the backend/ folder):
//   node scripts/fixDiscountRounding.js        # dry run, prints changes
//   node scripts/fixDiscountRounding.js --apply  # actually writes changes

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

  const products = await Product.find({ originalPrice: { $exists: true, $ne: null } })

  let changed = 0
  for (const p of products) {
    // Skip products with no live discount (price === originalPrice) — not part
    // of the over-discounting bug, and correcting them would newly discount
    // items that aren't currently marked down at all.
    if (!p.originalPrice || p.price === p.originalPrice) continue
    const newPrice = discountPrice(p.originalPrice)
    if (newPrice !== p.price) {
      const oldDiscount = ((p.originalPrice - p.price) / p.originalPrice * 100).toFixed(2)
      const newDiscount = ((p.originalPrice - newPrice) / p.originalPrice * 100).toFixed(2)
      console.log(`${p.name}: price ${p.price} -> ${newPrice} (MRP ${p.originalPrice}), discount ${oldDiscount}% -> ${newDiscount}%`)
      if (apply) {
        p.price = newPrice
        await p.save()
      }
      changed++
    }
  }

  console.log(`\n${apply ? 'Updated' : 'Would update'} ${changed} of ${products.length} discounted products.`)
  await mongoose.disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
