// Utility to map Shiprocket status code to description
import SHIPROCKET_STATUS_MAP from '../src/lib/shiprocketStatusMap.js';

export function mapShiprocketStatus(status, statusCode) {
  if (status === 'Tracking not available yet' || !status) {
    // If tracking is not available, fall back to a default status (e.g., 'Pending')
    return 'Pending';
  }
  if (statusCode && SHIPROCKET_STATUS_MAP[statusCode]) {
    return SHIPROCKET_STATUS_MAP[statusCode];
  }
  // fallback: if status is already a string description
  return status || 'Pending';
}
