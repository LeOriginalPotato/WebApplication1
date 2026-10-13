const express = require('express');
const session = require('express-session');

const app = express();
const port = process.env.PORT || 3000;
const loginPath = '/login';
const whatsappImportWebhookPath = '/api/webhooks/whatsapp-import';
const importWebhookToken = process.env.WHATSAPP_IMPORT_WEBHOOK_TOKEN || '';
const publicPaths = new Set(['/styles/site.css']);
const systemConfiguration = {
  environmentName: 'production',
  siteName: 'PA Infrastructure Portal',
  whatsAppChatLink: 'https://wa.me/0000000000'
};
const incidents = [];
const section78Disputes = [];
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
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.text({ type: ['text/plain', 'text/*'], limit: '5mb' }));
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

  if (req.path === whatsappImportWebhookPath) {
    next();
    return;
  }

  if (req.path === loginPath || req.path === '/register') {
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
  const isStaff = role === 'Server Admin' || role === 'Admin' || role === 'PA Member';
  const isAdmin = role === 'Server Admin' || role === 'Admin';

  if (role === 'Resident') {
    return [
      { href: '/dashboard', label: 'Dashboard' },
      { href: '/report-incident', label: 'Report Infrastructure Failure' },
      { href: '/section78-dispute', label: 'Section 78 Dispute' },
      { href: '/edit-my-user', label: 'Edit My User' },
      { href: '/privacy', label: 'Compliance' }
    ];
  }

  const items = [
    { href: '/dashboard', label: 'Dashboard' }
  ];

  if (isStaff) {
    items.push(
      { href: '/stats-hub', label: 'Stats Hub' },
      { href: '/command-view', label: 'PA Oversight Tab' }
    );
  }

  if (isAdmin) {
    items.push(
      { href: '/create-admin-user', label: 'Create Admin/PA User' },
      { href: '/staff-management', label: 'Staff Management' },
      { href: '/resident-management', label: 'Resident Management' }
    );
  }

  if (role === 'Server Admin') {
    items.push({ href: '/setup', label: 'System Configuration' });
  }

  if (isStaff) {
    items.push({ href: '/residents-export', label: 'Residents List Export' });
  }

  items.push(
    { href: '/edit-my-user', label: 'Edit My User' },
    { href: '/privacy', label: 'Compliance' }
  );

  return items;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function requireImportWebhook(req, res, next) {
  if (!importWebhookToken) {
    res.status(503).json({
      message: 'Webhook token is not configured. Set WHATSAPP_IMPORT_WEBHOOK_TOKEN first.'
    });
    return;
  }

  const authHeader = String(req.headers.authorization || '').trim();
  const tokenFromHeader = authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : '';

  if (!tokenFromHeader || tokenFromHeader !== importWebhookToken) {
    res.status(401).json({ message: 'Unauthorized webhook request.' });
    return;
  }

  next();
}

function scrubWhatsAppChatText(raw) {
  const source = String(raw || '');
  let scrubbed = source;

  scrubbed = scrubbed.replace(/\+27\s?\d{2}\s?\d{3}\s?\d{4}/g, '[REDACTED_PHONE]');
  scrubbed = scrubbed.replace(/\+27\d{9}/g, '[REDACTED_PHONE]');
  scrubbed = scrubbed.replace(/\b0\d{2}\s?\d{3}\s?\d{4}\b/g, '[REDACTED_PHONE]');

  scrubbed = scrubbed.replace(
    /(\b(?:street|st\.?|road|rd\.?|avenue|ave\.?|lane|ln\.?|drive|dr\.?|court|ct\.?|close|crescent|erf|stand|plot|holding)\s+)(\d+[a-zA-Z0-9/-]*)/gi,
    '$1[REDACTED_STREET_NUMBER]'
  );

  scrubbed = scrubbed.replace(
    /(^|\n)(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4},?\s+\d{1,2}:\d{2}(?:\s?[ap]m)?\s+-\s+)([^:]{2,60})(:)/gi,
    '$1$2[REDACTED_NAME]$4'
  );

  scrubbed = scrubbed.replace(/\b(?:Mr|Mrs|Ms|Miss|Dr|Prof)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g, '[REDACTED_NAME]');

  return scrubbed;
}

function buildWhatsAppAnalyticsPrompt() {
  return [
    'You are a municipal service-delivery analytics engine for Randfontein.',
    'Input is a scrubbed WhatsApp export text file where personal names, phone numbers, and street numbers must remain ignored.',
    'Identify distinct service-delivery complaints and group them into localized categories.',
    'Use only these categories: Electrical, Roads, Water, Environmental, TaxIncrease, Other.',
    'Return only valid JSON with keys: TotalComplaints, CategoryCounts, LocalityCounts, SummaryNote.',
    'CategoryCounts must be an object with category names as keys and numeric counts as values.',
    'LocalityCounts must be an object keyed by locality/ward names when inferable from the text.',
    'Do not include markdown, code fences, analysis text, or extra keys.'
  ].join(' ');
}

function buildFallbackComplaintStats(scrubbedText) {
  const categoryPatterns = {
    Electrical: /\b(power|electricity|transformer|load\s?shedding|substation|blackout|cable)\b/gi,
    Roads: /\b(pothole|road|tar|traffic\s?light|bridge|stormwater|drainage)\b/gi,
    Water: /\b(water|pipe|leak|sewer|sanitation|burst|tap)\b/gi,
    Environmental: /\b(refuse|waste|dump|landfill|pollution|smoke|air\s?quality)\b/gi,
    TaxIncrease: /\b(rate\s?increase|tax\s?increase|valuation|billing|municipal\s?account)\b/gi,
    Other: /\b(complaint|issue|problem|service)\b/gi
  };

  const localityPatterns = {
    Randfontein: /\brandfontein\b/gi,
    Mohlakeng: /\bmohlakeng\b/gi,
    'Rural Holdings': /\brural\s+holdings\b/gi,
    'CBD Core': /\bcbd\b|\bcbd\s+core\b/gi
  };

  const categoryCounts = Object.fromEntries(
    Object.entries(categoryPatterns).map(([category, pattern]) => [category, (scrubbedText.match(pattern) || []).length])
  );

  const localityCounts = Object.fromEntries(
    Object.entries(localityPatterns).map(([locality, pattern]) => [locality, (scrubbedText.match(pattern) || []).length])
  );

  const totalComplaints = Object.values(categoryCounts).reduce((sum, value) => sum + value, 0);

  return {
    TotalComplaints: totalComplaints,
    CategoryCounts: categoryCounts,
    LocalityCounts: localityCounts,
    SummaryNote: 'Fallback parser stats were used. Configure OPENAI_API_KEY to enable GPT-4o analytics output.'
  };
}

async function runWhatsAppAnalytics(scrubbedText) {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) {
    return {
      model: 'fallback-parser',
      prompt: buildWhatsAppAnalyticsPrompt(),
      result: buildFallbackComplaintStats(scrubbedText)
    };
  }

  const endpoint = String(process.env.OPENAI_ENDPOINT || 'https://api.openai.com/v1/chat/completions').trim();
  const deployment = String(process.env.AZURE_OPENAI_DEPLOYMENT || '').trim();
  const isAzure = endpoint.includes('.openai.azure.com');

  const systemPrompt = buildWhatsAppAnalyticsPrompt();
  const requestBody = {
    model: process.env.OPENAI_MODEL || 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: scrubbedText }
    ],
    temperature: 0.1,
    response_format: { type: 'json_object' }
  };

  let requestUrl = endpoint;
  const headers = { 'Content-Type': 'application/json' };

  if (isAzure) {
    const apiVersion = String(process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview').trim();
    const deploymentName = deployment || process.env.OPENAI_MODEL || 'gpt-4o';
    requestUrl = `${endpoint.replace(/\/$/, '')}/openai/deployments/${deploymentName}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;
    headers['api-key'] = apiKey;
    delete requestBody.model;
  } else {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(requestUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`LLM request failed (${response.status}): ${details}`);
  }

  const completion = await response.json();
  const content = completion?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('LLM returned an empty analytics payload.');
  }

  return {
    model: isAzure ? `azure:${deployment || requestBody.model || 'gpt-4o'}` : requestBody.model,
    prompt: systemPrompt,
    result: JSON.parse(content)
  };
}

function navMarkup(user) {
  const menuLinks = buildMenuItems(user)
    .map((item) => `<a href="${item.href}">${item.label}</a>`)
    .join('');

  return `
    <div class="site-nav-wrap">
      <a class="site-whatsapp-button" href="${escapeHtml(systemConfiguration.whatsAppChatLink)}" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp chat link">WhatsApp</a>
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

function renderIncidentRows() {
  return incidents
    .slice()
    .reverse()
    .slice(0, 20)
    .map((incident) => `
      <tr>
        <td>${escapeHtml(incident.ticketReference)}</td>
        <td>${escapeHtml(incident.reporterName)}</td>
        <td>${escapeHtml(incident.category)}</td>
        <td>${escapeHtml(incident.locationLabel)}</td>
        <td>${escapeHtml(`${incident.latitude}, ${incident.longitude}`)}</td>
        <td>${incident.photoDataUrl ? '<a href="' + escapeHtml(incident.photoDataUrl) + '" target="_blank" rel="noopener noreferrer">View Photo</a>' : '-'}</td>
      </tr>`)
    .join('') || '<tr><td colspan="6">No incidents logged yet.</td></tr>';
}

function renderResidentQueueRows(user) {
  return incidents
    .filter((entry) => entry.reporterEmail === user.emailAddress)
    .slice()
    .reverse()
    .slice(0, 15)
    .map((entry) => `
      <li class="ticket-item">
        <div>
          <div class="ticket-ref">${escapeHtml(entry.ticketReference)}</div>
          <div class="ticket-date">${escapeHtml(entry.category)} · ${escapeHtml(entry.locationLabel)}</div>
          <div class="ticket-date">${escapeHtml(new Date(entry.createdAt).toLocaleString('en-ZA'))}</div>
        </div>
        <span class="status-pill status-${escapeHtml((entry.status || 'logged').toLowerCase())}">${escapeHtml(entry.status || 'Logged')}</span>
      </li>`)
    .join('') || '<li class="ticket-item"><div class="ticket-date">No complaints logged yet.</div></li>';
}

function buildResidentDashboardBody(user) {
  const firstName = (String(user.displayName || '').split(' ')[0] || 'Leader');
  const queueItems = renderResidentQueueRows(user);

  return `
    <section class="hero-block resident-hero">
      <h1>Good Day, ${escapeHtml(firstName)}. Let's fix Randfontein together.</h1>
      <section class="sector-grid">
        <article class="sector-item">
          <span class="sector-label">Localized Sector</span>
          <strong>Mohlakeng / Rural Holdings Desk</strong>
        </article>
        <article class="sector-item">
          <span class="sector-label">Operations Window</span>
          <strong>Weekend Complaint Consolidation Active</strong>
        </article>
      </section>
    </section>

    <section class="action-grid">
      <article class="action-card">
        <h2>🚨 Report Infrastructure Failure</h2>
        <p>Log urgent municipal infrastructure issues with geolocation and proof attachment.</p>
        <a class="btn" href="/report-incident">Open Report Form</a>
      </article>
      <article class="action-card">
        <h2>Mass Rates Objection Portal</h2>
        <p>Submit a structural Section 78 dispute for incorrect municipal categorization and valuation impacts.</p>
        <div class="check-wrap">
          <label class="form-check-row"><input type="checkbox" checked disabled> I confirm that I did not receive a formal municipal reclassification notice.</label>
          <label class="form-check-row"><input type="checkbox" checked disabled> I confirm that no lawful Section 78 prior engagement documents were delivered to my address.</label>
        </div>
        <a class="btn" href="/section78-dispute">File Section 78 Dispute</a>
      </article>
    </section>

    <section class="queue-card">
      <h2>My Live Action Queue</h2>
      <ul class="ticket-list">${queueItems}</ul>
    </section>`;
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
      <p class="muted" style="margin-top: 1rem;">No resident account yet?</p>
      <p><a class="btn" href="/register">Create Resident Account</a></p>
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
  const user = req.session.user;
  const isResident = user.role === 'Resident';

  if (isResident) {
    sendPage(res, 'Resident Dashboard', buildResidentDashboardBody(user), 200, { authenticated: true, user });
    return;
  }

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
      <p><strong>Logged:</strong> ${incidents.filter((entry) => String(entry.status || 'Logged').toLowerCase() === 'logged').length}</p>
      <p><strong>Resolved:</strong> ${incidents.filter((entry) => String(entry.status || '').toLowerCase() === 'resolved').length}</p>
      <p><strong>Pending:</strong> ${incidents.filter((entry) => String(entry.status || '').toLowerCase() === 'pending').length}</p>
    </section>`;

  sendPage(res, 'PA Infrastructure Portal', portalBody('Good Day, Leader. Let\'s fix Randfontein together.', 'You are signed in and viewing the portal dashboard.', cards), 200, { authenticated: true, user });
});

app.get('/dashboard', requireLogin, (req, res) => {
  const user = req.session.user;
  if (user.role === 'Resident') {
    sendPage(res, 'Resident Dashboard', buildResidentDashboardBody(user), 200, { authenticated: true, user });
    return;
  }

  const cards = `
    <section class="grid" style="margin-top: 1rem;">
      <section class="panel"><h2>Logged Complaints</h2><p>${incidents.filter((entry) => String(entry.status || 'Logged').toLowerCase() === 'logged').length}</p></section>
      <section class="panel"><h2>Resolved</h2><p>${incidents.filter((entry) => String(entry.status || '').toLowerCase() === 'resolved').length}</p></section>
      <section class="panel"><h2>Pending</h2><p>${incidents.filter((entry) => String(entry.status || '').toLowerCase() === 'pending').length}</p></section>
    </section>`;

  sendPage(res, 'Dashboard', portalBody('Staff Dashboard', 'This is the main landing page after login.', cards), 200, { authenticated: true, user });
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

app.get('/register', (req, res) => {
  const body = `
    <section class="hero-block">
      <h1>Resident Registration</h1>
      <p class="muted">Create a portal account with the details your municipality needs.</p>
    </section>
    <section class="auth-shell" style="margin-top: 1rem;">
      <form method="post" action="/register">
        <div class="grid">
          <div><label>Full Name</label><input class="form-control" name="fullName" required></div>
          <div><label>Surname</label><input class="form-control" name="surname" required></div>
          <div><label>Email Address</label><input class="form-control" type="email" name="emailAddress" required></div>
          <div><label>Number</label><input class="form-control" name="phoneNumber" required></div>
          <div><label>Address</label><input class="form-control" name="address" required></div>
          <div><label>Password</label><input class="form-control" type="password" name="password" required></div>
        </div>
        <p style="margin-top: 1rem;"><button class="btn" type="submit">Register</button></p>
      </form>
    </section>`;

  sendPage(res, 'Resident Registration', body, 200, { authenticated: Boolean(req.session.user), user: req.session.user });
});

app.post('/register', (req, res) => {
  const fullName = String(req.body.fullName || '').trim();
  const surname = String(req.body.surname || '').trim();
  const emailAddress = String(req.body.emailAddress || '').trim().toLowerCase();
  const phoneNumber = String(req.body.phoneNumber || '').trim();
  const address = String(req.body.address || '').trim();
  const password = String(req.body.password || '').trim();

  if (!fullName || !surname || !emailAddress || !phoneNumber || !address || !password) {
    const notice = 'Please complete full name, surname, email, number, address, and password.';
    const body = `
      <section class="hero-block">
        <h1>Resident Registration</h1>
        <p class="muted">Create a portal account with the details your municipality needs.</p>
      </section>
      <section class="auth-shell" style="margin-top: 1rem;">
        <div class="notice-error">${notice}</div>
        <form method="post" action="/register">
          <div class="grid">
            <div><label>Full Name</label><input class="form-control" name="fullName" value="${escapeHtml(fullName)}" required></div>
            <div><label>Surname</label><input class="form-control" name="surname" value="${escapeHtml(surname)}" required></div>
            <div><label>Email Address</label><input class="form-control" type="email" name="emailAddress" value="${escapeHtml(emailAddress)}" required></div>
            <div><label>Number</label><input class="form-control" name="phoneNumber" value="${escapeHtml(phoneNumber)}" required></div>
            <div><label>Address</label><input class="form-control" name="address" value="${escapeHtml(address)}" required></div>
            <div><label>Password</label><input class="form-control" type="password" name="password" required></div>
          </div>
          <p style="margin-top: 1rem;"><button class="btn" type="submit">Register</button></p>
        </form>
      </section>`;

    sendPage(res, 'Resident Registration', body, 400, { authenticated: Boolean(req.session.user), user: req.session.user });
    return;
  }

  const existing = users.find((entry) => entry.emailAddress.toLowerCase() === emailAddress);
  if (existing) {
    const body = `
      <section class="hero-block">
        <h1>Resident Registration</h1>
        <p class="muted">Create a portal account with the details your municipality needs.</p>
      </section>
      <section class="auth-shell" style="margin-top: 1rem;">
        <div class="notice-error">An account already exists for that email address.</div>
        <form method="post" action="/register">
          <div class="grid">
            <div><label>Full Name</label><input class="form-control" name="fullName" value="${escapeHtml(fullName)}" required></div>
            <div><label>Surname</label><input class="form-control" name="surname" value="${escapeHtml(surname)}" required></div>
            <div><label>Email Address</label><input class="form-control" type="email" name="emailAddress" value="${escapeHtml(emailAddress)}" required></div>
            <div><label>Number</label><input class="form-control" name="phoneNumber" value="${escapeHtml(phoneNumber)}" required></div>
            <div><label>Address</label><input class="form-control" name="address" value="${escapeHtml(address)}" required></div>
            <div><label>Password</label><input class="form-control" type="password" name="password" required></div>
          </div>
          <p style="margin-top: 1rem;"><button class="btn" type="submit">Register</button></p>
        </form>
      </section>`;

    sendPage(res, 'Resident Registration', body, 409, { authenticated: Boolean(req.session.user), user: req.session.user });
    return;
  }

  users.push({
    emailAddress,
    password,
    displayName: `${fullName} ${surname}`,
    fullName,
    surname,
    phoneNumber,
    address,
    role: 'Resident'
  });

  const body = portalBody('Resident Registration', 'Your portal account has been created successfully.', '<section class="notice-success" style="margin-top: 1rem;">You can now sign in with your email address and password.</section>');
  sendPage(res, 'Resident Registration', body, 200, { authenticated: Boolean(req.session.user), user: req.session.user });
});

app.get('/setup', requireRole(['Server Admin']), (req, res) => {
  const body = `
    <section class="hero-block">
      <h1>Setup</h1>
      <p class="muted">Update portal configuration including the WhatsApp quick-chat button link.</p>
    </section>
    <section class="auth-shell" style="margin-top: 1rem;">
      <form method="post" action="/setup">
        <div class="grid">
          <div><label>Environment Name</label><input class="form-control" name="environmentName" value="${escapeHtml(systemConfiguration.environmentName)}"></div>
          <div><label>Site Name</label><input class="form-control" name="siteName" value="${escapeHtml(systemConfiguration.siteName)}"></div>
          <div><label>WhatsApp Chat Link</label><input class="form-control" name="whatsAppChatLink" value="${escapeHtml(systemConfiguration.whatsAppChatLink)}" placeholder="https://wa.me/27123456789" required></div>
        </div>
        <p style="margin-top: 1rem;"><button class="btn" type="submit">Save Setup</button></p>
      </form>
    </section>`;

  sendPage(res, 'Setup', body, 200, { authenticated: true, user: req.session.user });
});

app.post('/setup', requireRole(['Server Admin']), (req, res) => {
  const environmentName = String(req.body.environmentName || '').trim() || 'production';
  const siteName = String(req.body.siteName || '').trim() || 'PA Infrastructure Portal';
  const whatsAppChatLinkInput = String(req.body.whatsAppChatLink || '').trim();
  const whatsAppChatLink = /^https?:\/\//i.test(whatsAppChatLinkInput)
    ? whatsAppChatLinkInput
    : systemConfiguration.whatsAppChatLink;

  systemConfiguration.environmentName = environmentName;
  systemConfiguration.siteName = siteName;
  systemConfiguration.whatsAppChatLink = whatsAppChatLink;

  const body = `
    <section class="hero-block">
      <h1>Setup</h1>
      <p class="muted">Setup completed in the current Node.js shell.</p>
    </section>
    <section class="notice-success" style="margin-top: 1rem;">Configuration saved successfully.</section>
    <section class="panel" style="margin-top: 1rem;">
      <h2>Updated Settings</h2>
      <p><strong>Environment:</strong> ${escapeHtml(systemConfiguration.environmentName)}</p>
      <p><strong>Site Name:</strong> ${escapeHtml(systemConfiguration.siteName)}</p>
      <p><strong>WhatsApp Link:</strong> <a href="${escapeHtml(systemConfiguration.whatsAppChatLink)}" target="_blank" rel="noopener noreferrer">${escapeHtml(systemConfiguration.whatsAppChatLink)}</a></p>
    </section>`;

  sendPage(res, 'Setup', body, 200, { authenticated: true, user: req.session.user });
});

app.post(whatsappImportWebhookPath, requireImportWebhook, async (req, res) => {
  try {
    const contentType = String(req.headers['content-type'] || '').toLowerCase();
    const payload = req.body;

    let rawChatDump = '';
    if (typeof payload === 'string') {
      rawChatDump = payload;
    } else if (payload && typeof payload === 'object') {
      rawChatDump = String(payload.chatDump || payload.text || payload.content || payload.raw || '');
    }

    if (!rawChatDump.trim()) {
      res.status(400).json({
        message: 'Provide WhatsApp .txt content as text/plain body or JSON with chatDump/text/content/raw.'
      });
      return;
    }

    const scrubbedChatDump = scrubWhatsAppChatText(rawChatDump);
    const analytics = await runWhatsAppAnalytics(scrubbedChatDump);

    res.status(200).json({
      ingestion: {
        contentType,
        inputLength: rawChatDump.length,
        scrubbedLength: scrubbedChatDump.length,
        popiaScrubApplied: true
      },
      llm: {
        model: analytics.model,
        prompt: analytics.prompt
      },
      statistics: analytics.result
    });
  } catch (error) {
    res.status(500).json({
      message: 'Unable to process WhatsApp import payload.',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

app.get('/residents', requireRole(['Server Admin', 'Admin', 'PA Member']), (req, res) => {
  const residentRows = users
    .filter((entry) => entry.role === 'Resident')
    .map((entry) => `
      <tr>
        <td>${escapeHtml(entry.displayName || `${entry.fullName || ''} ${entry.surname || ''}`.trim())}</td>
        <td>${escapeHtml(entry.emailAddress)}</td>
        <td>${escapeHtml(entry.phoneNumber || '-')}</td>
        <td>${escapeHtml(entry.address || '-')}</td>
      </tr>`)
    .join('') || '<tr><td colspan="4">No resident accounts have been created yet.</td></tr>';

  const incidentRows = renderIncidentRows();

  const body = `
    <section class="hero-block">
      <h1>Residents & Roles</h1>
      <p class="muted">View resident accounts and create PA Member, Admin, or Server Admin users.</p>
    </section>
    <section class="panel" style="margin-top: 1rem;">
      <h2>Create Staff or Access Accounts</h2>
      <form method="post" action="/residents">
        <div class="grid">
          <div><label>Full Name</label><input class="form-control" name="fullName" required></div>
          <div><label>Surname</label><input class="form-control" name="surname" required></div>
          <div><label>Email Address</label><input class="form-control" type="email" name="emailAddress" required></div>
          <div><label>Number</label><input class="form-control" name="phoneNumber" required></div>
          <div><label>Address</label><input class="form-control" name="address" required></div>
          <div>
            <label>Role</label>
            <select class="form-control" name="role" required>
              <option value="PA Member">PA Member</option>
              <option value="Admin">Admin</option>
              <option value="Server Admin">Server Admin</option>
            </select>
          </div>
          <div><label>Password</label><input class="form-control" type="password" name="password" required></div>
        </div>
        <p style="margin-top: 1rem;"><button class="btn" type="submit">Add Account</button></p>
      </form>
    </section>
    <section class="panel table-wrap" style="margin-top: 1rem;">
      <h2>Resident Directory</h2>
      <table class="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Number</th>
            <th>Address</th>
          </tr>
        </thead>
        <tbody>
          ${residentRows}
        </tbody>
      </table>
    </section>
    <section class="panel table-wrap" style="margin-top: 1rem;">
      <h2>Recent Resident Incident Reports</h2>
      <table class="table">
        <thead>
          <tr>
            <th>Ticket</th>
            <th>Resident</th>
            <th>Category</th>
            <th>Pin Location</th>
            <th>Coordinates</th>
            <th>Photo</th>
          </tr>
        </thead>
        <tbody>
          ${incidentRows}
        </tbody>
      </table>
    </section>`;

  sendPage(res, 'Residents Directory', body, 200, { authenticated: true, user: req.session.user });
});

app.post('/residents', requireRole(['Server Admin', 'Admin', 'PA Member']), (req, res) => {
  const fullName = String(req.body.fullName || '').trim();
  const surname = String(req.body.surname || '').trim();
  const emailAddress = String(req.body.emailAddress || '').trim().toLowerCase();
  const phoneNumber = String(req.body.phoneNumber || '').trim();
  const address = String(req.body.address || '').trim();
  const role = String(req.body.role || '').trim();
  const password = String(req.body.password || '').trim();

  if (!fullName || !surname || !emailAddress || !phoneNumber || !address || !role || !password || !['PA Member', 'Admin', 'Server Admin'].includes(role)) {
    res.redirect('/residents');
    return;
  }

  const existing = users.find((entry) => entry.emailAddress.toLowerCase() === emailAddress);
  if (!existing) {
    users.push({
      emailAddress,
      password,
      displayName: `${fullName} ${surname}`,
      fullName,
      surname,
      phoneNumber,
      address,
      role
    });
  }

  res.redirect('/residents');
});

app.get('/report-incident', requireRole(['Resident']), (req, res) => {
  const body = `
    <section class="hero-block">
      <h1>Report Incident</h1>
      <p class="muted">Log an incident with a photo and drop a Google Maps pin link. Coordinates are automatically extracted.</p>
    </section>
    <section class="auth-shell" style="margin-top: 1rem;">
      <form method="post" action="/report-incident">
        <div class="grid">
          <div>
            <label>Incident Category</label>
            <select class="form-control" name="category" required>
              <option value="Outage / Service Delivery">Outage / Service Delivery</option>
              <option value="Road / Transport">Road / Transport</option>
              <option value="Water / Sanitation">Water / Sanitation</option>
              <option value="Environmental">Environmental</option>
              <option value="Tax Increase">Tax Increase</option>
            </select>
          </div>
          <div>
            <label>Google Pin Link</label>
            <input class="form-control" name="googlePinUrl" placeholder="https://maps.google.com/?q=-26.17,27.70" required>
          </div>
          <div>
            <label>Photo Attachment (image URL or base64 data URL)</label>
            <input class="form-control" name="photoDataUrl" placeholder="https://... or data:image/jpeg;base64,...">
          </div>
        </div>
        <div style="margin-top: 1rem;">
          <label>Incident Description</label>
          <textarea class="form-control" name="description" rows="4" required></textarea>
        </div>
        <p style="margin-top: 1rem;"><button class="btn" type="submit">Submit Incident</button></p>
      </form>
    </section>`;

  sendPage(res, 'Report Incident', body, 200, { authenticated: true, user: req.session.user });
});

app.get('/section78-dispute', requireRole(['Resident']), (req, res) => {
  const body = `
    <section class="hero-block">
      <h1>Section 78 Dispute</h1>
      <p class="muted">Submit your mass rates objection details for PA follow-up and municipal escalation.</p>
    </section>
    <section class="auth-shell" style="margin-top:1rem;">
      <form method="post" action="/section78-dispute">
        <div class="grid">
          <div><label>Property Address</label><input class="form-control" name="propertyAddress" required></div>
          <div><label>Municipal Account Number</label><input class="form-control" name="municipalAccountNumber" required></div>
          <div><label>Erf / Stand Number</label><input class="form-control" name="erfNumber" required></div>
          <div><label>Title Deed Number</label><input class="form-control" name="titleDeedNumber" required></div>
          <div><label>Actual Dominant Use</label><input class="form-control" name="actualDominantUse" required></div>
          <div><label>Disputed Category</label><input class="form-control" name="propertyCategoryDispute" required></div>
        </div>
        <div style="margin-top:1rem;">
          <label>Resident Statement</label>
          <textarea class="form-control" name="ownerStatement" rows="5" required></textarea>
        </div>
        <div class="check-wrap" style="margin-top:1rem;">
          <label class="form-check-row"><input type="checkbox" name="noFormalNoticeReceived" value="true" required> I confirm that I did not receive a formal municipal reclassification notice.</label>
          <label class="form-check-row"><input type="checkbox" name="noSection78DocumentsReceived" value="true" required> I confirm that no lawful Section 78 prior engagement documents were delivered to my address.</label>
          <label class="form-check-row"><input type="checkbox" name="popiaConsent" value="true" required> I consent to PA leadership representing my billing query with the Municipal Valuer under POPIA.</label>
        </div>
        <p style="margin-top: 1rem;"><button class="btn" type="submit">Submit Section 78 Dispute</button></p>
      </form>
    </section>`;

  sendPage(res, 'Section 78 Dispute', body, 200, { authenticated: true, user: req.session.user });
});

app.post('/section78-dispute', requireRole(['Resident']), (req, res) => {
  const propertyAddress = String(req.body.propertyAddress || '').trim();
  const municipalAccountNumber = String(req.body.municipalAccountNumber || '').trim();
  const erfNumber = String(req.body.erfNumber || '').trim();
  const titleDeedNumber = String(req.body.titleDeedNumber || '').trim();
  const actualDominantUse = String(req.body.actualDominantUse || '').trim();
  const propertyCategoryDispute = String(req.body.propertyCategoryDispute || '').trim();
  const ownerStatement = String(req.body.ownerStatement || '').trim();
  const noFormalNoticeReceived = String(req.body.noFormalNoticeReceived || '').toLowerCase() === 'true';
  const noSection78DocumentsReceived = String(req.body.noSection78DocumentsReceived || '').toLowerCase() === 'true';
  const popiaConsent = String(req.body.popiaConsent || '').toLowerCase() === 'true';

  if (!propertyAddress || !municipalAccountNumber || !erfNumber || !titleDeedNumber || !actualDominantUse || !propertyCategoryDispute || !ownerStatement || !noFormalNoticeReceived || !noSection78DocumentsReceived || !popiaConsent) {
    sendPage(res, 'Section 78 Dispute', portalBody('Section 78 Dispute', 'Missing required information or consent.', '<section class="notice-error" style="margin-top:1rem;">Please complete all fields and confirm all declarations before submission.</section>'), 400, { authenticated: true, user: req.session.user });
    return;
  }

  const disputeReference = `S78-RF-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 90000) + 10000)}`;
  section78Disputes.push({
    disputeReference,
    residentEmail: req.session.user.emailAddress,
    residentName: req.session.user.displayName,
    propertyAddress,
    municipalAccountNumber,
    erfNumber,
    titleDeedNumber,
    actualDominantUse,
    propertyCategoryDispute,
    ownerStatement,
    noFormalNoticeReceived,
    noSection78DocumentsReceived,
    popiaConsent,
    submittedAt: new Date().toISOString()
  });

  const body = `
    <section class="hero-block">
      <h1>Section 78 Dispute Submitted</h1>
      <p class="muted">Your dispute has been logged for PA review.</p>
    </section>
    <section class="notice-success" style="margin-top: 1rem;">Reference: <strong>${escapeHtml(disputeReference)}</strong></section>
    <section class="panel" style="margin-top:1rem;">
      <p><strong>Property:</strong> ${escapeHtml(propertyAddress)}</p>
      <p><strong>Municipal Account:</strong> ${escapeHtml(municipalAccountNumber)}</p>
      <p><strong>Status:</strong> Submitted to PA leadership queue.</p>
    </section>`;

  sendPage(res, 'Section 78 Dispute Submitted', body, 200, { authenticated: true, user: req.session.user });
});

app.post('/report-incident', requireRole(['Resident']), (req, res) => {
  const category = String(req.body.category || '').trim();
  const googlePinUrl = String(req.body.googlePinUrl || '').trim();
  const description = String(req.body.description || '').trim();
  const photoDataUrl = String(req.body.photoDataUrl || '').trim();

  if (!category || !googlePinUrl || !description) {
    sendPage(res, 'Report Incident', portalBody('Report Incident', 'Missing required fields. Please complete category, Google pin link, and description.', '<section class="notice-error" style="margin-top:1rem;">Please complete all required fields.</section>'), 400, { authenticated: true, user: req.session.user });
    return;
  }

  const coordinateMatch = googlePinUrl.match(/(-?\d{1,2}\.\d{3,}),\s*(-?\d{1,3}\.\d{3,})/);
  if (!coordinateMatch) {
    sendPage(res, 'Report Incident', portalBody('Report Incident', 'Could not detect coordinates in the Google pin link.', '<section class="notice-error" style="margin-top:1rem;">Use a Google Maps link containing latitude and longitude.</section>'), 400, { authenticated: true, user: req.session.user });
    return;
  }

  const latitude = Number(coordinateMatch[1]);
  const longitude = Number(coordinateMatch[2]);

  const randomDigits = Math.floor(Math.random() * 90000) + 10000;
  const ticketReference = `PA-RF-${new Date().getFullYear()}-${randomDigits}`;

  incidents.push({
    ticketReference,
    reporterEmail: req.session.user.emailAddress,
    reporterName: req.session.user.displayName,
    category,
    description,
    locationLabel: googlePinUrl,
    latitude,
    longitude,
    photoDataUrl,
    createdAt: new Date().toISOString()
  });

  const body = `
    <section class="hero-block">
      <h1>Incident Logged</h1>
      <p class="muted">Your incident was submitted successfully.</p>
    </section>
    <section class="notice-success" style="margin-top: 1rem;">
      Ticket <strong>${escapeHtml(ticketReference)}</strong> logged at coordinates <strong>${escapeHtml(String(latitude))}, ${escapeHtml(String(longitude))}</strong>.
    </section>
    <section class="panel" style="margin-top:1rem;">
      <p><strong>Category:</strong> ${escapeHtml(category)}</p>
      <p><strong>Description:</strong> ${escapeHtml(description)}</p>
      <p><strong>Google Pin:</strong> <a href="${escapeHtml(googlePinUrl)}" target="_blank" rel="noopener noreferrer">Open Map</a></p>
      ${photoDataUrl ? `<p><strong>Photo:</strong> <a href="${escapeHtml(photoDataUrl)}" target="_blank" rel="noopener noreferrer">View Attachment</a></p>` : '<p><strong>Photo:</strong> Not supplied</p>'}
    </section>`;

  sendPage(res, 'Incident Logged', body, 200, { authenticated: true, user: req.session.user });
});

app.get('/command-view', requireRole(['Server Admin', 'Admin', 'PA Member']), (req, res) => sendPage(res, 'Councillor & MMC Oversight', portalBody('Councillor & MMC Oversight', 'Operational oversight content can be connected here in the next iteration.', '<section class="grid" style="margin-top: 1rem;"><div class="panel"><h2>Workflow</h2><p>Placeholder for dispatch and inspection actions.</p></div><div class="panel"><h2>Status</h2><p>Placeholder for complaint status updates.</p></div></section>'), 200, { authenticated: true, user: req.session.user }));

app.get('/stats-hub', requireRole(['Server Admin', 'Admin', 'PA Member']), (req, res) => sendPage(res, 'Public Live Statistics Hub', portalBody('Public Live Statistics Hub', 'The live stats hub is available as a Node.js page.', '<section class="grid" style="margin-top: 1rem;"><div class="panel"><h2>Total Issues</h2><p>0</p></div><div class="panel"><h2>Electrical</h2><p>0</p></div><div class="panel"><h2>Roads</h2><p>0</p></div><div class="panel"><h2>Water</h2><p>0</p></div></section>'), 200, { authenticated: true, user: req.session.user }));

app.get('/create-admin-user', requireRole(['Server Admin', 'Admin']), (req, res) => {
  const body = portalBody('Create Admin/PA User', 'Create managed staff accounts from the Residents & Roles tab.', '<section class="panel" style="margin-top:1rem;"><p>Use <a href="/residents">Residents & Roles</a> to create Admin, PA Member, or Server Admin users.</p></section>');
  sendPage(res, 'Create Admin/PA User', body, 200, { authenticated: true, user: req.session.user });
});

app.get('/staff-management', requireRole(['Server Admin', 'Admin']), (req, res) => {
  const staffRows = users
    .filter((entry) => entry.role === 'Server Admin' || entry.role === 'Admin' || entry.role === 'PA Member')
    .map((entry) => `<tr><td>${escapeHtml(entry.displayName)}</td><td>${escapeHtml(entry.role)}</td><td>${escapeHtml(entry.emailAddress)}</td><td>${escapeHtml(entry.phoneNumber || '-')}</td></tr>`)
    .join('') || '<tr><td colspan="4">No staff accounts found.</td></tr>';

  const body = `
    <section class="hero-block"><h1>Staff Management</h1><p class="muted">View all PA Member, Admin, and Server Admin accounts.</p></section>
    <section class="panel table-wrap" style="margin-top:1rem;">
      <table class="table">
        <thead><tr><th>Name</th><th>Role</th><th>Email</th><th>Number</th></tr></thead>
        <tbody>${staffRows}</tbody>
      </table>
    </section>`;

  sendPage(res, 'Staff Management', body, 200, { authenticated: true, user: req.session.user });
});

app.get('/resident-management', requireRole(['Server Admin', 'Admin']), (req, res) => {
  const residentRows = users
    .filter((entry) => entry.role === 'Resident')
    .map((entry) => `<tr><td>${escapeHtml(entry.displayName)}</td><td>${escapeHtml(entry.emailAddress)}</td><td>${escapeHtml(entry.phoneNumber || '-')}</td><td>${escapeHtml(entry.address || '-')}</td></tr>`)
    .join('') || '<tr><td colspan="4">No residents found.</td></tr>';

  const body = `
    <section class="hero-block"><h1>Resident Management</h1><p class="muted">Review resident records.</p></section>
    <section class="panel table-wrap" style="margin-top:1rem;">
      <table class="table">
        <thead><tr><th>Name</th><th>Email</th><th>Number</th><th>Address</th></tr></thead>
        <tbody>${residentRows}</tbody>
      </table>
    </section>`;

  sendPage(res, 'Resident Management', body, 200, { authenticated: true, user: req.session.user });
});

app.get('/residents-export', requireRole(['Server Admin', 'Admin', 'PA Member']), (req, res) => {
  const rows = users
    .filter((entry) => entry.role === 'Resident')
    .map((entry) => [
      entry.displayName || '',
      entry.emailAddress || '',
      entry.phoneNumber || '',
      entry.address || ''
    ].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','));

  const csv = ['Name,Email,Number,Address', ...rows].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="residents_${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
});

app.get('/edit-my-user', requireLogin, (req, res) => {
  const account = users.find((entry) => entry.emailAddress.toLowerCase() === req.session.user.emailAddress.toLowerCase());
  const body = `
    <section class="hero-block"><h1>Edit My User</h1><p class="muted">Update your phone number and physical address.</p></section>
    <section class="auth-shell" style="margin-top:1rem;">
      <form method="post" action="/edit-my-user">
        <div class="grid">
          <div><label>Email Address</label><input class="form-control" value="${escapeHtml(account?.emailAddress || req.session.user.emailAddress)}" disabled></div>
          <div><label>Phone Number</label><input class="form-control" name="phoneNumber" value="${escapeHtml(account?.phoneNumber || '')}"></div>
          <div><label>Address</label><input class="form-control" name="address" value="${escapeHtml(account?.address || '')}"></div>
        </div>
        <p style="margin-top:1rem;"><button class="btn" type="submit">Save My Profile</button></p>
      </form>
    </section>`;

  sendPage(res, 'Edit My User', body, 200, { authenticated: true, user: req.session.user });
});

app.post('/edit-my-user', requireLogin, (req, res) => {
  const account = users.find((entry) => entry.emailAddress.toLowerCase() === req.session.user.emailAddress.toLowerCase());
  if (account) {
    account.phoneNumber = String(req.body.phoneNumber || '').trim();
    account.address = String(req.body.address || '').trim();
  }
  res.redirect('/edit-my-user');
});

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
