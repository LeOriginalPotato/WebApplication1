const fs = require('fs');
const assert = require('node:assert/strict');

const base = process.env.BASE_URL || 'http://127.0.0.1:3000';
const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;
if (!adminEmail || !adminPassword) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD for the server admin that can already sign in.');
  process.exit(1);
}

const jpeg = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
]);

function csrfOf(html) {
  const match = html.match(/name="_csrf" value="([a-f0-9]+)"/);
  assert.ok(match, 'expected a form token');
  return match[1];
}

class Client {
  constructor() { this.jar = new Map(); }
  store(response) {
    const cookies = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
    for (const cookie of cookies) {
      const pair = cookie.split(';')[0];
      const eq = pair.indexOf('=');
      this.jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }
  async send(method, pathname, { form, multipart, redirect = 'manual' } = {}) {
    const headers = {};
    const cookie = [...this.jar].map(([key, value]) => `${key}=${value}`).join('; ');
    if (cookie) headers.cookie = cookie;
    let body;
    if (form) {
      headers['content-type'] = 'application/x-www-form-urlencoded';
      body = new URLSearchParams(form);
    } else if (multipart) {
      body = multipart;
    }
    const response = await fetch(base + pathname, { method, headers, body, redirect });
    this.store(response);
    const text = await response.text();
    return { status: response.status, text, location: response.headers.get('location'), type: response.headers.get('content-type') || '' };
  }
}

async function login(client, email, password) {
  const page = await client.send('GET', '/login');
  const posted = await client.send('POST', '/login', {
    form: { _csrf: csrfOf(page.text), email, credential: password, loginMethod: 'password', returnUrl: '/' },
  });
  assert.equal(posted.status, 302, `login failed for ${email}: ${posted.status}`);
  return posted.location;
}

function wardChoice(html, wardName) {
  const match = html.match(new RegExp(`<option value="(\\d+)" data-parent="(\\d+)"[^>]*>[^<]*${wardName}[^<]*</option>`));
  assert.ok(match, `missing ward ${wardName}`);
  return { wardId: match[1], municipalityId: match[2] };
}

function areaCheckbox(html, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = html.match(new RegExp(`name="areas" value="(\\d+)"[^>]*>\\s*${escaped}\\s*<span class="muted">`));
  assert.ok(match, `missing area ${label}`);
  return match[1];
}

async function registerResident(client, person, wardName) {
  const page = await client.send('GET', '/register');
  const area = wardChoice(page.text, wardName);
  const posted = await client.send('POST', '/register', {
    form: {
      _csrf: csrfOf(page.text),
      fullName: person.first,
      surname: person.surname,
      email: person.email,
      phone: person.phone,
      address: person.address,
      municipalityId: area.municipalityId,
      wardId: area.wardId,
      idNumber: '',
      password: person.password,
      pin: '2468',
      consent: 'yes',
    },
  });
  assert.equal(posted.status, 302, `register failed for ${person.email}: ${posted.text.slice(0, 300)}`);
  assert.equal(posted.location, '/login');
}

async function main() {
  const health = await fetch(`${base}/api/health`);
  assert.equal(health.status, 200);
  const healthBody = await health.json();
  assert.equal(healthBody.ok, true);
  assert.equal(healthBody.sessionSecret, undefined);

  const guest = new Client();
  const home = await guest.send('GET', '/');
  assert.equal(home.status, 302);
  assert.match(home.location, /^\/login/);

  const privacy = await guest.send('GET', '/privacy');
  assert.equal(privacy.status, 200);
  assert.match(privacy.text, /Privacy/);

  const sneaky = await guest.send('GET', '/login?returnUrl=' + encodeURIComponent('//evil.example/phish'));
  assert.equal(sneaky.status, 200);
  assert.doesNotMatch(sneaky.text, /evil\.example/);

  const scripted = await guest.send('GET', '/login?returnUrl=' + encodeURIComponent('/foo"><script>alert(1)</script>'));
  assert.doesNotMatch(scripted.text, /<script>alert\(1\)<\/script>/);

  const webhook = await guest.send('POST', '/api/webhooks/whatsapp-import', { form: { chatDump: 'hello' } });
  assert.equal(webhook.status, 503);

  const photoGuest = await guest.send('GET', '/complaints/1/photo');
  assert.equal(photoGuest.status, 401);

  const ayesha = {
    first: 'Ayesha', surname: 'Jacobs', email: `ayesha.${Date.now()}@example.com`,
    phone: '0601110001', address: '12 Soap Street, Mohlakeng', password: `resident-${Date.now()}-aA`,
  };
  const ben = {
    first: 'Ben', surname: 'Dlamini', email: `ben.${Date.now()}@example.com`,
    phone: '0601110002', address: '99 Other Road, CBD Core', password: `resident-${Date.now()}-bB`,
  };
  await registerResident(guest, ayesha, 'Mohlakeng');
  await registerResident(new Client(), ben, 'CBD Core');

  const resident = new Client();
  await login(resident, ayesha.email, ayesha.password);
  const residentHome = await resident.send('GET', '/');
  assert.equal(residentHome.status, 200);
  assert.match(residentHome.text, /On record/);
  assert.match(residentHome.text, /Resolved/);
  assert.match(residentHome.text, /bottom-nav/);
  assert.doesNotMatch(residentHome.text, /href="\/people"/);
  assert.doesNotMatch(residentHome.text, /href="\/section78"/);
  assert.match(residentHome.text, /href="\/more"/);

  for (const blocked of ['/people', '/complaints', '/map', '/settings', '/rates']) {
    const denied = await resident.send('GET', blocked);
    assert.equal(denied.status, 403, blocked);
  }

  const report = await resident.send('GET', '/report');
  const reportForm = new FormData();
  reportForm.set('_csrf', csrfOf(report.text));
  reportForm.set('category', 'Pothole');
  reportForm.set('description', 'Large pothole near the shop on Soap Street.');
  reportForm.set('address', ayesha.address);
  const area = wardChoice(report.text, 'Mohlakeng');
  reportForm.set('municipalityId', area.municipalityId);
  reportForm.set('wardId', area.wardId);
  reportForm.set('latitude', '-26.175000');
  reportForm.set('longitude', '27.700000');
  reportForm.set('photo', new Blob([jpeg], { type: 'image/jpeg' }), 'hole.jpg');
  const submitted = await resident.send('POST', '/report', { multipart: reportForm });
  assert.equal(submitted.status, 302, submitted.text.slice(0, 400));
  assert.match(submitted.location, /^\/my-reports\/\d+$/);
  const complaintPath = submitted.location;

  const badPhoto = new FormData();
  const reportAgain = await resident.send('GET', '/report');
  badPhoto.set('_csrf', csrfOf(reportAgain.text));
  badPhoto.set('category', 'Refuse');
  badPhoto.set('description', 'This photo is not really a photo.');
  badPhoto.set('address', ayesha.address);
  badPhoto.set('municipalityId', area.municipalityId);
  badPhoto.set('wardId', area.wardId);
  badPhoto.set('photo', new Blob(['<svg xmlns="http://www.w3.org/2000/svg"></svg>'], { type: 'image/svg+xml' }), 'x.svg');
  const rejected = await resident.send('POST', '/report', { multipart: badPhoto });
  assert.equal(rejected.status, 400);
  assert.match(rejected.text, /JPEG, PNG, WEBP, or HEIC/);

  const mine = await resident.send('GET', '/my-reports');
  assert.match(mine.text, /Pothole/);
  assert.match(mine.text, /12 Soap Street/);
  assert.doesNotMatch(mine.text, /99 Other Road/);

  const detail = await resident.send('GET', complaintPath);
  assert.match(detail.text, /Large pothole near the shop/);
  const photo = await resident.send('GET', complaintPath.replace('/my-reports/', '/complaints/') + '/photo');
  assert.equal(photo.status, 200);
  assert.match(photo.type, /image\/jpeg/);

  const benClient = new Client();
  await login(benClient, ben.email, ben.password);
  const benReport = await benClient.send('GET', '/report');
  const benForm = new FormData();
  const benArea = wardChoice(benReport.text, 'CBD Core');
  benForm.set('_csrf', csrfOf(benReport.text));
  benForm.set('category', 'Water');
  benForm.set('description', 'No water from the tap since yesterday morning.');
  benForm.set('address', ben.address);
  benForm.set('municipalityId', benArea.municipalityId);
  benForm.set('wardId', benArea.wardId);
  const benPosted = await benClient.send('POST', '/report', { multipart: benForm });
  assert.equal(benPosted.status, 302, benPosted.text.slice(0, 300));
  const stolen = await resident.send('GET', benPosted.location);
  assert.equal(stolen.status, 404);
  const residentApi = await resident.send('GET', '/api/complaints');
  assert.equal(residentApi.status, 200);
  assert.match(residentApi.text, /Soap Street/);
  assert.doesNotMatch(residentApi.text, /Other Road/);
  assert.doesNotMatch(residentApi.text, new RegExp(ben.email));

  const owner = new Client();
  const bounced = await owner.send('GET', '/login');
  const open = await owner.send('POST', '/login', {
    form: {
      _csrf: csrfOf(bounced.text),
      email: adminEmail,
      credential: adminPassword,
      loginMethod: 'password',
      returnUrl: '//evil.example/phish',
    },
  });
  assert.equal(open.status, 302);
  assert.equal(open.location, '/');
  assert.doesNotMatch(open.location, /evil/);

  const people = await owner.send('GET', '/people');
  assert.equal(people.status, 200);
  const token = csrfOf(people.text);
  const randfontein = areaCheckbox(people.text, 'Randfontein');
  const mohlakengWard = areaCheckbox(people.text, 'Randfontein · Mohlakeng');
  const stamp = Date.now();
  const adminUser = { email: `admin.${stamp}@example.com`, password: `admin-pass-${stamp}-xY` };
  const memberUser = { email: `member.${stamp}@example.com`, password: `member-pass-${stamp}-xY` };

  const createdAdmin = await owner.send('POST', '/people/staff', {
    form: {
      _csrf: token, fullName: 'Area', surname: 'Admin', email: adminUser.email, phone: '0601110004',
      role: 'Admin', areas: randfontein, password: adminUser.password, pin: '1357',
    },
  });
  assert.equal(createdAdmin.status, 302, createdAdmin.text.slice(0, 300));

  const createdMember = await owner.send('POST', '/people/staff', {
    form: {
      _csrf: token, fullName: 'Ward', surname: 'Member', email: memberUser.email, phone: '0601110005',
      role: 'PA Member', areas: mohlakengWard, password: memberUser.password, pin: '1357',
    },
  });
  assert.equal(createdMember.status, 302, createdMember.text.slice(0, 300));

  const member = new Client();
  await login(member, memberUser.email, memberUser.password);
  assert.equal((await member.send('GET', '/people')).status, 403);
  assert.equal((await member.send('GET', '/settings')).status, 403);
  assert.equal((await member.send('GET', '/rates')).status, 403);
  const queue = await member.send('GET', '/complaints');
  assert.equal(queue.status, 200);
  assert.match(queue.text, /12 Soap Street/);
  assert.match(queue.text, /Pothole/);
  assert.doesNotMatch(queue.text, /99 Other Road/);
  assert.doesNotMatch(queue.text, new RegExp(ayesha.email));
  assert.doesNotMatch(queue.text, /Ayesha/);
  const memberApi = await member.send('GET', '/api/complaints');
  assert.doesNotMatch(memberApi.text, /reporter/i);
  assert.doesNotMatch(memberApi.text, new RegExp(ayesha.email));

  const ticket = complaintPath.split('/').pop();
  const opened = await member.send('GET', `/complaints/${ticket}`);
  assert.equal(opened.status, 200);
  assert.doesNotMatch(opened.text, /Ayesha/);
  const escalate = await member.send('POST', `/complaints/${ticket}/escalate`, {
    form: { _csrf: csrfOf(opened.text), level: 'Provincial Desk' },
  });
  assert.equal(escalate.status, 403);

  const dispatched = await member.send('POST', `/complaints/${ticket}/dispatch`, {
    form: { _csrf: csrfOf(opened.text), assignee: 'Ward roads team' },
  });
  assert.equal(dispatched.status, 302);

  const afterDispatch = await resident.send('GET', '/');
  assert.match(afterDispatch.text, /badge/);
  const notes = await resident.send('GET', '/notifications');
  assert.match(notes.text, /in progress/i);
  assert.match(notes.text, /Ward roads team/);
  const ownDetail = await resident.send('GET', complaintPath);
  assert.match(ownDetail.text, /In progress/);
  assert.match(ownDetail.text, /Ward roads team/);

  const areaAdmin = new Client();
  await login(areaAdmin, adminUser.email, adminUser.password);
  const adminQueue = await areaAdmin.send('GET', '/complaints');
  assert.match(adminQueue.text, /12 Soap Street/);
  assert.match(adminQueue.text, /99 Other Road/);
  const adminPeople = await areaAdmin.send('GET', '/people');
  assert.match(adminPeople.text, /Ayesha/);
  assert.match(adminPeople.text, /Ward Member/);
  assert.doesNotMatch(adminPeople.text, new RegExp(adminEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  const tamper = await areaAdmin.send('POST', '/people/staff/1', {
    form: { _csrf: csrfOf(adminPeople.text), displayName: 'Taken Over', role: 'Admin', phone: '0600000000' },
  });
  assert.equal(tamper.status, 403);
  const promoted = await areaAdmin.send('POST', '/people/staff', {
    form: {
      _csrf: csrfOf(adminPeople.text), fullName: 'Server', surname: 'Imposter', email: `imposter.${stamp}@example.com`,
      phone: '0601110003', role: 'Server Admin', areas: randfontein, password: 'long-password-1', pin: '1357',
    },
  });
  assert.equal(promoted.status, 403);

  const referred = await areaAdmin.send('POST', `/complaints/${ticket}/escalate`, {
    form: { _csrf: csrfOf((await areaAdmin.send('GET', `/complaints/${ticket}`)).text), level: 'Regional Coordinator' },
  });
  assert.equal(referred.status, 302);
  const referralNotes = await resident.send('GET', '/notifications');
  assert.match(referralNotes.text, /Regional Coordinator/);

  const done = await member.send('POST', `/complaints/${ticket}/complete`, {
    form: { _csrf: csrfOf((await member.send('GET', `/complaints/${ticket}`)).text) },
  });
  assert.equal(done.status, 302);
  const finished = await resident.send('GET', complaintPath);
  assert.match(finished.text, /Resolved/);
  const finalNotes = await resident.send('GET', '/notifications');
  assert.match(finalNotes.text, /marked complete/i);
  const totals = await resident.send('GET', '/');
  assert.match(totals.text, /<strong>1<\/strong>|<strong>[1-9]/);

  const publicFile = await guest.send('GET', '/styles/site.css');
  assert.equal(publicFile.status, 200);
  assert.doesNotMatch(publicFile.text, /Soap Street/);

  fs.writeFileSync('/tmp/pa-role-accounts.json', JSON.stringify({
    base,
    adminEmail,
    adminPassword,
    ayesha,
    ben,
    adminUser,
    memberUser,
    complaintPath,
  }, null, 2), { mode: 0o600 });
  console.log('Smoke checks passed.');
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
