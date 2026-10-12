const express = require('express');
const session = require('express-session');

const app = express();
const port = process.env.PORT || 3000;
const loginPath = '/login';
const publicPaths = new Set(['/styles/site.css']);
const users = [
  {
    emailAddress: 'jeanmari@thesolution.co.za',
    password: 'Foktogbokka',
    displayName: 'Jeanmari Administrator',
    role: 'Server Admin'
  },
  {
    emailAddress: 'jean@thesolution.co.za',
    password: '888@JP',
    displayName: 'Jean Administrator',
    role: 'Server Admin'
  },
  {
    emailAddress: 'admin@pa.local',
    password: 'Password123!',
    displayName: 'Admin Example',
    role: 'Admin'
  },
  {
    emailAddress: 'pamember@pa.local',
    password: 'Password123!',
    displayName: 'PA Member Example',
    role: 'PA Member'
  },
  {
    emailAddress: 'resident@pa.local',
    password: 'Password123!',
    displayName: 'Resident Example',
    role: 'Resident'
  }
];

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'pa-infrastructure-portal',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax'
  }
}));

app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  next();
});

app.use((req, res, next) => {
  if (publicPaths.has(req.path) || req.path.startsWith('/styles/')) {
    next();
    return;
  }

  if (req.path === '/logout') {
    next();
    return;
  }

  if (req.path === loginPath) {
    next();
    return;
  }

  if (!req.session.user) {
    res.redirect(`${loginPath}?returnUrl=${encodeURIComponent(req.originalUrl)}`);
    return;
  }

  next();
});

function buildMenuItems(user) {
  const role = user?.role || '';
  const items = [
    { href: '/', label: 'Dashboard' },
    { href: '/privacy', label: 'Compliance' }
  ];

  if (role === 'Server Admin' || role === 'Admin' || role === 'PA Member') {
    items.splice(1, 0,
      { href: '/command-view', label: 'PA Oversight Tab' },
      { href: '/stats-hub', label: 'Stats Hub' },
      { href: '/residents', label: 'Residents List Export' }
    );
  }

  if (role === 'Server Admin') {
    items.splice(4, 0, { href: '/setup', label: 'System Configuration' });
  }

  return items;
}

function navMarkup(user) {
  const menuLinks = buildMenuItems(user)
    .map((item) => `<a href="${item.href}">${item.label}</a>`)
    .join('');

  return `
    <div class="site-nav-wrap">
      <div class="site-profile-badge">${user.displayName} (${user.role})</div>
      <div class="site-clock" id="siteClock"></div>
      <details class="site-menu">
        <summary class="site-menu-toggle">Portal Menu</summary>
        <div class="site-menu-panel">
          ${menuLinks}
          <form method="post" action="/logout" class="site-menu-form">
            <button type="submit">Sign Out</button>
          </form>
        </div>
      </details>
    </div>`;
}

function pageShell(title, body, options = {}) {
  const authenticated = Boolean(options.authenticated);
  const headerContent = authenticated
    ? navMarkup(options.user)
    : `<nav class="site-nav"><a href="/login">Sign In</a></nav>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <link rel="stylesheet" href="/styles/site.css">
</head>
<body>
  <header class="site-header">
    <div class="site-header-inner">
      <div class="site-brand">PA Infrastructure Portal</div>
      ${headerContent}
    </div>
  </header>
  <main class="site-main">
    ${body}
  </main>
  <footer class="site-footer">
    <div class="site-footer-inner">
      <small>Node.js version for cPanel deployment</small>
      <small>POPIA Compliant Data System</small>
    </div>
  </footer>
  <script>
    (function () {
      const clock = document.getElementById('siteClock');
      if (!clock) return;
      const tick = () => {
        clock.textContent = new Date().toLocaleString('en-ZA', {
          weekday: 'short', year: 'numeric', month: 'short', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
        });
      };
      tick();
      setInterval(tick, 1000);
    })();
  </script>
</body>
</html>`;
}

function sendPage(res, title, body, status = 200, options = {}) {
  res.status(status).type('html').send(pageShell(title, body, options));
}

function portalBody(title, intro, cards = '', extra = '') {
  return `
    <section class="hero-block">
      <h1>${title}</h1>
      <p class="muted">${intro}</p>
    </section>
    ${cards}
    ${extra}
  `;
}

function loginBody(notice = '', returnUrl = '/dashboard') {
  return `
    <section class="auth-shell" style="max-width: 460px; margin: 0 auto;">
      <h1 style="margin-top: 0;">Portal Sign In</h1>
      <p class="muted">Use your assigned portal account to continue.</p>
      ${notice ? `<div class="notice-info">${notice}</div>` : ''}
      <form method="post" action="/login">
        <input type="hidden" name="returnUrl" value="${returnUrl}">
        <div style="display:grid; gap: 1rem;">
          <div>
            <label>Email Address</label>
            <input class="form-control" type="email" name="emailAddress" placeholder="jeanmari@thesolution.co.za" required>
          </div>
          <div>
            <label>Password</label>
            <input class="form-control" type="password" name="password" placeholder="Your password" required>
          </div>
        </div>
        <p style="margin-top: 1rem;"><button class="btn" type="submit">Sign In</button></p>
      </form>
    </section>`;
}

function requireLogin(req, res, next) {
  if (!req.session.user) {
    res.redirect(`${loginPath}?returnUrl=${encodeURIComponent(req.originalUrl)}`);
    return;
  }

  next();
}

function requireRole(allowedRoles, redirectTarget = '/dashboard') {
  return (req, res, next) => {
    if (!req.session.user) {
      res.redirect(`${loginPath}?returnUrl=${encodeURIComponent(req.originalUrl)}`);
      return;
    }

    if (!allowedRoles.includes(req.session.user.role)) {
      res.redirect(redirectTarget);
      return;
    }

    next();
  };
}

app.get('/', requireLogin, (req, res) => {
  const cards = `
    <section class="grid" style="margin-top: 1rem;">
      <section class="panel">
        <h2>Localized Sector</h2>
        <p>Randfontein municipal support and complaint routing.</p>
      </section>
      <section class="panel">
        <h2>Service Queue</h2>
        <p>Review logged faults, resolved issues, and follow-up items.</p>
      </section>
      <section class="panel">
        <h2>Resident Access</h2>
        <p>Resident records, exports, and portal access are available here.</p>
      </section>
    </section>
    <section class="panel" style="margin-top: 1rem;">
      <h2>Live Queue</h2>
      <p><strong>Logged:</strong> 0</p>
      <p><strong>Resolved:</strong> 0</p>
      <p><strong>Pending:</strong> 0</p>
    </section>`;

  sendPage(res, 'PA Infrastructure Portal', portalBody('Good Day, Leader. Let\'s fix Randfontein together.', 'You are signed in and viewing the portal dashboard.', cards), 200, { authenticated: true, user: req.session.user });
});

app.get('/dashboard', requireLogin, (req, res) => {
  const cards = `
    <section class="grid" style="margin-top: 1rem;">
      <section class="panel"><h2>Logged Complaints</h2><p>0</p></section>
      <section class="panel"><h2>Resolved</h2><p>0</p></section>
      <section class="panel"><h2>Pending</h2><p>0</p></section>
    </section>`;

  sendPage(res, 'Dashboard', portalBody('Resident Dashboard', 'This is the main landing page after login.', cards), 200, { authenticated: true, user: req.session.user });
});

app.get('/privacy', requireLogin, (req, res) => sendPage(res, 'Privacy Policy', portalBody('Privacy Policy', 'Use this page to detail your site\'s privacy policy.', '<section class="panel" style="margin-top: 1rem;"><p>This is the Node.js version of the privacy page.</p></section>'), 200, { authenticated: true, user: req.session.user }));

app.get('/login', (req, res) => {
  if (req.session.user) {
    res.redirect('/dashboard');
    return;
  }

  sendPage(res, 'Sign In', loginBody('', req.query.returnUrl || '/dashboard'), 200, { authenticated: false });
});

app.post('/login', (req, res) => {
  const email = String(req.body.emailAddress || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const returnUrl = String(req.body.returnUrl || '/dashboard');
  const user = users.find((entry) => entry.emailAddress.toLowerCase() === email && entry.password === password);

  if (!user) {
    sendPage(res, 'Sign In', loginBody('Invalid login attempt.', returnUrl), 401, { authenticated: false });
    return;
  }

  req.session.user = {
    emailAddress: user.emailAddress,
    displayName: user.displayName,
    role: user.role
  };

  const safeRedirect = returnUrl.startsWith('/') ? returnUrl : '/dashboard';
  res.redirect(safeRedirect);
});

app.post('/logout', requireLogin, (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

app.get('/register', requireLogin, (req, res) => {
  const body = `
    <section class="hero-block">
      <h1>Resident Registration</h1>
      <p class="muted">This page mirrors the earlier portal structure and can be expanded for full account creation.</p>
    </section>
    <section class="auth-shell" style="margin-top: 1rem;">
      <form method="post" action="/register">
        <div class="grid">
          <div><label>Username</label><input class="form-control" name="username"></div>
          <div><label>Email Address</label><input class="form-control" type="email" name="emailAddress"></div>
          <div><label>First Name</label><input class="form-control" name="firstName"></div>
          <div><label>Last Name</label><input class="form-control" name="lastName"></div>
        </div>
        <p style="margin-top: 1rem;"><button class="btn" type="submit">Register</button></p>
      </form>
    </section>`;

  sendPage(res, 'Resident Registration', body, 200, { authenticated: true, user: req.session.user });
});

app.post('/register', requireLogin, (req, res) => {
  sendPage(res, 'Resident Registration', `${portalBody('Resident Registration', 'Registration is a placeholder in this Node.js build.', '<section class="panel" style="margin-top: 1rem;"><p>Registration is available in this Node.js shell and can be connected later.</p></section>')}`, 200, { authenticated: true, user: req.session.user });
});

app.get('/setup', requireRole(['Server Admin']), (req, res) => {
  const body = `
    <section class="hero-block">
      <h1>Setup</h1>
      <p class="muted">This page is ready for future configuration work if you want to add persistence.</p>
    </section>
    <section class="auth-shell" style="margin-top: 1rem;">
      <form method="post" action="/setup">
        <div class="grid">
          <div><label>Environment Name</label><input class="form-control" name="environmentName" value="production"></div>
          <div><label>Site Name</label><input class="form-control" name="siteName" value="PA Infrastructure Portal"></div>
        </div>
        <p style="margin-top: 1rem;"><button class="btn" type="submit">Save Setup</button></p>
      </form>
    </section>`;

  sendPage(res, 'Setup', body, 200, { authenticated: true, user: req.session.user });
});

app.post('/setup', requireRole(['Server Admin']), (req, res) => {
  const body = `
    <section class="hero-block">
      <h1>Setup</h1>
      <p class="muted">Setup completed in the current Node.js shell.</p>
    </section>
    <section class="notice-success" style="margin-top: 1rem;">Configuration saved successfully.</section>`;

  sendPage(res, 'Setup', body, 200, { authenticated: true, user: req.session.user });
});

app.get('/residents', requireRole(['Server Admin', 'Admin', 'PA Member']), (req, res) => sendPage(res, 'Residents Directory', portalBody('Residents Directory', 'This page is the Node.js placeholder for resident management and export features.', '<section class="panel" style="margin-top: 1rem;"><p>No resident data is loaded yet in this Node.js phase.</p></section>'), 200, { authenticated: true, user: req.session.user }));

app.get('/command-view', requireRole(['Server Admin', 'Admin', 'PA Member']), (req, res) => sendPage(res, 'Councillor & MMC Oversight', portalBody('Councillor & MMC Oversight', 'Operational oversight content can be connected here in the next iteration.', '<section class="grid" style="margin-top: 1rem;"><div class="panel"><h2>Workflow</h2><p>Placeholder for dispatch and inspection actions.</p></div><div class="panel"><h2>Status</h2><p>Placeholder for complaint status updates.</p></div></section>'), 200, { authenticated: true, user: req.session.user }));

app.get('/stats-hub', requireRole(['Server Admin', 'Admin', 'PA Member']), (req, res) => sendPage(res, 'Public Live Statistics Hub', portalBody('Public Live Statistics Hub', 'The live stats hub is available as a Node.js page.', '<section class="grid" style="margin-top: 1rem;"><div class="panel"><h2>Total Issues</h2><p>0</p></div><div class="panel"><h2>Electrical</h2><p>0</p></div><div class="panel"><h2>Roads</h2><p>0</p></div><div class="panel"><h2>Water</h2><p>0</p></div></section>'), 200, { authenticated: true, user: req.session.user }));

app.use((req, res) => {
  if (!req.session.user) {
    res.redirect(`${loginPath}?returnUrl=${encodeURIComponent(req.originalUrl)}`);
    return;
  }

  sendPage(res, 'Not Found', `<section class="hero-block"><h1>404</h1><p>Page not found: <strong>${req.path}</strong></p></section>`, 404, { authenticated: true, user: req.session.user });
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
