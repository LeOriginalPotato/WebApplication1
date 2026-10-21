const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { loadDatabaseConfig } = require('../src/config');
const { createPool } = require('../src/db');
const { migrate } = require('../src/migrate');
const { createData } = require('../src/data');
const { hashSecret } = require('../src/passwords');
const { storedPhotoName } = require('../src/security');

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'db']);

const jpeg = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
]);

function localPassword() {
  return `local-${crypto.randomBytes(12).toString('base64url')}`;
}

function wardNamed(areas, name) {
  const ward = areas.find((area) => area.kind === 'ward' && area.name === name);
  if (!ward) throw new Error(`Ward ${name} is missing. Start the app once so migrations can create Randfontein.`);
  return ward;
}

async function upsertUser(data, spec, password) {
  const passwordHash = await hashSecret(password);
  const existing = await data.findUserByEmail(spec.email);
  if (!existing) {
    const id = await data.createUser({
      email: spec.email,
      passwordHash,
      displayName: spec.displayName,
      fullName: spec.fullName,
      surname: spec.surname,
      phone: spec.phone,
      address: spec.address || null,
      role: spec.role,
      homeAreaId: spec.homeAreaId || null,
      consentGiven: true,
    }, spec.areaIds || []);
    return data.findUserById(id);
  }
  await data.updateUser(existing.id, {
    passwordHash,
    displayName: spec.displayName,
    phone: spec.phone || null,
    address: spec.address || null,
    role: spec.role,
    homeAreaId: spec.homeAreaId || null,
  });
  await data.replaceUserAreas(existing.id, spec.areaIds || []);
  return data.findUserById(existing.id);
}

async function clearResidentComplaints(data, config, residentId) {
  const existing = await data.listComplaintsForReporter(residentId);
  for (const complaint of existing) {
    if (complaint.photoStoredName) {
      await fs.promises.unlink(path.join(config.uploadDir, complaint.photoStoredName)).catch(() => {});
    }
  }
  await data.query(
    `DELETE n FROM notifications n
     INNER JOIN complaints c ON c.id = n.complaint_id
     WHERE c.reporter_id = ?`,
    [residentId]
  );
  await data.query(
    `DELETE u FROM complaint_updates u
     INNER JOIN complaints c ON c.id = u.complaint_id
     WHERE c.reporter_id = ?`,
    [residentId]
  );
  await data.query('DELETE FROM complaints WHERE reporter_id = ?', [residentId]);
}

async function main() {
  const config = loadDatabaseConfig();
  if (!LOCAL_HOSTS.has(config.mysql.host)) {
    console.error(`dev:seed only runs against a local database (localhost, 127.0.0.1, or the Docker service "db"). Refusing host ${config.mysql.host}.`);
    process.exit(1);
  }
  await migrate(config);
  fs.mkdirSync(config.uploadDir, { recursive: true });
  const pool = createPool(config);
  const data = createData(pool);
  try {
    const areas = await data.listAreas();
    const municipality = areas.find((area) => area.kind === 'municipality' && area.name === 'Randfontein');
    const mohlakeng = wardNamed(areas, 'Mohlakeng');
    const cbd = wardNamed(areas, 'CBD Core');
    const rural = wardNamed(areas, 'Rural Holdings');
    if (!municipality) throw new Error('Randfontein is missing. Start the app once so migrations can run.');

    const accounts = [
      {
        role: 'Resident',
        email: 'resident@example.com',
        displayName: 'Thandi Mokoena',
        fullName: 'Thandi',
        surname: 'Mokoena',
        phone: '0601001001',
        address: '12 Soap Street, Mohlakeng',
        homeAreaId: mohlakeng.id,
        areaIds: [],
      },
      {
        role: 'PA Member',
        email: 'member@example.com',
        displayName: 'Sipho Ndlovu',
        fullName: 'Sipho',
        surname: 'Ndlovu',
        phone: '0601001002',
        homeAreaId: null,
        areaIds: [municipality.id],
      },
      {
        role: 'Admin',
        email: 'admin@example.com',
        displayName: 'Lerato Khumalo',
        fullName: 'Lerato',
        surname: 'Khumalo',
        phone: '0601001003',
        homeAreaId: null,
        areaIds: [municipality.id],
      },
      {
        role: 'Server Admin',
        email: 'server.admin@example.com',
        displayName: 'Site Owner',
        fullName: 'Site',
        surname: 'Owner',
        phone: '0601001004',
        homeAreaId: null,
        areaIds: [],
      },
    ];

    const printed = [];
    const users = {};
    for (const spec of accounts) {
      const password = localPassword();
      users[spec.role] = await upsertUser(data, spec, password);
      printed.push({ role: spec.role, email: spec.email, password });
    }

    const resident = users.Resident;
    const member = users['PA Member'];
    await clearResidentComplaints(data, config, resident.id);
    const photoName = storedPhotoName('image/jpeg');
    await fs.promises.writeFile(path.join(config.uploadDir, photoName), jpeg, { mode: 0o640 });

    const samples = [
      {
        category: 'Pothole',
        description: 'Large pothole near the shop on Soap Street. Cars are driving around it.',
        address: '12 Soap Street, Mohlakeng',
        ward: mohlakeng,
        latitude: -26.1752,
        longitude: 27.7014,
        photoStoredName: photoName,
        photoMime: 'image/jpeg',
      },
      {
        category: 'Water',
        description: 'Water running in the street outside 44 Fifth Street since this morning.',
        address: '44 Fifth Street, CBD Core',
        ward: cbd,
        latitude: -26.1831,
        longitude: 27.7048,
        photoStoredName: null,
        photoMime: null,
        dispatch: 'CBD plumbing team',
      },
      {
        category: 'Refuse',
        description: 'Refuse bags have not been collected from Plot 8 for two weeks.',
        address: 'Plot 8, Rural Holdings',
        ward: rural,
        latitude: -26.1684,
        longitude: 27.6892,
        photoStoredName: null,
        photoMime: null,
        complete: true,
      },
    ];

    for (const sample of samples) {
      const created = await data.createComplaint({
        reporterId: resident.id,
        category: sample.category,
        description: sample.description,
        address: sample.address,
        municipalityId: municipality.id,
        wardId: sample.ward.id,
        latitude: sample.latitude,
        longitude: sample.longitude,
        photoStoredName: sample.photoStoredName,
        photoMime: sample.photoMime,
        placeLabel: `${sample.ward.name}, Randfontein`,
      });
      const complaint = await data.getComplaint(created.id);
      if (sample.dispatch) await data.dispatchComplaint(complaint, member.id, sample.dispatch);
      if (sample.complete) await data.completeComplaint(complaint, member.id);
    }

    const lines = [
      'Local demo accounts. These are for your laptop only.',
      '',
      ...printed.map((row) => `${row.role.padEnd(14)} ${row.email.padEnd(28)} ${row.password}`),
      '',
      'Open http://localhost:3000 and sign in with one of the emails above.',
      'Run this command again if you need new passwords. Do not use these accounts on the live site.',
    ];
    const text = `${lines.join('\n')}\n`;
    const outPath = path.join(__dirname, '..', '.demo-accounts.local');
    fs.writeFileSync(outPath, text, { mode: 0o600 });
    console.log(text);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error && error.message ? error.message : 'Could not seed local demo data.');
  process.exit(1);
});
