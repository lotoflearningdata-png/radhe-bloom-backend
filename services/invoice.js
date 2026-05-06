// backend/services/invoice.js
// Generates PDF invoice for orders using PDFKit

const PDFDocument = require('pdfkit')
const path        = require('path')
const fs          = require('fs')

// Brand colors
const SAFFRON  = '#f97f0a'
const DARK     = '#1a0a00'
const BROWN    = '#3d1f0a'
const CREAM    = '#f9f3e7'
const GRAY     = '#888888'
const LIGHT    = '#fdfaf5'

async function generateInvoice(order) {
  return new Promise((resolve, reject) => {
    try {
      const doc  = new PDFDocument({ size: 'A4', margin: 50 })
      const chunks = []

      doc.on('data',  chunk => chunks.push(chunk))
      doc.on('end',   () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      const W = doc.page.width
      const M = 50 // margin

      // ── HEADER BACKGROUND ────────────────────────────────────────
      doc.rect(0, 0, W, 140).fill(DARK)

      // Brand name
      doc.font('Helvetica-Bold').fontSize(28).fillColor(SAFFRON)
        .text('Radhe Bloom', M, 35)

      doc.font('Helvetica').fontSize(10).fillColor('#ffdba3')
        .text('Divine Creations from Mathura', M, 68)

      doc.font('Helvetica').fontSize(9).fillColor('#d09650')
        .text('+91-9528078217  |  hello@radhebloom.in  |  Mathura, Uttar Pradesh', M, 85)

      // INVOICE label
      doc.font('Helvetica-Bold').fontSize(22).fillColor(SAFFRON)
        .text('INVOICE', W - M - 100, 40, { width: 100, align: 'right' })

      doc.font('Helvetica').fontSize(9).fillColor('#ffdba3')
        .text(`#${order._id?.toString().slice(-10).toUpperCase()}`, W - M - 100, 70, { width: 100, align: 'right' })

      doc.font('Helvetica').fontSize(9).fillColor('#d09650')
        .text(`Date: ${new Date(order.createdAt || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`, W - M - 100, 85, { width: 100, align: 'right' })

      // ── BILLING & SHIPPING INFO ───────────────────────────────────
      let y = 165

      // Left: Bill To
      doc.font('Helvetica-Bold').fontSize(9).fillColor(SAFFRON)
        .text('BILL TO', M, y)
      doc.font('Helvetica-Bold').fontSize(11).fillColor(BROWN)
        .text(order.shippingAddress?.name || 'Customer', M, y + 14)
      doc.font('Helvetica').fontSize(9).fillColor(GRAY)
        .text(order.shippingAddress?.address || '', M, y + 28)
        .text(`${order.shippingAddress?.city || ''}, ${order.shippingAddress?.state || ''} - ${order.shippingAddress?.pincode || ''}`, M, y + 40)
        .text(`Phone: ${order.shippingAddress?.phone || ''}`, M, y + 52)
        .text(`Email: ${order.shippingAddress?.email || ''}`, M, y + 64)

      // Right: Order details
      const rx = W / 2 + 20
      doc.font('Helvetica-Bold').fontSize(9).fillColor(SAFFRON)
        .text('ORDER DETAILS', rx, y)

      const orderDetails = [
        ['Order ID',     `#${order._id?.toString().slice(-10).toUpperCase()}`],
        ['Order Date',   new Date(order.createdAt || Date.now()).toLocaleDateString('en-IN')],
        ['Payment',      `${order.paymentMethod?.toUpperCase() || 'PAID'} — ${order.paymentStatus?.toUpperCase() || 'PAID'}`],
        ['Status',       order.status?.toUpperCase() || 'CONFIRMED'],
      ]

      orderDetails.forEach(([label, value], i) => {
        doc.font('Helvetica-Bold').fontSize(8).fillColor(GRAY)
          .text(label + ':', rx, y + 14 + (i * 14))
        doc.font('Helvetica').fontSize(8).fillColor(BROWN)
          .text(value, rx + 75, y + 14 + (i * 14))
      })

      // ── DIVIDER ───────────────────────────────────────────────────
      y += 100
      doc.moveTo(M, y).lineTo(W - M, y).lineWidth(0.5).strokeColor('#e5d5c0').stroke()
      y += 20

      // ── ITEMS TABLE HEADER ────────────────────────────────────────
      doc.rect(M, y, W - M * 2, 24).fill(SAFFRON)

      const cols = {
        no:    { x: M + 8,   w: 25,  align: 'left' },
        name:  { x: M + 35,  w: 210, align: 'left' },
        cat:   { x: M + 248, w: 90,  align: 'left' },
        qty:   { x: M + 340, w: 40,  align: 'center' },
        price: { x: M + 385, w: 60,  align: 'right' },
        total: { x: M + 450, w: 55,  align: 'right' },
      }

      doc.font('Helvetica-Bold').fontSize(8).fillColor('white')
      Object.entries(cols).forEach(([key, col]) => {
        const labels = { no: '#', name: 'PRODUCT', cat: 'CATEGORY', qty: 'QTY', price: 'PRICE', total: 'TOTAL' }
        doc.text(labels[key], col.x, y + 8, { width: col.w, align: col.align })
      })

      y += 32

      // ── ITEMS ROWS ────────────────────────────────────────────────
      const items = order.items || []
      let subtotal = 0

      items.forEach((item, i) => {
        const rowY   = y + (i * 30)
        const bg     = i % 2 === 0 ? LIGHT : '#fff'
        const price  = item.price || item.product?.price || 0
        const qty    = item.qty || 1
        const amount = price * qty
        subtotal    += amount

        doc.rect(M, rowY, W - M * 2, 28).fill(bg)

        const productName = item.product?.name || item.name || 'Product'
        const category    = item.product?.category || ''

        doc.font('Helvetica').fontSize(8).fillColor(BROWN)
        doc.text(`${i + 1}`, cols.no.x,    rowY + 10, { width: cols.no.w,    align: cols.no.align })
        doc.text(productName.substring(0, 35), cols.name.x,  rowY + 5,  { width: cols.name.w,  align: cols.name.align })
        doc.font('Helvetica').fontSize(7).fillColor(GRAY)
           .text(category, cols.name.x, rowY + 17, { width: cols.name.w })
        doc.font('Helvetica').fontSize(8).fillColor(BROWN)
        doc.text(category.replace(/-/g, ' '), cols.cat.x, rowY + 10, { width: cols.cat.w, align: cols.cat.align })
        doc.text(qty.toString(),              cols.qty.x, rowY + 10, { width: cols.qty.w, align: cols.qty.align })
        doc.text(`Rs.${price.toFixed(2)}`,   cols.price.x, rowY + 10, { width: cols.price.w, align: cols.price.align })
        doc.font('Helvetica-Bold').fontSize(8).fillColor(BROWN)
           .text(`Rs.${amount.toFixed(2)}`,  cols.total.x, rowY + 10, { width: cols.total.w, align: cols.total.align })

        // Row bottom border
        doc.moveTo(M, rowY + 28).lineTo(W - M, rowY + 28).lineWidth(0.3).strokeColor('#e5d5c0').stroke()
      })

      y += items.length * 30 + 15

      // ── TOTALS ────────────────────────────────────────────────────
      const shipping  = order.total - subtotal > 0 && order.total - subtotal < 200 ? order.total - subtotal : 0
      const calcShip  = subtotal >= 499 ? 0 : 49
      const finalShip = shipping || calcShip
      const total     = subtotal + finalShip

      const totalsX = W - M - 180

      // Box
      doc.rect(totalsX, y, 180, 90).fill(CREAM).stroke('#e5d5c0')

      const rows = [
        ['Subtotal',  `Rs.${subtotal.toFixed(2)}`,  false],
        ['Shipping',  finalShip === 0 ? 'FREE' : `Rs.${finalShip.toFixed(2)}`, false],
        ['',          '',                            false],
        ['TOTAL',     `Rs.${(order.total || total).toFixed(2)}`, true],
      ]

      rows.forEach(([label, value, bold], i) => {
        if (!label) return
        const rowY2 = y + 12 + (i * 20)
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica')
           .fontSize(bold ? 10 : 8)
           .fillColor(bold ? SAFFRON : BROWN)
           .text(label, totalsX + 12, rowY2)
           .text(value, totalsX + 12, rowY2, { width: 156, align: 'right' })
      })

      // Divider above total
      doc.moveTo(totalsX + 10, y + 68).lineTo(totalsX + 170, y + 68).lineWidth(0.5).strokeColor(SAFFRON).stroke()

      // ── PAYMENT CONFIRMED STAMP ───────────────────────────────────
      if (order.paymentStatus === 'paid') {
        doc.save()
           .rotate(-25, { origin: [W - 120, y + 30] })
           .rect(W - 180, y - 10, 120, 35).lineWidth(2).strokeColor('#22c55e').stroke()
           .font('Helvetica-Bold').fontSize(14).fillColor('#22c55e')
           .text('PAID', W - 165, y, { width: 90, align: 'center' })
           .restore()
      }

      y += 115

      // ── THANK YOU NOTE ────────────────────────────────────────────
      if (y < 680) {
        doc.font('Helvetica').fontSize(9).fillColor(GRAY)
          .text('Thank you for your divine order! 🌸', M, y, { align: 'center', width: W - M * 2 })
          .text('For any queries, WhatsApp us at +91-9528078217', M, y + 14, { align: 'center', width: W - M * 2 })
      }

      // ── FOOTER ────────────────────────────────────────────────────
      doc.rect(0, doc.page.height - 50, W, 50).fill(DARK)
      doc.font('Helvetica').fontSize(8).fillColor('#d09650')
        .text('Radhe Bloom | Divine Creations from Mathura | radhebloom.in | +91-9528078217', M, doc.page.height - 32, { align: 'center', width: W - M * 2 })

      // ── TRACKING INFO (if available) ──────────────────────────────
      if (order.awbCode && y < 640) {
        doc.rect(M, y + 25, W - M * 2, 40).fill('#f0fdf4').stroke('#86efac')
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#16a34a')
          .text('📦 Shipment Tracking', M + 12, y + 35)
        doc.font('Helvetica').fontSize(8).fillColor(BROWN)
          .text(`AWB: ${order.awbCode}  |  Courier: ${order.courierName || 'N/A'}`, M + 12, y + 49)
      }

      doc.end()
    } catch (err) {
      reject(err)
    }
  })
}

module.exports = { generateInvoice }