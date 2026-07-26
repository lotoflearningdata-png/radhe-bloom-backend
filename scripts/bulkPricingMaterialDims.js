// backend/scripts/bulkPricingMaterialDims.js
//
// One-off catalog update:
//  1. Apply a flat 10% discount to every product — originalPrice = current price,
//     price = 10% off, rounded down to keep the existing ₹X9 charm-pricing pattern.
//  2. Normalize wood/MDF material labels: "Wood"/"Wooden"/"MDF"/"Wooden Mdf"/
//     "MDF Wooden"/"Wood (MDF)" etc. → "Wood" for kids-toys, "Wooden MDF" elsewhere.
//     Composite materials (e.g. "Wooden & Rubber") and blanks are left untouched.
//  3. Correct width/height in `dimensions` from the launch-list sheet, formatted as
//     "{W}W X {H}H CM" (or just "{H}H CM" where the sheet only gives a height).
//     Only applied to products confidently identified from the sheet.
//
// Usage (from the backend/ folder):
//   node scripts/bulkPricingMaterialDims.js

require('dotenv').config()
const mongoose = require('mongoose')
const Product = require('../models/Product')

function discountPrice(price) {
  const raw = price * 0.9
  return Math.floor(raw / 10) * 10 - 1
}

function normalizeMaterial(current, category) {
  if (!current) return null
  const norm = current.trim().toLowerCase().replace(/[()]/g, '').replace(/\s+/g, ' ').trim()
  const WOOD_MDF = new Set(['wood', 'wooden', 'mdf', 'wood mdf', 'mdf wood', 'wooden mdf', 'mdf wooden'])
  if (!WOOD_MDF.has(norm)) return null
  const target = category === 'kids-toys' ? 'Wood' : 'Wooden MDF'
  return target === current ? null : target
}

// name (trimmed) -> new dimensions, sourced from the sheet's Width/Height columns
const DIMENSIONS = {
  'Rass Leela Set Wooden MDF Idol': '2.9W X 3.5H CM',
  'Ganesh & Laxmi Ji MDF Wooden Cutout': '4.5W X 6H CM',
  'Mataki Set for Laddu Gopal (Set of 3 Pcs)': '2W X 2H CM',
  'Haldi Mehndi Shaadi Rangoli Mat': '7.5W X 7.5H CM',
  'Haldi Mehndi Shaadi Readymade Rangoli Mat': '7.5W X 7.5H CM',
  'Animal Toy – Metallic Meena Work (Set of 12)': '1.5W X 1.9H CM',
  'Guitar': '4.2W X 8.2H CM',
  'Jhan Jhan Rattles for Babies': '6H CM',
  'Ball Jhan Jhan Rattles for Babies': '6H CM',
  'Tir Tir Rattles for Babies': '6H CM',
  'Pinjhara Rattles for Babies': '6H CM',
  'Hilna Rattles': '5H CM',
  'Dum Dum Wooden Toy Car': '4.7W X 4.5H CM',
  'Shrinath Ji Wooden MDF Cutout': '8.1W X 10.5H CM',
  'Tic Tac Toe Wood Board Game': '6W X 6H CM',
  '36 Pieces Mini Puzzle Foam ABC Mat for Kids': '10.8W X 7.9H CM',
  'Radha Rani Idol for Home Decor (Radhe Radhe)': '3W X 5.3H CM',
  'Radha Ballabh Lal Ji MDF Cutout': '4.7W X 6H CM',
  'Radha Raman Standard Size MDF Puja Idol': '3.5W X 6H CM',
  'Banke Bihari Standard Size MDF Home Decor Idol': '4.6W X 6H CM',
  'Fiber Dancing Peacock (Set of 2)': '5W X 6.5H CM',
  'Elephants Pair Fiber Statue Designer Showpiece (Set of 2)': '2W X 5H CM',
  'Wooden Designer Pencil for Kids (Set of 5 Pcs)': '8H CM',
  'Ashta Sakha Wooden MDF (Set of 8 Pcs)': '2.2W X 3.5H CM',
  'Krishna Cow Set': '3W X 3H CM',
  'Nav Durga Wooden MDF (Set of 9 Pcs)': '2.6W X 3.8H CM',
  'Radha Krishna Jhula – Wooden MDF Idol': '5W X 6H CM',
  'Premanand Ji Wall Hanging': '11.4W X 19H CM',
  'Vivah Khel Set': '3.9W X 4.2H CM',
  'Krishna Kamal Set': '2.8W X 6H CM',
  'Rasoi Leela Set': '4.9W X 5H CM',
  'Krishna Leela Set': '4.8W X 5.5H CM',
  'Bal Leela Set': '4W X 5.5H CM',
  'Ashta Sakha Gold (Set Of 8 Pcs)': '2.8W X 4H CM',
  'Aashta Sakhi Gold': '2.8W X 4H CM',
  'Gopi Set (16 Pcs)': '1.9W X 4.4H CM',
  'Makhan Chor Leela Set': '3W X 8.2H CM',
  'Baal Krishna Okhla Leela MDF Idol': '4.8W X 5.5H CM',
  'Jail': '6W X 6H CM',
  'Vasudeva Carrying Baby Krishna MDF Idol': '4W X 5.9H CM',
  'Dhai Handi Ladu Gopal – Janmashtami Decoration Toy': '3W X 6.2H CM',
  'Premanand Ji Sanding': '5.8W X 5.8H CM',
  'Ganesh Ji Band Wooden MDF Cutout (Set of 9 Pcs)': '4.9W X 5.9H CM',
  'Golden Multicolor Metal Dancing Peacock': '2.2W X 3.5H CM',
  'Ban Bhojan': '5W X 6H CM',
  'Lord Krishna Hands With Flute': '2.7W X 3H CM',
  'Govardhan Parvat Jhaki Leela Set (Folding)': '11W X 6.5H CM',
  'Chirharan': '4.2W X 5.8H CM',
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI)
  const products = await Product.find({})
  console.log(`Loaded ${products.length} products.\n`)

  const matchedDimNames = new Set()
  let priceCount = 0, materialCount = 0, dimsCount = 0
  const log = []

  for (const p of products) {
    const before = { price: p.price, originalPrice: p.originalPrice, material: p.material, dimensions: p.dimensions }
    const changes = []

    // 1. Discount
    const newOriginal = p.price
    const newPrice = discountPrice(p.price)
    if (newOriginal !== p.originalPrice || newPrice !== p.price) {
      p.originalPrice = newOriginal
      p.price = newPrice
      priceCount++
      changes.push(`price ${before.price}->${newPrice} (MRP ${before.originalPrice}->${newOriginal})`)
    }

    // 2. Material
    const newMaterial = normalizeMaterial(before.material, p.category)
    if (newMaterial) {
      p.material = newMaterial
      materialCount++
      changes.push(`material "${before.material}"->"${newMaterial}"`)
    }

    // 3. Dimensions
    const key = p.name.trim()
    if (Object.prototype.hasOwnProperty.call(DIMENSIONS, key)) {
      matchedDimNames.add(key)
      const newDims = DIMENSIONS[key]
      if (newDims !== before.dimensions) {
        p.dimensions = newDims
        dimsCount++
        changes.push(`dims "${before.dimensions || ''}"->"${newDims}"`)
      }
    }

    if (changes.length) {
      await p.save()
      log.push(`- ${p.name.trim()}\n    ${changes.join('\n    ')}`)
    }
  }

  const unmatched = Object.keys(DIMENSIONS).filter(n => !matchedDimNames.has(n))
  if (unmatched.length) {
    console.log('⚠️  Dimension entries with no matching product (check spelling):')
    unmatched.forEach(n => console.log('   -', n))
    console.log()
  }

  console.log(log.join('\n\n'))
  console.log(`\n✅ Done. Price updated: ${priceCount}, material normalized: ${materialCount}, dimensions corrected: ${dimsCount}`)

  await mongoose.disconnect()
}

main().catch(err => { console.error(err); process.exit(1) })
