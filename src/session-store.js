const session = require('express-session');

class MariaSessionStore extends session.Store {
  constructor(pool) {
    super();
    this.pool = pool;
  }

  get(sid, callback) {
    this.pool.query('SELECT data, expires_ms FROM sessions WHERE sid = ?', [sid])
      .then(([rows]) => {
        if (!rows.length || Number(rows[0].expires_ms) < Date.now()) {
          if (rows.length) this.destroy(sid, () => callback(null, null));
          else callback(null, null);
          return;
        }
        try {
          callback(null, JSON.parse(rows[0].data));
        } catch (error) {
          callback(error);
        }
      })
      .catch(callback);
  }

  set(sid, sess, callback) {
    const maxAge = sess.cookie && sess.cookie.maxAge ? sess.cookie.maxAge : 8 * 60 * 60 * 1000;
    const expires = Date.now() + maxAge;
    const data = JSON.stringify(sess);
    this.pool.query(
      `INSERT INTO sessions (sid, data, expires_ms) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE data = VALUES(data), expires_ms = VALUES(expires_ms)`,
      [sid, data, expires]
    ).then(() => callback(null)).catch(callback);
  }

  destroy(sid, callback) {
    this.pool.query('DELETE FROM sessions WHERE sid = ?', [sid])
      .then(() => callback(null))
      .catch(callback);
  }

  touch(sid, sess, callback) {
    this.set(sid, sess, callback);
  }
}

module.exports = { MariaSessionStore };
