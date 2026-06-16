// backend/services/email.js
// Complete email automation for Radhe Bloom

const nodemailer = require('nodemailer')

// ── TRANSPORTER ──────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host:   'smtp.gmail.com',
  port:   587,
  secure: false, // TLS not SSL
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
})

// ── BASE TEMPLATE ─────────────────────────────────────────────────
function baseTemplate(content, title = 'Radhe Bloom') {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f9f3e7;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:600px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(249,127,10,0.12);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1a0a00,#3d1f0a);padding:32px 40px;text-align:center;">
      <h1 style="color:#f97f0a;margin:0;font-size:28px;letter-spacing:1px;">🌸 Radhe Bloom</h1>
      <p style="color:#d09650;margin:6px 0 0;font-size:12px;letter-spacing:3px;text-transform:uppercase;">Divine Creations from Mathura</p>
    </div>

    <!-- Content -->
    <div style="padding:36px 40px;">
      ${content}
    </div>

    <!-- Footer -->
    <div style="background:#1a0a00;padding:20px 40px;text-align:center;">
      <p style="color:#f97f0a;margin:0 0 6px;font-size:13px;">🌸 Radhe Bloom</p>
      <p style="color:#d09650;margin:0;font-size:11px;">
        <a href="tel:+919528078217" style="color:#d09650;text-decoration:none;">+91-9528078217</a>
        &nbsp;|&nbsp;
        <a href="mailto:hello@radhebloom.in" style="color:#d09650;text-decoration:none;">hello@radhebloom.in</a>
        &nbsp;|&nbsp; Mathura, UP
      </p>
      <p style="color:#78340b;margin:8px 0 0;font-size:10px;">© ${new Date().getFullYear()} Radhe Bloom. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`
}

// ── HELPER: Items Table ────────────────────────────────────────────
function itemsTable(items = []) {
  const rows = items.map(item => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #f3e5cc;">
        <strong style="color:#3d1f0a;font-size:13px;">${item.product?.name || 'Product'}</strong><br/>
        <span style="color:#888;font-size:11px;">${item.product?.category?.replace(/-/g,' ') || ''}</span>
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #f3e5cc;text-align:center;color:#3d1f0a;font-size:13px;">×${item.qty}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f3e5cc;text-align:right;color:#e06200;font-weight:bold;font-size:13px;">₹${(item.price * item.qty).toFixed(2)}</td>
    </tr>`).join('')

  return `
    <table style="width:100%;border-collapse:collapse;margin:16px 0;border-radius:12px;overflow:hidden;">
      <thead>
        <tr style="background:#fff8f0;">
          <th style="padding:10px 12px;text-align:left;color:#e06200;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Product</th>
          <th style="padding:10px 12px;text-align:center;color:#e06200;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Qty</th>
          <th style="padding:10px 12px;text-align:right;color:#e06200;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Amount</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`
}

// ── HELPER: Order ID Badge ─────────────────────────────────────────
function orderBadge(orderId) {
  return `<div style="background:#fff8f0;border:1px solid #ffdba3;border-radius:10px;padding:12px 16px;margin:16px 0;display:inline-block;">
    <p style="margin:0;color:#e06200;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;">Order ID</p>
    <p style="margin:4px 0 0;color:#3d1f0a;font-size:13px;font-family:monospace;">${orderId}</p>
  </div>`
}

// ── HELPER: Address Block ──────────────────────────────────────────
function addressBlock(addr) {
  if (!addr) return ''
  return `<div style="background:#f9f3e7;border-radius:10px;padding:14px 16px;margin:16px 0;">
    <p style="margin:0 0 6px;color:#e06200;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;">Shipping To</p>
    <p style="margin:0;color:#3d1f0a;font-size:13px;line-height:1.7;">
      ${addr.name}<br/>${addr.address}<br/>
      ${addr.city}, ${addr.state} - ${addr.pincode}<br/>
      📞 ${addr.phone}
    </p>
  </div>`
}

// ── HELPER: CTA Button ─────────────────────────────────────────────
function ctaButton(text, url) {
  return `<div style="text-align:center;margin:24px 0;">
    <a href="${url}" style="background:#f97f0a;color:#fff;padding:14px 32px;border-radius:50px;text-decoration:none;font-weight:bold;font-size:14px;display:inline-block;">${text}</a>
  </div>`
}

// ── HELPER: WhatsApp Button ────────────────────────────────────────
function whatsappButton(orderId = '') {
  const msg = orderId ? `Hi%2C%20my%20order%20ID%20is%20${orderId}` : 'Hi%20Radhe%20Bloom'
  return `<div style="text-align:center;margin:16px 0;">
    <a href="https://wa.me/919528078217?text=${msg}" style="background:#25D366;color:#fff;padding:12px 28px;border-radius:50px;text-decoration:none;font-weight:bold;font-size:13px;display:inline-block;">💬 WhatsApp Us for Help</a>
  </div>`
}

// ══════════════════════════════════════════════════════════════════
// 1. WELCOME EMAIL — sent on registration
// ══════════════════════════════════════════════════════════════════
async function sendWelcomeEmail(user) {
  const content = `
    <h2 style="color:#3d1f0a;font-size:24px;margin:0 0 8px;">Welcome to Radhe Bloom! 🙏</h2>
    <p style="color:#888;font-size:14px;margin:0 0 24px;">Your divine shopping journey begins here.</p>

    <p style="color:#3d1f0a;font-size:15px;">Dear <strong>${user.name}</strong>,</p>
    <p style="color:#555;font-size:14px;line-height:1.7;">
      We're delighted to welcome you to the Radhe Bloom family! You now have access to our complete collection of
      handcrafted Krishna idols, MDF cutouts, festive sets, candles, gift hampers and much more — all crafted
      with devotion from the heart of Mathura.
    </p>

    <div style="background:#fff8f0;border-left:4px solid #f97f0a;padding:16px 20px;border-radius:8px;margin:24px 0;">
      <p style="margin:0;color:#e06200;font-weight:bold;font-size:14px;">✨ What's waiting for you:</p>
      <ul style="margin:10px 0 0;padding-left:20px;color:#555;font-size:13px;line-height:2;">
        <li>500+ handcrafted divine products</li>
        <li>Free shipping on orders above ₹499</li>
        <li>Retail & wholesale pricing available</li>
        <li>7-day easy returns</li>
      </ul>
    </div>

    ${ctaButton('🛕 Start Shopping', 'https://radhebloom.in/shop')}

    <p style="color:#888;font-size:13px;text-align:center;margin-top:8px;">
      Questions? <a href="https://wa.me/919528078217" style="color:#f97f0a;">WhatsApp us</a> anytime!
    </p>`

  await transporter.sendMail({
    from:    `"Radhe Bloom 🌸" <${process.env.EMAIL_USER}>`,
    to:      user.email,
    subject: `Welcome to Radhe Bloom, ${user.name}! 🌸`,
    html:    baseTemplate(content, 'Welcome to Radhe Bloom'),
  })
  console.log('✅ Welcome email sent to', user.email)
}

// ══════════════════════════════════════════════════════════════════
// 2. ORDER CONFIRMATION — sent after payment verified
// ══════════════════════════════════════════════════════════════════
async function sendOrderConfirmation(order, invoiceBuffer = null) {
  const shipping = order.total - (order.items || []).reduce((s, i) => s + i.price * i.qty, 0)
  const content = `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="width:64px;height:64px;background:#f0fdf4;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:28px;">✅</div>
      <h2 style="color:#3d1f0a;font-size:24px;margin:12px 0 4px;">Order Confirmed!</h2>
      <p style="color:#888;font-size:14px;margin:0;">Your divine order has been placed successfully 🙏</p>
    </div>

    <p style="color:#3d1f0a;font-size:15px;">Dear <strong>${order.shippingAddress?.name}</strong>,</p>
    <p style="color:#555;font-size:14px;line-height:1.7;">
      Thank you for your order! We've received your payment and will start preparing your divine items right away.
    </p>

    ${orderBadge(order._id)}
    ${itemsTable(order.items || [])}

    <table style="width:100%;margin-top:8px;">
      <tr><td style="color:#888;font-size:13px;padding:4px 0;">Subtotal</td><td style="text-align:right;color:#3d1f0a;font-size:13px;">₹${((order.items || []).reduce((s, i) => s + i.price * i.qty, 0)).toFixed(2)}</td></tr>
      <tr><td style="color:#888;font-size:13px;padding:4px 0;">Shipping</td><td style="text-align:right;color:#22c55e;font-size:13px;font-weight:bold;">${order.total >= 499 ? 'FREE' : '₹49'}</td></tr>
      <tr style="border-top:2px solid #ffdba3;"><td style="color:#3d1f0a;font-size:15px;font-weight:bold;padding-top:8px;">Total</td><td style="text-align:right;color:#f97f0a;font-size:18px;font-weight:bold;padding-top:8px;">₹${order.total?.toFixed(2)}</td></tr>
    </table>

    ${addressBlock(order.shippingAddress)}

    ${order.awbCode ? `
    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:14px 16px;margin:16px 0;">
      <p style="margin:0 0 6px;color:#16a34a;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;">📦 Tracking Info</p>
      <p style="margin:0;color:#3d1f0a;font-size:13px;">AWB: <strong>${order.awbCode}</strong> | Courier: ${order.courierName}</p>
    </div>` : ''}

    ${invoiceBuffer ? '<p style="color:#555;font-size:13px;text-align:center;">📎 Your invoice is attached to this email.</p>' : ''}

    ${whatsappButton(order._id)}

    <p style="color:#888;font-size:12px;text-align:center;">We'll send you another email once your order is shipped.</p>`

  const mailOptions = {
    from:    `"Radhe Bloom 🌸" <${process.env.EMAIL_USER}>`,
    to:      order.shippingAddress?.email,
    subject: `✅ Order Confirmed #${order._id?.toString().slice(-8).toUpperCase()} – Radhe Bloom`,
    html:    baseTemplate(content, 'Order Confirmed'),
  }

  // Attach invoice PDF if provided
  if (invoiceBuffer) {
    mailOptions.attachments = [{
      filename:    `Invoice_${order._id?.toString().slice(-8).toUpperCase()}.pdf`,
      content:     invoiceBuffer,
      contentType: 'application/pdf',
    }]
  }

  await transporter.sendMail(mailOptions)
  console.log('✅ Order confirmation sent to', order.shippingAddress?.email)
}

// ══════════════════════════════════════════════════════════════════
// 3. ADMIN NEW ORDER ALERT
// ══════════════════════════════════════════════════════════════════
async function sendAdminOrderAlert(order) {
  const itemsList = (order.items || []).map(i =>
    `<li>${i.product?.name || 'Product'} × ${i.qty} = ₹${(i.price * i.qty).toFixed(2)}</li>`
  ).join('')

  const content = `
    <h2 style="color:#3d1f0a;">🛕 New Order Received!</h2>
    <p style="color:#555;">A new order has been placed on Radhe Bloom.</p>

    ${orderBadge(order._id)}

    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:6px;color:#888;font-size:13px;">Customer</td><td style="padding:6px;color:#3d1f0a;font-weight:bold;">${order.shippingAddress?.name}</td></tr>
      <tr><td style="padding:6px;color:#888;font-size:13px;">Phone</td><td style="padding:6px;color:#3d1f0a;">${order.shippingAddress?.phone}</td></tr>
      <tr><td style="padding:6px;color:#888;font-size:13px;">Email</td><td style="padding:6px;color:#3d1f0a;">${order.shippingAddress?.email}</td></tr>
      <tr><td style="padding:6px;color:#888;font-size:13px;">Total</td><td style="padding:6px;color:#f97f0a;font-weight:bold;font-size:16px;">₹${order.total?.toFixed(2)}</td></tr>
      <tr><td style="padding:6px;color:#888;font-size:13px;">Payment</td><td style="padding:6px;color:#22c55e;font-weight:bold;">${order.paymentMethod?.toUpperCase()} — ${order.paymentStatus?.toUpperCase()}</td></tr>
      <tr><td style="padding:6px;color:#888;font-size:13px;">Type</td><td style="padding:6px;color:#3d1f0a;">${order.isInternational ? '🌍 International' : '🇮🇳 Domestic'}</td></tr>
    </table>

    <p style="color:#555;font-size:13px;"><strong>Items Ordered:</strong></p>
    <ul style="color:#3d1f0a;font-size:13px;line-height:2;">${itemsList}</ul>

    <p style="color:#555;font-size:13px;"><strong>Ship To:</strong><br/>
    ${order.shippingAddress?.address}, ${order.shippingAddress?.city}, ${order.shippingAddress?.state} - ${order.shippingAddress?.pincode}</p>

    ${ctaButton('View Order in Admin', 'https://radhebloom.in/admin/orders')}`

  await transporter.sendMail({
    from:    `"Radhe Bloom Orders" <${process.env.EMAIL_USER}>`,
    to:      process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
    subject: `🛕 New Order ₹${order.total?.toFixed(2)} — ${order.shippingAddress?.name}`,
    html:    baseTemplate(content, 'New Order Alert'),
  })
  console.log('✅ Admin order alert sent')
}

// ══════════════════════════════════════════════════════════════════
// 4. SHIPPING UPDATE — sent when status changes to "shipped"
// ══════════════════════════════════════════════════════════════════
async function sendShippingUpdate(order) {
  const content = `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:48px;">📦</div>
      <h2 style="color:#3d1f0a;font-size:24px;margin:12px 0 4px;">Your Order is Shipped!</h2>
      <p style="color:#888;font-size:14px;margin:0;">Your divine items are on their way 🚚</p>
    </div>

    <p style="color:#3d1f0a;font-size:15px;">Dear <strong>${order.shippingAddress?.name}</strong>,</p>
    <p style="color:#555;font-size:14px;line-height:1.7;">
      Great news! Your Radhe Bloom order has been shipped and is on its way to you.
    </p>

    ${orderBadge(order._id)}

    ${order.awbCode ? `
    <div style="background:#eff6ff;border:2px solid #bfdbfe;border-radius:12px;padding:20px;margin:20px 0;text-align:center;">
      <p style="margin:0 0 4px;color:#3b82f6;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;">Tracking Information</p>
      <p style="margin:0 0 8px;color:#1e40af;font-size:20px;font-weight:bold;letter-spacing:2px;">${order.awbCode}</p>
      <p style="margin:0;color:#555;font-size:13px;">Courier: <strong>${order.courierName || 'N/A'}</strong></p>
    </div>` : ''}

    <div style="background:#f9f3e7;border-radius:10px;padding:16px;margin:16px 0;">
      <p style="margin:0 0 8px;color:#e06200;font-size:13px;font-weight:bold;">Estimated Delivery</p>
      <p style="margin:0;color:#3d1f0a;font-size:13px;">Usually delivered within 3-7 business days depending on your location.</p>
    </div>

    ${addressBlock(order.shippingAddress)}
    ${whatsappButton(order._id)}

    <p style="color:#888;font-size:12px;text-align:center;">We'll notify you once your order is delivered.</p>`

  await transporter.sendMail({
    from:    `"Radhe Bloom 🌸" <${process.env.EMAIL_USER}>`,
    to:      order.shippingAddress?.email,
    subject: `📦 Your Order is Shipped! – Radhe Bloom`,
    html:    baseTemplate(content, 'Order Shipped'),
  })
  console.log('✅ Shipping update sent to', order.shippingAddress?.email)
}

// ══════════════════════════════════════════════════════════════════
// 5. DELIVERY CONFIRMATION + REVIEW REQUEST
// ══════════════════════════════════════════════════════════════════
async function sendDeliveryConfirmation(order) {
  const content = `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:48px;">🏠</div>
      <h2 style="color:#3d1f0a;font-size:24px;margin:12px 0 4px;">Order Delivered!</h2>
      <p style="color:#888;font-size:14px;margin:0;">Your divine items have arrived 🙏</p>
    </div>

    <p style="color:#3d1f0a;font-size:15px;">Dear <strong>${order.shippingAddress?.name}</strong>,</p>
    <p style="color:#555;font-size:14px;line-height:1.7;">
      Your Radhe Bloom order has been delivered! We hope you love your divine items and they bring
      peace, positivity and blessings to your home.
    </p>

    ${orderBadge(order._id)}
    ${itemsTable(order.items || [])}

    <!-- Review Request -->
    <div style="background:linear-gradient(135deg,#fff8f0,#ffefd6);border:2px solid #ffdba3;border-radius:16px;padding:24px;margin:24px 0;text-align:center;">
      <p style="font-size:28px;margin:0 0 8px;">⭐⭐⭐⭐⭐</p>
      <h3 style="color:#3d1f0a;margin:0 0 8px;font-size:18px;">How was your experience?</h3>
      <p style="color:#555;font-size:13px;margin:0 0 16px;">Your review helps other devotees find the right products. Takes just 30 seconds!</p>
      ${ctaButton('✍️ Write a Review', `https://radhebloom.in/orders`)}
    </div>

    ${whatsappButton(order._id)}

    <p style="color:#888;font-size:12px;text-align:center;">
      Not happy with your order? <a href="https://wa.me/919528078217" style="color:#f97f0a;">Contact us</a> within 7 days for easy returns.
    </p>`

  await transporter.sendMail({
    from:    `"Radhe Bloom 🌸" <${process.env.EMAIL_USER}>`,
    to:      order.shippingAddress?.email,
    subject: `🏠 Delivered! How was your Radhe Bloom experience? ⭐`,
    html:    baseTemplate(content, 'Order Delivered'),
  })
  console.log('✅ Delivery confirmation sent to', order.shippingAddress?.email)
}

// ══════════════════════════════════════════════════════════════════
// 6. CONTACT FORM QUERY — sent to admin
// ══════════════════════════════════════════════════════════════════
async function sendContactAlert(contact) {
  const content = `
    <h2 style="color:#3d1f0a;">📩 New Customer Query</h2>
    <p style="color:#555;">Someone submitted the contact form on Radhe Bloom.</p>

    <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#f9f3e7;border-radius:10px;overflow:hidden;">
      <tr><td style="padding:10px 16px;color:#888;font-size:13px;width:100px;">Name</td><td style="padding:10px 16px;color:#3d1f0a;font-weight:bold;">${contact.name}</td></tr>
      <tr><td style="padding:10px 16px;color:#888;font-size:13px;">Email</td><td style="padding:10px 16px;color:#3d1f0a;">${contact.email}</td></tr>
      <tr><td style="padding:10px 16px;color:#888;font-size:13px;">Phone</td><td style="padding:10px 16px;color:#3d1f0a;">${contact.phone || 'Not provided'}</td></tr>
      <tr><td style="padding:10px 16px;color:#888;font-size:13px;">Subject</td><td style="padding:10px 16px;color:#f97f0a;font-weight:bold;">${contact.subject || 'General Query'}</td></tr>
    </table>

    <div style="background:#fff;border-left:4px solid #f97f0a;padding:16px 20px;border-radius:8px;margin:16px 0;">
      <p style="margin:0 0 8px;color:#e06200;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;">Message</p>
      <p style="margin:0;color:#3d1f0a;font-size:14px;line-height:1.7;">${contact.message}</p>
    </div>

    <div style="text-align:center;margin:24px 0;display:flex;gap:12px;justify-content:center;">
      <a href="mailto:${contact.email}?subject=Re: ${contact.subject || 'Your Query'}" style="background:#f97f0a;color:#fff;padding:12px 24px;border-radius:50px;text-decoration:none;font-weight:bold;font-size:13px;">📧 Reply via Email</a>
      <a href="https://wa.me/91${contact.phone?.replace(/\D/g,'')}" style="background:#25D366;color:#fff;padding:12px 24px;border-radius:50px;text-decoration:none;font-weight:bold;font-size:13px;">💬 Reply via WhatsApp</a>
    </div>`

  await transporter.sendMail({
    from:    `"Radhe Bloom Contact" <${process.env.EMAIL_USER}>`,
    to:      process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
    subject: `📩 New Query: ${contact.subject || 'General'} — ${contact.name}`,
    html:    baseTemplate(content, 'New Customer Query'),
    replyTo: contact.email,
  })
  console.log('✅ Contact alert sent to admin')
}

// ══════════════════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════════════════
module.exports = {
  sendWelcomeEmail,
  sendOrderConfirmation,
  sendAdminOrderAlert,
  sendShippingUpdate,
  sendDeliveryConfirmation,
  sendContactAlert,
}