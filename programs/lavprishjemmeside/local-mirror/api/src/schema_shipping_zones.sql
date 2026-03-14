ALTER TABLE shipping_methods ADD COLUMN IF NOT EXISTS countries JSON NULL COMMENT 'ISO 3166-1 alpha-2 array, NULL = all countries';
