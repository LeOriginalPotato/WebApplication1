CREATE TABLE IF NOT EXISTS areas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  parent_id INT NULL,
  name VARCHAR(160) NOT NULL,
  kind ENUM('municipality', 'ward') NOT NULL,
  parent_key INT AS (IFNULL(parent_id, 0)) STORED,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_area (kind, parent_key, name),
  CONSTRAINT fk_area_parent FOREIGN KEY (parent_id) REFERENCES areas (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  pin_hash VARCHAR(255) NULL,
  display_name VARCHAR(200) NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  surname VARCHAR(120) NOT NULL,
  id_number VARCHAR(32) NULL,
  phone VARCHAR(40) NULL,
  address VARCHAR(400) NULL,
  role ENUM('Resident', 'PA Member', 'Admin', 'Server Admin') NOT NULL,
  home_area_id INT NULL,
  consent_given TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email),
  CONSTRAINT fk_users_home_area FOREIGN KEY (home_area_id) REFERENCES areas (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_areas (
  user_id INT NOT NULL,
  area_id INT NOT NULL,
  PRIMARY KEY (user_id, area_id),
  CONSTRAINT fk_user_areas_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_user_areas_area FOREIGN KEY (area_id) REFERENCES areas (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS complaints (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ticket_reference VARCHAR(32) NOT NULL,
  reporter_id INT NOT NULL,
  category VARCHAR(40) NOT NULL,
  description TEXT NOT NULL,
  address VARCHAR(400) NOT NULL,
  municipality_id INT NOT NULL,
  ward_id INT NULL,
  latitude DECIMAL(9,6) NULL,
  longitude DECIMAL(9,6) NULL,
  photo_stored_name VARCHAR(80) NULL,
  photo_mime VARCHAR(80) NULL,
  status ENUM('Received', 'In progress', 'Resolved') NOT NULL DEFAULT 'Received',
  escalation_level VARCHAR(80) NULL,
  assignee_label VARCHAR(160) NULL,
  dispatched_at DATETIME NULL,
  dispatched_by INT NULL,
  completed_at DATETIME NULL,
  completed_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_complaints_ticket (ticket_reference),
  KEY ix_complaints_reporter (reporter_id),
  KEY ix_complaints_area (municipality_id, ward_id),
  KEY ix_complaints_status (status),
  CONSTRAINT fk_complaints_reporter FOREIGN KEY (reporter_id) REFERENCES users (id),
  CONSTRAINT fk_complaints_municipality FOREIGN KEY (municipality_id) REFERENCES areas (id),
  CONSTRAINT fk_complaints_ward FOREIGN KEY (ward_id) REFERENCES areas (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS complaint_updates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  complaint_id INT NOT NULL,
  status VARCHAR(40) NOT NULL,
  note VARCHAR(500) NOT NULL,
  actor_id INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_updates_complaint (complaint_id, created_at),
  CONSTRAINT fk_updates_complaint FOREIGN KEY (complaint_id) REFERENCES complaints (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  complaint_id INT NULL,
  message VARCHAR(500) NOT NULL,
  read_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_notifications_user (user_id, read_at, created_at),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_notifications_complaint FOREIGN KEY (complaint_id) REFERENCES complaints (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS section78_disputes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  resident_id INT NOT NULL,
  reference_code VARCHAR(32) NOT NULL,
  property_address VARCHAR(400) NOT NULL,
  municipal_account_number VARCHAR(80) NOT NULL,
  erf_number VARCHAR(80) NOT NULL,
  title_deed_number VARCHAR(80) NOT NULL,
  actual_dominant_use VARCHAR(200) NOT NULL,
  property_category_dispute VARCHAR(200) NOT NULL,
  owner_statement TEXT NOT NULL,
  municipality_id INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_section78_reference (reference_code),
  KEY ix_section78_resident (resident_id),
  CONSTRAINT fk_section78_resident FOREIGN KEY (resident_id) REFERENCES users (id),
  CONSTRAINT fk_section78_area FOREIGN KEY (municipality_id) REFERENCES areas (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS settings (
  id TINYINT PRIMARY KEY,
  site_name VARCHAR(160) NOT NULL,
  whatsapp_link VARCHAR(300) NOT NULL,
  google_maps_api_key VARCHAR(200) NOT NULL DEFAULT '',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  sid VARCHAR(128) PRIMARY KEY,
  data MEDIUMTEXT NOT NULL,
  expires_ms BIGINT NOT NULL,
  KEY ix_sessions_expires (expires_ms)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO areas (parent_id, name, kind)
SELECT NULL, 'Randfontein', 'municipality'
WHERE NOT EXISTS (
  SELECT 1 FROM areas WHERE kind = 'municipality' AND name = 'Randfontein' AND parent_id IS NULL
);

INSERT INTO areas (parent_id, name, kind)
SELECT m.id, w.name, 'ward'
FROM areas m
JOIN (
  SELECT 'Mohlakeng' AS name
  UNION ALL SELECT 'Rural Holdings'
  UNION ALL SELECT 'CBD Core'
) w
WHERE m.kind = 'municipality' AND m.name = 'Randfontein' AND m.parent_id IS NULL
AND NOT EXISTS (
  SELECT 1 FROM areas existing WHERE existing.parent_id = m.id AND existing.name = w.name
);

INSERT INTO settings (id, site_name, whatsapp_link, google_maps_api_key)
SELECT 1, 'PA At Work', '', ''
WHERE NOT EXISTS (SELECT 1 FROM settings WHERE id = 1);
