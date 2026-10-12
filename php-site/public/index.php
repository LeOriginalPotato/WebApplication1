<?php

declare(strict_types=1);

require __DIR__ . '/../app/bootstrap.php';

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

$pdo = null;
$dbBootError = null;
try {
	$pdo = db();
} catch (Throwable $e) {
	$dbBootError = $e->getMessage();
}

$setupConfigFile = __DIR__ . '/../app/config.local.json';

$renderSetup = static function (string $error = '', string $success = ''): void {
	$dbCfg = app_config()['db'];
	$openAiCfg = app_config()['openai'];
	$host = htmlspecialchars((string)($dbCfg['host'] ?? 'localhost'));
	$port = htmlspecialchars((string)($dbCfg['port'] ?? '3306'));
	$database = htmlspecialchars((string)($dbCfg['database'] ?? ''));
	$username = htmlspecialchars((string)($dbCfg['username'] ?? ''));
	$apiKey = htmlspecialchars((string)($openAiCfg['api_key'] ?? ''));
	$errorHtml = $error !== '' ? '<div style="margin-bottom:1rem;padding:.75rem;border-radius:10px;background:rgba(255,141,161,.12);border:1px solid rgba(255,141,161,.45);color:#ffd0da;">' . htmlspecialchars($error) . '</div>' : '';
	$successHtml = $success !== '' ? '<div style="margin-bottom:1rem;padding:.75rem;border-radius:10px;background:rgba(0,191,110,.16);border:1px solid rgba(0,191,110,.45);color:#a8f2ca;">' . htmlspecialchars($success) . '</div>' : '';

	echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PA Portal Setup</title><style>body{margin:0;font-family:Inter,Segoe UI,Arial,sans-serif;background:#121826;color:#d5deeb} .wrap{max-width:760px;margin:2rem auto;padding:1.25rem;background:#1b2436;border:1px solid rgba(255,255,255,.12);border-radius:16px} h1{margin-top:0;color:#fff} label{display:block;margin:.6rem 0 .3rem;font-weight:600;color:#fff} input{width:100%;padding:.58rem .65rem;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#fff} button{margin-top:1rem;border:1px solid #ffcc00;background:#ffcc00;color:#1a1f2c;font-weight:800;border-radius:999px;padding:.62rem 1.1rem;cursor:pointer} .muted{color:#9fb0c9}</style></head><body><section class="wrap"><h1>PA Infrastructure Portal Setup</h1><p class="muted">Enter your cPanel MySQL credentials once, then publish and run normally.</p>' . $errorHtml . $successHtml . '<form method="post" action="/setup"><input type="hidden" name="_csrf" value="' . htmlspecialchars(csrf_token()) . '"><label>DB Host</label><input name="db_host" value="' . $host . '" required><label>DB Port</label><input name="db_port" value="' . $port . '" required><label>Database Name</label><input name="db_name" value="' . $database . '" required><label>DB Username</label><input name="db_user" value="' . $username . '" required><label>DB Password</label><input type="password" name="db_password" value="" placeholder="Enter cPanel DB password" required><label>OpenAI API Key (optional)</label><input name="openai_api_key" value="' . $apiKey . '"><button type="submit">Save and Initialize Database</button></form></section></body></html>';
	exit;
};

if ($path === '/setup' && $method === 'GET') {
	$renderSetup($dbBootError ?? '');
}

if ($path === '/setup' && $method === 'POST') {
	verify_csrf();

	$dbHost = trim((string)($_POST['db_host'] ?? 'localhost'));
	$dbPort = (int)($_POST['db_port'] ?? 3306);
	$dbName = trim((string)($_POST['db_name'] ?? ''));
	$dbUser = trim((string)($_POST['db_user'] ?? ''));
	$dbPassword = (string)($_POST['db_password'] ?? '');
	$openAiApiKey = trim((string)($_POST['openai_api_key'] ?? ''));

	if ($dbName === '' || $dbUser === '') {
		$renderSetup('Database name and username are required.');
	}

	$setupConfig = [
		'db' => [
			'host' => $dbHost,
			'port' => $dbPort,
			'database' => $dbName,
			'username' => $dbUser,
			'password' => $dbPassword,
		],
		'openai' => [
			'api_key' => $openAiApiKey,
		],
	];

	$content = json_encode($setupConfig, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
	if ($content === false || @file_put_contents($setupConfigFile, $content . "\n") === false) {
		$renderSetup('Could not write app/config.local.json. Check file permissions for php-site/app.');
	}

	try {
		$dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $dbHost, $dbPort, $dbName);
		$setupPdo = new PDO($dsn, $dbUser, $dbPassword, [
			PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
			PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
			PDO::ATTR_EMULATE_PREPARES => false,
		]);

		$schemaPath = __DIR__ . '/../database/schema.mysql.sql';
		$schemaSql = file_get_contents($schemaPath);
		if ($schemaSql !== false) {
			$schemaSql = preg_replace('/^\s*--.*$/m', '', $schemaSql);
			$statements = preg_split('/;\s*(?:\r?\n|$)/', (string)$schemaSql);
			if (is_array($statements)) {
				foreach ($statements as $statement) {
					$statement = trim($statement);
					if ($statement === '') {
						continue;
					}

					try {
						$setupPdo->exec($statement);
					} catch (Throwable $schemaEx) {
						$lower = strtolower($statement);
						if (starts_with($lower, 'create database') || starts_with($lower, 'use ')) {
							continue;
						}
						throw $schemaEx;
					}
				}
			}
		}
	} catch (Throwable $setupEx) {
		$renderSetup('Setup failed: ' . $setupEx->getMessage());
	}

	$renderSetup('', 'Setup completed. You can now open the site and log in.');
}

if ($dbBootError !== null && $path !== '/setup') {
	redirect('/setup');
}

if ($method === 'POST' && ($path === '/logout')) {
	verify_csrf();
	logout_user();
	redirect('/login');
}

if ($path === '/login' && $method === 'GET') {
	if (is_authenticated()) {
		redirect('/');
	}

	render_page('login', ['title' => 'Sign In', 'returnUrl' => $_GET['returnUrl'] ?? '/']);
	exit;
}

if ($path === '/login' && $method === 'POST') {
	verify_csrf();

	$email = trim((string)($_POST['emailAddress'] ?? ''));
	$password = (string)($_POST['password'] ?? '');
	$returnUrl = trim((string)($_POST['returnUrl'] ?? '/'));

	$user = db_one($pdo, 'SELECT * FROM Users WHERE EmailAddress = ?', [$email]);
	if (!$user || !verify_password($password, (string)$user['EmailAddress'], (string)$user['PasswordHash'])) {
		render_page('login', ['title' => 'Sign In', 'error' => 'Invalid login attempt.', 'returnUrl' => $returnUrl]);
		exit;
	}

	login_user($user);
	redirect($returnUrl !== '' ? $returnUrl : '/');
}

if ($path === '/register' && $method === 'GET') {
	render_page('register', ['title' => 'Resident Registration']);
	exit;
}

if ($path === '/register' && $method === 'POST') {
	verify_csrf();

	$data = [
		'username' => trim((string)($_POST['username'] ?? '')),
		'firstName' => trim((string)($_POST['firstName'] ?? '')),
		'lastName' => trim((string)($_POST['lastName'] ?? '')),
		'physicalAddress' => trim((string)($_POST['physicalAddress'] ?? '')),
		'cellNumber' => trim((string)($_POST['cellNumber'] ?? '')),
		'emailAddress' => trim((string)($_POST['emailAddress'] ?? '')),
		'password' => (string)($_POST['password'] ?? ''),
		'confirmPassword' => (string)($_POST['confirmPassword'] ?? ''),
	];

	if ($data['password'] === '' || $data['password'] !== $data['confirmPassword']) {
		render_page('register', ['title' => 'Resident Registration', 'error' => 'Password and confirmation must match.']);
		exit;
	}

	$exists = db_one($pdo, 'SELECT UserID FROM Users WHERE Username = ? OR EmailAddress = ? OR CellNumber = ?', [$data['username'], $data['emailAddress'], $data['cellNumber']]);
	if ($exists) {
		render_page('register', ['title' => 'Resident Registration', 'error' => 'A user with the same username, email, or phone already exists.']);
		exit;
	}

	$stmt = $pdo->prepare('INSERT INTO Users (Username, FirstName, LastName, PhysicalAddress, CellNumber, EmailAddress, PasswordHash, UserRole, CreatedAt, IsProfileComplete) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
	$stmt->execute([
		$data['username'],
		$data['firstName'],
		$data['lastName'],
		$data['physicalAddress'],
		$data['cellNumber'],
		$data['emailAddress'],
		create_password_hash($data['password'], $data['emailAddress']),
		'Resident',
		now_utc(),
		1,
	]);

	redirect('/login?returnUrl=%2F');
}

if ($path === '/privacy') {
	render_page('privacy', ['title' => 'Privacy Policy']);
	exit;
}

if ($path === '/') {
	require_auth('Server Admin', 'Admin', 'PA Member', 'Resident');
	render_page('index', ['title' => 'Resident Dashboard']);
	exit;
}

if ($path === '/command-view') {
	require_auth('Server Admin', 'Admin', 'PA Member');
	render_page('command-view', ['title' => 'Councillor & MMC Oversight']);
	exit;
}

if ($path === '/residents') {
	require_auth('Server Admin', 'Admin', 'PA Member');
	render_page('residents', ['title' => 'Residents Directory']);
	exit;
}

if ($path === '/stats-hub') {
	require_auth('Server Admin', 'Admin', 'PA Member');
	$stats = [
		'total' => (int)($pdo->query('SELECT COUNT(*) FROM Faults')->fetchColumn() ?: 0),
		'electrical' => (int)($pdo->query('SELECT COUNT(*) FROM Faults WHERE CategoryID = 1')->fetchColumn() ?: 0),
		'roads' => (int)($pdo->query('SELECT COUNT(*) FROM Faults WHERE CategoryID = 2')->fetchColumn() ?: 0),
		'water' => (int)($pdo->query('SELECT COUNT(*) FROM Faults WHERE CategoryID = 3')->fetchColumn() ?: 0),
		'landfill' => (int)($pdo->query('SELECT COUNT(*) FROM Faults WHERE CategoryID = 4')->fetchColumn() ?: 0),
	];

	render_page('stats-hub', ['title' => 'Public Live Statistics Hub', 'stats' => $stats]);
	exit;
}

if ($path === '/section78-dispute' && $method === 'GET') {
	require_auth('Resident');
	render_page('section78-dispute', ['title' => 'Section 78 Dispute']);
	exit;
}

if ($path === '/section78-dispute' && $method === 'POST') {
	require_auth('Resident');
	verify_csrf();

	$user = app_user();
	$userRow = db_one($pdo, 'SELECT * FROM Users WHERE UserID = ?', [(int)$user['UserID']]);
	if (!$userRow || !(bool)$userRow['IsProfileComplete']) {
		render_page('section78-dispute', ['title' => 'Section 78 Dispute', 'error' => 'Complete your resident profile before filing a Section 78 dispute.']);
		exit;
	}

	$required = ['supportingDocument', 'identityDocument', 'municipalAccountProof'];
	foreach ($required as $fileField) {
		if (!isset($_FILES[$fileField]) || $_FILES[$fileField]['error'] !== UPLOAD_ERR_OK) {
			render_page('section78-dispute', ['title' => 'Section 78 Dispute', 'error' => 'All required documents must be uploaded.']);
			exit;
		}
	}

	$baseUpload = __DIR__ . '/../storage/uploads/section78/' . $user['UserID'] . '/' . gmdate('YmdHis');
	if (!is_dir($baseUpload) && !mkdir($baseUpload, 0777, true) && !is_dir($baseUpload)) {
		render_page('section78-dispute', ['title' => 'Section 78 Dispute', 'error' => 'Unable to prepare upload folder.']);
		exit;
	}

	$saveUpload = static function (string $field, string $folder): string {
		$name = (string)($_FILES[$field]['name'] ?? '');
		$ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
		$safeName = bin2hex(random_bytes(16)) . ($ext !== '' ? '.' . $ext : '');
		$target = $folder . DIRECTORY_SEPARATOR . $safeName;
		if (!move_uploaded_file($_FILES[$field]['tmp_name'], $target)) {
			throw new RuntimeException('Failed to store uploaded file.');
		}

		return $target;
	};

	try {
		$supportingPath = $saveUpload('supportingDocument', $baseUpload);
		$identityPath = $saveUpload('identityDocument', $baseUpload);
		$accountProofPath = $saveUpload('municipalAccountProof', $baseUpload);
	} catch (Throwable) {
		render_page('section78-dispute', ['title' => 'Section 78 Dispute', 'error' => 'Could not save uploaded files.']);
		exit;
	}

	$stmt = $pdo->prepare('INSERT INTO Section78Disputes (UserID, PropertyAddress, MunicipalAccountNumber, ErfNumber, PropertyCategoryDispute, OwnerStatement, NoFormalNoticeReceived, NoSection78DocumentsReceived, SupportingDocumentPath, IdentityDocumentPath, MunicipalAccountProofPath, AdditionalNotes, SubmittedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
	$stmt->execute([
		(int)$user['UserID'],
		trim((string)($_POST['propertyAddress'] ?? '')),
		trim((string)($_POST['municipalAccountNumber'] ?? '')),
		trim((string)($_POST['erfNumber'] ?? '')),
		trim((string)($_POST['propertyCategoryDispute'] ?? '')),
		trim((string)($_POST['ownerStatement'] ?? '')),
		isset($_POST['noFormalNoticeReceived']) ? 1 : 0,
		isset($_POST['noSection78DocumentsReceived']) ? 1 : 0,
		$supportingPath,
		$identityPath,
		$accountProofPath,
		trim((string)($_POST['additionalNotes'] ?? '')),
		now_utc(),
	]);

	flash('Section78Success', 'Your Section 78 dispute has been submitted successfully.');
	redirect('/section78-dispute');
}

if ($path === '/system-configuration') {
	require_auth('Server Admin');
	$config = db_one($pdo, 'SELECT * FROM SystemConfigurations ORDER BY UpdatedAt DESC LIMIT 1') ?? [];
	render_page('system-configuration', ['title' => 'System Configuration', 'config' => $config]);
	exit;
}

if ($path === '/account/edit-my-user' && $method === 'GET') {
	require_auth('Server Admin', 'Admin', 'PA Member', 'Resident');
	$user = app_user();
	$userRow = db_one($pdo, 'SELECT * FROM Users WHERE UserID = ?', [(int)$user['UserID']]);
	if (!$userRow) {
		http_response_code(404);
		echo 'User not found.';
		exit;
	}

	render_page('edit-my-user', ['title' => 'Edit My User', 'userRow' => $userRow]);
	exit;
}

if ($path === '/account/edit-my-user' && $method === 'POST') {
	require_auth('Server Admin', 'Admin', 'PA Member', 'Resident');
	verify_csrf();

	$user = app_user();
	$userId = (int)$user['UserID'];
	$newPassword = (string)($_POST['newPassword'] ?? '');
	$confirmNewPassword = (string)($_POST['confirmNewPassword'] ?? '');
	if ($newPassword !== '' && $newPassword !== $confirmNewPassword) {
		$userRow = db_one($pdo, 'SELECT * FROM Users WHERE UserID = ?', [$userId]);
		render_page('edit-my-user', ['title' => 'Edit My User', 'userRow' => $userRow, 'error' => 'New password and confirmation must match.']);
		exit;
	}

	$email = trim((string)($_POST['emailAddress'] ?? ''));
	$exists = db_one($pdo, 'SELECT UserID FROM Users WHERE UserID <> ? AND (Username = ? OR EmailAddress = ? OR CellNumber = ?)', [$userId, trim((string)($_POST['username'] ?? '')), $email, trim((string)($_POST['cellNumber'] ?? ''))]);
	if ($exists) {
		$userRow = db_one($pdo, 'SELECT * FROM Users WHERE UserID = ?', [$userId]);
		render_page('edit-my-user', ['title' => 'Edit My User', 'userRow' => $userRow, 'error' => 'Another account already uses this username, email, or phone number.']);
		exit;
	}

	$sql = 'UPDATE Users SET Username = ?, FirstName = ?, LastName = ?, PhysicalAddress = ?, EmailAddress = ?, CellNumber = ?, IsProfileComplete = 1';
	$params = [trim((string)($_POST['username'] ?? '')), trim((string)($_POST['firstName'] ?? '')), trim((string)($_POST['lastName'] ?? '')), trim((string)($_POST['physicalAddress'] ?? '')), $email, trim((string)($_POST['cellNumber'] ?? ''))];
	if ($newPassword !== '') {
		$sql .= ', PasswordHash = ?';
		$params[] = create_password_hash($newPassword, $email);
	}
	$sql .= ' WHERE UserID = ?';
	$params[] = $userId;
	$stmt = $pdo->prepare($sql);
	$stmt->execute($params);

	$refreshed = db_one($pdo, 'SELECT * FROM Users WHERE UserID = ?', [$userId]);
	if ($refreshed) {
		login_user($refreshed);
	}

	flash('ProfileUpdated', 'Your account details were updated successfully.');
	redirect('/account/edit-my-user');
}

if ($path === '/account/create-managed-user' && $method === 'GET') {
	require_auth('Server Admin', 'Admin');
	render_page('create-managed-user', ['title' => 'Create Admin/PA Member']);
	exit;
}

if ($path === '/account/create-managed-user' && $method === 'POST') {
	require_auth('Server Admin', 'Admin');
	verify_csrf();

	$role = trim((string)($_POST['userRole'] ?? 'PA Member'));
	if ($role === 'Server Admin' && !has_role('Server Admin')) {
		render_page('create-managed-user', ['title' => 'Create Admin/PA Member', 'error' => 'Only Server Admin users can create Server Admin accounts.']);
		exit;
	}

	$username = trim((string)($_POST['username'] ?? ''));
	$email = trim((string)($_POST['emailAddress'] ?? ''));
	$cell = trim((string)($_POST['cellNumber'] ?? ''));

	$exists = db_one($pdo, 'SELECT UserID FROM Users WHERE Username = ? OR EmailAddress = ? OR CellNumber = ?', [$username, $email, $cell]);
	if ($exists) {
		render_page('create-managed-user', ['title' => 'Create Admin/PA Member', 'error' => 'A user with the same username, email, or phone already exists.']);
		exit;
	}

	$stmt = $pdo->prepare('INSERT INTO Users (Username, FirstName, LastName, PhysicalAddress, CellNumber, EmailAddress, PasswordHash, UserRole, CreatedAt, IsProfileComplete) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
	$stmt->execute([
		$username,
		trim((string)($_POST['firstName'] ?? '')),
		trim((string)($_POST['lastName'] ?? '')),
		trim((string)($_POST['physicalAddress'] ?? '')),
		$cell,
		$email,
		create_password_hash((string)($_POST['password'] ?? ''), $email),
		$role,
		now_utc(),
		1,
	]);

	flash('ManagedUserCreated', 'User created successfully.');
	redirect('/account/create-managed-user');
}

if ($path === '/account/manage-users') {
	require_auth('Server Admin', 'Admin');
	$isServerAdmin = has_role('Server Admin');

	$sql = $isServerAdmin
		? "SELECT * FROM Users WHERE UserRole IN ('Server Admin', 'Admin', 'PA Member') ORDER BY UserRole, FirstName"
		: "SELECT * FROM Users WHERE UserRole IN ('Admin', 'PA Member') ORDER BY UserRole, FirstName";

	$users = $pdo->query($sql)->fetchAll();
	render_page('manage-users', [
		'title' => 'User Management',
		'description' => 'Server Admins can edit staff and Server Admin accounts. Admins can edit Admin and PA Member accounts here.',
		'users' => $users,
		'canEditServerAdmins' => $isServerAdmin,
		'isResidentTab' => false,
	]);
	exit;
}

if ($path === '/account/manage-residents') {
	require_auth('Server Admin', 'Admin');
	$users = $pdo->query("SELECT * FROM Users WHERE UserRole = 'Resident' ORDER BY FirstName")->fetchAll();
	render_page('manage-users', [
		'title' => 'Resident Management',
		'description' => 'Admins and Server Admins can edit resident accounts from this dedicated tab.',
		'users' => $users,
		'canEditServerAdmins' => has_role('Server Admin'),
		'isResidentTab' => true,
	]);
	exit;
}

if ($path === '/account/update-managed-user' && $method === 'POST') {
	require_auth('Server Admin', 'Admin');
	verify_csrf();

	$redirect = (strcasecmp((string)($_POST['returnTab'] ?? ''), 'Residents') === 0) ? '/account/manage-residents' : '/account/manage-users';
	$userId = (int)($_POST['userID'] ?? 0);
	$target = db_one($pdo, 'SELECT * FROM Users WHERE UserID = ?', [$userId]);
	if (!$target) {
		flash('UserManagementError', 'User not found.');
		redirect($redirect);
	}

	$isServerAdmin = has_role('Server Admin');
	if (!$isServerAdmin && $target['UserRole'] === 'Server Admin') {
		flash('UserManagementError', 'You are not allowed to edit Server Admin accounts.');
		redirect($redirect);
	}

	$newRole = trim((string)($_POST['userRole'] ?? $target['UserRole']));
	if (!$isServerAdmin && $newRole === 'Server Admin') {
		flash('UserManagementError', 'You are not allowed to assign that role.');
		redirect($redirect);
	}

	$email = trim((string)($_POST['emailAddress'] ?? ''));
	$exists = db_one($pdo, 'SELECT UserID FROM Users WHERE UserID <> ? AND (Username = ? OR EmailAddress = ? OR CellNumber = ?)', [$userId, trim((string)($_POST['username'] ?? '')), $email, trim((string)($_POST['cellNumber'] ?? ''))]);
	if ($exists) {
		flash('UserManagementError', 'Another account already uses this username, email, or phone number.');
		redirect($redirect);
	}

	$newPassword = (string)($_POST['newPassword'] ?? '');
	$confirmNewPassword = (string)($_POST['confirmNewPassword'] ?? '');
	if (($newPassword !== '' || $confirmNewPassword !== '') && $newPassword !== $confirmNewPassword) {
		flash('UserManagementError', 'New password and confirmation must match.');
		redirect($redirect);
	}

	$sql = 'UPDATE Users SET Username = ?, FirstName = ?, LastName = ?, PhysicalAddress = ?, EmailAddress = ?, CellNumber = ?, UserRole = ?, IsProfileComplete = 1';
	$params = [trim((string)($_POST['username'] ?? '')), trim((string)($_POST['firstName'] ?? '')), trim((string)($_POST['lastName'] ?? '')), trim((string)($_POST['physicalAddress'] ?? '')), $email, trim((string)($_POST['cellNumber'] ?? '')), $newRole];
	if ($newPassword !== '') {
		$sql .= ', PasswordHash = ?';
		$params[] = create_password_hash($newPassword, $email);
	}
	$sql .= ' WHERE UserID = ?';
	$params[] = $userId;

	$stmt = $pdo->prepare($sql);
	$stmt->execute($params);

	flash('UserManagementSuccess', 'User account updated successfully.');
	redirect($redirect);
}

if (starts_with($path, '/api/')) {
	require_auth('Server Admin', 'Admin', 'PA Member', 'Resident');

	if ($path === '/api/infrastructure/log-fault' && $method === 'POST') {
		$payload = request_json();
		$user = app_user();
		$userRow = db_one($pdo, 'SELECT * FROM Users WHERE UserID = ?', [(int)$user['UserID']]);
		if (!$userRow) {
			json_response(['message' => 'Authenticated user was not found.'], 400);
		}

		if ($userRow['UserRole'] === 'Resident' && !(bool)$userRow['IsProfileComplete']) {
			json_response(['message' => 'Resident profile is incomplete. Complete all required profile fields before logging a complaint.'], 400);
		}

		$categoryId = (int)($payload['categoryID'] ?? 0);
		$categoryExists = db_one($pdo, 'SELECT CategoryID FROM Categories WHERE CategoryID = ?', [$categoryId]);
		if (!$categoryExists) {
			json_response(['message' => 'Invalid CategoryID.'], 400);
		}

		$ticketReference = next_ticket_reference($pdo);
		$stmt = $pdo->prepare('INSERT INTO Faults (TicketReference, UserID, CategoryID, Description, PhysicalAddress, Latitude, Longitude, Status, DateLogged, LastUpdated, TeamDispatched, InspectionFindings, IsResolved) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0)');
		$stmt->execute([
			$ticketReference,
			(int)$user['UserID'],
			$categoryId,
			trim((string)($payload['description'] ?? '')),
			trim((string)($payload['physicalAddress'] ?? '')),
			(float)($payload['latitude'] ?? 0),
			(float)($payload['longitude'] ?? 0),
			'Logged',
			now_utc(),
			now_utc(),
			'',
		]);

		$stmt = $pdo->prepare('INSERT INTO Notifications (UserID, TargetRole, Message, RelatedTicketReference, IsRead, CreatedAt) VALUES (?, ?, ?, ?, 0, ?)');
		$stmt->execute([null, 'PA Member', 'New community complaint logged: ' . $ticketReference, $ticketReference, now_utc()]);

		json_response(['ticketReference' => $ticketReference]);
	}

	if ($path === '/api/infrastructure/my-complaints' && $method === 'GET') {
		$user = app_user();
		$stmt = $pdo->prepare("SELECT f.TicketReference, f.DateLogged, f.Status, COALESCE((SELECT e.Notes FROM EscalationHistories e WHERE e.FaultID = f.FaultID ORDER BY e.DateActioned DESC LIMIT 1), f.Status) AS LatestUpdate, COALESCE((SELECT e.DateActioned FROM EscalationHistories e WHERE e.FaultID = f.FaultID ORDER BY e.DateActioned DESC LIMIT 1), f.LastUpdated) AS LastUpdatedAt FROM Faults f WHERE f.UserID = ? ORDER BY f.DateLogged DESC");
		$stmt->execute([(int)$user['UserID']]);
		$rows = array_map(static function (array $r): array {
			return [
				'ticketReference' => $r['TicketReference'],
				'dateLogged' => $r['DateLogged'],
				'status' => $r['Status'],
				'latestUpdate' => $r['LatestUpdate'],
				'lastUpdatedAt' => $r['LastUpdatedAt'],
			];
		}, $stmt->fetchAll());

		json_response($rows);
	}

	if ($path === '/api/oversight/complaints' && $method === 'GET') {
		require_auth('Server Admin', 'Admin', 'PA Member');
		$rows = $pdo->query('SELECT f.FaultID, f.TicketReference, f.DateLogged, c.CategoryName AS Category, f.Description, f.PhysicalAddress, f.Latitude, f.Longitude, f.Status, f.TeamDispatched, f.InspectionFindings, f.IsResolved, f.ResolvedAt, CONCAT(u.FirstName, " ", u.LastName) AS Resident, f.UserID FROM Faults f INNER JOIN Users u ON u.UserID = f.UserID INNER JOIN Categories c ON c.CategoryID = f.CategoryID ORDER BY f.DateLogged DESC')->fetchAll();
		$mapped = array_map(static function (array $r): array {
			return [
				'faultID' => (int)$r['FaultID'],
				'ticketReference' => $r['TicketReference'],
				'dateLogged' => $r['DateLogged'],
				'category' => $r['Category'],
				'description' => $r['Description'],
				'physicalAddress' => $r['PhysicalAddress'],
				'latitude' => (float)$r['Latitude'],
				'longitude' => (float)$r['Longitude'],
				'status' => $r['Status'],
				'teamDispatched' => (bool)$r['TeamDispatched'],
				'inspectionFindings' => $r['InspectionFindings'],
				'isResolved' => (bool)$r['IsResolved'],
				'resolvedAt' => $r['ResolvedAt'],
				'resident' => trim($r['Resident']),
				'userID' => (int)$r['UserID'],
			];
		}, $rows);
		json_response($mapped);
	}

	if (preg_match('#^/api/oversight/complaints/(\d+)/workflow$#', $path, $m) === 1 && in_array($method, ['PUT', 'POST'], true)) {
		require_auth('Server Admin', 'Admin', 'PA Member');
		$faultId = (int)$m[1];
		$payload = request_json();

		$fault = db_one($pdo, 'SELECT * FROM Faults WHERE FaultID = ?', [$faultId]);
		if (!$fault) {
			json_response(['message' => 'Complaint not found.'], 404);
		}

		if ((bool)$fault['IsResolved']) {
			json_response(['message' => 'Complaint is already resolved and locked.'], 400);
		}

		$teamDispatched = array_key_exists('teamDispatched', $payload) ? (int)((bool)$payload['teamDispatched']) : (int)$fault['TeamDispatched'];
		$inspectionFindings = trim((string)($payload['inspectionFindings'] ?? ''));
		$markResolved = (bool)($payload['markResolved'] ?? false);

		$status = (string)$fault['Status'];
		$isResolved = (int)$fault['IsResolved'];
		$resolvedAt = $fault['ResolvedAt'];

		if ($teamDispatched) {
			$status = 'Team Dispatched';
		}

		if ($inspectionFindings !== '') {
			$status = 'Inspection Updated';
		}

		if ($markResolved) {
			$isResolved = 1;
			$resolvedAt = now_utc();
			$status = 'Resolved';

			$stmtN = $pdo->prepare('INSERT INTO Notifications (UserID, TargetRole, Message, RelatedTicketReference, IsRead, CreatedAt) VALUES (?, ?, ?, ?, 0, ?)');
			$stmtN->execute([(int)$fault['UserID'], 'Resident', 'Your complaint ' . $fault['TicketReference'] . ' has been resolved.', $fault['TicketReference'], now_utc()]);
		}

		$stmt = $pdo->prepare('UPDATE Faults SET TeamDispatched = ?, InspectionFindings = ?, IsResolved = ?, ResolvedAt = ?, Status = ?, LastUpdated = ? WHERE FaultID = ?');
		$stmt->execute([$teamDispatched, $inspectionFindings, $isResolved, $resolvedAt, $status, now_utc(), $faultId]);

		$actorId = (int)(app_user()['UserID'] ?? 0);
		$historyNote = $markResolved ? 'Complaint marked as resolved.' : ($inspectionFindings !== '' ? ('Inspection findings updated: ' . $inspectionFindings) : ('Team dispatched set to ' . ($teamDispatched ? 'True' : 'False') . '.'));
		$stmtH = $pdo->prepare('INSERT INTO EscalationHistories (FaultID, ActionTakenBy, Notes, DateActioned) VALUES (?, ?, ?, ?)');
		$stmtH->execute([$faultId, $actorId, $historyNote, now_utc()]);

		$updated = db_one($pdo, 'SELECT * FROM Faults WHERE FaultID = ?', [$faultId]);
		json_response([
			'faultID' => (int)$updated['FaultID'],
			'ticketReference' => $updated['TicketReference'],
			'status' => $updated['Status'],
			'teamDispatched' => (bool)$updated['TeamDispatched'],
			'inspectionFindings' => $updated['InspectionFindings'],
			'isResolved' => (bool)$updated['IsResolved'],
			'resolvedAt' => $updated['ResolvedAt'],
			'lastUpdated' => $updated['LastUpdated'],
		]);
	}

	if ($path === '/api/residents' && $method === 'GET') {
		require_auth('Server Admin', 'Admin', 'PA Member');
		$rows = $pdo->query("SELECT UserID, Username, FirstName, LastName, PhysicalAddress, EmailAddress, CellNumber, CreatedAt FROM Users WHERE UserRole = 'Resident' ORDER BY CreatedAt ASC")->fetchAll();
		$mapped = array_map(static function (array $r): array {
			return [
				'userID' => (int)$r['UserID'],
				'username' => $r['Username'],
				'firstName' => $r['FirstName'],
				'lastName' => $r['LastName'],
				'physicalAddress' => $r['PhysicalAddress'],
				'emailAddress' => $r['EmailAddress'],
				'cellNumber' => $r['CellNumber'],
				'createdAt' => $r['CreatedAt'],
			];
		}, $rows);
		json_response($mapped);
	}

	if ($path === '/api/residents/export' && $method === 'GET') {
		require_auth('Server Admin', 'Admin', 'PA Member');
		$rows = $pdo->query("SELECT UserID, Username, FirstName, LastName, PhysicalAddress, EmailAddress, CellNumber, CreatedAt FROM Users WHERE UserRole = 'Resident' ORDER BY CreatedAt ASC")->fetchAll();

		header('Content-Type: text/csv; charset=UTF-8');
		header('Content-Disposition: attachment; filename="residents_' . gmdate('YmdHis') . '.csv"');

		$out = fopen('php://output', 'wb');
		fputcsv($out, ['UserID', 'Username', 'FirstName', 'LastName', 'PhysicalAddress', 'EmailAddress', 'CellNumber', 'CreatedAt']);
		foreach ($rows as $row) {
			fputcsv($out, [$row['UserID'], $row['Username'], $row['FirstName'], $row['LastName'], $row['PhysicalAddress'], $row['EmailAddress'], $row['CellNumber'], $row['CreatedAt']]);
		}
		fclose($out);
		exit;
	}

	if ($path === '/api/system-configuration' && $method === 'GET') {
		require_auth('Server Admin');
		$config = db_one($pdo, 'SELECT * FROM SystemConfigurations ORDER BY UpdatedAt DESC LIMIT 1');
		if (!$config) {
			json_response(['message' => 'Configuration record not found.'], 404);
		}

		json_response($config);
	}

	if ($path === '/api/system-configuration' && in_array($method, ['PUT', 'POST'], true)) {
		require_auth('Server Admin');
		$payload = request_json();
		$actorId = (int)(app_user()['UserID'] ?? 0);
		$existing = db_one($pdo, 'SELECT * FROM SystemConfigurations ORDER BY UpdatedAt DESC LIMIT 1');
		if ($existing) {
			$stmt = $pdo->prepare('UPDATE SystemConfigurations SET WebsiteName = ?, DomainName = ?, StorageRootPath = ?, LocalDirectoryStructure = ?, DatabaseConnectionString = ?, BackupDriveLocation = ?, WhatsAppChatLink = ?, UpdatedAt = ?, UpdatedByUserID = ? WHERE SystemConfigurationID = ?');
			$stmt->execute([
				trim((string)($payload['websiteName'] ?? '')),
				trim((string)($payload['domainName'] ?? '')),
				trim((string)($payload['storageRootPath'] ?? '')),
				trim((string)($payload['localDirectoryStructure'] ?? '')),
				trim((string)($payload['databaseConnectionString'] ?? '')),
				trim((string)($payload['backupDriveLocation'] ?? '')),
				trim((string)($payload['whatsAppChatLink'] ?? '')),
				now_utc(),
				$actorId,
				(int)$existing['SystemConfigurationID'],
			]);
		} else {
			$stmt = $pdo->prepare('INSERT INTO SystemConfigurations (WebsiteName, DomainName, StorageRootPath, LocalDirectoryStructure, DatabaseConnectionString, BackupDriveLocation, WhatsAppChatLink, UpdatedAt, UpdatedByUserID) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
			$stmt->execute([
				trim((string)($payload['websiteName'] ?? '')),
				trim((string)($payload['domainName'] ?? '')),
				trim((string)($payload['storageRootPath'] ?? '')),
				trim((string)($payload['localDirectoryStructure'] ?? '')),
				trim((string)($payload['databaseConnectionString'] ?? '')),
				trim((string)($payload['backupDriveLocation'] ?? '')),
				trim((string)($payload['whatsAppChatLink'] ?? '')),
				now_utc(),
				$actorId,
			]);
		}

		$config = db_one($pdo, 'SELECT * FROM SystemConfigurations ORDER BY UpdatedAt DESC LIMIT 1');
		json_response($config ?? []);
	}

	if ($path === '/api/ai-analytics/analyze-whatsapp-dump' && $method === 'POST') {
		$apiKey = trim((string)app_config()['openai']['api_key']);
		if ($apiKey === '') {
			json_response(['message' => 'OPENAI_API_KEY is not configured.'], 500);
		}

		$raw = file_get_contents('php://input') ?: '';
		if (trim($raw) === '') {
			json_response(['message' => 'The chat payload cannot be empty.'], 400);
		}

		$model = (string)app_config()['openai']['model'];
		$payload = [
			'model' => $model,
			'messages' => [
				[
					'role' => 'system',
					'content' => 'You are a municipal infrastructure analytics engine. Analyze only the provided WhatsApp group chat dump text. Count distinct community infrastructure complaints that occurred over the weekend only. Classify complaints into these categories only: Electrical, Roads, Water, Environmental. For privacy and POPIA compliance, remove and ignore all personal names, phone numbers, and exact ERF numbers. Return output as valid raw JSON only with exactly these keys: TotalComplaints, ElectricalCount, RoadsCount, WaterCount, LandfillCount, SummaryNote. LandfillCount must represent Environmental complaints. Do not include markdown, code fences, additional text, or extra properties.'
				],
				[
					'role' => 'user',
					'content' => $raw,
				],
			],
			'temperature' => 0.2,
		];

		$ch = curl_init('https://api.openai.com/v1/chat/completions');
		curl_setopt_array($ch, [
			CURLOPT_POST => true,
			CURLOPT_RETURNTRANSFER => true,
			CURLOPT_HTTPHEADER => [
				'Content-Type: application/json',
				'Authorization: Bearer ' . $apiKey,
			],
			CURLOPT_POSTFIELDS => json_encode($payload),
			CURLOPT_TIMEOUT => 60,
		]);

		$response = curl_exec($ch);
		$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
		curl_close($ch);

		if ($response === false || $status >= 400) {
			json_response(['message' => 'AI service request failed.'], 502);
		}

		$decoded = json_decode($response, true);
		$text = $decoded['choices'][0]['message']['content'] ?? '';
		$start = strpos($text, '{');
		$end = strrpos($text, '}');
		if ($start === false || $end === false || $end < $start) {
			json_response(['message' => 'AI service returned invalid JSON.'], 502);
		}

		$jsonString = substr($text, $start, $end - $start + 1);
		$json = json_decode($jsonString, true);
		if (!is_array($json)) {
			json_response(['message' => 'AI service returned unreadable JSON.'], 502);
		}

		json_response($json);
	}

	json_response(['message' => 'Not found.'], 404);
}

http_response_code(404);
echo 'Page not found.';
