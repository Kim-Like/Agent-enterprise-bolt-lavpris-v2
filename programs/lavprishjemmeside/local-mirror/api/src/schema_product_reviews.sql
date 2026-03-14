CREATE TABLE IF NOT EXISTS product_reviews (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id     INT UNSIGNED NOT NULL,
  customer_email VARCHAR(320) NOT NULL,
  customer_name  VARCHAR(200) NOT NULL DEFAULT '',
  rating         TINYINT UNSIGNED NOT NULL,
  body           TEXT,
  approved       TINYINT(1) NOT NULL DEFAULT 0,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pr_product (product_id),
  INDEX idx_pr_approved (product_id, approved),
  INDEX idx_pr_email (customer_email),
  CONSTRAINT chk_pr_rating CHECK (rating BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
