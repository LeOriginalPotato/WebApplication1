const mysql = require('mysql2/promise');

function poolOptions(config, extra = {}) {
  const options = {
    user: config.mysql.user,
    password: config.mysql.password,
    database: config.mysql.database,
    waitForConnections: true,
    connectionLimit: 10,
    charset: 'utf8mb4',
    timezone: 'Z',
    dateStrings: true,
    ...extra,
  };
  if (config.databaseSocket) {
    options.socketPath = config.databaseSocket;
  } else {
    options.host = config.mysql.host;
    options.port = config.mysql.port;
  }
  return options;
}

function createPool(config) {
  return mysql.createPool(poolOptions(config));
}

function createMigrationConnection(config) {
  const options = poolOptions(config, { multipleStatements: true });
  delete options.connectionLimit;
  delete options.waitForConnections;
  return mysql.createConnection(options);
}

module.exports = { createPool, createMigrationConnection };
