-- Phase 6: Subscription Management Schema
-- Run on each client DB via cPanel phpMyAdmin (operator step).
-- Safe to re-run: all statements use IF NOT EXISTS / IGNORE.

CREATE TABLE IF NOT EXISTS subscriptions (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  site_id         INT NULL,
  domain          VARCHAR(255) NOT NULL,
  plan            ENUM('starter', 'growth', 'pro') NOT NULL DEFAULT 'starter',
  billing_status  ENUM('active', 'overdue', 'cancelled', 'trialing') NOT NULL DEFAULT 'active',
  renewal_date    DATE NULL,
  billing_email   VARCHAR(255) NULL,
  billing_name    VARCHAR(255) NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subscription_usage_snapshots (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  subscription_id       INT NOT NULL,
  snapshot_date         DATE NOT NULL,
  ai_tokens_used_month  BIGINT NOT NULL DEFAULT 0,
  pages_count           INT NOT NULL DEFAULT 0,
  media_mb_used         DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  email_accounts_used   INT NOT NULL DEFAULT 0,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sub_date (subscription_id, snapshot_date)
);

CREATE TABLE IF NOT EXISTS subscription_upgrade_requests (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  site_id      INT NULL,
  domain       VARCHAR(255) NULL,
  current_plan ENUM('starter', 'growth', 'pro') NULL,
  requested_plan ENUM('starter', 'growth', 'pro') NOT NULL,
  requested_by INT NULL,
  status       ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  notes        TEXT NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS provider_config (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  active_provider ENUM('anthropic', 'openai') NOT NULL DEFAULT 'anthropic',
  changed_by      VARCHAR(255) NULL,
  changed_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS provider_audit_log (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  old_provider    VARCHAR(64) NULL,
  new_provider    VARCHAR(64) NOT NULL,
  changed_by      VARCHAR(255) NULL,
  changed_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO provider_config (id, active_provider) VALUES (1, 'anthropic');
