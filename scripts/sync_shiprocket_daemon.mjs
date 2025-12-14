import dotenv from 'dotenv';
dotenv.config();

import pLimit from 'p-limit';
import { createClient } from '@supabase/supabase-js';
import {
  getTracking,
  getShipmentStatus
} from '../src/lib/shiprocketService.js';

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const POLL_INTERVAL_MS = Number(process.env.SHIPROCKET_POLL_INTERVAL_MS || 60_000); // 1 minute
const BATCH_SIZE = Number(process.env.SHIPROCKET_BATCH_SIZE || 200);
const CONCURRENCY = Number(process.env.SHIPROCKET_CONCURRENCY || 8);

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
  process.exit(2);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const limit = pLimit(CONCURRENCY);

async function fetchOrdersToSync(limitRows = BATCH_SIZE, offset = 0) {
  // PostgREST .or syntax can be fragile; do three simple queries and merge results to avoid complex filter parsing.
  const q1 = await supabase
    .from('orders')
    .select('id,order_code,shiprocket_shipment_id,shiprocket_order_id,shiprocket_awb,shiprocket_status,shiprocket_track_url')
    .not('shiprocket_shipment_id', 'is', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + limitRows - 1);
  const q2 = await supabase
    .from('orders')
    .select('id,order_code,shiprocket_shipment_id,shiprocket_order_id,shiprocket_awb,shiprocket_status,shiprocket_track_url')
    .not('shiprocket_order_id', 'is', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + limitRows - 1);
  const q3 = await supabase
    .from('orders')
    .select('id,order_code,shiprocket_shipment_id,shiprocket_order_id,shiprocket_awb,shiprocket_status,shiprocket_track_url')
    .not('shiprocket_awb', 'is', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + limitRows - 1);

  const errs = [q1.error, q2.error, q3.error].filter(Boolean);
  if (errs.length) throw errs[0];

  const combined = [...(q1.data || []), ...(q2.data || []), ...(q3.data || [])];
  // de-duplicate by id while preserving order
  const seen = new Set();
  const unique = [];
  for (const row of combined) {
    if (!seen.has(row.id)) {
      seen.add(row.id);
      unique.push(row);
    }
  }
  return unique.slice(0, limitRows);
}

function extractStatusFromTracking(tracking) {
  try {
    const td = tracking?.tracking_data || tracking;
    if (!td) return { status: null, awb: null, courier: null, track_url: null };
    let latestAWB = null;
    let latestCourier = null;
    let latestStatus = null;
    let track_url = td?.track_url || null;
    if (Array.isArray(td?.shipment_track) && td.shipment_track.length > 0) {
      const trackObj = td.shipment_track.find(t => t.current_status || t.status || t.awb_code || t.courier_name) || td.shipment_track[0];
      latestAWB = trackObj.awb_code || trackObj.awb || null;
      latestCourier = trackObj.courier_name || null;
      latestStatus = trackObj.current_status || trackObj.status || null;
    }
    if (!latestAWB) latestAWB = td?.awb_code || null;
    if (!latestCourier) latestCourier = td?.courier_name || null;
    if (!latestStatus) latestStatus = td?.shipment_status || td?.shipment_status?.current_status || td?.current_status || td?.status || null;
    return { status: latestStatus, awb: latestAWB, courier: latestCourier, track_url };
  } catch (e) {
    return { status: null, awb: null, courier: null, track_url: null };
  }
}

async function syncBatch() {
  try {
    console.log(new Date().toISOString(), 'Starting Shiprocket sync batch');
    let offset = 0;
    let totalUpdated = 0;
    while (true) {
      const orders = await fetchOrdersToSync(BATCH_SIZE, offset);
      if (!orders || orders.length === 0) break;

      // Process orders with limited concurrency
      const tasks = orders.map(order => limit(async () => {
        try {
          // choose identifier
          let tracking = null;
          if (order.shiprocket_order_id) {
            tracking = await getTracking({ order_id: String(order.shiprocket_order_id) });
          } else if (order.shiprocket_awb) {
            // Shiprocket sometimes expects order_id; try awb then fallback
            try {
              tracking = await getTracking({ awb: String(order.shiprocket_awb) });
            } catch (e) {
              tracking = null;
            }
          } else if (order.shiprocket_shipment_id) {
            try {
              tracking = await getShipmentStatus(String(order.shiprocket_shipment_id));
            } catch (e) {
              tracking = null;
            }
          }

          if (!tracking) return { order, changed: false };
          const { status, awb, courier, track_url } = extractStatusFromTracking(tracking);

          const updates = {};
          if (status && status !== order.shiprocket_status) updates.shiprocket_status = status;
          if (awb && awb !== order.shiprocket_awb) updates.shiprocket_awb = awb;
          if (track_url && track_url !== order.shiprocket_track_url) updates.shiprocket_track_url = track_url;
          if (courier) updates.shiprocket_courier = courier;
          if (Object.keys(updates).length > 0) {
            updates.shiprocket_last_synced_at = new Date().toISOString();
            const { error } = await supabase.from('orders').update(updates).eq('id', order.id);
            if (error) {
              console.error('DB update error for', order.order_code, error.message || error);
              return { order, changed: false };
            }
            console.log('Updated order', order.order_code, updates);
            return { order, changed: true };
          }
          return { order, changed: false };
        } catch (err) {
          console.error('Sync error for order', order.order_code, err && err.message ? err.message : err);
          return { order, changed: false };
        }
      }));

      const results = await Promise.all(tasks);
      totalUpdated += results.filter(r => r.changed).length;
      if (orders.length < BATCH_SIZE) break;
      offset += BATCH_SIZE;
    }
    console.log(new Date().toISOString(), `Shiprocket sync completed. Total updated: ${totalUpdated}`);
  } catch (e) {
    console.error('Shiprocket sync batch failed:', e && e.message ? e.message : e);
  }
}

// Run first immediately, then every POLL_INTERVAL_MS
(async () => {
  await syncBatch();
  setInterval(async () => {
    await syncBatch();
  }, POLL_INTERVAL_MS);
})();
