const axios = require('axios')

const SHIPROCKET_URL = 'https://apiv2.shiprocket.in/v1/external'

let cachedToken = null
let tokenExpiry  = null

// Get auth token (cached for 24 hours)
async function getToken() {
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
    return cachedToken
  }
  try {
    const { data } = await axios.post(`${SHIPROCKET_URL}/auth/login`, {
      email:    process.env.SHIPROCKET_EMAIL,
      password: process.env.SHIPROCKET_PASSWORD,
    })
    cachedToken = data.token
    tokenExpiry  = Date.now() + 23 * 60 * 60 * 1000 // 23 hours
    return cachedToken
  } catch (err) {
    throw new Error('Shiprocket auth failed: ' + err.message)
  }
}

// Create order in Shiprocket
async function createShiprocketOrder(order) {
  const token = await getToken()

  const items = order.items.map(item => ({
    name:      item.product?.name || 'Product',
    sku:       item.product?._id?.toString() || 'SKU001',
    units:     item.qty,
    selling_price: item.price,
    discount:  0,
    tax:       '',
    hsn:       '',
  }))

  const payload = {
    order_id:          order._id.toString(),
    order_date:        new Date(order.createdAt).toISOString().split('T')[0],
    pickup_location:   'Primary',
    channel_id:        '',
    comment:           'Radhe Bloom Order',
    billing_customer_name:  order.shippingAddress.name,
    billing_last_name:      '',
    billing_address:        order.shippingAddress.address,
    billing_address_2:      '',
    billing_city:           order.shippingAddress.city,
    billing_pincode:        order.shippingAddress.pincode,
    billing_state:          order.shippingAddress.state,
    billing_country:        order.shippingAddress.country || 'India',
    billing_email:          order.shippingAddress.email,
    billing_phone:          order.shippingAddress.phone,
    shipping_is_billing:    true,
    order_items:            items,
    payment_method:         order.paymentMethod === 'cod' ? 'COD' : 'Prepaid',
    shipping_charges:       0,
    giftwrap_charges:       0,
    transaction_charges:    0,
    total_discount:         0,
    sub_total:              order.total,
    length:                 10,
    breadth:                10,
    height:                 10,
    weight:                 0.5,
  }

  const { data } = await axios.post(
    `${SHIPROCKET_URL}/orders/create/adhoc`,
    payload,
    { headers: { Authorization: `Bearer ${token}` } }
  )

  return {
    shiprocketOrderId: data.order_id,
    shipmentId:        data.shipment_id,
    awbCode:           data.awb_code || null,
    courierName:       data.courier_name || null,
    status:            data.status,
  }
}

// Track shipment by AWB or order ID
async function trackShipment(awbCode) {
  const token = await getToken()
  const { data } = await axios.get(
    `${SHIPROCKET_URL}/courier/track/awb/${awbCode}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  return data.tracking_data
}

// Track by Shiprocket order ID
async function trackByOrderId(shiprocketOrderId) {
  const token = await getToken()
  const { data } = await axios.get(
    `${SHIPROCKET_URL}/orders/show/${shiprocketOrderId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  return data
}

// Generate shipping label
async function generateLabel(shipmentId) {
  const token = await getToken()
  const { data } = await axios.post(
    `${SHIPROCKET_URL}/courier/generate/label`,
    { shipment_id: [shipmentId] },
    { headers: { Authorization: `Bearer ${token}` } }
  )
  return data
}

// Check serviceability for a pincode
async function checkServiceability(pickupPincode, deliveryPincode, weight = 0.5, cod = 0) {
  const token = await getToken()
  const { data } = await axios.get(
    `${SHIPROCKET_URL}/courier/serviceability/`,
    {
      params: { pickup_postcode: pickupPincode, delivery_postcode: deliveryPincode, weight, cod },
      headers: { Authorization: `Bearer ${token}` }
    }
  )
  return data.data?.available_courier_companies || []
}

// Cancel order in Shiprocket
async function cancelOrder(ids) {
  const token = await getToken()
  const { data } = await axios.post(
    `${SHIPROCKET_URL}/orders/cancel`,
    { ids },
    { headers: { Authorization: `Bearer ${token}` } }
  )
  return data
}

module.exports = {
  getToken,
  createShiprocketOrder,
  trackShipment,
  trackByOrderId,
  generateLabel,
  checkServiceability,
  cancelOrder,
}