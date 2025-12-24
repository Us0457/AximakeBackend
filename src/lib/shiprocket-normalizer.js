// Centralized Shiprocket status normalization and forward-only transition helpers
import SHIPROCKET_STATUS_MAP from './shiprocketStatusMap.js';

// Canonical progression order (low -> high). Unknown statuses map to a safe low index.
const PROGRESSION = [
  'Pending',
  'New',
  'Booked',
  'Ready To Ship',
  'Pickup Scheduled',
  'Pickup Booked',
  'Picked Up',
  'Shipped',
  'In Transit',
  'Out for Delivery',
  'Delivered',
  'Return Initiated',
  'Returned',
  'RTO Initiated',
  'Cancelled',
  'Lost'
];

const NORMALIZED_MAP = Object.values(SHIPROCKET_STATUS_MAP).reduce((acc, v) => {
  if (typeof v === 'string') acc[v.toLowerCase()] = v;
  return acc;
}, {});

function fuzzyLookup(raw) {
  if (!raw) return 'Pending';
  const s = String(raw).trim();
  if (!s) return 'Pending';
  // If it's a known code description exactly
  const exact = NORMALIZED_MAP[s.toLowerCase()];
  if (exact) return exact;
  // Try to match by token presence
  const low = s.toLowerCase();
  for (const key of Object.keys(NORMALIZED_MAP)) {
    if (low.includes(key) || key.includes(low)) return NORMALIZED_MAP[key];
  }
  // Try some common synonyms
  if (low.includes('manifest') || low.includes('booked')) return 'Booked';
  if (low.includes('pickup') || low.includes('collected')) return 'Pickup Scheduled';
  if (low.includes('packed') || low.includes('ready')) return 'Ready To Ship';
  if (low.includes('picked') || low.includes('picked up')) return 'Picked Up';
  if (low.includes('shipped')) return 'Shipped';
  if (low.includes('in transit') || low.includes('transit')) return 'In Transit';
  if (low.includes('out for delivery') || low.includes('ofd')) return 'Out for Delivery';
  if (low.includes('delivered')) return 'Delivered';
  if (low.includes('return') || low.includes('rto')) return 'Return Initiated';
  if (low.includes('cancel')) return 'Cancelled';
  if (low.includes('lost')) return 'Lost';
  return 'Pending';
}

export function normalizeStatus(rawStatus, statusCode = null) {
  // Prefer mapping by numeric statusCode if provided
  if (statusCode && SHIPROCKET_STATUS_MAP[statusCode]) return SHIPROCKET_STATUS_MAP[statusCode];
  // If rawStatus already exactly matches a mapped description, return it
  if (typeof rawStatus === 'string' && NORMALIZED_MAP[rawStatus.toLowerCase()]) return NORMALIZED_MAP[rawStatus.toLowerCase()];
  return fuzzyLookup(rawStatus);
}

function indexOfStatus(s) {
  if (!s) return 0;
  const idx = PROGRESSION.findIndex(p => p.toLowerCase() === String(s).toLowerCase());
  return idx === -1 ? 0 : idx;
}

export function isFinalStatus(s) {
  if (!s) return false;
  const lowered = String(s).toLowerCase();
  return lowered === 'delivered' || lowered === 'returned' || lowered === 'cancelled' || lowered === 'lost';
}

// Returns true if `next` is the same or ahead of `current` in progression
export function isProgressionAllowed(current, next) {
  const curIdx = indexOfStatus(current);
  const nextIdx = indexOfStatus(next);
  // allow equal or forward progression
  return nextIdx >= curIdx;
}

export default {
  normalizeStatus,
  isFinalStatus,
  isProgressionAllowed
};
