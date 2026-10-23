-- Presentation filler for phpMyAdmin on the live database (paatwork_site).
-- Safe to run again: existing demo emails and PA-DEMO- tickets are left as they are.
--
-- No password is stored in this file. Each new demo user copies password_hash
-- from the Server Admin with the lowest id. Sign in with that person's password.
-- PIN login is not set up for these accounts.
--
-- Requires migrations (Randfontein, Mohlakeng, Rural Holdings, CBD Core) and
-- at least one Server Admin. If either is missing, the check below stops the
-- script and inserts nothing.
--
-- Demo sign-in addresses:
--   demo.resident1@example.com  Thabo Molefe, Resident, Mohlakeng
--   demo.resident2@example.com  Lerato Nkosi, Resident, CBD Core
--   demo.resident3@example.com  Ruan Jacobs, Resident, Rural Holdings
--   demo.member1@example.com    Nomsa Dlamini, PA Member, all Randfontein wards
--   demo.member2@example.com    Sipho Khumalo, PA Member, Mohlakeng only
--   demo.admin1@example.com     Ayesha Patel, Admin, all Randfontein wards

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

SET @demo_password_hash := (
  SELECT password_hash FROM users WHERE role = 'Server Admin' ORDER BY id LIMIT 1
);
SET @randfontein_id := (
  SELECT id FROM areas
  WHERE kind = 'municipality' AND name = 'Randfontein' AND parent_id IS NULL
  LIMIT 1
);
SET @ward_mohlakeng := (
  SELECT id FROM areas
  WHERE kind = 'ward' AND name = 'Mohlakeng' AND parent_id = @randfontein_id
  LIMIT 1
);
SET @ward_cbd := (
  SELECT id FROM areas
  WHERE kind = 'ward' AND name = 'CBD Core' AND parent_id = @randfontein_id
  LIMIT 1
);
SET @ward_rural := (
  SELECT id FROM areas
  WHERE kind = 'ward' AND name = 'Rural Holdings' AND parent_id = @randfontein_id
  LIMIT 1
);
SET @demo_seed_ready := (
  @demo_password_hash IS NOT NULL
  AND @randfontein_id IS NOT NULL
  AND @ward_mohlakeng IS NOT NULL
  AND @ward_cbd IS NOT NULL
  AND @ward_rural IS NOT NULL
);

-- Intentional failure when the database is not ready. The missing table name
-- in the error says what to fix. Later inserts also check @demo_seed_ready.
SET @demo_seed_check_sql := CASE
  WHEN @demo_password_hash IS NULL THEN 'SELECT 1 FROM demo_seed_needs_server_admin'
  WHEN @demo_seed_ready = 0 THEN 'SELECT 1 FROM demo_seed_needs_randfontein_wards'
  ELSE 'SELECT ''Demo seed checks passed'' AS demo_seed_status'
END;
PREPARE demo_seed_check FROM @demo_seed_check_sql;
EXECUTE demo_seed_check;
DEALLOCATE PREPARE demo_seed_check;

START TRANSACTION;

INSERT INTO users (
  email, password_hash, pin_hash, display_name, full_name, surname,
  phone, address, role, home_area_id, consent_given, created_at
)
SELECT 'demo.resident1@example.com', @demo_password_hash, NULL,
  'Thabo Molefe', 'Thabo', 'Molefe', '010 100 1001',
  '18 Serobe Street, Mohlakeng, Randfontein', 'Resident', @ward_mohlakeng, 1,
  DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY)
FROM DUAL
WHERE @demo_seed_ready = 1
  AND NOT EXISTS (SELECT 1 FROM users WHERE email = 'demo.resident1@example.com');

INSERT INTO users (
  email, password_hash, pin_hash, display_name, full_name, surname,
  phone, address, role, home_area_id, consent_given, created_at
)
SELECT 'demo.resident2@example.com', @demo_password_hash, NULL,
  'Lerato Nkosi', 'Lerato', 'Nkosi', '010 100 1002',
  '7 Van Riebeeck Road, Randfontein', 'Resident', @ward_cbd, 1,
  DATE_SUB(UTC_TIMESTAMP(), INTERVAL 28 DAY)
FROM DUAL
WHERE @demo_seed_ready = 1
  AND NOT EXISTS (SELECT 1 FROM users WHERE email = 'demo.resident2@example.com');

INSERT INTO users (
  email, password_hash, pin_hash, display_name, full_name, surname,
  phone, address, role, home_area_id, consent_given, created_at
)
SELECT 'demo.resident3@example.com', @demo_password_hash, NULL,
  'Ruan Jacobs', 'Ruan', 'Jacobs', '010 100 1003',
  'Plot 18, Fifth Avenue, Randfontein', 'Resident', @ward_rural, 1,
  DATE_SUB(UTC_TIMESTAMP(), INTERVAL 26 DAY)
FROM DUAL
WHERE @demo_seed_ready = 1
  AND NOT EXISTS (SELECT 1 FROM users WHERE email = 'demo.resident3@example.com');

INSERT INTO users (
  email, password_hash, pin_hash, display_name, full_name, surname,
  phone, address, role, home_area_id, consent_given, created_at
)
SELECT 'demo.member1@example.com', @demo_password_hash, NULL,
  'Nomsa Dlamini', 'Nomsa', 'Dlamini', '010 100 2001',
  'PA office, Sutherland Street, Randfontein', 'PA Member', @randfontein_id, 0,
  DATE_SUB(UTC_TIMESTAMP(), INTERVAL 40 DAY)
FROM DUAL
WHERE @demo_seed_ready = 1
  AND NOT EXISTS (SELECT 1 FROM users WHERE email = 'demo.member1@example.com');

INSERT INTO users (
  email, password_hash, pin_hash, display_name, full_name, surname,
  phone, address, role, home_area_id, consent_given, created_at
)
SELECT 'demo.member2@example.com', @demo_password_hash, NULL,
  'Sipho Khumalo', 'Sipho', 'Khumalo', '010 100 2002',
  '22 Mphahlele Street, Mohlakeng, Randfontein', 'PA Member', @ward_mohlakeng, 0,
  DATE_SUB(UTC_TIMESTAMP(), INTERVAL 36 DAY)
FROM DUAL
WHERE @demo_seed_ready = 1
  AND NOT EXISTS (SELECT 1 FROM users WHERE email = 'demo.member2@example.com');

INSERT INTO users (
  email, password_hash, pin_hash, display_name, full_name, surname,
  phone, address, role, home_area_id, consent_given, created_at
)
SELECT 'demo.admin1@example.com', @demo_password_hash, NULL,
  'Ayesha Patel', 'Ayesha', 'Patel', '010 100 3001',
  'PA office, Union Street, Randfontein', 'Admin', @randfontein_id, 0,
  DATE_SUB(UTC_TIMESTAMP(), INTERVAL 45 DAY)
FROM DUAL
WHERE @demo_seed_ready = 1
  AND NOT EXISTS (SELECT 1 FROM users WHERE email = 'demo.admin1@example.com');

-- Municipality assignment includes every ward. A ward assignment does not.
INSERT INTO user_areas (user_id, area_id)
SELECT u.id, @randfontein_id
FROM users u
WHERE @demo_seed_ready = 1
  AND u.email IN ('demo.member1@example.com', 'demo.admin1@example.com')
  AND NOT EXISTS (
    SELECT 1 FROM user_areas ua WHERE ua.user_id = u.id AND ua.area_id = @randfontein_id
  );

INSERT INTO user_areas (user_id, area_id)
SELECT u.id, @ward_mohlakeng
FROM users u
WHERE @demo_seed_ready = 1
  AND u.email = 'demo.member2@example.com'
  AND NOT EXISTS (
    SELECT 1 FROM user_areas ua WHERE ua.user_id = u.id AND ua.area_id = @ward_mohlakeng
  );

-- Columns in each UNION row:
-- ticket, reporter, category, description, address, ward,
-- latitude, longitude, status, escalation, assignee, dispatcher, completer,
-- created_at, dispatched_at, completed_at, updated_at
INSERT INTO complaints (
  ticket_reference, reporter_id, category, description, address,
  municipality_id, ward_id, latitude, longitude, photo_stored_name, photo_mime,
  status, escalation_level, assignee_label, dispatched_at, dispatched_by,
  completed_at, completed_by, created_at, updated_at
)
SELECT
  row.ticket_reference,
  reporter.id,
  row.category,
  row.description,
  row.address,
  @randfontein_id,
  CASE row.ward_name
    WHEN 'Mohlakeng' THEN @ward_mohlakeng
    WHEN 'CBD Core' THEN @ward_cbd
    WHEN 'Rural Holdings' THEN @ward_rural
  END,
  row.latitude,
  row.longitude,
  NULL,
  NULL,
  row.status,
  row.escalation_level,
  row.assignee_label,
  row.dispatched_at,
  dispatcher.id,
  row.completed_at,
  completer.id,
  row.created_at,
  row.updated_at
FROM (
  SELECT 'PA-DEMO-001' AS ticket_reference, 'demo.resident1@example.com' AS reporter_email,
    'Pothole' AS category,
    'A deep pothole has opened in Serobe Street outside house 18. Cars are swerving into the opposite lane.' AS description,
    '18 Serobe Street, Mohlakeng' AS address, 'Mohlakeng' AS ward_name,
    CAST(-26.208400 AS DECIMAL(9,6)) AS latitude, CAST(27.679800 AS DECIMAL(9,6)) AS longitude,
    'Received' AS status, CAST(NULL AS CHAR(80)) AS escalation_level, CAST(NULL AS CHAR(160)) AS assignee_label,
    CAST(NULL AS CHAR(255)) AS dispatcher_email, CAST(NULL AS CHAR(255)) AS completer_email,
    DATE_SUB(UTC_TIMESTAMP(), INTERVAL 2 DAY) AS created_at,
    CAST(NULL AS DATETIME) AS dispatched_at, CAST(NULL AS DATETIME) AS completed_at,
    DATE_SUB(UTC_TIMESTAMP(), INTERVAL 2 DAY) AS updated_at
  UNION ALL
  SELECT 'PA-DEMO-002', 'demo.resident1@example.com', 'Water',
    'No water from the yard tap since Monday morning. Neighbours in the same block are also dry.',
    '14 Makoe Street, Mohlakeng', 'Mohlakeng',
    -26.211200, 27.683500,
    'In progress', NULL, 'Mohlakeng water team',
    'demo.member2@example.com', NULL,
    DATE_SUB(UTC_TIMESTAMP(), INTERVAL 12 DAY),
    DATE_SUB(UTC_TIMESTAMP(), INTERVAL 11 DAY), NULL,
    DATE_SUB(UTC_TIMESTAMP(), INTERVAL 11 DAY)
  UNION ALL
  SELECT 'PA-DEMO-003', 'demo.resident1@example.com', 'Refuse',
    'Black bags from the Tuesday round have been sitting on the corner for more than a week.',
    'Corner of Serobe Street and Mphahlele Street, Mohlakeng', 'Mohlakeng',
    -26.205500, 27.676000,
    'Resolved', NULL, 'Mohlakeng refuse round',
    'demo.member2@example.com', 'demo.member2@example.com',
    DATE_SUB(UTC_TIMESTAMP(), INTERVAL 20 DAY),
    DATE_SUB(UTC_TIMESTAMP(), INTERVAL 19 DAY), DATE_SUB(UTC_TIMESTAMP(), INTERVAL 16 DAY),
    DATE_SUB(UTC_TIMESTAMP(), INTERVAL 16 DAY)
  UNION ALL
  SELECT 'PA-DEMO-004', 'demo.resident2@example.com', 'Power outage',
    'The block between Station Street and Fifth Street has been dark since last night. Street lights are out as well.',
    'Station Street, Randfontein', 'CBD Core',
    -26.183200, 27.702500,
    'Received', 'Ward Councillor', NULL,
    NULL, NULL,
    DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY),
    NULL, NULL,
    DATE_SUB(UTC_TIMESTAMP(), INTERVAL 18 HOUR)
  UNION ALL
  SELECT 'PA-DEMO-005', 'demo.resident2@example.com', 'Pothole',
    'The pothole at the Union Street robot is wide enough to catch a wheel.',
    'Union Street, Randfontein', 'CBD Core',
    -26.186800, 27.699400,
    'In progress', NULL, 'CBD roads team',
    'demo.member1@example.com', NULL,
    DATE_SUB(UTC_TIMESTAMP(), INTERVAL 8 DAY),
    DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY), NULL,
    DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY)
  UNION ALL
  SELECT 'PA-DEMO-006', 'demo.resident2@example.com', 'Water',
    'Dirty water is coming out of the kitchen taps at the flats on Van Riebeeck Road.',
    '44 Fifth Street, Randfontein', 'CBD Core',
    -26.181000, 27.706200,
    'Resolved', 'Provincial Desk', 'CBD plumbing team',
    'demo.member1@example.com', 'demo.member1@example.com',
    DATE_SUB(UTC_TIMESTAMP(), INTERVAL 18 DAY),
    DATE_SUB(UTC_TIMESTAMP(), INTERVAL 17 DAY), DATE_SUB(UTC_TIMESTAMP(), INTERVAL 14 DAY),
    DATE_SUB(UTC_TIMESTAMP(), INTERVAL 14 DAY)
  UNION ALL
  SELECT 'PA-DEMO-007', 'demo.resident3@example.com', 'Other',
    'The gravel entrance to the smallholdings on Fifth Avenue washes away after rain. Delivery vehicles get stuck.',
    'Plot 18, Fifth Avenue, Rural Holdings', 'Rural Holdings',
    -26.162000, 27.742000,
    'Received', NULL, NULL,
    NULL, NULL,
    DATE_SUB(UTC_TIMESTAMP(), INTERVAL 2 DAY),
    NULL, NULL,
    DATE_SUB(UTC_TIMESTAMP(), INTERVAL 2 DAY)
  UNION ALL
  SELECT 'PA-DEMO-008', 'demo.resident3@example.com', 'Power outage',
    'Plot 18 has had no power since the storm. The pole at the gate is leaning.',
    'Plot 18, Fifth Avenue, Randfontein', 'Rural Holdings',
    -26.158400, 27.728800,
    'In progress', 'Regional Coordinator', 'Rural electricity crew',
    'demo.member1@example.com', NULL,
    DATE_SUB(UTC_TIMESTAMP(), INTERVAL 15 DAY),
    DATE_SUB(UTC_TIMESTAMP(), INTERVAL 14 DAY), NULL,
    DATE_SUB(UTC_TIMESTAMP(), INTERVAL 13 DAY)
  UNION ALL
  SELECT 'PA-DEMO-009', 'demo.resident3@example.com', 'Refuse',
    'Garden refuse on Main Reef Road was not collected on the scheduled Friday.',
    'Main Reef Road, Rural Holdings', 'Rural Holdings',
    -26.170200, 27.751000,
    'Resolved', NULL, 'Rural holdings refuse truck',
    'demo.member1@example.com', 'demo.member1@example.com',
    DATE_SUB(UTC_TIMESTAMP(), INTERVAL 22 DAY),
    DATE_SUB(UTC_TIMESTAMP(), INTERVAL 21 DAY), DATE_SUB(UTC_TIMESTAMP(), INTERVAL 18 DAY),
    DATE_SUB(UTC_TIMESTAMP(), INTERVAL 18 DAY)
  UNION ALL
  SELECT 'PA-DEMO-010', 'demo.resident1@example.com', 'Power outage',
    'House 42 on Mphahlele Street loses power every evening.',
    '42 Mphahlele Street, Mohlakeng', 'Mohlakeng',
    -26.214000, 27.686200,
    'In progress', NULL, 'Municipal electricians',
    'demo.member2@example.com', NULL,
    DATE_SUB(UTC_TIMESTAMP(), INTERVAL 6 DAY),
    DATE_SUB(UTC_TIMESTAMP(), INTERVAL 5 DAY), NULL,
    DATE_SUB(UTC_TIMESTAMP(), INTERVAL 5 DAY)
  UNION ALL
  SELECT 'PA-DEMO-011', 'demo.resident2@example.com', 'Refuse',
    'The collection behind the shops on Sutherland Street was skipped. Bins are overflowing onto the pavement.',
    'Sutherland Street, Randfontein', 'CBD Core',
    -26.185500, 27.697800,
    'Received', NULL, NULL,
    NULL, NULL,
    DATE_SUB(UTC_TIMESTAMP(), INTERVAL 3 DAY),
    NULL, NULL,
    DATE_SUB(UTC_TIMESTAMP(), INTERVAL 3 DAY)
  UNION ALL
  SELECT 'PA-DEMO-012', 'demo.resident3@example.com', 'Water',
    'A burst pipe beside Eighth Street has been running down the road for three days.',
    'Eighth Street, Rural Holdings', 'Rural Holdings',
    -26.166600, 27.736400,
    'In progress', 'PA Member Liaison', 'Rural water team',
    'demo.member1@example.com', NULL,
    DATE_SUB(UTC_TIMESTAMP(), INTERVAL 9 DAY),
    DATE_SUB(UTC_TIMESTAMP(), INTERVAL 8 DAY), NULL,
    DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY)
) AS row
JOIN users reporter ON reporter.email = row.reporter_email
LEFT JOIN users dispatcher ON dispatcher.email = row.dispatcher_email
LEFT JOIN users completer ON completer.email = row.completer_email
WHERE @demo_seed_ready = 1
  AND NOT EXISTS (
    SELECT 1 FROM complaints existing WHERE existing.ticket_reference = row.ticket_reference
  );

INSERT INTO complaint_updates (complaint_id, status, note, actor_id, created_at)
SELECT c.id, 'Received',
  CONCAT('We received your complaint ', c.ticket_reference, ' (', c.category, ').'),
  c.reporter_id, c.created_at
FROM complaints c
WHERE @demo_seed_ready = 1
  AND c.ticket_reference LIKE 'PA-DEMO-%'
  AND NOT EXISTS (
    SELECT 1 FROM complaint_updates u
    WHERE u.complaint_id = c.id AND u.status = 'Received'
  );

INSERT INTO complaint_updates (complaint_id, status, note, actor_id, created_at)
SELECT c.id, 'In progress',
  CONCAT(c.assignee_label, ' was sent to repair this complaint.'),
  c.dispatched_by, c.dispatched_at
FROM complaints c
WHERE @demo_seed_ready = 1
  AND c.ticket_reference LIKE 'PA-DEMO-%'
  AND c.dispatched_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM complaint_updates u
    WHERE u.complaint_id = c.id AND u.status = 'In progress'
  );

INSERT INTO complaint_updates (complaint_id, status, note, actor_id, created_at)
SELECT c.id,
  CASE c.ticket_reference
    WHEN 'PA-DEMO-004' THEN 'Received'
    ELSE 'In progress'
  END,
  CONCAT('Your complaint ', c.ticket_reference, ' was referred to ', c.escalation_level, '.'),
  admin_user.id,
  CASE c.ticket_reference
    WHEN 'PA-DEMO-004' THEN DATE_SUB(UTC_TIMESTAMP(), INTERVAL 18 HOUR)
    WHEN 'PA-DEMO-006' THEN DATE_SUB(UTC_TIMESTAMP(), INTERVAL 16 DAY)
    WHEN 'PA-DEMO-008' THEN DATE_SUB(UTC_TIMESTAMP(), INTERVAL 13 DAY)
    WHEN 'PA-DEMO-012' THEN DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY)
  END
FROM complaints c
JOIN users admin_user ON admin_user.email = 'demo.admin1@example.com'
WHERE @demo_seed_ready = 1
  AND c.ticket_reference IN ('PA-DEMO-004', 'PA-DEMO-006', 'PA-DEMO-008', 'PA-DEMO-012')
  AND c.escalation_level IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM complaint_updates u
    WHERE u.complaint_id = c.id AND u.note LIKE 'Your complaint % was referred to %'
  );

INSERT INTO complaint_updates (complaint_id, status, note, actor_id, created_at)
SELECT c.id, 'Resolved',
  CONCAT('Your complaint ', c.ticket_reference, ' has been marked complete.'),
  c.completed_by, c.completed_at
FROM complaints c
WHERE @demo_seed_ready = 1
  AND c.ticket_reference LIKE 'PA-DEMO-%'
  AND c.completed_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM complaint_updates u
    WHERE u.complaint_id = c.id AND u.status = 'Resolved'
  );

INSERT INTO notifications (user_id, complaint_id, message, read_at, created_at)
SELECT c.reporter_id, c.id,
  CONCAT('We received your complaint ', c.ticket_reference, ' (', c.category, ').'),
  CASE
    WHEN c.created_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 3 DAY)
      THEN DATE_ADD(c.created_at, INTERVAL 3 HOUR)
    ELSE NULL
  END,
  c.created_at
FROM complaints c
JOIN users reporter ON reporter.id = c.reporter_id
WHERE @demo_seed_ready = 1
  AND c.ticket_reference LIKE 'PA-DEMO-%'
  AND reporter.email LIKE 'demo.resident%@example.com'
  AND NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.user_id = c.reporter_id AND n.complaint_id = c.id
      AND n.message = CONCAT('We received your complaint ', c.ticket_reference, ' (', c.category, ').')
  );

INSERT INTO notifications (user_id, complaint_id, message, read_at, created_at)
SELECT c.reporter_id, c.id,
  CONCAT('Your complaint ', c.ticket_reference, ' is in progress. ', c.assignee_label, ' was sent to repair this complaint.'),
  CASE
    WHEN c.dispatched_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 3 DAY)
      THEN DATE_ADD(c.dispatched_at, INTERVAL 3 HOUR)
    ELSE NULL
  END,
  c.dispatched_at
FROM complaints c
WHERE @demo_seed_ready = 1
  AND c.ticket_reference LIKE 'PA-DEMO-%'
  AND c.dispatched_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.complaint_id = c.id AND n.user_id = c.reporter_id
      AND n.message LIKE 'Your complaint % is in progress.%'
  );

INSERT INTO notifications (user_id, complaint_id, message, read_at, created_at)
SELECT c.reporter_id, c.id,
  CONCAT('Your complaint ', c.ticket_reference, ' was referred to ', c.escalation_level, '.'),
  CASE
    WHEN referred.referred_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 3 DAY)
      THEN DATE_ADD(referred.referred_at, INTERVAL 3 HOUR)
    ELSE NULL
  END,
  referred.referred_at
FROM complaints c
JOIN (
  SELECT 'PA-DEMO-004' AS ticket_reference, DATE_SUB(UTC_TIMESTAMP(), INTERVAL 18 HOUR) AS referred_at
  UNION ALL SELECT 'PA-DEMO-006', DATE_SUB(UTC_TIMESTAMP(), INTERVAL 16 DAY)
  UNION ALL SELECT 'PA-DEMO-008', DATE_SUB(UTC_TIMESTAMP(), INTERVAL 13 DAY)
  UNION ALL SELECT 'PA-DEMO-012', DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY)
) AS referred ON referred.ticket_reference = c.ticket_reference
WHERE @demo_seed_ready = 1
  AND c.escalation_level IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.complaint_id = c.id AND n.user_id = c.reporter_id
      AND n.message LIKE 'Your complaint % was referred to %'
  );

INSERT INTO notifications (user_id, complaint_id, message, read_at, created_at)
SELECT c.reporter_id, c.id,
  CONCAT('Your complaint ', c.ticket_reference, ' has been marked complete.'),
  DATE_ADD(c.completed_at, INTERVAL 3 HOUR),
  c.completed_at
FROM complaints c
WHERE @demo_seed_ready = 1
  AND c.ticket_reference LIKE 'PA-DEMO-%'
  AND c.completed_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.complaint_id = c.id AND n.user_id = c.reporter_id
      AND n.message LIKE 'Your complaint % has been marked complete.'
  );

INSERT INTO notifications (user_id, complaint_id, message, read_at, created_at)
SELECT staff.id, c.id,
  CONCAT('New ', c.category, ' complaint ', c.ticket_reference, ' in ', ward.name, ', Randfontein.'),
  CASE
    WHEN c.created_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 3 DAY)
      THEN DATE_ADD(c.created_at, INTERVAL 2 HOUR)
    ELSE NULL
  END,
  DATE_ADD(c.created_at, INTERVAL 1 MINUTE)
FROM complaints c
JOIN areas ward ON ward.id = c.ward_id
JOIN users staff ON staff.email IN ('demo.member1@example.com', 'demo.admin1@example.com')
  OR (staff.email = 'demo.member2@example.com' AND ward.name = 'Mohlakeng')
WHERE @demo_seed_ready = 1
  AND c.ticket_reference LIKE 'PA-DEMO-%'
  AND NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.user_id = staff.id AND n.complaint_id = c.id
      AND n.message LIKE 'New % complaint PA-DEMO-%'
  );

COMMIT;

SELECT
  (SELECT COUNT(*) FROM users WHERE email LIKE 'demo.%@example.com') AS demo_users,
  (SELECT COUNT(*) FROM complaints WHERE ticket_reference LIKE 'PA-DEMO-%') AS demo_complaints,
  (SELECT COUNT(*) FROM complaint_updates u JOIN complaints c ON c.id = u.complaint_id WHERE c.ticket_reference LIKE 'PA-DEMO-%') AS demo_updates,
  (SELECT COUNT(*) FROM notifications n JOIN users u ON u.id = n.user_id WHERE u.email LIKE 'demo.%@example.com') AS demo_notifications,
  CASE
    WHEN @demo_password_hash IS NULL THEN 'Stopped: no Server Admin password hash to copy.'
    WHEN @demo_seed_ready = 0 THEN 'Stopped: Randfontein or one of its wards is missing.'
    ELSE 'Demo data is in place. Sign in with a demo.*@example.com address and the Server Admin password.'
  END AS result;
