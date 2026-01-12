// shiprocketService.js
// Shiprocket API integration for order shipment, pickup, tracking, and label
// Requires: npm install dotenv

import dotenv from 'dotenv';
dotenv.config();

const SHIPROCKET_BASE = 'https://apiv2.shiprocket.in/v1/external';
const EMAIL = process.env.SHIPROCKET_EMAIL;
const PASSWORD = process.env.SHIPROCKET_PASSWORD;
let BEARER_TOKEN = null;
let TOKEN_EXPIRES = 0;

// Helper to consistently log Shiprocket HTTP responses for debugging
function logShiprocketResponse(endpoint, res, data) {
  try {
    const status = res && res.status ? res.status : 'no-status';
    const snippet = (typeof data === 'object') ? JSON.stringify(data) : String(data);
    const trimmed = snippet.length > 2000 ? snippet.slice(0, 2000) + '...[truncated]' : snippet;
    console.log(`[Shiprocket] ${endpoint} -> status=${status} response=${trimmed}`);
  } catch (e) {
    console.log('[Shiprocket] failed to log response', e && e.message);
  }
}

async function getToken() {
  if (BEARER_TOKEN && Date.now() < TOKEN_EXPIRES) return BEARER_TOKEN;
  const res = await fetch(`${SHIPROCKET_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD })
  });
  let data;
  try {
    data = await res.json();
  } catch (e) {
    // log raw body if possible
    console.log('[Shiprocket] Auth fetch failed to parse JSON:', e.message);
    throw new Error('Shiprocket Auth failed: invalid JSON response or network error: ' + e.message);
  }
  logShiprocketResponse('auth/login', res, data);
  if (!res.ok || !data.token) throw new Error('Shiprocket Auth failed: ' + (data.message || res.statusText));
  BEARER_TOKEN = data.token;
  TOKEN_EXPIRES = Date.now() + 60 * 60 * 1000; // 1 hour
  return BEARER_TOKEN;
}

// Accepts a fully-transformed Shiprocket payload and sends it as-is
async function createShipment(payload) {
  const token = await getToken();
  console.log('Shiprocket payload:', JSON.stringify(payload, null, 2));
  let res;
  try {
    res = await fetch(`${SHIPROCKET_BASE}/orders/create/adhoc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    throw new Error('Network error when contacting Shiprocket create order endpoint: ' + e.message);
  }
  let data;
  try { data = await res.json(); } catch (e) { throw new Error('Create shipment failed: invalid JSON response: ' + e.message); }
  logShiprocketResponse('orders/create/adhoc', res, data);
  if (!res.ok || !data.shipment_id) throw new Error('Create shipment failed: ' + (data.message || res.statusText || JSON.stringify(data)));
  return {
    shipment_id: data.shipment_id,
    awb: data.awb_code,
    courier: data.courier_name,
    status: data.status,
    label_url: data.label_url,
    order_id: data.order_id // <-- Shiprocket's numeric order ID
  };
}

async function schedulePickup(shipment_id) {
  const token = await getToken();
  const res = await fetch(`${SHIPROCKET_BASE}/courier/generate/pickup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ shipment_id: [shipment_id] })
  });
  let data;
  try { data = await res.json(); } catch (e) { throw new Error('Pickup scheduling failed: invalid JSON response: ' + e.message); }
  logShiprocketResponse('courier/generate/pickup', res, data);
  if (!res.ok || !data.pickup_id) throw new Error('Pickup scheduling failed: ' + (data.message || res.statusText || JSON.stringify(data)));
  return data;
}

async function getShipmentStatus(shipment_id) {
  const token = await getToken();
  const res = await fetch(`${SHIPROCKET_BASE}/shipments/${shipment_id}/track`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  let data;
  try { data = await res.json(); } catch (e) { throw new Error('Get status failed: invalid JSON response: ' + e.message); }
  logShiprocketResponse(`shipments/${shipment_id}/track`, res, data);
  if (!res.ok) throw new Error('Get status failed: ' + (data.message || res.statusText || JSON.stringify(data)));
  return data;
}

// Get order details by Shiprocket numeric order ID
async function getOrderDetails(order_id) {
  const token = await getToken();
  const res = await fetch(`${SHIPROCKET_BASE}/orders/show/${order_id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  let data;
  try { data = await res.json(); } catch (e) { throw new Error('Get order details failed: invalid JSON response: ' + e.message); }
  logShiprocketResponse(`orders/show/${order_id}`, res, data);
  if (!res.ok) throw new Error('Get order details failed: ' + (data.message || res.statusText || JSON.stringify(data)));
  return data;
}

// Get shipment details (not tracking) for a given shipment_id
async function getShipmentDetails(shipment_id) {
  const token = await getToken();
  const res = await fetch(`${SHIPROCKET_BASE}/shipments/${shipment_id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  let data;
  try { data = await res.json(); } catch (e) { throw new Error('Get shipment details failed: invalid JSON response: ' + e.message); }
  logShiprocketResponse(`shipments/${shipment_id}`, res, data);
  if (!res.ok) throw new Error('Get shipment details failed: ' + (data.message || res.statusText || JSON.stringify(data)));
  return data;
}

async function getLabel(shipment_id) {
  const token = await getToken();
  const res = await fetch(`${SHIPROCKET_BASE}/courier/generate/label`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ shipment_id: [shipment_id] })
  });
  let data;
  try { data = await res.json(); } catch (e) { throw new Error('Label fetch failed: invalid JSON response: ' + e.message); }
  logShiprocketResponse('courier/generate/label', res, data);
  if (!res.ok || !data.label_url) throw new Error('Label fetch failed: ' + (data.message || res.statusText || JSON.stringify(data)));
  return data.label_url;
}

// Get tracking details for a shipment or order
async function getTracking({ order_id, awb }) {
  const token = await getToken();
  let url = `${SHIPROCKET_BASE}/courier/track?`;
  if (order_id) {
    url += `order_id=${encodeURIComponent(order_id)}`;
  } else if (awb) {
    url += `awb=${encodeURIComponent(awb)}`;
  } else {
    throw new Error('Tracking fetch failed: order_id or awb param is required!');
  }
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  logShiprocketResponse(url, res, data);
  if (!res.ok) throw new Error('Tracking fetch failed: ' + (data.message || res.statusText));
  // Normalize a few inconsistent Shiprocket shapes:
  // - Sometimes Shiprocket returns an array like [{ ORDER_CODE: { tracking_data: { ... } } }]
  // - Sometimes it returns an object with `tracking_data` at the top level
  if (Array.isArray(data) && data.length > 0) {
    // Try to extract the first object's tracking_data
    const first = data[0];
    const keys = Object.keys(first || {});
    if (keys.length === 1 && first[keys[0]] && first[keys[0]].tracking_data) {
      return first[keys[0]];
    }
    // fallback: return first element as-is
    return first;
  }
  if (data && data.tracking_data) return data;
  return data;
}

// Generate AWB and assign courier for a shipment
async function generateAWB(shipment_id, courier_id = null) {
  const token = await getToken();
  const body = { shipment_id: [shipment_id] };
  if (courier_id) body.courier_id = courier_id;
  const res = await fetch(`${SHIPROCKET_BASE}/courier/assign/awb`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  logShiprocketResponse('courier/assign/awb', res, data);
  // Normalize response: check top-level, then nested
  let awb_code = data.awb_code || data?.response?.data?.awb_code;
  let courier_name = data.courier_name || data?.response?.data?.courier_name;
  let status = data.status || data?.response?.data?.awb_code_status;
  if (!res.ok || !awb_code) {
    // Log and throw the full response for debugging
    console.error('Shiprocket AWB API response:', data);
    throw new Error('AWB generation failed: ' + (data.message || res.statusText) + ' | Shiprocket response: ' + JSON.stringify(data));
  }
  return {
    awb_code,
    courier_name,
    status,
    raw: data
  };
}

// Download invoice PDF for a shipment
async function downloadInvoice(shipment_id) {
  const token = await getToken();
  const res = await fetch(`${SHIPROCKET_BASE}/shipments/invoice/${shipment_id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    logShiprocketResponse(`shipments/invoice/${shipment_id}`, res, data);
    throw new Error('Invoice download failed: ' + (data.message || res.statusText));
  }
  // Return the PDF buffer and content-type
  const buffer = await res.arrayBuffer();
  return {
    buffer: Buffer.from(buffer),
    contentType: res.headers.get('content-type') || 'application/pdf',
    contentDisposition: res.headers.get('content-disposition') || `attachment; filename=invoice_${shipment_id}.pdf`
  };
}

// Download invoice PDF for a shipment and trigger status change
async function printAndDownloadInvoice(shipment_id) {
  const token = await getToken();
  // This endpoint triggers invoice generation and returns the PDF
  const res = await fetch(`${SHIPROCKET_BASE}/orders/print/invoice/${shipment_id}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    logShiprocketResponse(`orders/print/invoice/${shipment_id}`, res, data);
    throw new Error('Invoice print/download failed: ' + (data.message || res.statusText));
  }
  // Try to get status from headers or Shiprocket API if possible
  // (Shiprocket does not always return status in this call, so you may need to fetch status separately)
  const buffer = await res.arrayBuffer();
  return {
    buffer: Buffer.from(buffer),
    contentType: res.headers.get('content-type') || 'application/pdf',
    contentDisposition: res.headers.get('content-disposition') || `attachment; filename=invoice_${shipment_id}.pdf`,
    // Optionally, you can fetch status after this call if needed
  };
}

// Get invoice_url for a Shiprocket order_id
async function getInvoiceUrlByOrderId(order_id) {
  const token = await getToken();
  const res = await fetch(`${SHIPROCKET_BASE}/orders/print/invoice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ids: [order_id] })
  });
  const data = await res.json();
  logShiprocketResponse('orders/print/invoice', res, data);
  if (!res.ok || !data.invoice_url) {
    throw new Error('Failed to get invoice_url: ' + (data.message || res.statusText));
  }
  return data.invoice_url;
}

// Safe fetch that returns raw Shiprocket response without throwing
async function fetchInvoiceUrlRaw(order_id) {
  const token = await getToken();
  const payload = { ids: [Number(order_id)] };
  // Log payload for debugging
  console.log('[Shiprocket] orders/print/invoice payload:', JSON.stringify(payload));
  const res = await fetch(`${SHIPROCKET_BASE}/orders/print/invoice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  let data;
  try { data = await res.json(); } catch (e) { data = null; }
  logShiprocketResponse('orders/print/invoice', res, data);
  return { ok: res.ok, status: res.status, data };
}

export {
  createShipment,
  schedulePickup,
  getShipmentStatus,
  getLabel,
  getTracking,
  generateAWB,
  downloadInvoice,
  printAndDownloadInvoice,
  getInvoiceUrlByOrderId,
  fetchInvoiceUrlRaw,
  getOrderDetails,
  getShipmentDetails
};

// Cancel one or more Shiprocket orders by their Shiprocket numeric order IDs
async function cancelOrders(orderIds = []) {
  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    throw new Error('cancelOrders requires an array of one or more order IDs');
  }
  const token = await getToken();
  const res = await fetch(`${SHIPROCKET_BASE}/orders/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ids: orderIds })
  });
  let data;
  try { data = await res.json(); } catch (e) { throw new Error('Cancel orders failed: invalid JSON response: ' + e.message); }
  logShiprocketResponse('orders/cancel', res, data);
  if (!res.ok) {
    throw new Error('Cancel orders failed: ' + (data.message || res.statusText || JSON.stringify(data)));
  }
  return data;
}

export { cancelOrders };
