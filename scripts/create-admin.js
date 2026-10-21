const { loadDatabaseConfig } = require('../src/config');
const { createPool } = require('../src/db');
const { migrate } = require('../src/migrate');
const { createData } = require('../src/data');
const { hashSecret } = require('../src/passwords');
const { isEmail, cleanText } = require('../src/security');

async function main() {
  const email = cleanText(process.env.ADMIN_EMAIL, 255).toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || '');
  const name = cleanText(process.env.ADMIN_NAME || 'Server Admin', 120);
  const reset = process.argv.includes('--reset');
  if (!isEmail(email) || password.length < 10 || !name) {
    console.error('Set ADMIN_EMAIL, ADMIN_NAME, and ADMIN_PASSWORD (at least 10 characters), then run npm run create-admin.');
    process.exit(1);
  }
  const config = loadDatabaseConfig();
  await migrate(config);
  const pool = createPool(config);
  const data = createData(pool);
  try {
    const existing = await data.findUserByEmail(email);
    const passwordHash = await hashSecret(password);
    if (existing && existing.role === 'Server Admin' && reset) {
      await data.updateUser(existing.id, { passwordHash, displayName: name });
      console.log('Server admin password updated. Remove ADMIN_PASSWORD from the environment.');
      return;
    }
    if (existing) {
      console.error('An account with that email already exists. The password was not changed. Pass --reset only to replace the password of an existing server admin.');
      process.exitCode = 1;
      return;
    }
    await data.createUser({
      email,
      passwordHash,
      displayName: name,
      fullName: name,
      surname: 'Admin',
      role: 'Server Admin',
      consentGiven: false,
    });
    console.log('Server admin created. Remove ADMIN_PASSWORD from the environment and store it in a password manager.');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error && error.message ? error.message : 'Could not create the server admin.');
  process.exit(1);
});
