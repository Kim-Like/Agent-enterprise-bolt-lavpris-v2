ALTER TABLE customers ADD COLUMN IF NOT EXISTS password_hash TEXT NULL;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP NULL;

CREATE TABLE IF NOT EXISTS customer_sessions (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_id  INT UNSIGNED NOT NULL,
  token        VARCHAR(64) NOT NULL UNIQUE,
  expires_at   TIMESTAMP NOT NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_customer_sessions_token (token),
  INDEX idx_customer_sessions_customer (customer_id),
  INDEX idx_customer_sessions_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
