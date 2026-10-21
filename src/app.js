const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const { MariaSessionStore } = require('./session-store');
const { hashSecret, matches } = require('./passwords');
const { webhookHandler } = require('./whatsapp');
const {
  CATEGORIES,
  ESCALATIONS,
  ASSIGNABLE_BY_ADMIN,
  ASSIGNABLE_BY_SERVER_ADMIN,
  safeReturnPath,
  cleanText,
  isEmail,
  isPin,
  parseCoord,
  sniffImage,
  storedPhotoName,
  isSafePhotoName,
  cleanHttpUrl,
  idList,
  tokensEqual,
  MIME_EXTENSIONS,
} = require('./security');
const pages = require('./render');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 20 },
});

const attempts = new Map();

function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function tooManyAttempts(ip) {
  const row = attempts.get(ip);
  return Boolean(row && row.until > Date.now());
}

function recordFailure(ip) {
  const row = attempts.get(ip) || { count: 0, until: 0 };
  if (row.until && row.until < Date.now()) {
    row.count = 0;
    row.until = 0;
  }
  row.count += 1;
  if (row.count >= 8) row.until = Date.now() + 5 * 60 * 1000;
  attempts.set(ip, row);
}

function clearFailures(ip) {
  attempts.delete(ip);
}

function wrap(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function ensureCsrf(req) {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(32).toString('hex');
  return req.session.csrf;
}

function paramId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function createApp({ config, pool, data }) {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    next();
  });

  app.get('/api/health', (req, res) => {
    res.json({ ok: true, service: 'PA At Work' });
  });

  app.use(express.json({ limit: '200kb' }));
  app.use(express.urlencoded({ extended: true, limit: '200kb' }));
  app.use(express.text({ type: ['text/plain', 'text/*'], limit: '1mb' }));
  app.post('/api/webhooks/whatsapp-import', webhookHandler);
  app.post('/api/whatsapp/import', webhookHandler);

  const root = path.join(__dirname, '..');
  app.use('/styles', express.static(path.join(root, 'public', 'styles'), { index: false, dotfiles: 'deny', maxAge: '1h' }));
  app.use('/images', express.static(path.join(root, 'public', 'images'), { index: false, dotfiles: 'deny', maxAge: '1d' }));

  app.use(session({
    name: 'paatwork.sid',
    secret: config.sessionSecret,
    store: new MariaSessionStore(pool),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.cookieSecure,
      maxAge: 8 * 60 * 60 * 1000,
      path: '/',
    },
  }));

  app.use(wrap(async (req, res, next) => {
    ensureCsrf(req);
    if (!req.session.userId) {
      req.currentUser = null;
      return next();
    }
    const user = await data.findUserById(req.session.userId);
    if (!user) {
      req.session.userId = null;
      req.currentUser = null;
      return next();
    }
    req.currentUser = user;
    next();
  }));

  app.use(wrap(async (req, res, next) => {
    req.siteSettings = await data.getSettings();
    next();
  }));

  function takeFlash(req) {
    const flash = req.session.flash || null;
    delete req.session.flash;
    return flash;
  }

  function setFlash(req, type, text) {
    req.session.flash = { type, text };
  }

  async function view(req, extras = {}) {
    const unread = req.currentUser ? await data.unreadCount(req.currentUser.id) : 0;
    return {
      settings: req.siteSettings,
      user: req.currentUser,
      unread,
      csrf: req.session.csrf,
      flash: takeFlash(req),
      ...extras,
    };
  }

  function send(res, html, status = 200) {
    res.status(status).type('html').send(html);
  }

  function wantsJson(req) {
    return req.path.startsWith('/api/');
  }

  function requireUser(req, res, next) {
    if (req.currentUser) return next();
    if (wantsJson(req)) return res.status(401).json({ message: 'Sign in required.' });
    const target = safeReturnPath(req.originalUrl) || '/';
    return res.redirect(`/login?returnUrl=${encodeURIComponent(target)}`);
  }

  function requireRoles(...roles) {
    return (req, res, next) => {
      if (!req.currentUser) return requireUser(req, res, next);
      if (!roles.includes(req.currentUser.role)) {
        if (wantsJson(req)) return res.status(403).json({ message: 'You cannot open that.' });
        return send(res, pages.messagePage({
          settings: req.siteSettings,
          user: req.currentUser,
          heading: 'Not available',
          message: 'Your account cannot open that page.',
          extra: '<p><a href="/">Back</a></p>',
        }), 403);
      }
      return next();
    };
  }

  function requireCsrf(req, res, next) {
    const sent = req.body?._csrf || req.get('x-csrf-token') || '';
    if (!tokensEqual(sent, req.session?.csrf)) {
      if (wantsJson(req)) return res.status(403).json({ message: 'Form expired. Reload and try again.' });
      return send(res, pages.messagePage({
        settings: req.siteSettings,
        user: req.currentUser,
        heading: 'Form expired',
        message: 'Go back, reload the page, and submit it again.',
      }), 403);
    }
    return next();
  }

  async function canSee(user, complaint) {
    if (!user || !complaint) return false;
    if (user.role === 'Resident') return complaint.reporterId === user.id;
    if (user.role === 'Server Admin') return true;
    const scope = await data.scopeForUser(user);
    if (scope.has(complaint.municipalityId)) return true;
    return Boolean(complaint.wardId && scope.has(complaint.wardId));
  }

  function homeFor(user) {
    return user && user.role !== 'Resident' ? '/complaints' : '/';
  }

  app.get('/login', wrap(async (req, res) => {
    if (req.currentUser) return res.redirect(homeFor(req.currentUser));
    send(res, pages.loginPage(await view(req, { returnUrl: safeReturnPath(req.query.returnUrl) })));
  }));

  app.post('/login', requireCsrf, wrap(async (req, res, next) => {
    const ip = clientIp(req);
    if (tooManyAttempts(ip)) {
      send(res, pages.loginPage(await view(req, {
        returnUrl: safeReturnPath(req.body.returnUrl),
        flash: { type: 'error', text: 'Too many sign-in attempts. Wait a few minutes and try again.' },
      })), 429);
      return;
    }
    const email = cleanText(req.body.email, 255).toLowerCase();
    const credential = String(req.body.credential || '');
    const method = req.body.loginMethod === 'pin' ? 'pin' : 'password';
    const user = isEmail(email) ? await data.findUserByEmail(email) : null;
    const ok = method === 'pin'
      ? await matches(credential, user && user.pinHash)
      : await matches(credential, user && user.passwordHash);
    if (!ok) {
      recordFailure(ip);
      send(res, pages.loginPage(await view(req, {
        returnUrl: safeReturnPath(req.body.returnUrl),
        flash: { type: 'error', text: 'Those sign-in details were not recognised.' },
      })), 401);
      return;
    }
    clearFailures(ip);
    const returnUrl = safeReturnPath(req.body.returnUrl) || '/';
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.userId = user.id;
      req.session.csrf = crypto.randomBytes(32).toString('hex');
      req.session.save((saveErr) => {
        if (saveErr) return next(saveErr);
        res.redirect(returnUrl);
      });
    });
  }));

  app.post('/logout', requireUser, requireCsrf, (req, res) => {
    req.session.destroy(() => {
      res.clearCookie('paatwork.sid', { path: '/' });
      res.redirect('/login');
    });
  });

  app.get('/register', wrap(async (req, res) => {
    const areas = await data.listAreas();
    send(res, pages.registerPage(await view(req, { areas, values: {} })));
  }));

  app.post('/register', requireCsrf, wrap(async (req, res) => {
    const values = {
      fullName: cleanText(req.body.fullName, 120),
      surname: cleanText(req.body.surname, 120),
      email: cleanText(req.body.email, 255).toLowerCase(),
      phone: cleanText(req.body.phone, 40),
      address: cleanText(req.body.address, 400),
      idNumber: cleanText(req.body.idNumber, 32),
      municipalityId: paramId(req.body.municipalityId) || '',
      wardId: paramId(req.body.wardId) || '',
    };
    const areas = await data.listAreas();
    const fail = async (text) => send(res, pages.registerPage(await view(req, { areas, values, flash: { type: 'error', text } })), 400);
    const ward = values.wardId ? await data.findArea(values.wardId) : null;
    const password = String(req.body.password || '');
    if (!values.fullName || !values.surname || !isEmail(values.email) || !values.phone || values.address.length < 5) {
      return fail('Fill in your name, email, phone, and address.');
    }
    if (!ward || ward.kind !== 'ward' || ward.parent_id !== values.municipalityId) {
      return fail('Choose a municipality and one of its wards.');
    }
    if (password.length < 10) return fail('Use a password of at least 10 characters.');
    if (!isPin(String(req.body.pin || ''))) return fail('Choose a PIN of 4 to 8 digits.');
    if (req.body.consent !== 'yes') return fail('Consent is required to create an account.');
    if (await data.findUserByEmail(values.email)) return fail('That email is already registered. Sign in instead.');
    await data.createUser({
      email: values.email,
      passwordHash: await hashSecret(password),
      pinHash: await hashSecret(String(req.body.pin)),
      displayName: `${values.fullName} ${values.surname}`,
      fullName: values.fullName,
      surname: values.surname,
      idNumber: values.idNumber,
      phone: values.phone,
      address: values.address,
      role: 'Resident',
      homeAreaId: ward.id,
      consentGiven: true,
    });
    setFlash(req, 'success', 'Account created. Sign in with your email and password or PIN.');
    res.redirect('/login');
  }));

  app.get('/privacy', wrap(async (req, res) => {
    send(res, pages.privacyPage(await view(req)));
  }));

  app.get('/', requireUser, wrap(async (req, res) => {
    if (req.currentUser.role !== 'Resident') return res.redirect('/complaints');
    const [totals, complaints] = await Promise.all([
      data.publicTotals(),
      data.listComplaintsForReporter(req.currentUser.id),
    ]);
    send(res, pages.residentHomePage(await view(req, { totals, complaints })));
  }));

  app.get('/more', requireUser, wrap(async (req, res) => {
    send(res, pages.morePage(await view(req)));
  }));

  app.get('/notifications', requireUser, wrap(async (req, res) => {
    const notifications = await data.listNotifications(req.currentUser.id);
    send(res, pages.notificationsPage(await view(req, { notifications })));
  }));

  app.post('/notifications/read', requireUser, requireCsrf, wrap(async (req, res) => {
    await data.markAllRead(req.currentUser.id);
    res.redirect('/notifications');
  }));

  app.get('/profile', requireUser, wrap(async (req, res) => {
    const areas = await data.listAreas();
    let municipalityId = '';
    let wardId = '';
    if (req.currentUser.homeAreaId) {
      const home = await data.findArea(req.currentUser.homeAreaId);
      if (home?.kind === 'ward') {
        wardId = home.id;
        municipalityId = home.parent_id;
      } else if (home) {
        municipalityId = home.id;
      }
    }
    send(res, pages.profilePage(await view(req, { areas, municipalityId, wardId })));
  }));

  app.post('/profile', requireUser, requireCsrf, wrap(async (req, res) => {
    const phone = cleanText(req.body.phone, 40);
    const address = cleanText(req.body.address, 400);
    const fields = { phone, address };
    if (req.currentUser.role === 'Resident') {
      const ward = await data.findArea(paramId(req.body.wardId));
      const municipalityId = paramId(req.body.municipalityId);
      if (!ward || ward.kind !== 'ward' || ward.parent_id !== municipalityId) {
        setFlash(req, 'error', 'Choose a municipality and one of its wards.');
        return res.redirect('/profile');
      }
      fields.homeAreaId = ward.id;
    }
    const newPin = String(req.body.newPin || '');
    if (newPin) {
      if (!isPin(newPin)) {
        setFlash(req, 'error', 'A new PIN must be 4 to 8 digits.');
        return res.redirect('/profile');
      }
      const currentPassword = String(req.body.currentPassword || '');
      const passwordOk = await matches(currentPassword, req.currentUser.passwordHash);
      if (!passwordOk) {
        setFlash(req, 'error', 'Enter your current password to change your PIN.');
        return res.redirect('/profile');
      }
      fields.pinHash = await hashSecret(newPin);
    }
    await data.updateUser(req.currentUser.id, fields);
    setFlash(req, 'success', 'Profile saved.');
    res.redirect('/profile');
  }));

  app.get('/report', requireRoles('Resident'), wrap(async (req, res) => {
    const areas = await data.listAreas();
    let municipalityId = '';
    let wardId = '';
    if (req.currentUser.homeAreaId) {
      const home = await data.findArea(req.currentUser.homeAreaId);
      if (home?.kind === 'ward') {
        wardId = home.id;
        municipalityId = home.parent_id;
      }
    }
    send(res, pages.reportPage(await view(req, {
      areas,
      values: { municipalityId, wardId, address: req.currentUser.address || '' },
    })));
  }));

  function readPhoto(req) {
    if (req.uploadError) return { error: req.uploadError };
    if (!req.file) return { storedName: null, mime: null };
    const mime = sniffImage(req.file.buffer);
    if (!mime || !MIME_EXTENSIONS[mime]) return { error: 'Upload a JPEG, PNG, WEBP, or HEIC photo.' };
    return { storedName: storedPhotoName(mime), mime, buffer: req.file.buffer };
  }

  app.post('/report', requireRoles('Resident'), (req, res, next) => {
    upload.single('photo')(req, res, (err) => {
      if (err && err.code === 'LIMIT_FILE_SIZE') {
        req.uploadError = 'Photos must be 5 MB or smaller.';
        return next();
      }
      if (err) return next(err);
      return next();
    });
  }, requireCsrf, wrap(async (req, res) => {
    const areas = await data.listAreas();
    const values = {
      category: cleanText(req.body.category, 40),
      description: cleanText(req.body.description, 4000),
      address: cleanText(req.body.address, 400),
      municipalityId: paramId(req.body.municipalityId) || '',
      wardId: paramId(req.body.wardId) || '',
      latitude: cleanText(req.body.latitude, 20),
      longitude: cleanText(req.body.longitude, 20),
    };
    const fail = async (text) => send(res, pages.reportPage(await view(req, { areas, values, flash: { type: 'error', text } })), 400);
    if (!CATEGORIES.includes(values.category)) return fail('Choose a category.');
    if (values.description.length < 10) return fail('Describe the problem in a sentence or two.');
    if (values.address.length < 5) return fail('Add the street address.');
    const ward = values.wardId ? await data.findArea(values.wardId) : null;
    const municipality = values.municipalityId ? await data.findArea(values.municipalityId) : null;
    if (!municipality || municipality.kind !== 'municipality' || !ward || ward.kind !== 'ward' || ward.parent_id !== municipality.id) {
      return fail('Choose a municipality and one of its wards.');
    }
    const latitude = parseCoord(values.latitude, -90, 90);
    const longitude = parseCoord(values.longitude, -180, 180);
    if (latitude === undefined || longitude === undefined || (latitude === null) !== (longitude === null)) {
      return fail('Location could not be saved. Try Use my location again, or send the complaint with the street address only.');
    }
    const photo = readPhoto(req);
    if (photo.error) return fail(photo.error);
    if (photo.storedName) {
      await fs.promises.writeFile(path.join(config.uploadDir, photo.storedName), photo.buffer, { mode: 0o640 });
    }
    try {
      const created = await data.createComplaint({
        reporterId: req.currentUser.id,
        category: values.category,
        description: values.description,
        address: values.address,
        municipalityId: municipality.id,
        wardId: ward.id,
        latitude,
        longitude,
        photoStoredName: photo.storedName,
        photoMime: photo.mime,
        placeLabel: `${ward.name}, ${municipality.name}`,
      });
      setFlash(req, 'success', `Complaint ${created.ticketReference} is logged.`);
      res.redirect(`/my-reports/${created.id}`);
    } catch (error) {
      if (photo.storedName) await fs.promises.unlink(path.join(config.uploadDir, photo.storedName)).catch(() => {});
      throw error;
    }
  }));

  app.get('/my-reports', requireRoles('Resident'), wrap(async (req, res) => {
    const complaints = await data.listComplaintsForReporter(req.currentUser.id);
    send(res, pages.myReportsPage(await view(req, { complaints })));
  }));

  app.get('/my-reports/:id', requireRoles('Resident'), wrap(async (req, res) => {
    const complaint = await data.getComplaint(paramId(req.params.id));
    if (!complaint || complaint.reporterId !== req.currentUser.id) {
      return send(res, pages.messagePage(await view(req, { heading: 'Not found', message: 'That complaint is not on your account.' })), 404);
    }
    await data.markComplaintRead(req.currentUser.id, complaint.id);
    const updates = await data.listUpdates(complaint.id);
    send(res, pages.reportDetailPage(await view(req, { complaint, updates })));
  }));

  app.get('/section78', requireRoles('Resident'), wrap(async (req, res) => {
    const previous = await data.listDisputesForResident(req.currentUser.id);
    send(res, pages.section78Page(await view(req, { previous })));
  }));

  app.post('/section78', requireRoles('Resident'), requireCsrf, wrap(async (req, res) => {
    const input = {
      propertyAddress: cleanText(req.body.propertyAddress, 400),
      municipalAccountNumber: cleanText(req.body.municipalAccountNumber, 80),
      erfNumber: cleanText(req.body.erfNumber, 80),
      titleDeedNumber: cleanText(req.body.titleDeedNumber, 80),
      actualDominantUse: cleanText(req.body.actualDominantUse, 200),
      propertyCategoryDispute: cleanText(req.body.propertyCategoryDispute, 200),
      ownerStatement: cleanText(req.body.ownerStatement, 4000),
    };
    if (Object.values(input).some((value) => !value) || req.body.noFormalNotice !== 'yes' || req.body.noSection78Documents !== 'yes' || req.body.consent !== 'yes') {
      setFlash(req, 'error', 'Complete every field and confirm each statement.');
      return res.redirect('/section78');
    }
    let municipalityId = null;
    if (req.currentUser.homeAreaId) {
      const home = await data.findArea(req.currentUser.homeAreaId);
      municipalityId = home?.kind === 'municipality' ? home.id : home?.parent_id || null;
    }
    const created = await data.createDispute({ ...input, residentId: req.currentUser.id, municipalityId });
    setFlash(req, 'success', `Objection ${created.reference} is filed.`);
    res.redirect('/section78');
  }));

  app.get('/complaints', requireRoles('PA Member', 'Admin', 'Server Admin'), wrap(async (req, res) => {
    const status = ['Received', 'In progress', 'Resolved'].includes(req.query.status) ? req.query.status : '';
    const category = CATEGORIES.includes(req.query.category) ? req.query.category : '';
    const scope = await data.scopeForUser(req.currentUser);
    const complaints = await data.listComplaintsForScope(scope, { status, category });
    send(res, pages.complaintsPage(await view(req, { complaints, filters: { status, category } })));
  }));

  app.get('/complaints/:id/photo', wrap(async (req, res) => {
    if (!req.currentUser) return res.status(401).end();
    const complaint = await data.getComplaint(paramId(req.params.id));
    if (!complaint || !complaint.photoStoredName || !isSafePhotoName(complaint.photoStoredName) || !MIME_EXTENSIONS[complaint.photoMime]) {
      return res.status(404).end();
    }
    if (!(await canSee(req.currentUser, complaint))) return res.status(404).end();
    const root = path.resolve(config.uploadDir);
    const filePath = path.resolve(root, complaint.photoStoredName);
    if (path.dirname(filePath) !== root || !fs.existsSync(filePath)) return res.status(404).end();
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.type(complaint.photoMime);
    res.sendFile(complaint.photoStoredName, { root: config.uploadDir, dotfiles: 'deny' });
  }));

  app.get('/complaints/:id', requireRoles('PA Member', 'Admin', 'Server Admin'), wrap(async (req, res) => {
    const complaint = await data.getComplaint(paramId(req.params.id));
    if (!complaint || !(await canSee(req.currentUser, complaint))) {
      return send(res, pages.messagePage(await view(req, { heading: 'Not found', message: 'That complaint is not in your areas.' })), 404);
    }
    await data.markComplaintRead(req.currentUser.id, complaint.id);
    const updates = await data.listUpdates(complaint.id);
    const canEscalate = req.currentUser.role === 'Admin' || req.currentUser.role === 'Server Admin';
    send(res, pages.complaintDetailPage(await view(req, { complaint, updates, canEscalate })));
  }));

  async function loadScopedComplaint(req, res) {
    const complaint = await data.getComplaint(paramId(req.params.id));
    if (!complaint || !(await canSee(req.currentUser, complaint))) {
      send(res, pages.messagePage(await view(req, { heading: 'Not found', message: 'That complaint is not in your areas.' })), 404);
      return null;
    }
    return complaint;
  }

  app.post('/complaints/:id/dispatch', requireRoles('PA Member', 'Admin', 'Server Admin'), requireCsrf, wrap(async (req, res) => {
    const complaint = await loadScopedComplaint(req, res);
    if (!complaint) return;
    if (complaint.status === 'Resolved') {
      setFlash(req, 'error', 'This complaint is already complete.');
      return res.redirect(`/complaints/${complaint.id}`);
    }
    const assignee = cleanText(req.body.assignee, 160);
    if (assignee.length < 2) {
      setFlash(req, 'error', 'Say who was sent.');
      return res.redirect(`/complaints/${complaint.id}`);
    }
    await data.dispatchComplaint(complaint, req.currentUser.id, assignee);
    setFlash(req, 'success', 'Dispatch recorded.');
    res.redirect(`/complaints/${complaint.id}`);
  }));

  app.post('/complaints/:id/complete', requireRoles('PA Member', 'Admin', 'Server Admin'), requireCsrf, wrap(async (req, res) => {
    const complaint = await loadScopedComplaint(req, res);
    if (!complaint) return;
    if (complaint.status === 'Resolved') {
      setFlash(req, 'error', 'This complaint is already complete.');
      return res.redirect(`/complaints/${complaint.id}`);
    }
    await data.completeComplaint(complaint, req.currentUser.id);
    setFlash(req, 'success', 'Complaint marked complete.');
    res.redirect(`/complaints/${complaint.id}`);
  }));

  app.post('/complaints/:id/escalate', requireRoles('Admin', 'Server Admin'), requireCsrf, wrap(async (req, res) => {
    const complaint = await loadScopedComplaint(req, res);
    if (!complaint) return;
    const level = ESCALATIONS.includes(req.body.level) ? req.body.level : '';
    if (!level) {
      setFlash(req, 'error', 'Choose a referral level.');
      return res.redirect(`/complaints/${complaint.id}`);
    }
    await data.escalateComplaint(complaint, req.currentUser.id, level);
    setFlash(req, 'success', 'Referral saved.');
    res.redirect(`/complaints/${complaint.id}`);
  }));

  app.get('/map', requireRoles('PA Member', 'Admin', 'Server Admin'), wrap(async (req, res) => {
    const scope = await data.scopeForUser(req.currentUser);
    const [complaints, counts] = await Promise.all([
      data.listComplaintsForScope(scope),
      data.categoryCounts(scope),
    ]);
    const resolved = complaints.filter((item) => item.status === 'Resolved').length;
    const scopeLabel = req.currentUser.role === 'Server Admin' ? 'All areas' : 'Complaints in your areas';
    send(res, pages.mapPage(await view(req, {
      complaints,
      counts,
      total: complaints.length,
      resolved,
      scopeLabel,
    })));
  }));

  app.get('/rates', requireRoles('Admin', 'Server Admin'), wrap(async (req, res) => {
    const scope = await data.scopeForUser(req.currentUser);
    const disputes = await data.listDisputesForScope(scope);
    send(res, pages.ratesPage(await view(req, { disputes })));
  }));

  async function peopleContext(req) {
    const scope = await data.scopeForUser(req.currentUser);
    const search = cleanText(req.query.q || '', 80);
    const [areas, residents, staff] = await Promise.all([
      data.listAreas(),
      data.listResidents({ scope, search }),
      data.listStaff({ actor: req.currentUser, scope, search: '' }),
    ]);
    const visibleAreas = scope === null ? areas : areas.filter((area) => scope.has(area.id));
    return { scope, search, areas: visibleAreas, residents, staff, showId: req.currentUser.role === 'Server Admin' };
  }

  app.get('/people', requireRoles('Admin', 'Server Admin'), wrap(async (req, res) => {
    send(res, pages.peoplePage(await view(req, await peopleContext(req))));
  }));

  app.post('/people/export', requireRoles('Admin', 'Server Admin'), requireCsrf, wrap(async (req, res) => {
    const scope = await data.scopeForUser(req.currentUser);
    const search = cleanText(req.body.q, 80);
    const residents = await data.listResidents({ scope, search });
    const selected = new Set(idList(req.body.selected));
    const rows = residents.filter((person) => selected.has(person.id));
    if (!rows.length) {
      setFlash(req, 'error', 'Select at least one resident in your areas.');
      return res.redirect(`/people${search ? `?q=${encodeURIComponent(search)}` : ''}`);
    }
    const csv = ['Name,Email,Phone,Municipality,Ward,Address', ...rows.map((person) => [
      person.display_name, person.email, person.phone, person.municipality_name, person.ward_name, person.address,
    ].map(csvCell).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="residents.csv"');
    res.send(`\uFEFF${csv}`);
  }));

  function allowedRoles(actor) {
    return actor.role === 'Server Admin' ? ASSIGNABLE_BY_SERVER_ADMIN : ASSIGNABLE_BY_ADMIN;
  }

  app.post('/people/staff', requireRoles('Admin', 'Server Admin'), requireCsrf, wrap(async (req, res) => {
    const actor = req.currentUser;
    const role = cleanText(req.body.role, 40);
    const fullName = cleanText(req.body.fullName, 120);
    const surname = cleanText(req.body.surname, 120);
    const email = cleanText(req.body.email, 255).toLowerCase();
    const phone = cleanText(req.body.phone, 40);
    const password = String(req.body.password || '');
    const pin = String(req.body.pin || '');
    const requested = idList(req.body.areas);
    const scope = await data.scopeForUser(actor);
    if (!allowedRoles(actor).includes(role)) {
      return send(res, pages.messagePage(await view(req, { heading: 'Not allowed', message: 'You cannot create that role.' })), 403);
    }
    if (!fullName || !surname || !isEmail(email) || password.length < 10 || !isPin(pin)) {
      setFlash(req, 'error', 'Name, email, a 10-character password, and a 4 to 8 digit PIN are required.');
      return res.redirect('/people');
    }
    if (role !== 'Server Admin' && !requested.length) {
      setFlash(req, 'error', 'Choose at least one area for this account.');
      return res.redirect('/people');
    }
    if (scope !== null && requested.some((id) => !scope.has(id))) {
      return send(res, pages.messagePage(await view(req, { heading: 'Not allowed', message: 'You can only assign areas you cover.' })), 403);
    }
    const known = await data.listAreas();
    if (requested.some((id) => !known.some((area) => area.id === id))) {
      setFlash(req, 'error', 'One of those areas does not exist.');
      return res.redirect('/people');
    }
    if (await data.findUserByEmail(email)) {
      setFlash(req, 'error', 'That email is already registered.');
      return res.redirect('/people');
    }
    await data.createUser({
      email,
      passwordHash: await hashSecret(password),
      pinHash: await hashSecret(pin),
      displayName: `${fullName} ${surname}`,
      fullName,
      surname,
      phone,
      role,
      consentGiven: false,
    }, role === 'Server Admin' ? requested : requested);
    setFlash(req, 'success', 'Staff account created.');
    res.redirect('/people');
  }));

  app.post('/people/staff/:id', requireRoles('Admin', 'Server Admin'), requireCsrf, wrap(async (req, res) => {
    const actor = req.currentUser;
    const target = await data.findUserById(paramId(req.params.id));
    if (!target || target.role === 'Resident') {
      return send(res, pages.messagePage(await view(req, { heading: 'Not found', message: 'That staff account was not found.' })), 404);
    }
    const scope = await data.scopeForUser(actor);
    const existingAreas = await data.areaIdsForUser(target.id);
    if (actor.role !== 'Server Admin') {
      if (target.role === 'Server Admin' || !existingAreas.some((id) => scope.has(id))) {
        return send(res, pages.messagePage(await view(req, { heading: 'Not allowed', message: 'You cannot edit that account.' })), 403);
      }
    }
    const role = cleanText(req.body.role, 40);
    if (!allowedRoles(actor).includes(role) || (role === 'Server Admin' && actor.role !== 'Server Admin')) {
      return send(res, pages.messagePage(await view(req, { heading: 'Not allowed', message: 'You cannot assign that role.' })), 403);
    }
    if (target.role === 'Server Admin' && role !== 'Server Admin' && await data.countServerAdmins() <= 1) {
      setFlash(req, 'error', 'Keep at least one server admin.');
      return res.redirect('/people');
    }
    const requested = idList(req.body.areas);
    if (scope !== null && requested.some((id) => !scope.has(id))) {
      return send(res, pages.messagePage(await view(req, { heading: 'Not allowed', message: 'You can only assign areas you cover.' })), 403);
    }
    if (role !== 'Server Admin' && !requested.length && !(scope !== null && existingAreas.some((id) => !scope.has(id)))) {
      setFlash(req, 'error', 'Choose at least one area.');
      return res.redirect('/people');
    }
    const displayName = cleanText(req.body.displayName, 200);
    if (!displayName) {
      setFlash(req, 'error', 'Name is required.');
      return res.redirect('/people');
    }
    const fields = { displayName, phone: cleanText(req.body.phone, 40), role };
    const password = String(req.body.password || '');
    const pin = String(req.body.pin || '');
    if (password) {
      if (password.length < 10) {
        setFlash(req, 'error', 'A new password must be at least 10 characters.');
        return res.redirect('/people');
      }
      fields.passwordHash = await hashSecret(password);
    }
    if (pin) {
      if (!isPin(pin)) {
        setFlash(req, 'error', 'A new PIN must be 4 to 8 digits.');
        return res.redirect('/people');
      }
      fields.pinHash = await hashSecret(pin);
    }
    await data.updateUser(target.id, fields);
    const preserved = scope === null ? [] : existingAreas.filter((id) => !scope.has(id));
    await data.replaceUserAreas(target.id, [...preserved, ...requested]);
    setFlash(req, 'success', 'Staff account saved.');
    res.redirect('/people');
  }));

  app.get('/settings', requireRoles('Server Admin'), wrap(async (req, res) => {
    send(res, pages.settingsPage(await view(req, { areas: await data.listAreas() })));
  }));

  app.post('/settings', requireRoles('Server Admin'), requireCsrf, wrap(async (req, res) => {
    const siteName = cleanText(req.body.siteName, 160);
    const whatsappLink = cleanHttpUrl(req.body.whatsappLink);
    const mapsKey = cleanText(req.body.mapsKey, 200);
    if (!siteName || whatsappLink === null) {
      setFlash(req, 'error', 'Check the site name and WhatsApp link.');
      return res.redirect('/settings');
    }
    await data.updateSettings({ siteName, whatsappLink, mapsKey });
    setFlash(req, 'success', 'Settings saved.');
    res.redirect('/settings');
  }));

  app.post('/settings/areas', requireRoles('Server Admin'), requireCsrf, wrap(async (req, res) => {
    const kind = req.body.kind === 'ward' ? 'ward' : req.body.kind === 'municipality' ? 'municipality' : '';
    const name = cleanText(req.body.name, 160);
    if (!kind || name.length < 2) {
      setFlash(req, 'error', 'Enter an area name.');
      return res.redirect('/settings');
    }
    let parentId = null;
    if (kind === 'ward') {
      const parent = await data.findArea(paramId(req.body.parentId));
      if (!parent || parent.kind !== 'municipality') {
        setFlash(req, 'error', 'Choose the municipality for this ward.');
        return res.redirect('/settings');
      }
      parentId = parent.id;
    }
    try {
      await data.createArea({ name, kind, parentId });
      setFlash(req, 'success', 'Area added.');
    } catch (error) {
      if (error && error.code === 'ER_DUP_ENTRY') setFlash(req, 'error', 'That area already exists.');
      else throw error;
    }
    res.redirect('/settings');
  }));

  app.get('/api/notifications', requireUser, wrap(async (req, res) => {
    const notifications = await data.listNotifications(req.currentUser.id);
    res.json({
      unread: await data.unreadCount(req.currentUser.id),
      notifications: notifications.map((item) => ({
        id: item.id,
        complaintId: item.complaint_id,
        message: item.message,
        read: Boolean(item.read_at),
        createdAt: item.created_at,
      })),
    });
  }));

  app.get('/api/complaints', requireUser, wrap(async (req, res) => {
    if (req.currentUser.role === 'Resident') {
      const complaints = await data.listComplaintsForReporter(req.currentUser.id);
      return res.json({
        complaints: complaints.map((item) => ({
          id: item.id,
          ticketReference: item.ticketReference,
          category: item.category,
          status: item.status,
          address: item.address,
          municipality: item.municipalityName,
          ward: item.wardName,
          createdAt: item.createdAt,
          hasPhoto: Boolean(item.photoStoredName),
        })),
      });
    }
    if (!['PA Member', 'Admin', 'Server Admin'].includes(req.currentUser.role)) {
      return res.status(403).json({ message: 'You cannot open that.' });
    }
    const scope = await data.scopeForUser(req.currentUser);
    const complaints = await data.listComplaintsForScope(scope);
    return res.json({
      complaints: complaints.map((item) => ({
        id: item.id,
        ticketReference: item.ticketReference,
        category: item.category,
        description: item.description,
        status: item.status,
        address: item.address,
        municipality: item.municipalityName,
        ward: item.wardName,
        latitude: item.latitude,
        longitude: item.longitude,
        hasPhoto: Boolean(item.photoStoredName),
        assignee: item.assigneeLabel,
        createdAt: item.createdAt,
      })),
    });
  }));

  app.post('/api/complaints', requireRoles('Resident'), requireCsrf, wrap(async (req, res) => {
    const category = cleanText(req.body.category, 40);
    const description = cleanText(req.body.description, 4000);
    const address = cleanText(req.body.address, 400);
    const municipality = await data.findArea(paramId(req.body.municipalityId));
    const ward = await data.findArea(paramId(req.body.wardId));
    const latitude = parseCoord(req.body.latitude, -90, 90);
    const longitude = parseCoord(req.body.longitude, -180, 180);
    if (!CATEGORIES.includes(category) || description.length < 10 || address.length < 5 || !municipality || municipality.kind !== 'municipality' || !ward || ward.parent_id !== municipality.id || latitude === undefined || longitude === undefined || (latitude === null) !== (longitude === null)) {
      return res.status(400).json({ message: 'Check the category, description, address, and area.' });
    }
    const created = await data.createComplaint({
      reporterId: req.currentUser.id,
      category,
      description,
      address,
      municipalityId: municipality.id,
      wardId: ward.id,
      latitude,
      longitude,
      photoStoredName: null,
      photoMime: null,
      placeLabel: `${ward.name}, ${municipality.name}`,
    });
    res.status(201).json(created);
  }));

  const legacy = {
    '/dashboard': '/',
    '/stats-hub': '/map',
    '/command-view': '/complaints',
    '/incident-management': '/complaints',
    '/resident-management': '/people',
    '/user-management': '/people',
    '/staff-management': '/people',
    '/residents': '/people',
    '/setup': '/settings',
    '/report-incident': '/report',
    '/section78-dispute': '/section78',
    '/edit-my-user': '/profile',
  };
  app.get(Object.keys(legacy), requireUser, (req, res) => {
    res.redirect(legacy[req.path]);
  });

  app.use((req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ message: 'Not found.' });
    return send(res, pages.messagePage({
      settings: req.siteSettings,
      user: req.currentUser,
      heading: 'Page not found',
      message: 'That page is not part of PA At Work.',
      extra: req.currentUser ? '<p><a href="/">Back</a></p>' : '<p><a href="/login">Sign in</a></p>',
    }), 404);
  });

  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    console.error(err && err.message ? err.message : 'Request failed');
    if (req.path.startsWith('/api/')) return res.status(500).json({ message: 'Something went wrong.' });
    return send(res, pages.messagePage({
      settings: req.siteSettings || { site_name: 'PA At Work' },
      user: req.currentUser || null,
      heading: 'Something went wrong',
      message: 'The page could not be completed. Try again.',
    }), 500);
  });

  return app;
}

module.exports = { createApp };
