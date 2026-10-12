<?php

declare(strict_types=1);

$config = [
	'app' => [
		'name' => 'PA Infrastructure Portal',
		'base_url' => getenv('APP_BASE_URL') ?: '',
	],
	'db' => [
		'host' => getenv('DB_HOST') ?: '127.0.0.1',
		'port' => (int) (getenv('DB_PORT') ?: '3306'),
		'database' => getenv('DB_NAME') ?: 'pa_portal',
		'username' => getenv('DB_USER') ?: 'root',
		'password' => getenv('DB_PASSWORD') ?: '',
	],
	'openai' => [
		'api_key' => getenv('OPENAI_API_KEY') ?: '',
		'model' => getenv('OPENAI_MODEL') ?: 'gpt-4o-mini',
	],
];

$localConfigFile = __DIR__ . '/config.local.json';
if (is_file($localConfigFile)) {
	$localJson = file_get_contents($localConfigFile);
	if ($localJson !== false) {
		$local = json_decode($localJson, true);
		if (is_array($local)) {
			$config = array_replace_recursive($config, $local);
		}
	}
}

return $config;
