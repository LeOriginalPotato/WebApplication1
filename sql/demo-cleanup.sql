-- Removes only the presentation demo rows created by sql/demo-seed.sql.
-- Safe to run more than once. Does not delete areas, settings, sessions,
-- or any user whose email does not match demo.%@example.com.
--
-- Also removes PA-DEMO- complaints, in case a demo ticket was left behind,
-- and notifications about those complaints (including any copy sent to a
-- real Server Admin). Real complaints are not updated.
--
-- Foreign-key order: notifications, complaint updates, section 78 disputes,
-- complaints, area assignments, then the demo users.

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

START TRANSACTION;

DELETE n FROM notifications n
INNER JOIN users u ON u.id = n.user_id
WHERE u.email LIKE 'demo.%@example.com';

DELETE n FROM notifications n
INNER JOIN complaints c ON c.id = n.complaint_id
LEFT JOIN users reporter ON reporter.id = c.reporter_id
WHERE c.ticket_reference LIKE 'PA-DEMO-%'
   OR reporter.email LIKE 'demo.%@example.com';

DELETE u FROM complaint_updates u
INNER JOIN complaints c ON c.id = u.complaint_id
LEFT JOIN users reporter ON reporter.id = c.reporter_id
WHERE c.ticket_reference LIKE 'PA-DEMO-%'
   OR reporter.email LIKE 'demo.%@example.com';

DELETE d FROM section78_disputes d
INNER JOIN users u ON u.id = d.resident_id
WHERE u.email LIKE 'demo.%@example.com';

DELETE c FROM complaints c
LEFT JOIN users reporter ON reporter.id = c.reporter_id
WHERE c.ticket_reference LIKE 'PA-DEMO-%'
   OR reporter.email LIKE 'demo.%@example.com';

DELETE ua FROM user_areas ua
INNER JOIN users u ON u.id = ua.user_id
WHERE u.email LIKE 'demo.%@example.com';

DELETE FROM users
WHERE email LIKE 'demo.%@example.com';

COMMIT;

SELECT
  (SELECT COUNT(*) FROM users WHERE email LIKE 'demo.%@example.com') AS demo_users_left,
  (SELECT COUNT(*) FROM complaints WHERE ticket_reference LIKE 'PA-DEMO-%') AS demo_complaints_left,
  'Demo rows removed. Other accounts and areas were left in place.' AS result;
