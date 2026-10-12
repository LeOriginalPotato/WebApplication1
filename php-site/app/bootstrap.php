<?php

declare(strict_types=1);

if (session_status() !== PHP_SESSION_ACTIVE) {
	session_start();
}

$config = require __DIR__ . '/config.php';

function app_config(): array
{
	global $config;
	return $config;
}

function db(): PDO
{
	static $pdo = null;

	if ($pdo instanceof PDO) {
		return $pdo;
	}

	$cfg = app_config()['db'];
	$dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $cfg['host'], $cfg['port'], $cfg['database']);

	$pdo = new PDO($dsn, $cfg['username'], $cfg['password'], [
		PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
		PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
		PDO::ATTR_EMULATE_PREPARES => false,
	]);

	return $pdo;
}

function now_utc(): string
{
	return (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d H:i:s');
}

function app_user(): ?array
{
	return $_SESSION['user'] ?? null;
}

function is_authenticated(): bool
{
	return app_user() !== null;
}

function has_role(string ...$roles): bool
{
	$user = app_user();
	if ($user === null) {
		return false;
	}

	return in_array($user['UserRole'], $roles, true);
}

function require_auth(string ...$roles): void
{
	if (!is_authenticated()) {
		redirect('/login');
	}

	if ($roles && !has_role(...$roles)) {
		http_response_code(403);
		echo 'Access denied.';
		exit;
	}
}

function redirect(string $path): void
{
	header('Location: ' . $path);
	exit;
}

function csrf_token(): string
{
	if (empty($_SESSION['csrf_token'])) {
		$_SESSION['csrf_token'] = bin2hex(random_bytes(32));
	}

	return $_SESSION['csrf_token'];
}

function verify_csrf(): void
{
	$token = $_POST['_csrf'] ?? '';
	if (!hash_equals($_SESSION['csrf_token'] ?? '', $token)) {
		http_response_code(400);
		echo 'Invalid CSRF token.';
		exit;
	}
}

function flash(string $key, ?string $message = null): ?string
{
	if ($message !== null) {
		$_SESSION['flash'][$key] = $message;
		return null;
	}

	$value = $_SESSION['flash'][$key] ?? null;
	unset($_SESSION['flash'][$key]);
	return $value;
}

function deterministic_salt(string $seed): string
{
	return substr(hash('sha256', $seed, true), 0, 16);
}

function create_password_hash(string $password, string $email): string
{
	$iterations = 100000;
	$salt = deterministic_salt($email);
	$hash = hash_pbkdf2('sha256', $password, $salt, $iterations, 32, true);
	return 'PBKDF2$' . $iterations . '$' . base64_encode($salt) . '$' . base64_encode($hash);
}

function starts_with(string $haystack, string $needle): bool
{
	if ($needle === '') {
		return true;
	}

	return substr($haystack, 0, strlen($needle)) === $needle;
}

function verify_password(string $password, string $email, string $storedHash): bool
{
	if (starts_with($storedHash, 'PBKDF2$')) {
		$parts = explode('$', $storedHash);
		if (count($parts) !== 4) {
			return false;
		}

		$iterations = (int) $parts[1];
		$salt = base64_decode($parts[2], true);
		$expected = base64_decode($parts[3], true);

		if ($salt === false || $expected === false) {
			return false;
		}

		$detSalt = deterministic_salt($email);
		if (!hash_equals($salt, $detSalt)) {
			return false;
		}

		$actual = hash_pbkdf2('sha256', $password, $salt, $iterations, strlen($expected), true);
		return hash_equals($expected, $actual);
	}

	if (password_verify($password, $storedHash)) {
		return true;
	}

	// Transitional fallback for seed rows using clear text passwords.
	return hash_equals($storedHash, $password);
}

function login_user(array $dbUser): void
{
	$_SESSION['user'] = [
		'UserID' => (int) $dbUser['UserID'],
		'Name' => trim(($dbUser['FirstName'] ?? '') . ' ' . ($dbUser['LastName'] ?? '')),
		'UserRole' => $dbUser['UserRole'],
		'IsProfileComplete' => (bool) $dbUser['IsProfileComplete'],
		'EmailAddress' => $dbUser['EmailAddress'],
	];
}

function logout_user(): void
{
	unset($_SESSION['user']);
}

function json_response(array $payload, int $status = 200): void
{
	http_response_code($status);
	header('Content-Type: application/json');
	echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
	exit;
}

function request_json(): array
{
	$raw = file_get_contents('php://input');
	if ($raw === false || $raw === '') {
		return [];
	}

	$decoded = json_decode($raw, true);
	return is_array($decoded) ? $decoded : [];
}

function next_ticket_reference(PDO $pdo): string
{
	for ($i = 0; $i < 20; $i++) {
		$candidate = sprintf('PA-RF-%s-%05d', gmdate('Y'), random_int(10000, 99999));
		$stmt = $pdo->prepare('SELECT COUNT(*) FROM Faults WHERE TicketReference = ?');
		$stmt->execute([$candidate]);
		if ((int) $stmt->fetchColumn() === 0) {
			return $candidate;
		}
	}

	throw new RuntimeException('Failed to generate ticket reference.');
}

function db_one(PDO $pdo, string $sql, array $params = []): ?array
{
	$stmt = $pdo->prepare($sql);
	$stmt->execute($params);
	$row = $stmt->fetch();
	return $row === false ? null : $row;
}

function render_page(string $view, array $data = []): void
{
	extract($data, EXTR_SKIP);
	$viewFile = __DIR__ . '/../views/pages/' . $view . '.php';
	if (!file_exists($viewFile)) {
		http_response_code(500);
		echo 'View not found.';
		exit;
	}

	require __DIR__ . '/../views/layout.php';
}
