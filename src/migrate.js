const fs = require('fs');
const path = require('path');
const { createMigrationConnection } = require('./db');

async function migrate(config) {
  const connection = await createMigrationConnection(config);
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id VARCHAR(64) PRIMARY KEY,
        applied_at DATETIME NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    const dir = path.join(__dirname, '..', 'migrations');
    const files = fs.readdirSync(dir).filter((name) => name.endsWith('.sql')).sort();
    for (const file of files) {
      const [existing] = await connection.query('SELECT id FROM schema_migrations WHERE id = ?', [file]);
      if (existing.length) continue;
      const sql = fs.readFileSync(path.join(dir, file), 'utf8');
      await connection.query(sql);
      await connection.query('INSERT INTO schema_migrations (id, applied_at) VALUES (?, UTC_TIMESTAMP())', [file]);
    }
  } finally {
    await connection.end();
  }
}

module.exports = { migrate };
