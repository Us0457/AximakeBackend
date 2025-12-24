// Utility to map Shiprocket status code to description
import { normalizeStatus } from '../src/lib/shiprocket-normalizer.js';

export function mapShiprocketStatus(status, statusCode) {
  return normalizeStatus(status, statusCode);
}
