import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
	return twMerge(clsx(inputs));
}

// Utility to get API base URL from env
export function getApiUrl(path) {
  const base = import.meta.env.VITE_API_BASE_URL || '';
  if (path.startsWith('/')) return base + path;
  return base + '/' + path;
}

export function getPhpUrl(path) {
  const base = import.meta.env.VITE_PHP_BASE_URL || '';
  if (path.startsWith('/')) return base + path;
  return base + '/' + path;
}

// Return the most descriptive label for the latest scan event, falling back to `fallback`.
export function getLatestScanLabel(events, fallback) {
  try {
    const evs = Array.isArray(events) ? events : [];
    if (!evs.length) return fallback;
    const sorted = evs.slice().sort((a, b) => {
      const da = a && a.date ? Date.parse(a.date) || 0 : 0;
      const db = b && b.date ? Date.parse(b.date) || 0 : 0;
      return db - da;
    });
    const latest = sorted[0];
    return (latest && (latest['sr-status-label'] || latest.sr_status_label || latest.activity || latest.status)) || fallback;
  } catch (e) {
    return fallback;
  }
}