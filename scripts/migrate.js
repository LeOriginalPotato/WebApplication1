const { loadDatabaseConfig } = require('../src/config');
const { migrate } = require('../src/migrate');

migrate(loadDatabaseConfig())
  .then(() => {
    console.log('Database schema is up to date.');
  })
  .catch((error) => {
    console.error(error && error.message ? error.message : 'Migration failed.');
    process.exit(1);
  });
