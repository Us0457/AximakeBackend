import dotenv from 'dotenv';
dotenv.config();

const SHIPROCKET_BASE = 'https://apiv2.shiprocket.in/v1/external';
const EMAIL = process.env.SHIPROCKET_EMAIL;
const PASSWORD = process.env.SHIPROCKET_PASSWORD;

async function auth() {
  const res = await fetch(`${SHIPROCKET_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD })
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error('Auth failed: ' + (data?.message || res.statusText));
  return data.token;
}

async function fetchShipments(token, page=1, per_page=100) {
  const url = `${SHIPROCKET_BASE}/shipments?page=${page}&per_page=${per_page}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

(async () => {
  try {
    console.log('Authenticating to Shiprocket...');
    const token = await auth();
    console.log('Got token, fetching shipments...');
    const maxPages = Number(process.argv[2] || 5);
    const perPage = Number(process.argv[3] || 100);
    let all = [];
    for (let p=1; p<=maxPages; p++) {
      console.log(`Fetching page ${p}`);
      const { status, data } = await fetchShipments(token, p, perPage);
      console.log(`[Shiprocket] shipments page ${p} status=${status}`);
      if (!data) break;
      // If API returns {data: [...] } or an array
      let items = [];
      if (Array.isArray(data)) items = data;
      else if (Array.isArray(data?.data)) items = data.data;
      else if (data?.shipments && Array.isArray(data.shipments)) items = data.shipments;
      else {
        console.log('Unexpected response shape:', JSON.stringify(Object.keys(data || {})));
        console.log(JSON.stringify(data, null, 2));
        break;
      }
      console.log(`Received ${items.length} shipments`);
      all = all.concat(items);
      if (items.length < perPage) break; // last page
    }
    console.log('\nTotal shipments fetched:', all.length);
    // Print first 20 shipments summary
    const preview = all.slice(0, 20).map(s => ({ shipment_id: s.shipment_id || s.id || s.shipmentId || null, awb: s.awb_code || s.awb || s.awb_code, order_id: s.order_id || s.orderId || s.order_id, status: s.status || s.shipment_status }));
    console.log('Preview (first 20):', JSON.stringify(preview, null, 2));
  } catch (err) {
    console.error('Failed:', err && err.message ? err.message : err);
    process.exitCode = 1;
  }
})();
