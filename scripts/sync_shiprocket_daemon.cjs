#!/usr/bin/env node
require('dotenv').config();
#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(2);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Configuration via env or CLI
const INTERVAL_MS = Number(process.env.SYNC_INTERVAL_MS || process.argv[2] || 300000); // default 5 minutes
const BATCH_SIZE = Number(process.env.SYNC_BATCH_SIZE || process.argv[3] || 200);
const SLEEP_BETWEEN = Number(process.env.SYNC_SLEEP_BETWEEN || process.argv[4] || 250); // ms between requests
const LOOKBACK_MS = Number(process.env.SYNC_LOOKBACK_MS || process.argv[5] || 24 * 60 * 60 * 1000); // default 24h
const MAX_RETRIES = Number(process.env.SYNC_MAX_RETRIES || 3);
const LOG_PATH = process.env.SYNC_LOG_PATH || path.join(process.cwd(), 'logs', 'shiprocket-sync.log');

// ensure log dir exists
try { fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true }); } catch (e) {}

function log(msg, level = 'info') {
  const line = `${new Date().toISOString()} [${level.toUpperCase()}] ${msg}\n`;
  try { fs.appendFileSync(LOG_PATH, line); } catch (e) { console.error('Failed to write log:', e); }
  console.log(line.trim());
}

let stopped = false;
process.on('SIGINT', () => { stopped = true; log('Received SIGINT, shutting down'); });
process.on('SIGTERM', () => { stopped = true; log('Received SIGTERM, shutting down'); });

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function withRetries(fn, opts = {}) {
  const max = opts.retries || MAX_RETRIES;
  const base = opts.baseDelay || 500; // ms
  for (let attempt = 1; attempt <= max; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isLast = attempt === max;
      const transient = !err || (err.status && err.status >= 500) || (err.code && ['ECONNRESET','ETIMEDOUT','EAI_AGAIN'].includes(err.code));
      if (!transient || isLast) {
        throw err;
      }
      const delay = Math.round(base * Math.pow(2, attempt - 1) * (0.8 + Math.random() * 0.4));
      log(`Transient error (attempt ${attempt}/${max}): ${err.message || err}. Backing off ${delay}ms`, 'warn');
      await sleep(delay);
    }
  }
}

async function fetchTrackingForOrder(svc, order) {
  const sid = order.shiprocket_shipment_id;
  const awb = order.shiprocket_awb;
  const orcode = order.shiprocket_order_id || order.order_code;
  // try methods with retries/backoff
  if (sid && typeof svc.getShipmentStatus === 'function') {
    return await withRetries(() => svc.getShipmentStatus(sid));
  }
  if (orcode && typeof svc.getTracking === 'function') {
    try { return await withRetries(() => svc.getTracking({ order_id: orcode })); } catch (e) { log(`getTracking by order_id failed for ${orcode}: ${e.message || e}`, 'warn'); }
  }
  if (awb && typeof svc.getTracking === 'function') {
    return await withRetries(() => svc.getTracking({ awb: String(awb) }));
  }
  return null;
}

function extractStatusAndAwb(tracking) {
  if (!tracking) return { status: null, awb: null, courier: null, track_url: null };
  const td = tracking.tracking_data || tracking.data || tracking;
  let newStatus = null;
  let newAwb = null;
  let courier = null;
  let track_url = null;
  if (!td) return { status: null, awb: null, courier: null, track_url: null };
  const st = td.shipment_track || td.shipment_track || td.shipment_track;
  if (Array.isArray(st) && st.length > 0) {
    const first = st[0] || {};
    newStatus = first.current_status || first.status || newStatus;
    newAwb = first.awb_code || first.tracking_number || newAwb;
    courier = first.courier_name || courier;
  }
  newStatus = newStatus || td.shipment_status || td.current_status || td.status || null;
  newAwb = newAwb || td.awb_code || td.awb || null;
  courier = courier || td.courier_company_name || td.courier_name || null;
  track_url = td.track_url || null;
  return { status: newStatus, awb: newAwb, courier, track_url };
}

async function pollOnce(svc) {
  try {
    const cutoff = new Date(Date.now() - LOOKBACK_MS).toISOString();
    // Fetch orders updated recently OR missing key fields, limited to batch size
    const filter = `updated_at.gte.${cutoff},shiprocket_awb.is.null,shiprocket_status.is.null`;
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id,order_code,shiprocket_shipment_id,shiprocket_awb,shiprocket_status,shiprocket_order_id,updated_at')
      .not('shiprocket_shipment_id', 'is', null)
      .or(filter)
      .order('updated_at', { ascending: false })
      .limit(BATCH_SIZE);

    if (error) { log(`DB fetch error: ${error.message || JSON.stringify(error)}`, 'error'); return; }
    if (!orders || orders.length === 0) { log('No orders to sync in this interval'); return; }
    log(`Syncing ${orders.length} orders (batch ${BATCH_SIZE}, lookback ${LOOKBACK_MS}ms)`);
    for (const o of orders) {
      if (stopped) break;
      try {
        const tracking = await fetchTrackingForOrder(svc, o).catch(e => { throw e; });
        const { status: newStatus, awb: newAwb, courier, track_url } = extractStatusAndAwb(tracking);
        const updates = {};
        if (newStatus && newStatus !== o.shiprocket_status) updates.shiprocket_status = newStatus;
        if (newAwb && String(newAwb) !== String(o.shiprocket_awb)) updates.shiprocket_awb = String(newAwb);
        if (courier && courier !== o.shiprocket_courier) updates.shiprocket_courier = courier;
        if (track_url && track_url !== o.shiprocket_track_url) updates.shiprocket_track_url = track_url;
        if (Object.keys(updates).length > 0) {
          const { error: upErr } = await supabase.from('orders').update(updates).eq('id', o.id);
          if (upErr) log(`Failed to update order ${o.order_code}: ${upErr.message || JSON.stringify(upErr)}`, 'error');
          else log(`Updated order ${o.order_code}: ${JSON.stringify(updates)}`);
        } else {
          log(`No change for ${o.order_code}`);
        }
      } catch (e) {
        log(`Failed to refresh order ${o.order_code || o.id}: ${e.message || e}`, 'error');
      }
      await sleep(SLEEP_BETWEEN);
    }
  } catch (err) {
    log(`Error in pollOnce: ${err.message || err}`, 'error');
  }
}

async function main() {
  log(`Starting Shiprocket sync daemon: interval=${INTERVAL_MS}ms batch=${BATCH_SIZE} lookback=${LOOKBACK_MS}ms`);
  const svc = await import('../src/lib/shiprocketService.js');
  while (!stopped) {
    const start = Date.now();
    await pollOnce(svc);
    const elapsed = Date.now() - start;
    const wait = Math.max(1000, INTERVAL_MS - elapsed);
    if (stopped) break;
    log(`Poll complete, sleeping ${wait}ms`);
    await sleep(wait);
  }
  log('Shiprocket sync daemon exiting');
  process.exit(0);
}

main().catch(e => { log(`Daemon failed: ${e.message || e}`, 'error'); process.exit(1); });
