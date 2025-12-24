#!/usr/bin/env node
import 'dotenv/config';

const email = process.env.SHIPROCKET_EMAIL;
const password = process.env.SHIPROCKET_PASSWORD;
if (!email || !password) {
  console.error('Please set SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD in your .env');
  process.exit(1);
}

try {
  const res = await fetch('https://apiv2.shiprocket.in/v1/external/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    console.error('Shiprocket auth failed:', data || res.statusText || res.status);
    process.exit(2);
  }
  if (!data || !data.token) {
    console.error('No token in response:', JSON.stringify(data));
    process.exit(3);
  }
  console.log(data.token);
} catch (e) {
  console.error('Network or runtime error while fetching token:', e.message || e);
  process.exit(4);
}
