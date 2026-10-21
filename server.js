const fs = require('fs');
const { loadConfig } = require('./src/config');
const { createPool } = require('./src/db');
const { migrate } = require('./src/migrate');
const { createData } = require('./src/data');
const { createApp } = require('./src/app');

async function main() {
  const config = loadConfig();
  fs.mkdirSync(config.uploadDir, { recursive: true });
  const pool = createPool(config);
  await migrate(config);
  const app = createApp({ config, pool, data: createData(pool) });
  app.listen(config.port, () => {
    console.log(`PA At Work listening on port ${config.port}`);
  });
}

main().catch((error) => {
  console.error(error && error.message ? error.message : 'PA At Work failed to start.');
  process.exit(1);
});
