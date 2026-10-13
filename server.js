const express = require('express');
const session = require('express-session');

const app = express();
const port = process.env.PORT || 3000;
const loginPath = '/login';
const whatsappImportWebhookPath = '/api/webhooks/whatsapp-import';
const importWebhookToken = process.env.WHATSAPP_IMPORT_WEBHOOK_TOKEN || '';
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
      { href: '/residents', label: 'Residents & Roles' }
    );
  }

  if (role === 'Server Admin') {
    items.splice(4, 0, { href: '/setup', label: 'System Configuration' });
  }

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
