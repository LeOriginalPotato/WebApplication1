const bcrypt = require('bcryptjs');

const COST = 12;
let dummyHashPromise;

function dummyHash() {
  if (!dummyHashPromise) dummyHashPromise = bcrypt.hash('invalid-login-placeholder', COST);
  return dummyHashPromise;
}

function hashSecret(value) {
  return bcrypt.hash(value, COST);
}

async function matches(value, hash) {
  const stored = hash || await dummyHash();
  const ok = await bcrypt.compare(value, stored);
  return Boolean(hash) && ok;
}

module.exports = { hashSecret, matches, dummyHash };
