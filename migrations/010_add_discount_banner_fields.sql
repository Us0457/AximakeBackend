-- Add fields for enhanced discount banners
BEGIN;

ALTER TABLE IF EXISTS discount_banners
  ADD COLUMN IF NOT EXISTS bg_color text DEFAULT '#f59e42';

ALTER TABLE IF EXISTS discount_banners
  ADD COLUMN IF NOT EXISTS font_color text DEFAULT '#ffffff';

ALTER TABLE IF EXISTS discount_banners
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

ALTER TABLE IF EXISTS discount_banners
  ADD COLUMN IF NOT EXISTS moving boolean DEFAULT false;

ALTER TABLE IF EXISTS discount_banners
  ADD COLUMN IF NOT EXISTS speed integer DEFAULT 100;

-- Add ordering column if missing
ALTER TABLE IF EXISTS discount_banners
  ADD COLUMN IF NOT EXISTS "order" integer;

-- Migrate existing `color` -> `bg_color` when bg_color is null or default
UPDATE discount_banners SET bg_color = color WHERE (bg_color IS NULL OR bg_color = '') AND (color IS NOT NULL AND color <> '');

COMMIT;
