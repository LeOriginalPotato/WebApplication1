const crypto = require('crypto');
const { idList } = require('./security');

function createData(pool) {
  async function query(sql, params = []) {
    const [rows] = await pool.query(sql, params);
    return rows;
  }

  async function withTx(fn) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const result = await fn(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  function mapUser(row) {
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      pinHash: row.pin_hash,
      displayName: row.display_name,
      fullName: row.full_name,
      surname: row.surname,
      idNumber: row.id_number || '',
      phone: row.phone || '',
      address: row.address || '',
      role: row.role,
      homeAreaId: row.home_area_id,
      consentGiven: Boolean(row.consent_given),
      createdAt: row.created_at,
    };
  }

  function mapComplaint(row) {
    if (!row) return null;
    return {
      id: row.id,
      ticketReference: row.ticket_reference,
      reporterId: row.reporter_id,
      category: row.category,
      description: row.description,
      address: row.address,
      municipalityId: row.municipality_id,
      wardId: row.ward_id,
      municipalityName: row.municipality_name || '',
      wardName: row.ward_name || '',
      latitude: row.latitude === null || row.latitude === undefined ? null : Number(row.latitude),
      longitude: row.longitude === null || row.longitude === undefined ? null : Number(row.longitude),
      photoStoredName: row.photo_stored_name,
      photoMime: row.photo_mime,
      status: row.status,
      escalationLevel: row.escalation_level || '',
      assigneeLabel: row.assignee_label || '',
      dispatchedAt: row.dispatched_at,
      dispatchedBy: row.dispatched_by,
      completedAt: row.completed_at,
      completedBy: row.completed_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  const complaintSelect = `
    SELECT c.*, m.name AS municipality_name, w.name AS ward_name
    FROM complaints c
    JOIN areas m ON m.id = c.municipality_id
    LEFT JOIN areas w ON w.id = c.ward_id
  `;

  async function getSettings() {
    const rows = await query('SELECT site_name, whatsapp_link, google_maps_api_key FROM settings WHERE id = 1');
    return rows[0] || { site_name: 'PA At Work', whatsapp_link: '', google_maps_api_key: '' };
  }

  async function updateSettings({ siteName, whatsappLink, mapsKey }) {
    await query(
      `UPDATE settings SET site_name = ?, whatsapp_link = ?, google_maps_api_key = ?, updated_at = UTC_TIMESTAMP() WHERE id = 1`,
      [siteName, whatsappLink, mapsKey]
    );
  }

  async function listAreas() {
    return query(`
      SELECT a.id, a.parent_id, a.name, a.kind, p.name AS parent_name
      FROM areas a
      LEFT JOIN areas p ON p.id = a.parent_id
      ORDER BY COALESCE(p.name, a.name), a.kind, a.name
    `);
  }

  async function findArea(id) {
    const rows = await query('SELECT id, parent_id, name, kind FROM areas WHERE id = ?', [id]);
    return rows[0] || null;
  }

  async function createArea({ name, kind, parentId }) {
    const result = await query(
      'INSERT INTO areas (parent_id, name, kind) VALUES (?, ?, ?)',
      [parentId, name, kind]
    );
    return result.insertId;
  }

  async function findUserById(id) {
    const rows = await query('SELECT * FROM users WHERE id = ?', [id]);
    return mapUser(rows[0]);
  }

  async function findUserByEmail(email) {
    const rows = await query('SELECT * FROM users WHERE email = ?', [email]);
    return mapUser(rows[0]);
  }

  async function createUser(user, areaIds = []) {
    return withTx(async (connection) => {
      const [result] = await connection.query(
        `INSERT INTO users
          (email, password_hash, pin_hash, display_name, full_name, surname, id_number, phone, address, role, home_area_id, consent_given)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          user.email,
          user.passwordHash,
          user.pinHash || null,
          user.displayName,
          user.fullName,
          user.surname,
          user.idNumber || null,
          user.phone || null,
          user.address || null,
          user.role,
          user.homeAreaId || null,
          user.consentGiven ? 1 : 0,
        ]
      );
      const userId = result.insertId;
      for (const areaId of idList(areaIds)) {
        await connection.query('INSERT INTO user_areas (user_id, area_id) VALUES (?, ?)', [userId, areaId]);
      }
      return userId;
    });
  }

  async function updateUser(id, fields) {
    const sets = [];
    const params = [];
    const mapping = {
      displayName: 'display_name',
      phone: 'phone',
      address: 'address',
      homeAreaId: 'home_area_id',
      role: 'role',
      passwordHash: 'password_hash',
      pinHash: 'pin_hash',
      idNumber: 'id_number',
    };
    for (const [key, column] of Object.entries(mapping)) {
      if (Object.prototype.hasOwnProperty.call(fields, key)) {
        sets.push(`${column} = ?`);
        params.push(fields[key]);
      }
    }
    if (!sets.length) return;
    params.push(id);
    await query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params);
  }

  async function replaceUserAreas(userId, areaIds) {
    await withTx(async (connection) => {
      await connection.query('DELETE FROM user_areas WHERE user_id = ?', [userId]);
      for (const areaId of idList(areaIds)) {
        await connection.query('INSERT INTO user_areas (user_id, area_id) VALUES (?, ?)', [userId, areaId]);
      }
    });
  }

  async function areaIdsForUser(userId) {
    const rows = await query('SELECT area_id FROM user_areas WHERE user_id = ?', [userId]);
    return rows.map((row) => row.area_id);
  }

  async function scopeForUser(user) {
    if (!user || user.role === 'Server Admin') return null;
    if (user.role === 'Resident') return new Set();
    const assigned = await areaIdsForUser(user.id);
    if (!assigned.length) return new Set();
    const marks = assigned.map(() => '?').join(',');
    const children = await query(`SELECT id FROM areas WHERE parent_id IN (${marks})`, assigned);
    return new Set([...assigned, ...children.map((row) => row.id)]);
  }

  function scopeClause(scope, municipalityColumn, wardColumn) {
    if (scope === null) return { sql: '1=1', params: [] };
    const ids = idList([...scope]);
    if (!ids.length) return { sql: '1=0', params: [] };
    const marks = ids.map(() => '?').join(',');
    return {
      sql: `(${municipalityColumn} IN (${marks}) OR ${wardColumn} IN (${marks}))`,
      params: [...ids, ...ids],
    };
  }

  async function publicTotals() {
    const rows = await query(`
      SELECT COUNT(*) AS total, SUM(status = 'Resolved') AS resolved
      FROM complaints
    `);
    return {
      total: Number(rows[0]?.total || 0),
      resolved: Number(rows[0]?.resolved || 0),
    };
  }

  async function listComplaintsForReporter(userId) {
    const rows = await query(`${complaintSelect} WHERE c.reporter_id = ? ORDER BY c.created_at DESC, c.id DESC`, [userId]);
    return rows.map(mapComplaint);
  }

  async function listComplaintsForScope(scope, filters = {}) {
    const clause = scopeClause(scope, 'c.municipality_id', 'c.ward_id');
    const params = [...clause.params];
    let sql = `${complaintSelect} WHERE ${clause.sql}`;
    if (filters.status) {
      sql += ' AND c.status = ?';
      params.push(filters.status);
    }
    if (filters.category) {
      sql += ' AND c.category = ?';
      params.push(filters.category);
    }
    sql += ' ORDER BY c.created_at DESC, c.id DESC';
    const rows = await query(sql, params);
    return rows.map(mapComplaint);
  }

  async function getComplaint(id) {
    const rows = await query(`${complaintSelect} WHERE c.id = ?`, [id]);
    return mapComplaint(rows[0]);
  }

  async function nextReference(prefix) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const reference = `${prefix}-${new Date().getUTCFullYear()}-${crypto.randomInt(10000, 100000)}`;
      const table = prefix === 'S78' ? 'section78_disputes' : 'complaints';
      const column = prefix === 'S78' ? 'reference_code' : 'ticket_reference';
      const rows = await query(`SELECT id FROM ${table} WHERE ${column} = ?`, [reference]);
      if (!rows.length) return reference;
    }
    throw new Error('Could not allocate a reference.');
  }

  async function notifyUsers(connection, userIds, complaintId, message) {
    const unique = [...new Set(userIds.filter(Boolean))];
    for (const userId of unique) {
      await connection.query(
        'INSERT INTO notifications (user_id, complaint_id, message, created_at) VALUES (?, ?, ?, UTC_TIMESTAMP())',
        [userId, complaintId, message]
      );
    }
  }

  async function staffIdsForArea(municipalityId, wardId) {
    const rows = await query(
      `SELECT id FROM users WHERE role = 'Server Admin'
       UNION
       SELECT u.id
       FROM users u
       JOIN user_areas ua ON ua.user_id = u.id
       WHERE u.role IN ('PA Member', 'Admin')
         AND (ua.area_id = ? OR ua.area_id = ?)`,
      [municipalityId, wardId || 0]
    );
    return rows.map((row) => row.id);
  }

  async function createComplaint(input) {
    const reference = await nextReference('PA');
    return withTx(async (connection) => {
      const [result] = await connection.query(
        `INSERT INTO complaints
          (ticket_reference, reporter_id, category, description, address, municipality_id, ward_id, latitude, longitude, photo_stored_name, photo_mime, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Received', UTC_TIMESTAMP())`,
        [
          reference,
          input.reporterId,
          input.category,
          input.description,
          input.address,
          input.municipalityId,
          input.wardId,
          input.latitude,
          input.longitude,
          input.photoStoredName,
          input.photoMime,
        ]
      );
      const complaintId = result.insertId;
      const received = `We received your complaint ${reference} (${input.category}).`;
      await connection.query(
        'INSERT INTO complaint_updates (complaint_id, status, note, actor_id, created_at) VALUES (?, ?, ?, ?, UTC_TIMESTAMP())',
        [complaintId, 'Received', received, input.reporterId]
      );
      await notifyUsers(connection, [input.reporterId], complaintId, received);
      const staffIds = await staffIdsForArea(input.municipalityId, input.wardId);
      const place = input.placeLabel;
      await notifyUsers(
        connection,
        staffIds.filter((id) => id !== input.reporterId),
        complaintId,
        `New ${input.category} complaint ${reference} in ${place}.`
      );
      return { id: complaintId, ticketReference: reference };
    });
  }

  async function addUpdate(connection, complaintId, status, note, actorId) {
    await connection.query(
      'INSERT INTO complaint_updates (complaint_id, status, note, actor_id, created_at) VALUES (?, ?, ?, ?, UTC_TIMESTAMP())',
      [complaintId, status, note, actorId]
    );
  }

  async function dispatchComplaint(complaint, actorId, assigneeLabel) {
    const note = `${assigneeLabel} was sent to repair this complaint.`;
    await withTx(async (connection) => {
      await connection.query(
        `UPDATE complaints
         SET status = 'In progress', assignee_label = ?, dispatched_at = UTC_TIMESTAMP(), dispatched_by = ?, updated_at = UTC_TIMESTAMP()
         WHERE id = ? AND status <> 'Resolved'`,
        [assigneeLabel, actorId, complaint.id]
      );
      await addUpdate(connection, complaint.id, 'In progress', note, actorId);
      await notifyUsers(connection, [complaint.reporterId], complaint.id, `Your complaint ${complaint.ticketReference} is in progress. ${note}`);
    });
  }

  async function completeComplaint(complaint, actorId) {
    const note = `Your complaint ${complaint.ticketReference} has been marked complete.`;
    await withTx(async (connection) => {
      await connection.query(
        `UPDATE complaints
         SET status = 'Resolved', completed_at = UTC_TIMESTAMP(), completed_by = ?, updated_at = UTC_TIMESTAMP()
         WHERE id = ? AND status <> 'Resolved'`,
        [actorId, complaint.id]
      );
      await addUpdate(connection, complaint.id, 'Resolved', note, actorId);
      await notifyUsers(connection, [complaint.reporterId], complaint.id, note);
    });
  }

  async function escalateComplaint(complaint, actorId, level) {
    const note = `Your complaint ${complaint.ticketReference} was referred to ${level}.`;
    await withTx(async (connection) => {
      await connection.query(
        'UPDATE complaints SET escalation_level = ?, updated_at = UTC_TIMESTAMP() WHERE id = ?',
        [level, complaint.id]
      );
      await addUpdate(connection, complaint.id, complaint.status, note, actorId);
      await notifyUsers(connection, [complaint.reporterId], complaint.id, note);
    });
  }

  async function listUpdates(complaintId) {
    return query(
      'SELECT id, status, note, created_at FROM complaint_updates WHERE complaint_id = ? ORDER BY created_at ASC, id ASC',
      [complaintId]
    );
  }

  async function listNotifications(userId) {
    return query(
      `SELECT id, complaint_id, message, read_at, created_at
       FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 100`,
      [userId]
    );
  }

  async function unreadCount(userId) {
    const rows = await query('SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND read_at IS NULL', [userId]);
    return Number(rows[0]?.total || 0);
  }

  async function markAllRead(userId) {
    await query('UPDATE notifications SET read_at = UTC_TIMESTAMP() WHERE user_id = ? AND read_at IS NULL', [userId]);
  }

  async function markComplaintRead(userId, complaintId) {
    await query(
      'UPDATE notifications SET read_at = UTC_TIMESTAMP() WHERE user_id = ? AND complaint_id = ? AND read_at IS NULL',
      [userId, complaintId]
    );
  }

  async function countServerAdmins() {
    const rows = await query(`SELECT COUNT(*) AS total FROM users WHERE role = 'Server Admin'`);
    return Number(rows[0]?.total || 0);
  }

  async function listResidents({ scope, search }) {
    const params = [];
    let sql = `
      SELECT u.id, u.display_name, u.email, u.phone, u.address, u.id_number, u.created_at,
             ward.name AS ward_name, muni.name AS municipality_name, u.home_area_id
      FROM users u
      LEFT JOIN areas ward ON ward.id = u.home_area_id
      LEFT JOIN areas muni ON muni.id = COALESCE(ward.parent_id, CASE WHEN ward.kind = 'municipality' THEN ward.id ELSE NULL END)
      WHERE u.role = 'Resident'
    `;
    if (scope !== null) {
      const ids = idList([...scope]);
      if (!ids.length) return [];
      const marks = ids.map(() => '?').join(',');
      sql += ` AND (u.home_area_id IN (${marks}) OR ward.parent_id IN (${marks}))`;
      params.push(...ids, ...ids);
    }
    if (search) {
      sql += ' AND (u.display_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ? OR u.address LIKE ? OR ward.name LIKE ? OR muni.name LIKE ?)';
      const like = `%${search.replace(/[\\%_]/g, '')}%`;
      params.push(like, like, like, like, like, like);
    }
    sql += ' ORDER BY u.display_name';
    return query(sql, params);
  }

  async function listStaff({ actor, scope, search }) {
    const params = [];
    let sql = `
      SELECT u.id, u.display_name, u.email, u.phone, u.role, u.created_at
      FROM users u
      WHERE u.role IN ('PA Member', 'Admin', 'Server Admin')
    `;
    if (actor.role !== 'Server Admin') {
      const ids = idList([...(scope || [])]);
      if (!ids.length) return [];
      const marks = ids.map(() => '?').join(',');
      sql += ` AND u.role <> 'Server Admin' AND EXISTS (
        SELECT 1 FROM user_areas ua WHERE ua.user_id = u.id AND ua.area_id IN (${marks})
      )`;
      params.push(...ids);
    }
    if (search) {
      sql += ' AND (u.display_name LIKE ? OR u.email LIKE ? OR u.role LIKE ?)';
      const like = `%${search.replace(/[\\%_]/g, '')}%`;
      params.push(like, like, like);
    }
    sql += ' ORDER BY u.role, u.display_name';
    const people = await query(sql, params);
    for (const person of people) {
      const areas = await query(
        `SELECT a.id, a.name, a.kind, p.name AS parent_name
         FROM user_areas ua
         JOIN areas a ON a.id = ua.area_id
         LEFT JOIN areas p ON p.id = a.parent_id
         WHERE ua.user_id = ?
         ORDER BY a.name`,
        [person.id]
      );
      person.areas = areas;
    }
    return people;
  }

  async function createDispute(input) {
    const reference = await nextReference('S78');
    const result = await query(
      `INSERT INTO section78_disputes
        (resident_id, reference_code, property_address, municipal_account_number, erf_number, title_deed_number,
         actual_dominant_use, property_category_dispute, owner_statement, municipality_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
      [
        input.residentId,
        reference,
        input.propertyAddress,
        input.municipalAccountNumber,
        input.erfNumber,
        input.titleDeedNumber,
        input.actualDominantUse,
        input.propertyCategoryDispute,
        input.ownerStatement,
        input.municipalityId,
      ]
    );
    return { id: result.insertId, reference };
  }

  async function listDisputesForResident(userId) {
    return query(
      `SELECT reference_code, property_address, property_category_dispute, created_at
       FROM section78_disputes WHERE resident_id = ? ORDER BY created_at DESC`,
      [userId]
    );
  }

  async function listDisputesForScope(scope) {
    const params = [];
    let sql = `
      SELECT d.reference_code, d.property_address, d.municipal_account_number, d.erf_number,
             d.title_deed_number, d.actual_dominant_use, d.property_category_dispute, d.owner_statement,
             d.created_at, u.display_name, m.name AS municipality_name
      FROM section78_disputes d
      JOIN users u ON u.id = d.resident_id
      LEFT JOIN areas home ON home.id = u.home_area_id
      LEFT JOIN areas m ON m.id = d.municipality_id
      WHERE 1=1
    `;
    if (scope !== null) {
      const ids = idList([...scope]);
      if (!ids.length) return [];
      const marks = ids.map(() => '?').join(',');
      sql += ` AND (d.municipality_id IN (${marks}) OR u.home_area_id IN (${marks}) OR home.parent_id IN (${marks}))`;
      params.push(...ids, ...ids, ...ids);
    }
    sql += ' ORDER BY d.created_at DESC';
    return query(sql, params);
  }

  async function categoryCounts(scope) {
    const clause = scopeClause(scope, 'municipality_id', 'ward_id');
    const rows = await query(
      `SELECT category, COUNT(*) AS total FROM complaints WHERE ${clause.sql} GROUP BY category`,
      clause.params
    );
    return rows;
  }

  return {
    query,
    getSettings,
    updateSettings,
    listAreas,
    findArea,
    createArea,
    findUserById,
    findUserByEmail,
    createUser,
    updateUser,
    replaceUserAreas,
    areaIdsForUser,
    scopeForUser,
    publicTotals,
    listComplaintsForReporter,
    listComplaintsForScope,
    getComplaint,
    createComplaint,
    dispatchComplaint,
    completeComplaint,
    escalateComplaint,
    listUpdates,
    listNotifications,
    unreadCount,
    markAllRead,
    markComplaintRead,
    countServerAdmins,
    listResidents,
    listStaff,
    createDispute,
    listDisputesForResident,
    listDisputesForScope,
    categoryCounts,
  };
}

module.exports = { createData };
