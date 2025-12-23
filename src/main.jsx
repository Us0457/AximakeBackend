// Suppress specific React Router future-flag warning in dev only.
// This is a minimal, non-invasive change to avoid noisy console output
// while keeping actual behavior unchanged. It only filters the single
// warning about `v7_startTransition` and leaves other warnings intact.
if (process.env.NODE_ENV !== 'production') {
  const _warn = console.warn.bind(console);
  console.warn = (...args) => {
    try {
      const m = args[0];
      if (typeof m === 'string' && (
        m.includes('React Router will begin wrapping state updates') ||
        m.includes('v7_startTransition') ||
        m.includes('Relative route resolution within Splat routes') ||
        m.includes('v7_relativeSplatPath')
      )) {
        return; // swallow these specific router future-flag warnings
      }
    } catch (e) {}
    _warn(...args);
  };
}

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);