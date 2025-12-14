-- Migration: add shiprocket_events JSONB column to orders
ALTER TABLE IF EXISTS orders
  ADD COLUMN IF NOT EXISTS shiprocket_events jsonb;

-- Optionally add an index for queries on events
CREATE INDEX IF NOT EXISTS idx_orders_shiprocket_events ON orders USING gin (shiprocket_events);
