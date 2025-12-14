const { execSync } = require('child_process');
const fetch = global.fetch || require('node-fetch');
const path = require('path');

const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:5050/api/shiprocket-webhook';
const TOKEN = process.env.SHIPROCKET_WEBHOOK_TOKEN || 'doyouknowthis';
const ORDER_CODE = process.argv[2] || '1373900_150876814';

function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }

async function postPayload(payload) {
  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': TOKEN },
    body: JSON.stringify(payload)
  });
  const text = await res.text();
  console.log('POST ->', res.status, text);
}

function showOrder() {
  try {
    const out = execSync(`node ${path.join(__dirname, 'check_order.cjs')} order_code ${ORDER_CODE}`, { encoding: 'utf8' });
    console.log('ORDER ROW:\n', out);
  } catch (e) {
    console.error('Failed to fetch order:', e.stdout || e.message);
  }
}

(async () => {
  console.log('Posting full Shiprocket payload for', ORDER_CODE);
  const payload = {
    awb: '19041424751540',
    courier_name: 'Delhivery Surface',
    current_status: 'IN TRANSIT',
    current_status_id: 20,
    shipment_status: 'IN TRANSIT',
    shipment_status_id: 18,
    current_timestamp: '23 05 2023 11:43:52',
    order_id: ORDER_CODE,
    sr_order_id: 348456385,
    awb_assigned_date: '2023-05-19 11:59:16',
    pickup_scheduled_date: '2023-05-19 11:59:17',
    etd: '2023-05-23 15:40:19',
    scans: [
      { date: '2023-05-19 11:59:16', status: 'X-UCI', activity: 'Manifested - Manifest uploaded', location: 'Chomu_SamodRd_D (Rajasthan)', 'sr-status': '5', 'sr-status-label': 'MANIFEST GENERATED' },
      { date: '2023-05-19 15:32:17', status: 'X-PPOM', activity: 'In Transit - Shipment picked up', location: 'Chomu_SamodRd_D (Rajasthan)', 'sr-status': '42', 'sr-status-label': 'PICKED UP' },
      { date: '2023-05-19 16:40:19', status: 'X-PIOM', activity: 'In Transit - Shipment Recieved at Origin Center', location: 'Chomu_SamodRd_D (Rajasthan)', 'sr-status': '6', 'sr-status-label': 'SHIPPED' },
      { date: '2023-05-19 17:19:14', status: 'X-DBL1F', activity: 'In Transit - Added to Bag', location: 'Chomu_SamodRd_D (Rajasthan)', 'sr-status': 'NA', 'sr-status-label': 'NA' },
      { date: '2023-05-20 10:27:56', status: 'X-DLL2F', activity: 'In Transit - Bag Added To Trip', location: 'Chomu_SamodRd_D (Rajasthan)', 'sr-status': '18', 'sr-status-label': 'IN TRANSIT' },
      { date: '2023-05-20 12:23:44', status: 'X-ILL2F', activity: 'In Transit - Trip Arrived', location: 'Jaipur_Sez_GW (Rajasthan)', 'sr-status': '18', 'sr-status-label': 'IN TRANSIT' },
      { date: '2023-05-20 14:24:50', status: 'X-ILL1F', activity: 'In Transit - Bag Received at Facility', location: 'Jaipur_Sez_GW (Rajasthan)', 'sr-status': '18', 'sr-status-label': 'IN TRANSIT' },
      { date: '2023-05-20 15:23:38', status: 'X-IBD3F', activity: 'In Transit - Shipment Received at Facility', location: 'Jaipur_Sez_GW (Rajasthan)', 'sr-status': '18', 'sr-status-label': 'IN TRANSIT' },
      { date: '2023-05-20 15:23:38', status: 'X-DWS', activity: 'In Transit - System weight captured', location: 'Jaipur_Sez_GW (Rajasthan)', 'sr-status': 'NA', 'sr-status-label': 'NA' },
      { date: '2023-05-20 16:01:22', status: 'X-DBL1F', activity: 'In Transit - Added to Bag', location: 'Jaipur_Sez_GW (Rajasthan)', 'sr-status': 'NA', 'sr-status-label': 'NA' },
      { date: '2023-05-21 09:50:45', status: 'X-DLL2F', activity: 'In Transit - Bag Added To Trip', location: 'Jaipur_Sez_GW (Rajasthan)', 'sr-status': '18', 'sr-status-label': 'IN TRANSIT' },
      { date: '2023-05-22 22:01:12', status: 'X-ILL2F', activity: 'In Transit - Trip Arrived', location: 'Bhiwandi_Mega_GW (Maharashtra)', 'sr-status': '18', 'sr-status-label': 'IN TRANSIT' },
      { date: '2023-05-23 02:55:34', status: 'X-ILL1F', activity: 'In Transit - Bag Received at Facility', location: 'Bhiwandi_Mega_GW (Maharashtra)', 'sr-status': '18', 'sr-status-label': 'IN TRANSIT' },
      { date: '2023-05-23 07:38:08', status: 'X-DLL2F', activity: 'In Transit - Bag Added To Trip', location: 'Bhiwandi_Mega_GW (Maharashtra)', 'sr-status': '18', 'sr-status-label': 'IN TRANSIT' },
      { date: '2023-05-23 09:48:27', status: 'X-ILL2F', activity: 'In Transit - Trip Arrived', location: 'Mumbai_MiraRdIndEstate_I (Maharashtra)', 'sr-status': '18', 'sr-status-label': 'IN TRANSIT' },
      { date: '2023-05-23 10:14:27', status: 'X-ILL1F', activity: 'In Transit - Bag Received at Facility', location: 'Mumbai_MiraRdIndEstate_I (Maharashtra)', 'sr-status': '18', 'sr-status-label': 'IN TRANSIT' },
      { location: 'Mumbai_MiraRdIndEstate_I (Maharashtra)', date: '2023-05-23 11:43:46', activity: 'In Transit - Shipment Received at Facility', status: 'X-IBD3F', 'sr-status': '18', 'sr-status-label': 'IN TRANSIT' },
      { date: '2023-05-24 09:00:00', status: 'X-OFD', activity: 'Out for Delivery - Courier out for delivery', location: 'Mumbai_MiraRdIndEstate_I (Maharashtra)', 'sr-status': '19', 'sr-status-label': 'OUT FOR DELIVERY' },
      { date: '2023-05-24 12:30:00', status: 'X-DLV', activity: 'Delivered - Shipment delivered to recipient', location: 'Mumbai_MiraRdIndEstate_I (Maharashtra)', 'sr-status': '7', 'sr-status-label': 'DELIVERED' }
    ],
    is_return: 0,
    channel_id: 3422553,
    pod_status: 'OTP Based Delivery',
    pod: 'Not Available'
  };

  await postPayload(payload);
  await sleep(300);
  showOrder();
  console.log('Done.');
})();
