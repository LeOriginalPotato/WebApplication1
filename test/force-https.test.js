const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createApp } = require('../src/app');
const { loadConfig } = require('../src/config');

const SESSION_SECRET = 'force-https-test-secret-0123456789abcd';

function createServer(config) {
  const app = createApp({
    config: {
      sessionSecret: SESSION_SECRET,
      cookieSecure: false,
      trustProxy: false,
      forceHttps: false,
      uploadDir: '/tmp/pa-at-work-force-https-test',
      ...config,
    },
    pool: {
      query() {
        return Promise.resolve([[]]);
      },
    },
    data: {
      async getSettings() {
        return { site_name: 'PA At Work' };
      },
    },
  });
  const server = http.createServer(app);
  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
    server.on('error', reject);
  });
}

async function getLogin(server, headers = {}) {
  const { port } = server.address();
  const res = await fetch(`http://127.0.0.1:${port}/login`, { headers, redirect: 'manual' });
  await res.text();
  const cookies = typeof res.headers.getSetCookie === 'function'
    ? res.headers.getSetCookie()
    : [res.headers.get('set-cookie')].filter(Boolean);
  return { res, cookies };
}

function sessionCookie(cookies) {
  return cookies.find((cookie) => cookie.startsWith('paatwork.sid='));
}

test('COOKIE_SECURE and FORCE_HTTPS set a Secure session cookie without X-Forwarded-Proto', async () => {
  const server = await createServer({
    cookieSecure: true,
    trustProxy: true,
    forceHttps: true,
  });
  try {
    const { res, cookies } = await getLogin(server);
    const cookie = sessionCookie(cookies);
    assert.equal(res.status, 200);
    assert.ok(cookie, 'expected paatwork.sid');
    assert.match(cookie, /;\s*Secure(?:;|$)/i);
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);
  } finally {
    server.close();
  }
});

test('FORCE_HTTPS off does not issue a Secure cookie when X-Forwarded-Proto is missing', async () => {
  const server = await createServer({
    cookieSecure: true,
    trustProxy: true,
    forceHttps: false,
  });
  try {
    const { res, cookies } = await getLogin(server);
    assert.equal(res.status, 200);
    assert.equal(sessionCookie(cookies), undefined);
  } finally {
    server.close();
  }
});

test('an existing X-Forwarded-Proto is not replaced when FORCE_HTTPS is on', async () => {
  const server = await createServer({
    cookieSecure: true,
    trustProxy: true,
    forceHttps: true,
  });
  try {
    const plain = await getLogin(server, { 'x-forwarded-proto': 'http' });
    assert.equal(sessionCookie(plain.cookies), undefined);
    const secure = await getLogin(server, { 'x-forwarded-proto': 'https' });
    assert.match(sessionCookie(secure.cookies), /;\s*Secure(?:;|$)/i);
  } finally {
    server.close();
  }
});

test('a real X-Forwarded-Proto https still sets a Secure cookie when FORCE_HTTPS is off', async () => {
  const server = await createServer({
    cookieSecure: true,
    trustProxy: true,
    forceHttps: false,
  });
  try {
    const { cookies } = await getLogin(server, { 'x-forwarded-proto': 'https' });
    assert.match(sessionCookie(cookies), /;\s*Secure(?:;|$)/i);
  } finally {
    server.close();
  }
});

test('loadConfig enables forceHttps only when FORCE_HTTPS is exactly true', () => {
  const keys = ['DATABASE_URL', 'SESSION_SECRET', 'COOKIE_SECURE', 'TRUST_PROXY', 'FORCE_HTTPS'];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    process.env.DATABASE_URL = 'mysql://user:pass@127.0.0.1:3306/pa_at_work';
    process.env.SESSION_SECRET = 'x'.repeat(32);
    process.env.COOKIE_SECURE = 'true';
    process.env.TRUST_PROXY = 'true';
    delete process.env.FORCE_HTTPS;
    assert.equal(loadConfig().forceHttps, false);
    assert.equal(loadConfig().cookieSecure, true);
    assert.equal(loadConfig().trustProxy, true);
    process.env.FORCE_HTTPS = 'false';
    assert.equal(loadConfig().forceHttps, false);
    process.env.FORCE_HTTPS = '1';
    assert.equal(loadConfig().forceHttps, false);
    process.env.FORCE_HTTPS = 'true';
    assert.equal(loadConfig().forceHttps, true);
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
