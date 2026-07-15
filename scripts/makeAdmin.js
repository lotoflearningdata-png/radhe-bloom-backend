// backend/scripts/makeAdmin.js
// Promote a user to admin (or demote back to user).
//
// Usage (from the backend/ folder):
//   node scripts/makeAdmin.js someone@example.com
//   node scripts/makeAdmin.js someone@example.com user   ← demote back

require('dotenv').config()
const mongoose = require('mongoose')
const User = require('../models/User')

async function main() {
  const email = process.argv[2]
  const role  = process.argv[3] || 'admin'

  if (!email) {
    console.log('Usage: node scripts/makeAdmin.js <email> [admin|user]')
    process.exit(1)
  }
  if (!['admin', 'user'].includes(role)) {
    console.log('Role must be "admin" or "user"')
    process.exit(1)
  }

  await mongoose.connect(process.env.MONGO_URI)

  const user = await User.findOneAndUpdate(
    { email: email.toLowerCase() },
    { role },
    { new: true }
  )

  if (!user) {
    console.log(`❌ No user found with email: ${email}`)
  } else {
    console.log(`✅ ${user.name} (${user.email}) is now: ${user.role}`)
  }

  await mongoose.disconnect()
}

main().catch(err => { console.error(err.message); process.exit(1) })
