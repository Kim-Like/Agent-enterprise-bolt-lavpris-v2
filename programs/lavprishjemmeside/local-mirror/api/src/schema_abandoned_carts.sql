CREATE TABLE IF NOT EXISTS cart_sessions (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id       VARCHAR(64) NOT NULL UNIQUE,
  email            VARCHAR(320) NULL,
  cart_json        MEDIUMTEXT NOT NULL,
  captured_at      TIMESTAMP NULL,
  last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  reminder_sent_at TIMESTAMP NULL,
  recovered_at     TIMESTAMP NULL,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cs_session (session_id),
  INDEX idx_cs_email (email),
  INDEX idx_cs_activity (last_activity_at),
  INDEX idx_cs_reminder (reminder_sent_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
