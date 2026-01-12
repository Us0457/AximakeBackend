require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
// shiprocketService is an ES module; we'll dynamically import it at startup
let createShipment, downloadInvoice, printAndDownloadInvoice, getTracking, generateAWB, getShipmentStatus, getOrderDetails, getShipmentDetails, getLabel, cancelOrders, fetchInvoiceUrlRaw;
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

// Basic health endpoint for Render/Internal checks
app.get('/api/health', (req, res) => {
  console.log('/api/health requested from', req.ip || req.headers['x-forwarded-for'] || 'unknown');
  res.status(200).json({ status: 'ok' });
});

// root quick health for some platforms
app.get('/', (req, res) => {
  console.log('/ root requested from', req.ip || req.headers['x-forwarded-for'] || 'unknown');
  res.status(200).send('ok');
});

// Global error handlers to log crashes and avoid silent exits
process.on('uncaughtException', (err) => {
  console.error('uncaughtException', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('unhandledRejection', reason);
});

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
// Optionally use an external webhook handler module (ESM) if present.
let externalWebhookHandler = null;

// Helper to transform your order payload to Shiprocket API format
function transformOrderToShiprocket(order) {
  const address = order.address || {};
  // Compose full address string
  const fullAddress = [address.flat_no, address.area, address.city, address.state, address.pincode]
    .filter(Boolean).join(', ');
  // Use fallback for name if empty string or missing
  const customerName = (address.name && address.name.trim()) ? address.name : 'Customer';
  const customerLastName = address.last_name || '';
  // Calculate sub_total
  // Use raw prices for calculation, only round at the end
  const items = (order.items || []).map(item => {
    const isQuote = !item.product_id;
    const name = isQuote ? (item.display_name || item.cart_name || item.file_name || item.name || 'Custom Print') : (item.name || 'Product');
    const sku = item.sku || item.product_id || item.file_name || (isQuote ? ('QUOTE-' + String(item.id)) : String(item.id)) || 'QUOTE';
    // Use raw price for calculation
    const selling_price = Number(item.price) || 0;
    return {
      name,
      sku,
      units: Number(item.quantity) || 1,
      selling_price,
      discount: item.discount !== undefined ? item.discount : '',
      tax: item.tax !== undefined ? item.tax : '',
      hsn: item.hsn ? Number(item.hsn) : 3916 // fallback HSN for all
    };
  });
  // Debug: log all items before filtering
  console.log('Shiprocket order_items before filter:', JSON.stringify(items, null, 2));
  // Only filter out items with missing name, sku, or price <= 0
  const filteredItems = items.filter(item => item.name && item.sku && item.selling_price > 0);
  if (filteredItems.length !== items.length) {
    console.warn('Some items were filtered out from Shiprocket payload:', items.filter(item => !(item.name && item.sku && item.selling_price > 0)));
  }
  // Calculate sub_total as original total before discount (round only at the end)
  const sub_total = Math.round(items.reduce((sum, item) => sum + (item.selling_price * item.units), 0));
  // Calculate total_discount as the discount amount (rounded integer)
  const total_discount = Math.round(Number(order.discount_amount || order.total_discount || 0));
  // Charges (use raw, round at the end)
  const shipping_charges = Math.round(Number(order.shipping_charges) || 0);
  const giftwrap_charges = Math.round(Number(order.giftwrap_charges) || 0);
  const transaction_charges = Math.round(Number(order.transaction_charges) || 0);
  // Calculate final total after discount and charges (round at the end)
  const total = Math.round(Math.max(sub_total - total_discount + shipping_charges + giftwrap_charges + transaction_charges, 0));
  // Format order_date as 'YYYY-MM-DD HH:mm'
  const dateObj = order.created_at ? new Date(order.created_at) : new Date();
  const pad = n => n < 10 ? '0' + n : n;
  const order_date = `${dateObj.getFullYear()}-${pad(dateObj.getMonth()+1)}-${pad(dateObj.getDate())} ${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}`;

  // Always use 'Primary' for pickup_location
  // Always use 'Bangalore' for city
  // Always use numbers for pincode and phone
  const city = 'Bangalore';
  const pincode = address.pincode ? Number(address.pincode) : '';
  // Normalize phone to a plain 10-digit string (Shiprocket prefers local subscriber numbers)
  let phone = '';
  if (address.phone) {
    const digits = String(address.phone).replace(/\D/g, '');
    if (digits.length >= 10) {
      phone = digits.slice(-10); // use last 10 digits as local number
    } else {
      phone = digits;
    }
  }

  // Use the pickup location from .env (must match Shiprocket dashboard exactly)
  const pickupLocation = process.env.SHIPROCKET_PICKUP_LOCATION || 'Primary';

  const payload = {
    order_id: order.order_code || '',
    order_date,
    pickup_location: pickupLocation,
    comment: order.comment || '',
    billing_customer_name: customerName,
    billing_last_name: customerLastName,
    billing_address: address.flat_no + (address.area ? ', ' + address.area : ''),
    billing_address_2: address.address_2 || '',
    billing_city: city,
    billing_pincode: pincode,
    billing_state: address.state || '',
    billing_country: 'India',
    billing_email: address.email || 'noemail@example.com',
    billing_phone: phone,
    shipping_is_billing: true,
    shipping_customer_name: '',
    shipping_last_name: '',
    shipping_address: '',
    shipping_address_2: '',
    shipping_city: '',
    shipping_pincode: '',
    shipping_country: '',
    shipping_state: '',
    shipping_email: '',
    shipping_phone: '',
    order_items: filteredItems,
    payment_method: (order.payment_method && order.payment_method.toUpperCase() === 'COD') ? 'COD' : 'Prepaid',
    sub_total,
    total_discount,
    shipping_charges,
    giftwrap_charges,
    transaction_charges,
    total,
    length: Number(order.length) || 10,
    breadth: Number(order.breadth) || 10,
    height: Number(order.height) || 10,
    weight: Number(order.weight) || 0.5
  };
  return payload;
}

app.post('/api/create-shiprocket-order', async (req, res) => {
  try {
    const order = req.body;
    // Basic validation: billing email must look valid to avoid Shiprocket API errors
    const billingEmail = order?.address?.email || '';
    const looksLikeEmail = typeof billingEmail === 'string' && /@.+\./.test(billingEmail);
    if (!looksLikeEmail) {
      return res.status(400).json({ error: 'Invalid billing email: ' + billingEmail + '. Please provide a valid email (e.g. user@example.com).' });
    }
    console.log('Shiprocket order payload (raw input):', JSON.stringify(order, null, 2));
    // Debug: log all items and warn if any quote item is missing file_name
    if (Array.isArray(order.items)) {
      order.items.forEach((item, idx) => {
        if (!item.product_id && !item.file_name) {
          console.warn(`Quote item at index ${idx} is missing file_name!`, item);
        } else if (!item.product_id) {
          console.log(`Quote item at index ${idx} has file_name:`, item.file_name);
        }
      });
    }

    // --- Reject if not a raw order object ---
    if (!order.address || !order.items) {
      return res.status(400).json({
        error: 'Request must be a raw order object with address and items. Do not send a Shiprocket-style payload.',
        receivedKeys: Object.keys(order)
      });
    }

    // Transform order to Shiprocket format
    const shiprocketOrder = transformOrderToShiprocket(order);
    console.log('Shiprocket API payload (transformed):', JSON.stringify(shiprocketOrder, null, 2));

    // --- Strict validation for Shiprocket payload ---
    const requiredFields = [
      'order_id', 'order_date', 'pickup_location',
      'billing_customer_name', 'billing_address', 'billing_city', 'billing_pincode', 'billing_state', 'billing_country', 'billing_email', 'billing_phone',
      'shipping_customer_name', 'shipping_address', 'shipping_city', 'shipping_pincode', 'shipping_state', 'shipping_country', 'shipping_email', 'shipping_phone',
      'order_items', 'payment_method', 'sub_total', 'length', 'breadth', 'height', 'weight'
    ];
    const missingFields = requiredFields.filter(f => !(f in shiprocketOrder));
    // Check order_date format
    const dateFormatOk = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(shiprocketOrder.order_date);
    if (missingFields.length > 0 || !dateFormatOk) {
      return res.status(400).json({
        error: 'Shiprocket payload missing required fields or has invalid date format',
        missingFields,
        order_date: shiprocketOrder.order_date,
        shiprocketPayload: shiprocketOrder
      });
    }
    // --- End strict validation ---

    let shipment;
    let errorMsg = null;
    try {
      shipment = await createShipment(shiprocketOrder);
    } catch (err) {
      // Log the error and payload for debugging
      errorMsg = err.message;
      console.error('Shiprocket API error:', errorMsg);
    }
    // Always return the transformed payload for debugging
    if (errorMsg) {
      res.status(500).set('Content-Type', 'application/json').send(JSON.stringify({ error: errorMsg, shiprocketPayload: shiprocketOrder }));
      return;
    }
    const { data, error } = await supabase
      .from('orders')
      .update({
        shiprocket_shipment_id: shipment.shipment_id,
        shiprocket_awb: shipment.awb,
        shiprocket_courier: shipment.courier,
        shiprocket_status: shipment.status,
        shiprocket_label_url: shipment.label_url,
        shiprocket_order_id: shipment.order_id // <-- Save numeric Shiprocket order ID
      })
      .eq('order_code', order.order_code)
      .select();
    if (error) {
      res.status(500).set('Content-Type', 'application/json').send(JSON.stringify({ error: 'Failed to update order with Shiprocket details', details: error, shiprocketPayload: shiprocketOrder }));
      return;
    }
    res.status(200).set('Content-Type', 'application/json').send(JSON.stringify({ shipment, order: data[0], shiprocketPayload: shiprocketOrder }));
    return;
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Configure your Gmail SMTP transporter (credentials read from environment)
const smtpHost = process.env.SMTP_HOST;
const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
const smtpSecure = (process.env.SMTP_SECURE || 'ssl') === 'ssl' || (process.env.SMTP_SECURE || '').toLowerCase() === 'true';
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
if (!smtpUser || !smtpPass) {
  console.warn('SMTP_USER or SMTP_PASS not set in environment. Email sending will fail.');
}
let transporter;
if (smtpHost && smtpPort) {
  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined
  });
} else {
  // Fallback to Gmail service when explicit host/port not provided
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: smtpUser, pass: smtpPass }
  });
}

app.post('/api/contact', async (req, res) => {
  const { name, email, subject, message } = req.body;
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || smtpUser || 'no-reply@example.com',
      to: process.env.SUPPORT_EMAIL || 'us5679077@gmail.com', // support/recipient email from env
      subject: `Contact Form: ${subject}`,
      text: `Name: ${name}\nEmail: ${email}\n\n${message}`
    });
    res.status(200).json({ success: true, message: 'Email sent!' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to send email', error: error.message });
  }
});

// Shiprocket tracking endpoint
app.get('/api/shiprocket-tracking/:shipment_id', async (req, res) => {
  try {
    // getTracking will be provided by shiprocketService after dynamic import
    // Fetch order from DB to get order_code and awb
    const { data: orders, error } = await supabase
      .from('orders')
      .select('order_code, shiprocket_awb, shiprocket_shipment_id, shiprocket_order_id, shiprocket_status, shiprocket_courier, shiprocket_track_url')
      .eq('shiprocket_shipment_id', req.params.shipment_id)
      .limit(1);
    if (error || !orders || orders.length === 0) {
      return res.status(404).json({ error: 'Order not found for this shipment_id' });
    }
    const order = orders[0];
    // Debug log: print the order object
    console.log('Order fetched for tracking:', order);
    // Only call tracking API by Shiprocket numeric order_id. Do NOT use AWB or shipment_id params.
    let tracking = null;
    if (order.shiprocket_order_id) {
      try {
        console.log('Trying getTracking with shiprocket_order_id:', order.shiprocket_order_id);
        tracking = await getTracking({ order_id: String(order.shiprocket_order_id) });
        console.log('Shiprocket response for order_id:', JSON.stringify(tracking, null, 2));
      } catch (e) {
        console.warn('shiprocket-tracking: tracking fetch failed', e?.message || e);
        // Return last known DB status and do not error
        return res.status(200).json({ awb_code: order.shiprocket_awb, courier_company_name: order.shiprocket_courier, shipment_status: order.shiprocket_status, track_url: order.shiprocket_track_url || null, tracking_data: null, message: 'Tracking will be available once dispatched' });
      }
      if (!tracking || !tracking.tracking_data) {
        return res.status(200).json({ awb_code: order.shiprocket_awb, courier_company_name: order.shiprocket_courier, shipment_status: order.shiprocket_status, track_url: order.shiprocket_track_url || null, tracking_data: null, message: 'Tracking will be available once dispatched' });
      }
    } else {
      // No shiprocket_order_id — don't call tracking endpoints; return safe response
      return res.status(200).json({ awb_code: order.shiprocket_awb, courier_company_name: order.shiprocket_courier, shipment_status: order.shiprocket_status, track_url: order.shiprocket_track_url || null, tracking_data: null, message: 'Tracking will be available once dispatched' });
    }
    // Extract latest AWB, courier, and status from tracking response
    const trackingDataSR = tracking?.tracking_data;
    console.log('Shiprocket tracking_data:', JSON.stringify(trackingDataSR, null, 2));
    let latestAWB_SR = null;
    let latestCourier_SR = null;
    let latestStatus_SR = null;
    let latestStatusCode_SR = null;
    let track_url_SR = trackingDataSR?.track_url || null;
    // Try to extract from shipment_track array if present
    if (Array.isArray(trackingDataSR?.shipment_track) && trackingDataSR.shipment_track.length > 0) {
      const trackObj = trackingDataSR.shipment_track.find(t => t.current_status || t.status || t.awb_code || t.courier_name);
      if (trackObj) {
        latestAWB_SR = trackObj.awb_code || null;
        latestCourier_SR = trackObj.courier_name || null;
        latestStatus_SR = trackObj.current_status || trackObj.status || null;
        latestStatusCode_SR = trackObj.status_code || null;
      }
    }
    // Fallbacks if not found in shipment_track
    if (!latestAWB_SR) latestAWB_SR = trackingDataSR?.awb_code || null;
    if (!latestCourier_SR) latestCourier_SR = trackingDataSR?.courier_name || null;
    if (!latestStatus_SR) latestStatus_SR = trackingDataSR?.shipment_status || trackingDataSR?.current_status || trackingDataSR?.status || null;
    if (!latestStatus_SR) latestStatus_SR = 'Pending'; // fallback if all are null
    if (!latestStatusCode_SR) latestStatusCode_SR = trackingDataSR?.status_code || null;
    // Update AWB/courier/track_url. Also set READY_TO_SHIP when AWB assigned if progression allows.
    await supabase.from('orders').update({
      shiprocket_awb: latestAWB_SR,
      shiprocket_courier: latestCourier_SR,
      shiprocket_track_url: track_url_SR
    }).eq('shiprocket_shipment_id', req.params.shipment_id);

    // Derive internal READY_TO_SHIP milestone when AWB is present
    try {
      const desiredShiprocket = normalizeStatus ? normalizeStatus('Ready To Ship') : 'Ready To Ship';
      const desiredOrderStatus = 'READY_TO_SHIP';
      const cur = order.shiprocket_status || order.order_status || null;
      if (!isFinalStatus?.(cur) && (cur === 'New' || isProgressionAllowed?.(cur, desiredShiprocket))) {
        await supabase.from('orders').update({ shiprocket_status: desiredShiprocket, order_status: desiredOrderStatus }).eq('shiprocket_shipment_id', req.params.shipment_id);
      }
    } catch (e) {
      console.warn('READY_TO_SHIP derive failed:', e?.message || e);
    }
    res.set('Cache-Control', 'no-store');
    res.json({
      awb_code: latestAWB_SR,
      courier_company_name: latestCourier_SR,
      shipment_status: latestStatus_SR,
      track_url: track_url_SR,
      tracking_data: trackingDataSR
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Generate AWB and assign courier ("Ship Now")
app.post('/api/shiprocket-ship-now/:shipment_id', async (req, res) => {
  try {
    // generateAWB and getTracking provided by dynamic import
    const shipment_id = req.params.shipment_id;
    // Optionally accept courier_id in body
    const courier_id = req.body.courier_id || null;
    const result = await generateAWB(shipment_id, courier_id);
    // Fetch latest tracking info for status
    let latestStatus = result.status;
    let latestAWB = result.awb_code;
    let latestCourier = result.courier_name;
    let track_url = null;
    try {
      // Fetch DB row to find shiprocket_order_id to query tracking with order_id only
      const { data: orders } = await supabase.from('orders').select('shiprocket_order_id, shiprocket_awb, shiprocket_courier, shiprocket_status').eq('shiprocket_shipment_id', shipment_id).limit(1);
      const orderRow = Array.isArray(orders) && orders.length ? orders[0] : null;
      if (orderRow && orderRow.shiprocket_order_id) {
        try {
          const tracking = await getTracking({ order_id: String(orderRow.shiprocket_order_id) });
          latestStatus = tracking?.tracking_data?.shipment_track?.[0]?.current_status || tracking?.tracking_data?.shipment_status || result.status;
          latestAWB = tracking?.tracking_data?.shipment_track?.[0]?.awb_code || result.awb_code;
          latestCourier = tracking?.tracking_data?.shipment_track?.[0]?.courier_name || result.courier_name;
          track_url = tracking?.tracking_data?.track_url || null;
        } catch (e) {
          console.warn('ship-now: tracking fetch failed', e?.message || e);
        }
      } else {
        // No shiprocket_order_id — skip calling tracking endpoint
        latestAWB = result.awb_code;
        latestCourier = result.courier_name;
      }
    } catch (e) {
      console.warn('ship-now: failed to lookup order for tracking', e?.message || e);
    }
    // Update order in DB with new AWB/courier info and track_url (do NOT mutate status here)
    await supabase.from('orders').update({
      shiprocket_awb: latestAWB,
      shiprocket_courier: latestCourier,
      shiprocket_track_url: track_url
    }).eq('shiprocket_shipment_id', shipment_id);
    res.json({ ...result, latestStatus, latestAWB, latestCourier, track_url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// New endpoint: Automatically assign courier and generate AWB for a shipment
app.post('/api/shiprocket-ship-now', async (req, res) => {
  try {
    // generateAWB and getTracking provided by dynamic import
    const { shipment_id } = req.body;
    if (!shipment_id) {
      return res.status(400).json({ error: 'shipment_id is required in the request body' });
    }
    // Call Shiprocket API to assign courier and generate AWB
    let result;
    let tracking = null;
    let trackingError = null;
    try {
      result = await generateAWB(shipment_id);
    } catch (err) {
      // If AWB is already assigned, fetch the current AWB and status
      if (err.message && err.message.includes('AWB is already assigned')) {
        // Fetch order from DB to get order_code and awb
        const { data: orders, error } = await supabase
          .from('orders')
          .select('order_code, shiprocket_awb, shiprocket_order_id, shiprocket_courier, shiprocket_status')
          .eq('shiprocket_shipment_id', shipment_id)
          .limit(1);
        if (error || !orders || orders.length === 0) {
          return res.status(500).json({ error: 'AWB already assigned but failed to fetch order from DB', details: error });
        }
        const order = orders[0];
        // Prefer Shiprocket numeric order_id for tracking; do not use AWB param
        try {
          if (order.shiprocket_order_id) {
            tracking = await getTracking({ order_id: String(order.shiprocket_order_id) });
          } else {
            // No shiprocket_order_id — cannot query tracking safely; return last known DB state
            return res.status(200).json({ awb_code: order.shiprocket_awb, courier_company_name: order.shiprocket_courier, track_url: order.shiprocket_track_url || null, shipment_status: order.shiprocket_status, already_assigned: true, message: 'Tracking unavailable until shiprocket_order_id is present' });
          }
        } catch (trackErr) {
          console.warn('ship-now: tracking fetch failed after AWB assigned', trackErr?.message || trackErr);
          return res.status(200).json({ awb_code: order.shiprocket_awb, courier_company_name: order.shiprocket_courier, track_url: order.shiprocket_track_url || null, shipment_status: order.shiprocket_status, already_assigned: true, message: 'Tracking unavailable; returning last known state' });
        }
        // Always update order with latest tracking info (do NOT mutate status here)
        const trackingData = tracking?.tracking_data;
        let latestAWB = null;
        let latestCourier = null;
        let latestStatus = null;
        let track_url = trackingData?.track_url || null;
        if (Array.isArray(trackingData?.shipment_track) && trackingData.shipment_track.length > 0) {
          const trackObj = trackingData.shipment_track.find(t => t.current_status || t.status || t.awb_code || t.courier_name);
          if (trackObj) {
            latestAWB = trackObj.awb_code || null;
            latestCourier = trackObj.courier_name || null;
            latestStatus = trackObj.current_status || trackObj.status || null;
          }
        }
        if (!latestAWB) latestAWB = trackingData?.awb_code || null;
        if (!latestCourier) latestCourier = trackingData?.courier_name || null;
        if (!latestStatus) latestStatus = trackingData?.shipment_status || trackingData?.current_status || trackingData?.status || null;
        if (!latestStatus) latestStatus = 'Pending'; // fallback if all are null
        // Update order in DB (only AWB/courier/track_url)
        await supabase.from('orders').update({
          shiprocket_awb: latestAWB,
          shiprocket_courier: latestCourier,
          shiprocket_track_url: track_url
        }).eq('shiprocket_shipment_id', shipment_id);

        // Derive READY_TO_SHIP milestone when AWB assigned
        try {
          const desiredShiprocket = normalizeStatus ? normalizeStatus('Ready To Ship') : 'Ready To Ship';
          const desiredOrderStatus = 'READY_TO_SHIP';
          const cur = order.shiprocket_status || order.order_status || null;
          if (!isFinalStatus?.(cur) && (cur === 'New' || isProgressionAllowed?.(cur, desiredShiprocket))) {
            await supabase.from('orders').update({ shiprocket_status: desiredShiprocket, order_status: desiredOrderStatus }).eq('shiprocket_shipment_id', shipment_id);
          }
        } catch (e) {
          console.warn('READY_TO_SHIP derive failed (already_assigned branch):', e?.message || e);
        }

        return res.json({ awb_code: latestAWB, courier_company_name: latestCourier, track_url, shipment_status: latestStatus, already_assigned: true });
      }
      // Otherwise, return the error as before
      console.error('Shiprocket AWB generation error:', err);
      return res.status(500).json({ error: 'Shiprocket AWB generation failed', details: err.message, stack: err.stack });
    }
    // If Shiprocket did not return an AWB, treat as error
    if (!result || !result.awb_code) {
      console.error('Shiprocket AWB generation failed, response:', result);
      return res.status(500).json({ error: 'Shiprocket did not return an AWB', details: result });
    }
    // Attempt to fetch tracking by shiprocket order id from DB (do NOT use AWB param)
    try {
      const { data: orders2 } = await supabase.from('orders').select('shiprocket_order_id').eq('shiprocket_shipment_id', shipment_id).limit(1);
      const orderRow2 = Array.isArray(orders2) && orders2.length ? orders2[0] : null;
      if (orderRow2 && orderRow2.shiprocket_order_id) {
        try {
          tracking = await getTracking({ order_id: String(orderRow2.shiprocket_order_id) });
        } catch (e) {
          tracking = null;
          trackingError = e;
        }
      } else {
        // No shiprocket_order_id — skip tracking call
        tracking = null;
      }
    } catch (e) {
      tracking = null;
      trackingError = e;
    }
    // Robust extraction
    const trackingData = tracking?.tracking_data;
    let latestAWB = result.awb_code;
    let latestCourier = result.courier_name;
    let track_url = trackingData?.track_url || null;
    // Robust status extraction: always prefer 'Ready to Ship' if present, otherwise try all fields
    let latestStatus = null;
    if (Array.isArray(trackingData?.shipment_track) && trackingData.shipment_track.length > 0) {
      for (const trackObj of trackingData.shipment_track) {
        if (trackObj.current_status && trackObj.current_status.toLowerCase() === 'ready to ship') {
          latestStatus = 'Ready to Ship';
          break;
        }
        if (trackObj.status && trackObj.status.toLowerCase() === 'ready to ship') {
          latestStatus = 'Ready to Ship';
          break;
        }
      }
      if (!latestStatus) {
        const trackObj = trackingData.shipment_track[0];
        latestStatus = trackObj.current_status || trackObj.status || null;
      }
    }
    if (!latestStatus) latestStatus = trackingData?.shipment_status || trackingData?.current_status || trackingData?.status || null;
    if (!latestStatus) latestStatus = 'Pending';
    await supabase.from('orders').update({
      shiprocket_awb: latestAWB,
      shiprocket_courier: latestCourier,
      shiprocket_track_url: track_url
    }).eq('shiprocket_shipment_id', shipment_id);

    // Derive READY_TO_SHIP milestone when AWB assignment succeeded
    try {
      // Attempt to fetch existing order row to inspect current status
      const { data: rows } = await supabase.from('orders').select('shiprocket_status, order_status').eq('shiprocket_shipment_id', shipment_id).limit(1);
      const existing = Array.isArray(rows) && rows.length ? rows[0] : null;
      const desiredShiprocket = normalizeStatus ? normalizeStatus('Ready To Ship') : 'Ready To Ship';
      const desiredOrderStatus = 'READY_TO_SHIP';
      const cur = existing ? (existing.shiprocket_status || existing.order_status) : null;
      if (!isFinalStatus?.(cur) && (cur === 'New' || isProgressionAllowed?.(cur, desiredShiprocket))) {
        await supabase.from('orders').update({ shiprocket_status: desiredShiprocket, order_status: desiredOrderStatus }).eq('shiprocket_shipment_id', shipment_id);
      }
    } catch (e) {
      console.warn('READY_TO_SHIP derive failed (main branch):', e?.message || e);
    }

    res.json({ awb_code: latestAWB, courier_company_name: latestCourier, track_url, shipment_status: latestStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Webhook endpoint for real-time tracking updates (neutral name)
async function logisticsWebhookHandler(req, res) {
  try {
    // Preserve existing authentication: validate x-api-key against SHIPROCKET_WEBHOOK_TOKEN when set
    const incomingToken = req.headers['x-api-key'] || req.headers['x_api_key'] || req.headers['authorization'] || null;
    if (process.env.SHIPROCKET_WEBHOOK_TOKEN) {
      if (!incomingToken || String(incomingToken) !== String(process.env.SHIPROCKET_WEBHOOK_TOKEN)) {
        console.warn('Webhook: invalid or missing x-api-key header');
        return res.status(403).json({ error: 'Forbidden' });
      }
    }
    const payload = req.body;
    // Extract relevant fields
    const order_id = payload.order_id || payload.order_code || null;
    // Determine numeric Shiprocket order id (bigint) when available.
    let srOrderId = null;
    if (payload.sr_order_id || payload.srOrderId || payload.sr_orderId) {
      srOrderId = payload.sr_order_id || payload.srOrderId || payload.sr_orderId;
    } else if (payload.order_id && /^[0-9]+$/.test(String(payload.order_id))) {
      srOrderId = Number(payload.order_id);
    }
    const shipment_id = payload.shipment_id || null;
    const current_status = payload.current_status || payload.status || null;
    const awb = payload.awb || payload.awb_code || null;
    const courier = payload.courier || payload.courier_name || payload.courier_company_name || null;
    // Prefer `scans` when present (Shiprocket sends `scans` array); fall back to `event_details`.
    // Normalize incoming events into an array of objects (never keep stringified JSON in DB).
    function normalizeEvents(raw) {
      if (!raw) return null;
      try {
        let parsed = raw;
        if (typeof raw === 'string') {
          parsed = JSON.parse(raw);
        }
        if (!Array.isArray(parsed)) {
          if (parsed && typeof parsed === 'object') {
            if (Array.isArray(parsed.scans)) parsed = parsed.scans;
            else if (Array.isArray(parsed.event_details)) parsed = parsed.event_details;
            else parsed = [parsed];
          } else {
            parsed = [parsed];
          }
        }
        const out = [];
        for (const e of parsed) {
          if (e == null) continue;
          if (typeof e === 'string') {
            try {
              const p = JSON.parse(e);
              if (Array.isArray(p)) out.push(...p);
              else out.push(p);
            } catch (pe) {
              out.push({ activity: e });
            }
          } else if (Array.isArray(e)) {
            out.push(...e);
          } else {
            out.push(e);
          }
        }
        return out;
      } catch (err) {
        console.warn('Webhook: normalizeEvents failed to parse events', err);
        return null;
      }
    }
    const incomingEvents = normalizeEvents(payload.scans || payload.event_details || null);
    const updateData = {
      shiprocket_status: current_status,
      shiprocket_awb: awb,
      shiprocket_courier: courier
    };
    if (incomingEvents && Array.isArray(incomingEvents)) {
      updateData.shiprocket_events = incomingEvents;
    }
    let matched = false;

    // Helper to merge existing shiprocket_events with incoming events (avoid duplicates)
    async function mergeAndUpdate(whereClause) {
      try {
        const { data: existingRows, error: selErr } = await supabase.from('orders').select('id, shiprocket_events').match(whereClause).limit(1);
        if (selErr) {
          console.error('Webhook: failed to fetch existing events', selErr);
          return null;
        }
        const existing = Array.isArray(existingRows) && existingRows.length > 0 ? existingRows[0].shiprocket_events : null;
        let merged = null;
        if (incomingEvents && Array.isArray(incomingEvents)) {
          const incoming = incomingEvents;
          const existingArr = normalizeEvents(existing) || [];
          const seen = new Set(existingArr.map(e => {
            try { return JSON.stringify(e); } catch (err) { return String(e); }
          }));
          for (const it of incoming) {
            const key = (() => { try { return JSON.stringify(it); } catch (err) { return String(it); } })();
            if (!seen.has(key)) {
              existingArr.push(it);
              seen.add(key);
            }
          }
          existingArr.sort((a, b) => {
            const da = a && a.date ? Date.parse(a.date) : 0;
            const db = b && b.date ? Date.parse(b.date) : 0;
            if (da && db) return da - db;
            if (da) return -1;
            if (db) return 1;
            return 0;
          });
          merged = existingArr;
        }
        const payload = { ...updateData };
        if (merged) payload.shiprocket_events = merged;
        const { data, error } = await supabase.from('orders').update(payload).match(whereClause).select();
        if (error) console.error('Webhook update failed', whereClause, error);
        return Array.isArray(data) && data.length > 0 ? data : null;
      } catch (e) {
        console.error('mergeAndUpdate error', e);
        return null;
      }
    }
    try {
      if (shipment_id) {
        const result = await mergeAndUpdate({ shiprocket_shipment_id: String(shipment_id) });
        if (result) matched = true;
      }
      if (!matched && srOrderId != null) {
        const result = await mergeAndUpdate({ shiprocket_order_id: srOrderId });
        if (result) matched = true;
      }
      if (!matched && order_id) {
        const result = await mergeAndUpdate({ order_code: order_id });
        if (result) matched = true;
      }
      if (!matched && awb) {
        const awbStr = String(awb);
        const result = await mergeAndUpdate({ shiprocket_awb: awbStr });
        if (result) matched = true;
      }
    } catch (e) {
      console.error('Error updating order from webhook:', e);
    }
    if (!matched) {
      console.warn('Webhook received but no matching order found', { order_id, shipment_id, awb });
      try {
        const candidates = await Promise.all([
          shipment_id ? supabase.from('orders').select('order_code,shiprocket_shipment_id,shiprocket_order_id,shiprocket_awb').eq('shiprocket_shipment_id', String(shipment_id)).limit(5) : Promise.resolve({ data: [] }),
          srOrderId != null ? supabase.from('orders').select('order_code,shiprocket_shipment_id,shiprocket_order_id,shiprocket_awb').eq('shiprocket_order_id', srOrderId).limit(5) : Promise.resolve({ data: [] }),
          order_id ? supabase.from('orders').select('order_code,shiprocket_shipment_id,shiprocket_order_id,shiprocket_awb').eq('order_code', order_id).limit(5) : Promise.resolve({ data: [] }),
          awb ? supabase.from('orders').select('order_code,shiprocket_shipment_id,shiprocket_order_id,shiprocket_awb').eq('shiprocket_awb', String(awb)).limit(5) : Promise.resolve({ data: [] })
        ]);
        console.log('Webhook debug candidates:', {
          by_shipment_id: candidates[0]?.data || [],
          by_shiprocket_order_id: candidates[1]?.data || [],
          by_order_code: candidates[2]?.data || [],
          by_awb: candidates[3]?.data || []
        });
      } catch (dbgErr) {
        console.error('Webhook debug fetch failed:', dbgErr);
      }
      return res.status(200).json({ success: true, matched: false });
    }
    return res.status(200).json({ success: true, matched: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Register both the old internal route (kept for compatibility) and the new neutral route.
// If `externalWebhookHandler` is loaded at startup it will be used; otherwise
// fall back to the built-in `logisticsWebhookHandler` defined above.
function webhookRouter(handlerA, handlerB) {
  return async function (req, res) {
    try {
      if (externalWebhookHandler) return await externalWebhookHandler(req, res);
      return await handlerA(req, res);
    } catch (e) {
      // Last-resort fallback: try the other handler
      try { return await handlerB(req, res); } catch (e2) { console.error('Webhook router failure', e, e2); res.status(500).json({ error: 'internal' }); }
    }
  };
}

app.post('/api/logistics/webhook', webhookRouter(logisticsWebhookHandler, logisticsWebhookHandler));
app.post('/api/shiprocket-webhook', webhookRouter(logisticsWebhookHandler, logisticsWebhookHandler));

// Shiprocket status sync endpoint (for status refresh and AWB sync)
app.post('/api/shiprocket-status', async (req, res) => {
  try {
    // getShipmentStatus provided by dynamic import
    const { shipment_id, order_code } = req.body;
    if (!shipment_id || !order_code) {
      return res.status(400).json({ error: 'shipment_id and order_code required' });
    }
    // Fetch existing order to find shiprocket_order_id and last-known state
    const { data: existingRows, error: fetchErr } = await supabase.from('orders').select('id,shiprocket_order_id,shiprocket_awb,shiprocket_courier,shiprocket_status').eq('order_code', order_code).limit(1);
    if (fetchErr || !existingRows || existingRows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    const existing = existingRows[0];
    let tracking = null;
    try {
      if (existing.shiprocket_order_id) {
        tracking = await getTracking({ order_id: String(existing.shiprocket_order_id) });
      } else {
        console.warn('shiprocket-status (server): missing shiprocket_order_id for', order_code);
      }
    } catch (err) {
      console.warn('shiprocket-status (server): tracking fetch failed', err?.message || err);
      return res.status(200).json({ status: existing.shiprocket_status, awb: existing.shiprocket_awb, courier: existing.shiprocket_courier, order: existing, message: 'Tracking unavailable; returning last known status' });
    }
    // Extract AWB/courier/track_url if tracking present; do NOT mutate status here
    let awb_code = existing.shiprocket_awb || null;
    let courier_company_name = existing.shiprocket_courier || null;
    let track_url = existing.shiprocket_track_url || null;
    if (tracking && tracking.tracking_data) {
      const trackData = tracking.tracking_data;
      awb_code = trackData?.shipment_status?.awb_code || trackData?.shipment_track?.[0]?.awb_code || trackData?.awb || awb_code;
      courier_company_name = trackData?.shipment_status?.courier_company_name || trackData?.shipment_track?.[0]?.courier_name || trackData?.courier_company_name || courier_company_name;
      track_url = trackData?.track_url || track_url;
    }
    // Update only AWB/courier/track_url
    const { data: updated, error: upErr } = await supabase.from('orders').update({ shiprocket_awb: awb_code, shiprocket_courier: courier_company_name, shiprocket_track_url: track_url }).eq('order_code', order_code).select();
    if (upErr) {
      console.warn('shiprocket-status (server): failed to update tracking fields', upErr);
    }
    return res.status(200).json({ status: existing.shiprocket_status, awb: awb_code, courier: courier_company_name, order: updated && updated[0] ? updated[0] : existing });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Shiprocket Invoice Download and Status Update endpoint
app.get('/api/shiprocket-invoice/:shipment_id', async (req, res) => {
  try {
    // downloadInvoice and getShipmentStatus provided by dynamic import
    const shipment_id = req.params.shipment_id;
    // Download invoice PDF from Shiprocket
    const pdf = await downloadInvoice(shipment_id);
    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', pdf.contentDisposition);
    // Send PDF buffer (ensure Buffer type)
    res.end(Buffer.from(pdf.buffer));
    // After sending PDF, update tracking fields in DB asynchronously (do not call deprecated shipment endpoints)
    (async () => {
      try {
        const { data: rows } = await supabase.from('orders').select('shiprocket_order_id, shiprocket_awb, shiprocket_courier, shiprocket_status').eq('shiprocket_shipment_id', shipment_id).limit(1);
        const existing = Array.isArray(rows) && rows.length ? rows[0] : null;
        let awb_code = existing?.shiprocket_awb || null;
        let courier_company_name = existing?.shiprocket_courier || null;
        let shiprocket_status = existing?.shiprocket_status || null;
        if (existing && existing.shiprocket_order_id) {
          try {
            const tracking = await getTracking({ order_id: String(existing.shiprocket_order_id) });
            const trackData = tracking?.tracking_data;
            if (trackData) {
              awb_code = trackData?.shipment_status?.awb_code || trackData?.shipment_track?.[0]?.awb_code || trackData?.awb || awb_code;
              courier_company_name = trackData?.shipment_status?.courier_company_name || trackData?.shipment_track?.[0]?.courier_name || courier_company_name;
              shiprocket_status = trackData?.shipment_status?.current_status || trackData?.shipment_track?.[0]?.current_status || shiprocket_status;
            }
          } catch (e) {
            console.warn('Invoice async: tracking fetch failed', e?.message || e);
          }
        }
        // Update AWB/courier/track_url and mark order as INVOICED; do not overwrite status if tracking missing
        const updates = { order_status: 'INVOICED' };
        if (awb_code) updates.shiprocket_awb = awb_code;
        if (courier_company_name) updates.shiprocket_courier = courier_company_name;
        if (existing && existing.shiprocket_order_id && typeof shiprocket_status === 'string') updates.shiprocket_status = shiprocket_status;
        await supabase.from('orders').update(updates).eq('shiprocket_shipment_id', shipment_id);
      } catch (err) {
        console.error('Failed to update status after invoice download:', err);
      }
    })();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// New endpoint: Download invoice PDF by shipment_id
app.get('/api/shiprocket-invoice', async (req, res) => {
  const shipment_id = req.query.shipment_id;
  if (!shipment_id) {
    return res.status(400).json({ error: 'shipment_id required' });
  }
  try {
    // Look up Shiprocket numeric order_id for this shipment_id
    const { data: rows, error } = await supabase.from('orders').select('shiprocket_order_id').eq('shiprocket_shipment_id', shipment_id).limit(1);
    if (error || !rows || rows.length === 0) return res.status(404).json({ error: 'Order not found for this shipment_id' });
    const shiprocketOrderId = rows[0].shiprocket_order_id;
    if (!shiprocketOrderId) return res.status(400).json({ error: 'No shiprocket_order_id found for this shipment_id' });

    // Call Shiprocket POST /orders/print/invoice with { ids: [orderId] }
    const srResp = await fetchInvoiceUrlRaw(shiprocketOrderId);
    try { console.log('Shiprocket invoice raw response (server):', JSON.stringify(srResp)); } catch (e) {}

    const invoice_url = srResp && srResp.data && srResp.data.invoice_url ? srResp.data.invoice_url : null;
    if (invoice_url) {
      // If caller requested to skip DB update (frontend wants to just open invoice), respect that flag
      const skipUpdate = req.query && (String(req.query.skip_update || req.query.skipUpdate || req.query.no_update || req.query.noUpdate || '').toLowerCase() === '1' || String(req.query.skip_update || req.query.skipUpdate || req.query.no_update || req.query.noUpdate || '').toLowerCase() === 'true');
      if (!skipUpdate) {
        // Optionally update DB to INVOICED
        await supabase.from('orders').update({ shiprocket_status: 'INVOICED', order_status: 'INVOICED' }).eq('shiprocket_shipment_id', shipment_id);
      }
      return res.status(200).json({ invoice_url });
    }

    // No invoice URL yet — return a clear client-friendly message
    const details = (srResp && srResp.data && (srResp.data.message || srResp.data.error)) ? (srResp.data.message || srResp.data.error) : `Shiprocket returned status ${srResp && srResp.status}`;
    return res.status(409).json({ error: 'Invoice not generated yet', details });
  } catch (err) {
    res.status(500).json({ error: 'Invoice download failed: ' + (err.message || err) });
  }
});

// Central Shiprocket actions handler (single or bulk)
app.post('/api/shiprocket-actions', async (req, res) => {
  const { action, ids } = req.body || {};
  if (!action) return res.status(400).json({ error: 'action required' });
  if (!ids) return res.status(400).json({ error: 'ids required (array of shiprocket_order_id)' });
  const orderIds = Array.isArray(ids) ? ids.map(Number).filter(Boolean) : [Number(ids)].filter(Boolean);
  if (!orderIds.length) return res.status(400).json({ error: 'no valid shiprocket order ids provided' });

  try {
    // Fetch orders matching provided Shiprocket order ids
    const { data: rows, error } = await supabase.from('orders').select('id, shiprocket_order_id, shiprocket_shipment_id, shiprocket_awb, shiprocket_status, shiprocket_events, shiprocket_track_url, shiprocket_courier').in('shiprocket_order_id', orderIds);
    if (error) {
      console.error('shiprocket-actions: DB lookup failed', error);
      return res.status(500).json({ error: 'DB lookup failed' });
    }
    const byOrderId = (rows || []).reduce((acc, r) => { acc[r.shiprocket_order_id] = r; return acc; }, {});

    const results = { success: [], skipped: [], errors: [] };

    // Helper to record skip
    function skip(id, reason) { results.skipped.push({ id, reason }); }
    function recordSuccess(id, info) { results.success.push({ id, info }); }
    function recordError(id, err) { results.errors.push({ id, error: String(err) }); }

    // Helper: fetch full DB row and filter update keys to only existing columns
    async function filterUpdatesToExisting(rowId, updates) {
      try {
        const { data: fullRows, error: fullErr } = await supabase.from('orders').select('*').eq('id', rowId).limit(1);
        if (fullErr) return { filtered: {}, error: fullErr };
        const existing = Array.isArray(fullRows) && fullRows.length ? fullRows[0] : null;
        if (!existing) return { filtered: {}, error: new Error('existing row not found') };
        const allowed = Object.keys(existing);
        const filtered = {};
        for (const k of Object.keys(updates)) {
          if (allowed.includes(k)) filtered[k] = updates[k];
          else console.warn('[shiprocket-actions] skipping update key not in table:', k);
        }
        return { filtered };
      } catch (e) {
        return { filtered: {}, error: e };
      }
    }

    // Validate and execute per-action
    for (const oid of orderIds) {
      const row = byOrderId[oid];
      if (!row) { skip(oid, 'order not found'); continue; }
      const status = (row.shiprocket_status || '').toLowerCase();

      try {
        if (action === 'ship') {
          // Ship (generate AWB) - requires shipment_id and currently only allowed when status is NEW
          if (!row.shiprocket_shipment_id) { skip(oid, 'no shipment id'); continue; }
          if (!status.includes('new')) { skip(oid, 'can only ship orders in NEW status'); continue; }
          // call generateAWB per shipment
          try {
            const resp = await generateAWB(row.shiprocket_shipment_id);
            const awbCode = resp.awb_code || resp.raw?.response?.data?.awb_code || null;
            const courierName = resp.courier_name || resp.raw?.response?.data?.courier_name || null;
            // Update DB: set AWB and mark as Ready To Ship so UI reflects new state
            try {
              await supabase.from('orders').update({ shiprocket_awb: awbCode, shiprocket_courier: courierName, shiprocket_status: 'Ready To Ship' }).eq('id', row.id);
            } catch (dbErr) {
              console.error('Failed to update order after AWB generation for', oid, dbErr);
            }
            recordSuccess(oid, { awb: awbCode });
          } catch (e) { recordError(oid, e.message || e); }
        } else if (action === 'download_invoice') {
          // Get invoice URL via Shiprocket order ID
          try {
            const sr = await fetchInvoiceUrlRaw(oid);
            const url = sr && sr.data && sr.data.invoice_url ? sr.data.invoice_url : null;
            if (url) recordSuccess(oid, { invoice_url: url }); else skip(oid, 'invoice not generated yet');
          } catch (e) { recordError(oid, e.message || e); }
        } else if (action === 'download_label') {
          // Label requires shipment_id and AWB may be present
          if (!row.shiprocket_shipment_id) { skip(oid, 'no shipment id'); continue; }
          try {
            const labelUrl = await getLabel(row.shiprocket_shipment_id);
            if (labelUrl) recordSuccess(oid, { label_url: labelUrl }); else skip(oid, 'label not available');
          } catch (e) { recordError(oid, e.message || e); }
        } else if (action === 'sync_order') {
          // Sync order-level details from Shiprocket using order_id tracking response
          if (!row.shiprocket_order_id) { skip(oid, 'no shiprocket_order_id'); continue; }
          try {
            // Use Shiprocket orders/show endpoint to fetch authoritative order details
            try {
              const odResp = await getOrderDetails(oid);
              const od = odResp?.data || odResp;
              console.log('[shiprocket-actions] sync_order: orders/show response keys:', Object.keys(od || {}));
              const updates = {};
              // Order-level status
              const fetchedStatus = od?.status || od?.order_status || od?.order_status_label || od?.shipment_status || null;
              if (fetchedStatus && String(fetchedStatus).toLowerCase() !== String(row.shiprocket_status || '').toLowerCase()) updates.shiprocket_status = fetchedStatus;
                  // Respect caller intent: allow skipping DB updates by passing skip_update=1 or skip_update=true as a query param
                  const skipUpdate = req.query && (String(req.query.skip_update || req.query.skipUpdate || req.query.no_update || req.query.noUpdate || '').toLowerCase() === '1' || String(req.query.skip_update || req.query.skipUpdate || req.query.no_update || req.query.noUpdate || '').toLowerCase() === 'true');
                  if (!skipUpdate) {
                    const updates = { order_status: 'INVOICED' };
                    if (awb_code) updates.shiprocket_awb = awb_code;
                    if (courier_company_name) updates.shiprocket_courier = courier_company_name;
                    if (existing && existing.shiprocket_order_id && typeof shiprocket_status === 'string') updates.shiprocket_status = shiprocket_status;
                    await supabase.from('orders').update(updates).eq('shiprocket_shipment_id', shipment_id);
                  }
              const fetchedPayment = od?.payment_status || od?.paymentStatus || null;
              if (fetchedPayment && fetchedPayment !== row.payment_status) updates.payment_status = fetchedPayment;
              // Order value/total
              const fetchedValue = od?.amount || od?.order_value || od?.total || od?.grand_total || od?.final_price || null;
              if ((typeof fetchedValue !== 'undefined') && fetchedValue !== null && Number(fetchedValue) !== Number(row.price || row.total || 0)) updates.price = Number(fetchedValue);
              // Customer details (non-destructive)
              const fetchedCustomerName = od?.billing_customer_name || od?.customer_name || (od?.billing && od.billing.name) || null;
              if (fetchedCustomerName && (!row.customer_name || row.customer_name !== fetchedCustomerName)) updates.customer_name = fetchedCustomerName;
              // Track URL
              const fetchedTrackUrl = od?.tracking_url || od?.track_url || od?.data?.track_url || null;
              if (fetchedTrackUrl && fetchedTrackUrl !== row.shiprocket_track_url) updates.shiprocket_track_url = fetchedTrackUrl;
              // If Shiprocket returned shipment objects, try to pull shipment_id/awb/courier
              const shipments = od?.shipments || od?.data?.shipments || od?.shipment || null;
              if (Array.isArray(shipments) && shipments.length) {
                const first = shipments[0];
                const sid = first?.shipment_id || first?.id || first?.shipmentId || null;
                const awb = first?.awb || first?.awb_code || first?.tracking_number || null;
                const courier = first?.courier || first?.courier_name || null;
                if (sid && !row.shiprocket_shipment_id) updates.shiprocket_shipment_id = sid;
                if (awb && awb !== row.shiprocket_awb) updates.shiprocket_awb = awb;
                if (courier && courier !== row.shiprocket_courier) updates.shiprocket_courier = courier;
              }
              if (Object.keys(updates).length) {
                try {
                  console.log('[shiprocket-actions] sync_order: updating DB for oid', oid, 'id', row.id, 'updates', updates);
                  const { filtered, error: filterErr } = await filterUpdatesToExisting(row.id, updates);
                  if (filterErr) {
                    console.error('[shiprocket-actions] sync_order: failed to fetch existing row for filtering', filterErr);
                    recordError(oid, filterErr.message || filterErr);
                  } else if (!filtered || Object.keys(filtered).length === 0) {
                    console.log('[shiprocket-actions] sync_order: no valid columns to update after filtering for oid', oid);
                    skip(oid, 'no valid columns to update');
                  } else {
                    const { data: upData, error: upErr } = await supabase.from('orders').update(filtered).eq('id', row.id).select();
                    if (upErr) {
                      console.error('[shiprocket-actions] sync_order: DB update failed for oid', oid, upErr);
                      recordError(oid, upErr.message || upErr);
                    } else {
                      recordSuccess(oid, { updated: Object.keys(filtered), db: Array.isArray(upData) && upData.length ? upData[0] : upData });
                    }
                  }
                } catch (dbEx) {
                  console.error('[shiprocket-actions] sync_order: unexpected DB update exception for oid', oid, dbEx);
                  recordError(oid, dbEx.message || dbEx);
                }
              } else {
                skip(oid, 'no changes');
              }
            } catch (e2) {
              recordError(oid, e2.message || e2);
            }
          } catch (e) { recordError(oid, e.message || e); }
        } else if (action === 'sync_shipment') {
          // Sync shipment-level details using the authoritative Shiprocket /shipments/{id} endpoint
          if (!row.shiprocket_shipment_id) { skip(oid, 'no shipment id'); continue; }
          try {
            let sresp = null;
            try {
              console.log('[shiprocket-actions] sync_shipment: calling getShipmentDetails for shipment_id', row.shiprocket_shipment_id, 'oid', oid);
              sresp = await getShipmentDetails(row.shiprocket_shipment_id);
            } catch (err) {
              const msg = err && err.message ? err.message : String(err);
              if (msg.includes('404')) {
                skip(oid, 'shipment not found (404)');
                continue;
              }
              throw err;
            }

            const s = sresp?.data || sresp || {};
            console.log('[shiprocket-actions] sync_shipment: shipment response keys:', Object.keys(s || {}));

            // Conservative parsing of possible fields
            const fetchedAwb = s?.awb || s?.awb_code || s?.tracking_number || s?.data?.awb || s?.data?.awb_code || null;
            const fetchedCourier = s?.courier || s?.courier_name || s?.data?.courier_name || null;
            const rawFetchedStatus = s?.status || s?.shipment_status || s?.current_status || s?.data?.shipment_status || null;
            const mapStatus = (val) => {
              if (val == null) return null;
              if (typeof val === 'number') return (typeof SHIPROCKET_STATUS_MAP !== 'undefined' && SHIPROCKET_STATUS_MAP[val]) ? SHIPROCKET_STATUS_MAP[val] : String(val);
              if (typeof val === 'string' && /^\d+$/.test(val)) {
                const n = Number(val);
                return (typeof SHIPROCKET_STATUS_MAP !== 'undefined' && SHIPROCKET_STATUS_MAP[n]) ? SHIPROCKET_STATUS_MAP[n] : val;
              }
              return val;
            };
            const fetchedStatus = mapStatus(rawFetchedStatus);
            const fetchedPickup = s?.pickup_status || s?.data?.pickup_status || null;
            const fetchedManifest = s?.manifest_status || s?.data?.manifest_status || null;
            const fetchedTrackUrl = s?.track_url || s?.tracking_url || s?.data?.tracking_url || null;

            const updates = {};
            if (fetchedAwb && fetchedAwb !== row.shiprocket_awb) updates.shiprocket_awb = fetchedAwb;
            if (fetchedCourier && fetchedCourier !== row.shiprocket_courier) updates.shiprocket_courier = fetchedCourier;
            if (fetchedTrackUrl && fetchedTrackUrl !== row.shiprocket_track_url) updates.shiprocket_track_url = fetchedTrackUrl;
            if (fetchedStatus && String(fetchedStatus).toLowerCase() !== String(row.shiprocket_status || '').toLowerCase()) updates.shiprocket_status = fetchedStatus;
            if (fetchedPickup) updates.shiprocket_pickup_status = fetchedPickup;
            if (fetchedManifest) updates.shiprocket_manifest_status = fetchedManifest;

            if (Object.keys(updates).length) {
              try {
                const { filtered, error: filterErr } = await filterUpdatesToExisting(row.id, updates);
                if (filterErr) {
                  console.error('[shiprocket-actions] sync_shipment: failed to fetch existing row for filtering', filterErr);
                  recordError(oid, filterErr.message || filterErr);
                } else if (!filtered || Object.keys(filtered).length === 0) {
                  console.log('[shiprocket-actions] sync_shipment: no valid columns to update after filtering for oid', oid);
                  skip(oid, 'no valid columns to update');
                } else {
                  const { data: upData, error: upErr } = await supabase.from('orders').update(filtered).eq('id', row.id).select();
                  if (upErr) {
                    console.error('[shiprocket-actions] sync_shipment: DB update failed for oid', oid, upErr);
                    recordError(oid, upErr.message || upErr);
                  } else {
                    recordSuccess(oid, { updated: Object.keys(filtered), db: Array.isArray(upData) && upData.length ? upData[0] : upData });
                  }
                }
              } catch (e) { recordError(oid, e.message || e); }
            } else {
              skip(oid, 'no shipment changes');
            }
          } catch (e) { recordError(oid, e.message || e); }
        } else if (action === 'sync_tracking') {
          // Sync tracking events and status; append new scans only
          if (!row.shiprocket_order_id && !row.shiprocket_awb) { skip(oid, 'no order_id or awb'); continue; }
          try {
            // Prefer AWB for tracking if available, otherwise fallback to order_id
            const trackParam = row.shiprocket_awb ? { awb: String(row.shiprocket_awb) } : { order_id: String(oid) };
            console.log('[shiprocket-actions] sync_tracking: fetching tracking with', trackParam, 'for oid', oid);
            const tr = await getTracking(trackParam);
            const fetched = (tr && tr.tracking_data) ? tr.tracking_data : tr;
            const nested = (fetched && fetched.shipment_track && fetched.shipment_track[0]) ? fetched.shipment_track[0] : null;
            const fetchedEvents = nested && Array.isArray(nested.scan_details) ? nested.scan_details : (fetched && Array.isArray(fetched.shipment_track) ? fetched.shipment_track : []);
            const existing = Array.isArray(row.shiprocket_events) ? row.shiprocket_events : [];
            // Normalize events to { date, activity, location }
            const normalize = ev => {
              if (!ev) return null;
              const date = ev.date || ev.scan_date || ev.activity_date || ev.timestamp || ev.scanned_at || null;
              const activity = ev.activity || ev.activity_type || ev.status || ev.activity_text || ev.message || ev.sr_status_label || ev.status_label || null;
              const location = ev.location || ev.scan_location || ev.city || null;
              return { date, activity, location, raw: ev };
            };
            const newEvents = [];
            for (const fe of fetchedEvents || []) {
              const n = normalize(fe);
              if (!n || !n.date || !n.activity) continue;
              const duplicate = existing.some(ex => String(ex.date) === String(n.date) && String((ex.activity||'')).trim() === String((n.activity||'')).trim());
              if (!duplicate) newEvents.push(n);
            }
            const updates = {};
            if (newEvents.length) {
              updates.shiprocket_events = existing.concat(newEvents).slice(-500); // keep recent 500
            }
            const fetchedStatus = nested?.current_status || fetched?.shipment_status || nested?.status || null;
            if (fetchedStatus) {
              const cur = row.shiprocket_status || '';
              let shouldUpdate = false;
              if (typeof isProgressionAllowed === 'function') {
                shouldUpdate = isProgressionAllowed(String(cur), String(fetchedStatus));
              } else {
                shouldUpdate = String(fetchedStatus).toLowerCase() !== String(cur).toLowerCase();
              }
              if (shouldUpdate) updates.shiprocket_status = fetchedStatus;
            }
            if (Object.keys(updates).length) {
              try {
                const { filtered, error: filterErr } = await filterUpdatesToExisting(row.id, updates);
                if (filterErr) {
                  console.error('[shiprocket-actions] sync_tracking: failed to fetch existing row for filtering', filterErr);
                  recordError(oid, filterErr.message || filterErr);
                } else if (!filtered || Object.keys(filtered).length === 0) {
                  console.log('[shiprocket-actions] sync_tracking: no valid columns to update after filtering for oid', oid);
                  skip(oid, 'no valid columns to update');
                } else {
                  const { data: upData, error: upErr } = await supabase.from('orders').update(filtered).eq('id', row.id).select();
                  if (upErr) {
                    console.error('[shiprocket-actions] sync_tracking: DB update failed for oid', oid, upErr);
                    recordError(oid, upErr.message || upErr);
                  } else {
                    recordSuccess(oid, { appended: newEvents.length, updatedStatus: !!filtered.shiprocket_status, db: Array.isArray(upData) && upData.length ? upData[0] : upData });
                  }
                }
              } catch (e) { recordError(oid, e.message || e); }
            } else {
              skip(oid, 'no new tracking data');
            }
          } catch (e) { recordError(oid, e.message || e); }
        } else if (action === 'cancel') {
          // Cancel: allow cancelling at any stage (server will attempt Shiprocket cancel)
          try {
            const cr = await cancelOrders([oid]);
            // Update DB row to mark as cancelled so UI reflects change immediately
            try {
              await supabase.from('orders').update({ shiprocket_status: 'Cancelled' }).eq('id', row.id);
            } catch (dbErr) {
              console.error('Failed to update order status to Cancelled for', oid, dbErr);
            }
            recordSuccess(oid, { raw: cr });
          } catch (e) { recordError(oid, e.message || e); }
        } else if (action === 'generate_manifest') {
          // Manifest generation is not implemented in this integration
          skip(oid, 'manifest generation not implemented');
        } else {
          return res.status(400).json({ error: 'unknown action' });
        }
      } catch (err) {
        recordError(oid, err.message || err);
      }
    }

    // For bulk cancel, etc. we have already performed per-id calls; could improve batching later
    // Log results server-side
    console.log('shiprocket-actions results:', JSON.stringify(results));
    return res.status(200).json(results);
  } catch (err) {
    console.error('shiprocket-actions failed', err);
    return res.status(500).json({ error: 'Action processing failed' });
  }
});

// Delete one or more orders by DB id
app.post('/api/orders/delete', async (req, res) => {
  const { ids } = req.body || {};
  if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids required (array of DB order ids)' });
  try {
    const { error } = await supabase.from('orders').delete().in('id', ids);
    if (error) {
      console.error('Failed to delete orders', error);
      return res.status(500).json({ error: 'DB delete failed' });
    }
    return res.status(200).json({ deleted: ids.length });
  } catch (err) {
    console.error('orders/delete failed', err);
    return res.status(500).json({ error: 'orders/delete failed' });
  }
});

const PORT = process.env.PORT || 5000;

// Dynamically import ES module shiprocketService and then start the server
(async () => {
  try {
    const sr = await import('./src/lib/shiprocketService.js');
    createShipment = sr.createShipment;
    downloadInvoice = sr.downloadInvoice;
    printAndDownloadInvoice = sr.printAndDownloadInvoice;
    fetchInvoiceUrlRaw = sr.fetchInvoiceUrlRaw;
    getTracking = sr.getTracking;
    generateAWB = sr.generateAWB;
    getLabel = sr.getLabel;
    cancelOrders = sr.cancelOrders;
    getShipmentStatus = sr.getShipmentStatus;
    getOrderDetails = sr.getOrderDetails;
    getShipmentDetails = sr.getShipmentDetails;
    console.log('shiprocketService loaded');

    // Load normalizer helpers (ESM) for progression checks
    try {
      const norm = await import('./src/lib/shiprocket-normalizer.js');
      normalizeStatus = norm.normalizeStatus || norm.default?.normalizeStatus;
      isProgressionAllowed = norm.isProgressionAllowed || norm.default?.isProgressionAllowed;
      isFinalStatus = norm.isFinalStatus || norm.default?.isFinalStatus;
      console.log('shiprocket-normalizer loaded');
    } catch (e) {
      console.warn('Failed to load shiprocket-normalizer in server.cjs:', e?.message || e);
    }

    // Try to load the richer external webhook handler (ESM). If it loads,
    // route webhook requests to it; otherwise continue using the built-in
    // `logisticsWebhookHandler` defined in this file.
    try {
      const wh = await import('./api/shiprocket-webhook.js');
      if (wh && (wh.default || typeof wh === 'function')) {
        externalWebhookHandler = wh.default || wh;
        console.log('External shiprocket-webhook handler loaded and will be used');
      }
    } catch (e) {
      console.warn('External shiprocket-webhook handler not available:', e?.message || e);
    }

    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (err) {
    console.error('Failed to load shiprocketService module:', err);
    process.exit(1);
  }
})();

// Shiprocket status code to description mapping (updated)
const SHIPROCKET_STATUS_MAP = {
  1: 'New',
  2: 'Invoiced',
  3: 'Ready To Ship',
  4: 'Pickup Scheduled',
  5: 'Canceled',
  6: 'Shipped',
  7: 'Delivered',
  8: 'ePayment Failed',
  9: 'Returned',
  10: 'Unmapped',
  11: 'Unfulfillable',
  12: 'Pickup Queue',
  13: 'Pickup Rescheduled',
  14: 'Pickup Error',
  15: 'RTO Initiated',
  16: 'RTO Delivered',
  17: 'RTO Acknowledged',
  18: 'Cancellation Requested',
  19: 'Out for Delivery',
  20: 'In Transit',
  21: 'Return Pending',
  22: 'Return Initiated',
  23: 'Return Pickup Queued',
  24: 'Return Pickup Error',
  25: 'Return In Transit',
  26: 'Return Delivered',
  27: 'Return Cancelled',
  28: 'Return Pickup Generated',
  29: 'Return Cancellation Requested',
  30: 'Return Pickup Cancelled',
  31: 'Return Pickup Rescheduled',
  32: 'Return Picked Up',
  33: 'Lost',
  34: 'Out For Pickup',
  35: 'Pickup Exception',
  36: 'Undelivered',
  37: 'Delivery Delayed',
  38: 'Partial Delivered',
  39: 'Destroyed',
  40: 'Damaged',
  41: 'Fulfilled',
  42: 'Archived',
  43: 'Reached Destination Hub',
  44: 'Misrouted',
  45: 'RTO_OFD',
  46: 'RTO_NDR',
  47: 'Return Out For Pickup',
  48: 'Return Out For Delivery',
  49: 'Return Pickup Exception',
  50: 'Return Undelivered',
  51: 'Picked Up',
  52: 'Self Fulfilled',
  53: 'Disposed Off',
  54: 'Canceled before Dispatched',
  55: 'RTO In-Transit',
  57: 'QC Failed',
  58: 'Reached Warehouse',
  59: 'Custom Cleared',
  60: 'In Flight',
  61: 'Handover to Courier',
  62: 'Booked',
  64: 'In Transit Overseas',
  65: 'Connection Aligned',
  66: 'Reached Overseas Warehouse',
  67: 'Custom Cleared Overseas',
  68: 'RETURN ACKNOWLEGED',
  69: 'Box Packing',
  70: 'Pickup Booked',
  71: 'DARKSTORE SCHEDULED',
  72: 'Allocation in Progress',
  73: 'FC Allocated',
  74: 'Picklist Generated',
  75: 'Ready to Pack',
  76: 'Packed',
  80: 'FC MANIFEST GENERATED',
  81: 'PROCESSED AT WAREHOUSE',
  82: 'PACKED EXCEPTION',
  83: 'HANDOVER EXCEPTION',
  87: 'RTO_LOCK',
  88: 'UNTRACEABLE',
  89: 'ISSUE_RELATED_TO_THE_RECIPIENT',
  90: 'REACHED_BACK_AT_SELLER_CITY'
};

// Cancel a Shiprocket order by internal order id (server-side)
app.post('/api/shiprocket-cancel-order', async (req, res) => {
  try {
    const { order_id } = req.body || {};
    if (!order_id) return res.status(400).json({ error: 'order_id required' });
    // Fetch order to find shiprocket identifiers
    const { data: rows, error: fetchErr } = await supabase.from('orders').select('id, order_code, shiprocket_order_id, shiprocket_awb').eq('id', order_id).limit(1);
    if (fetchErr) return res.status(500).json({ error: 'DB lookup failed', details: fetchErr });
    const order = Array.isArray(rows) && rows.length ? rows[0] : null;
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Disallow cancelling after AWB assigned
    if (order.shiprocket_awb) {
      return res.status(400).json({ error: 'Cannot cancel after AWB assignment' });
    }

    // Need Shiprocket numeric order id to cancel
    const srOrderId = order.shiprocket_order_id;
    if (!srOrderId) return res.status(400).json({ error: 'Shiprocket order id missing; cannot cancel via Shiprocket' });

    // Call Shiprocket cancel API
    try {
      const result = await cancelOrders([Number(srOrderId)]);
      // Determine cancellation metadata: prefer explicit values from caller (reason/comment/cancelled_by)
      const body = req.body || {};
      const providedReason = body.reason || body.cancel_reason || null;
      const providedComment = body.comment || body.cancel_comment || null;
      const providedBy = body.cancelled_by || (providedReason ? 'user' : 'admin');
      const cancelReasonFinal = providedReason || (providedBy === 'admin' ? 'Cancelled by Admin' : null);
      const cancelCommentFinal = providedComment || null;
      const cancelledAt = new Date().toISOString();

      // On success, update local order_status to cancelled and write metadata
      const { data: updData, error: updErr } = await supabase.from('orders').update({
        order_status: 'cancelled',
        shiprocket_status: 'Canceled',
        cancelled_by: providedBy,
        cancel_reason: cancelReasonFinal,
        cancel_comment: cancelCommentFinal,
        cancelled_at: cancelledAt,
      }).eq('id', order.id).select();
      if (updErr) {
        console.error('Failed to write cancellation metadata to DB', updErr);
        // Return success for Shiprocket cancel but include DB write error details
        return res.status(200).json({ success: true, result, db_update_error: String(updErr) });
      }
      return res.json({ success: true, result, updated: updData });
    } catch (e) {
      console.error('Shiprocket cancel failed', e?.message || e);
      return res.status(502).json({ error: 'Shiprocket cancel failed', details: e?.message || e });
    }
  } catch (err) {
    console.error('shiprocket-cancel-order exception', err);
    return res.status(500).json({ error: err?.message || err });
  }
});

// Admin: suspend (permanently delete) a user and their profile/avatar.
// Protect with a header `x-admin-secret` matching ADMIN_API_SECRET env var.
app.post('/api/admin/suspend-user', async (req, res) => {
  try {
    // Role-based admin check: require Authorization: Bearer <access_token>
    const authHeader = req.headers.authorization || req.headers.Authorization || null;
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return res.status(401).json({ error: 'Authorization Bearer token required' });
    }
    const token = authHeader.split(' ')[1];
    // Try to resolve the requesting user from the provided access token
    let requesterId = null;
    try {
      let gu = null;
      try { gu = await supabase.auth.getUser(token); } catch (e) { gu = await supabase.auth.getUser({ access_token: token }); }
      requesterId = gu?.data?.user?.id || gu?.user?.id || null;
    } catch (e) {
      console.warn('suspend-user: failed to resolve user from token', e?.message || e);
    }
    if (!requesterId) return res.status(401).json({ error: 'Invalid or expired token' });

    // Ensure requester is admin according to profiles.role
    const { data: reqProfile, error: reqProfileErr } = await supabase.from('profiles').select('role').eq('id', requesterId).maybeSingle();
    if (reqProfileErr) return res.status(500).json({ error: 'Failed to verify admin role', details: reqProfileErr.message || reqProfileErr });
    const role = reqProfile?.role || null;
    if (!role || !['admin', 'superadmin', 'administrator'].includes(String(role).toLowerCase())) {
      return res.status(403).json({ error: 'Insufficient privileges' });
    }

    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required (profiles.id)' });

    // Fetch profile
    const { data: profile, error: fetchErr } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
    if (fetchErr) return res.status(500).json({ error: 'Failed to fetch profile', details: fetchErr.message || fetchErr });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const result = { id, steps: {} };

    // 1) Delete user from Supabase Auth (service-role)
    try {
      const authUid = profile.id || profile.user_id;
      if (authUid) {
        const { error: delAuthErr } = await supabase.auth.admin.deleteUser(authUid);
        if (delAuthErr) {
          // Build a best-effort message from common error shapes
          const parts = [];
          if (delAuthErr.message) parts.push(delAuthErr.message);
          if (delAuthErr.error) parts.push(delAuthErr.error);
          if (delAuthErr.details) parts.push(delAuthErr.details);
          if (delAuthErr.msg) parts.push(delAuthErr.msg);
          try { parts.push(JSON.stringify(delAuthErr)); } catch (e) { /* ignore */ }
          const msg = parts.filter(Boolean).join(' | ') || String(delAuthErr);
          const lower = String(msg).toLowerCase();
          // Treat any "not found" / 404-style responses as non-fatal (already-deleted)
          const isNotFound = lower.includes('user not found') || lower.includes('not found') || lower.includes('no user') || lower.includes('does not exist') || (delAuthErr && delAuthErr.status === 404);
          if (isNotFound) {
            console.warn('suspend-user: auth user not found or already deleted, continuing', msg);
            result.steps.deleteAuth = { ok: false, warning: 'auth user not found or already deleted', details: msg };
          } else {
            result.steps.deleteAuth = { ok: false, error: msg };
            return res.status(502).json({ error: 'Failed to delete auth user', details: msg });
          }
        } else {
          result.steps.deleteAuth = { ok: true };
        }
      } else {
        result.steps.deleteAuth = { ok: false, warning: 'no auth uid found on profile' };
      }
    } catch (e) {
      console.error('suspend-user: auth delete error', e);
      return res.status(502).json({ error: 'Failed to delete auth user', details: e?.message || e });
    }

    // 2) Delete avatar from storage if we can derive a path
    try {
      const avatarUrl = profile.avatar_url || profile.avatar || profile.avatar_path || null;
      if (avatarUrl && typeof avatarUrl === 'string') {
        // Try to extract path after '/avatars/' if public URL format used
        const m = avatarUrl.match(/\/avatars\/(.+)$/);
        const path = m ? m[1] : null;
        if (path) {
          try {
            const { error: remErr } = await supabase.storage.from('avatars').remove([path]);
            if (remErr) {
              console.warn('suspend-user: failed to remove avatar', remErr);
              result.steps.deleteAvatar = { ok: false, error: remErr.message || remErr };
            } else {
              result.steps.deleteAvatar = { ok: true };
            }
          } catch (re) {
            console.warn('suspend-user: storage remove exception', re);
            result.steps.deleteAvatar = { ok: false, error: re?.message || re };
          }
        } else {
          result.steps.deleteAvatar = { ok: false, warning: 'could not derive storage path from avatar_url' };
        }
      } else {
        result.steps.deleteAvatar = { ok: false, warning: 'no avatar_url present' };
      }
    } catch (e) {
      console.warn('suspend-user: avatar removal failed', e);
      result.steps.deleteAvatar = { ok: false, error: e?.message || e };
    }

    // 3) Delete profile row from DB
    try {
      const { error: delProfileErr } = await supabase.from('profiles').delete().eq('id', id);
      if (delProfileErr) {
        console.error('suspend-user: failed to delete profile', delProfileErr);
        result.steps.deleteProfile = { ok: false, error: delProfileErr.message || delProfileErr };
        return res.status(500).json({ error: 'Failed to delete profile', details: delProfileErr.message || delProfileErr, steps: result.steps });
      }
      result.steps.deleteProfile = { ok: true };
    } catch (e) {
      console.error('suspend-user: delete profile exception', e);
      return res.status(500).json({ error: 'Failed to delete profile', details: e?.message || e, steps: result.steps });
    }

    // 4) Optionally: remove other related rows (quotes, orders) -- left to background jobs or separate API

    return res.status(200).json({ ok: true, steps: result.steps });
  } catch (err) {
    console.error('admin suspend-user exception', err);
    return res.status(500).json({ error: err?.message || err });
  }
});
