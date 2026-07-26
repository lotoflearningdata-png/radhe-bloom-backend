// backend/scripts/setWoodHsn.js
// Set hsnCode = 4411 for all MDF / wood / wooden products.
//
// Usage (from the backend/ folder):
//   node scripts/setWoodHsn.js

require('dotenv').config()
const mongoose = require('mongoose')
const Product = require('../models/Product')

const MATCH = /mdf|\bwood(en)?\b/i

async function main() {
  await mongoose.connect(process.env.MONGO_URI)

  const products = await Product.find({
    $or: [
      { name: MATCH },
      { description: MATCH },
      { material: MATCH },
      { category: MATCH },
      { categories: MATCH },
    ],
  }).select('name material category hsnCode')

  if (products.length === 0) {
    console.log('No matching MDF/wood/wooden products found.')
  } else {
    console.log(`Found ${products.length} matching product(s):\n`)
    for (const p of products) {
      console.log(`- ${p.name} | material: ${p.material || '-'} | category: ${p.category} | current hsnCode: ${p.hsnCode || '-'}`)
    }

    const ids = products.map(p => p._id)
    const result = await Product.updateMany({ _id: { $in: ids } }, { hsnCode: '4411' })
    console.log(`\n✅ Updated ${result.modifiedCount} product(s) to hsnCode = 4411`)
  }

  await mongoose.disconnect()
}

main().catch(err => { console.error(err.message); process.exit(1) })
