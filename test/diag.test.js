const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createApp } = require('../src/app');

const SESSION_SECRET = 'diag-test-secret-must-not-leak-0123456789';
const DATABASE_URL = 'mysql://diag-user:diag-password@127.0.0.1:3306/diag_db';

function createDiagApp(overrides = {}) {
  return createApp({
    config: {
      sessionSecret: SESSION_SECRET,
      cookieSecure: false,
      trustProxy: true,
      uploadDir: '/tmp/pa-at-work-diag-test',
      databaseUrl: DATABASE_URL,
      ...overrides,
    },
    pool: {
      query() {
        return Promise.resolve([[]]);
      },
    },
    data: {},
  });
}

function listen(app) {
  const server = http.createServer(app);
  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
    server.on('error', reject);
  });
}

async function get(server, path, headers = {}) {
  const { port } = server.address();
  const res = await fetch(`http://127.0.0.1:${port}${path}`, { headers, redirect: 'manual' });
  const text = await res.text();
  return { res, text, body: JSON.parse(text) };
}

function setCookies(res) {
  return typeof res.headers.getSetCookie === 'function'
    ? res.headers.getSetCookie()
    : [res.headers.get('set-cookie')].filter(Boolean);
}

test('GET /api/diag sets a non-secure probe cookie and no session cookie', async () => {
  const server = await listen(createDiagApp());
  try {
    const { res, text, body } = await get(server, '/api/diag', {
      'x-forwarded-proto': 'https',
      'x-forwarded-host': 'pa-atwork.org',
      'x-forwarded-for': '203.0.113.5',
    });
    const cookies = setCookies(res);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.equal(cookies.some((cookie) => cookie.startsWith('probe=1')), true);
    assert.equal(cookies.some((cookie) => /secure/i.test(cookie)), false);
    assert.equal(cookies.some((cookie) => cookie.startsWith('paatwork.sid=')), false);
    assert.equal(body.cookieSecure, false);
    assert.equal(body.trustProxy, true);
    assert.equal(body.trustProxySetting, 1);
    assert.equal(body.secure, true);
    assert.equal(body.protocol, 'https');
    assert.equal(body.hostname, 'pa-atwork.org');
    assert.equal(body.xForwardedProto, 'https');
    assert.equal(body.hasXForwardedFor, true);
    assert.equal(Object.hasOwn(body, 'nodeEnv'), true);
    assert.equal(text.includes(SESSION_SECRET), false);
    assert.equal(text.includes(DATABASE_URL), false);
    assert.equal(text.includes('203.0.113.5'), false);
    assert.equal(text.includes('x-forwarded-for'), false);
  } finally {
    server.close();
  }
});

test('GET /api/diag-session lets express-session set its cookie when the request is secure', async () => {
  const server = await listen(createDiagApp({ cookieSecure: true }));
  try {
    const { res, text, body } = await get(server, '/api/diag-session', {
      'x-forwarded-proto': 'https',
      host: 'pa-atwork.org',
    });
    const cookies = setCookies(res);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.equal(cookies.some((cookie) => cookie.startsWith('paatwork.sid=')), true);
    assert.equal(cookies.some((cookie) => /;\s*Secure/i.test(cookie)), true);
    assert.equal(body.cookieSecure, true);
    assert.equal(body.secure, true);
    assert.equal(text.includes(SESSION_SECRET), false);
  } finally {
    server.close();
  }
});

test('GET /api/diag-session omits the session cookie when cookieSecure is on and the request is not https', async () => {
  const server = await listen(createDiagApp({ cookieSecure: true, trustProxy: false }));
  try {
    const { res, body } = await get(server, '/api/diag-session');
    const cookies = setCookies(res);
    const probe = await get(server, '/api/diag');
    const probeCookies = setCookies(probe.res);
    assert.equal(cookies.some((cookie) => cookie.startsWith('paatwork.sid=')), false);
    assert.equal(probeCookies.some((cookie) => cookie.startsWith('probe=1')), true);
    assert.equal(body.cookieSecure, true);
    assert.equal(body.secure, false);
    assert.equal(body.trustProxy, false);
    assert.equal(body.trustProxySetting, false);
    assert.equal(body.protocol, 'http');
  } finally {
    server.close();
  }
});
