-- Migration: add order_status_emails table to track which status emails have been sent
-- Run this with the Service Role key in Supabase SQL editor or via migrations tooling.

CREATE TABLE IF NOT EXISTS public.order_status_emails (
  id bigserial PRIMARY KEY,
  order_id bigint NOT NULL,
  order_code text,
  status text NOT NULL,
  sent boolean NOT NULL DEFAULT false,
  sent_at timestamptz NULL,
  error text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint to guarantee only one record per (order_id, status)
CREATE UNIQUE INDEX IF NOT EXISTS ux_order_status_emails_order_status ON public.order_status_emails (order_id, status);

-- Add foreign key if you have orders.id as bigint; adjust if your PK type differs.
ALTER TABLE IF EXISTS public.order_status_emails
  ADD CONSTRAINT fk_order_status_emails_order FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
