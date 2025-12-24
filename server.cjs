require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
// shiprocketService is an ES module; we'll dynamically import it at startup
let createShipment, downloadInvoice, printAndDownloadInvoice, getTracking, generateAWB, getShipmentStatus;
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
// Shiprocket should be configured to call the neutral path below.
app.post('/api/logistics/webhook', logisticsWebhookHandler);
app.post('/api/shiprocket-webhook', logisticsWebhookHandler);

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
    // Use the print endpoint to trigger status change and get the PDF
    const result = await printAndDownloadInvoice(shipment_id);
    if (!result || !result.buffer) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    // Update order status in DB to INVOICED
    await supabase
      .from('orders')
      .update({ shiprocket_status: 'INVOICED', order_status: 'INVOICED' })
      .eq('shiprocket_shipment_id', shipment_id);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', result.contentDisposition);
    res.send(result.buffer);
  } catch (err) {
    res.status(500).json({ error: 'Invoice download failed: ' + (err.message || err) });
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
    getTracking = sr.getTracking;
    generateAWB = sr.generateAWB;
    getShipmentStatus = sr.getShipmentStatus;
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
