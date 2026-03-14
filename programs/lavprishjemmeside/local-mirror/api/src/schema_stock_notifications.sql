CREATE TABLE IF NOT EXISTS stock_notifications (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id   INT UNSIGNED NOT NULL,
  variant_id   INT UNSIGNED NULL,
  email        VARCHAR(320) NOT NULL,
  notified_at  TIMESTAMP NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sn_product (product_id),
  INDEX idx_sn_variant (variant_id),
  INDEX idx_sn_email (email),
  INDEX idx_sn_notified (notified_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
