-- Phase 6: Email Client Foundation Schema
-- OPERATOR STEP: Run on each client DB via cPanel phpMyAdmin.
-- Safe to re-run: all statements use IF NOT EXISTS.
-- See PHASE6_HANDOFF.md for the full IMAP/SMTP proxy contract.

CREATE TABLE IF NOT EXISTS email_accounts (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  site_id         INT NULL,
  email_address   VARCHAR(255) NOT NULL,
  display_name    VARCHAR(255) NULL,
  imap_host       VARCHAR(255) NULL,
  imap_port       SMALLINT NOT NULL DEFAULT 993,
  imap_ssl        TINYINT(1) NOT NULL DEFAULT 1,
  smtp_host       VARCHAR(255) NULL,
  smtp_port       SMALLINT NOT NULL DEFAULT 587,
  smtp_ssl        TINYINT(1) NOT NULL DEFAULT 1,
  quota_mb        INT NOT NULL DEFAULT 250,
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_email (email_address)
);

CREATE TABLE IF NOT EXISTS email_folders (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  account_id      INT NOT NULL,
  folder_name     VARCHAR(255) NOT NULL,
  folder_path     VARCHAR(500) NOT NULL,
  message_count   INT NOT NULL DEFAULT 0,
  unseen_count    INT NOT NULL DEFAULT 0,
  last_synced_at  TIMESTAMP NULL,
  INDEX idx_account (account_id)
);

CREATE TABLE IF NOT EXISTS email_messages (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  account_id      INT NOT NULL,
  folder_id       INT NOT NULL,
  uid             BIGINT NOT NULL,
  message_id      VARCHAR(500) NULL,
  subject         VARCHAR(1000) NULL,
  from_address    VARCHAR(500) NULL,
  to_addresses    TEXT NULL,
  cc_addresses    TEXT NULL,
  sent_at         TIMESTAMP NULL,
  is_seen         TINYINT(1) NOT NULL DEFAULT 0,
  is_flagged      TINYINT(1) NOT NULL DEFAULT 0,
  has_attachments TINYINT(1) NOT NULL DEFAULT 0,
  body_preview    VARCHAR(500) NULL,
  synced_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_uid (account_id, folder_id, uid),
  INDEX idx_folder (folder_id),
  INDEX idx_sent (sent_at),
  INDEX idx_seen (is_seen)
);

CREATE TABLE IF NOT EXISTS email_drafts (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  account_id      INT NOT NULL,
  reply_to_uid    BIGINT NULL,
  to_addresses    TEXT NULL,
  cc_addresses    TEXT NULL,
  subject         VARCHAR(1000) NULL,
  body_html       MEDIUMTEXT NULL,
  body_text       MEDIUMTEXT NULL,
  status          ENUM('draft', 'sent', 'failed') NOT NULL DEFAULT 'draft',
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
