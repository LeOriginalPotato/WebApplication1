const path = require('path');

function required(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing required environment variable ${name}.`);
  }
  return String(value).trim();
}

function loadDatabaseConfig() {
  const databaseUrl = required('DATABASE_URL');
  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL must be a URL such as mysql://USER:PASSWORD@HOST:3306/DATABASE.');
  }
  if (parsed.protocol !== 'mysql:' && parsed.protocol !== 'mariadb:') {
    throw new Error('DATABASE_URL must start with mysql:// or mariadb://.');
  }
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (!database) {
    throw new Error('DATABASE_URL is missing a database name.');
  }
  return {
    databaseUrl,
    databaseSocket: process.env.DATABASE_SOCKET ? String(process.env.DATABASE_SOCKET).trim() : '',
    uploadDir: path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', 'storage', 'photos')),
    mysql: {
      host: parsed.hostname || '127.0.0.1',
      port: parsed.port ? Number(parsed.port) : 3306,
      user: decodeURIComponent(parsed.username || ''),
      password: decodeURIComponent(parsed.password || ''),
      database,
    },
  };
}

function loadConfig() {
  const database = loadDatabaseConfig();
  const sessionSecret = required('SESSION_SECRET');
  if (sessionSecret.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters.');
  }
  return {
    ...database,
    port: Number(process.env.PORT || 3000),
    sessionSecret,
    cookieSecure: process.env.COOKIE_SECURE === 'true',
    trustProxy: process.env.TRUST_PROXY === 'true',
    // Apache on this host proxies over HTTP and omits X-Forwarded-Proto.
    // Only an explicit true opts in; anything else leaves protocol detection alone.
    forceHttps: process.env.FORCE_HTTPS === 'true',
  };
}

module.exports = { loadConfig, loadDatabaseConfig };
