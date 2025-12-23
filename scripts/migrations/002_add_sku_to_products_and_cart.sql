-- Migration: add SKU columns
-- 1) Add `sku` column to `products` with length constraint and unique index
ALTER TABLE IF EXISTS products
  ADD COLUMN IF NOT EXISTS sku varchar(8);

-- Ensure SKUs, when present, are exactly 8 characters long
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_sku_length_check'
  ) THEN
    ALTER TABLE products ADD CONSTRAINT products_sku_length_check CHECK (char_length(sku) = 8 OR sku IS NULL);
  END IF;
END$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku_unique ON products(sku);

-- 2) Add sku column to cart_items and wishlist for propagation (nullable)
ALTER TABLE IF EXISTS cart_items
  ADD COLUMN IF NOT EXISTS sku varchar(8);
ALTER TABLE IF EXISTS wishlist
  ADD COLUMN IF NOT EXISTS sku varchar(8);

-- Add indexes to help lookups by sku (non-unique)
CREATE INDEX IF NOT EXISTS idx_cart_items_sku ON cart_items(sku);
CREATE INDEX IF NOT EXISTS idx_wishlist_sku ON wishlist(sku);

-- Note: This migration is additive and allows NULL SKUs for backward compatibility.
