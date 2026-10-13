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
  whatsAppChatLink: 'https://wa.me/0000000000',
  googleMapsApiKey: ''
};
const incidents = [];
const section78Disputes = [];
const notifications = [];
const users = [
  {
    emailAddress: 'jeanmari@thesolution.co.za',
    password: 'Foktogbokka',
    pin: '1101',
    idNumber: '8001015009087',
    displayName: 'Jeanmari Administrator',
    role: 'Server Admin'
  },
  {
    emailAddress: 'jean@thesolution.co.za',
    password: '888@JP',
    pin: '2202',
    idNumber: '8202025009088',
    displayName: 'Jean Administrator',
    role: 'Server Admin'
  },
  {
    emailAddress: 'admin@pa.local',
    password: 'Password123!',
    pin: '3303',
    idNumber: '8303035009089',
    displayName: 'Admin Example',
    role: 'Admin'
  },
  {
    emailAddress: 'pamember@pa.local',
    password: 'Password123!',
    pin: '4404',
    idNumber: '8404045009090',
    displayName: 'PA Member Example',
    role: 'PA Member'
  },
  {
    emailAddress: 'resident@pa.local',
    password: 'Password123!',
    pin: '5505',
    idNumber: '8505055009091',
    displayName: 'Resident Example',
    role: 'Resident',
    consentGiven: true
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
      { href: '/resident-management', label: 'Resident Management' },
      { href: '/user-management', label: 'User Management' },
      { href: '/incident-management', label: 'Incident Escalations' }
    );
  }

  if (role === 'Server Admin') {
    items.push({ href: '/setup', label: 'System Configuration' });
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

function extractTownFromAddress(address) {
  const text = String(address || '').trim();
  if (!text) return '';

  const segments = text.split(',').map((part) => part.trim()).filter(Boolean);
  if (!segments.length) return text;

  return segments[segments.length - 1];
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
      <div class="site-clock" data-site-clock></div>
      <details class="site-menu">
        <summary class="site-menu-toggle">Portal Menu</summary>
        <div class="site-menu-panel">
          <div class="site-menu-mobile-top">
            <a class="site-menu-mobile-whatsapp" href="${escapeHtml(systemConfiguration.whatsAppChatLink)}" target="_blank" rel="noopener noreferrer">WhatsApp</a>
            <div class="site-menu-mobile-profile">${user.displayName} (${user.role})</div>
            <div class="site-menu-mobile-clock" data-site-clock></div>
          </div>
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
  <meta property="og:title" content="Infrastructure Portal">
  <meta property="og:site_name" content="Infrastructure Portal">
  <meta property="og:image" content="/images/pa-logo.png">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="Infrastructure Portal">
  <meta name="twitter:image" content="/images/pa-logo.png">
  <link rel="icon" type="image/png" href="/images/pa-logo.png">
  <link rel="apple-touch-icon" href="/images/pa-logo.png">
  <link rel="stylesheet" href="/styles/site.css">
</head>
<body>
  <header class="site-header">
    <div class="site-header-inner">
      <a class="site-brand" href="/dashboard" aria-label="Infrastructure Portal home">
        <img class="site-brand-logo" src="/images/pa-logo.png" alt="Patriotic Alliance logo">
        <span class="site-brand-text">Infrastructure Portal</span>
      </a>
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
      const clocks = document.querySelectorAll('[data-site-clock]');
      if (!clocks.length) return;
      const tick = () => {
        const text = new Date().toLocaleString('en-ZA', {
          weekday: 'short', year: 'numeric', month: 'short', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
        });
        clocks.forEach((clock) => {
          clock.textContent = text;
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

function extractCoordinatesFromGooglePin(googlePinUrl) {
  const input = String(googlePinUrl || '').trim();
  const coordinateMatch = input.match(/(-?\d{1,2}\.\d{3,}),\s*(-?\d{1,3}\.\d{3,})/);

  if (!coordinateMatch) {
    return null;
  }

  return {
    latitude: Number(coordinateMatch[1]),
    longitude: Number(coordinateMatch[2])
  };
}

function buildIncidentRecord({ reporterEmail, reporterName, category, googlePinUrl, description, photoDataUrl = '' }) {
  const coordinates = extractCoordinatesFromGooglePin(googlePinUrl);
  if (!coordinates) {
    return { error: 'Use a Google Maps link containing latitude and longitude.' };
  }

  const randomDigits = Math.floor(Math.random() * 90000) + 10000;
  const ticketReference = `PA-RF-${new Date().getFullYear()}-${randomDigits}`;

  const incident = {
    ticketReference,
    reporterEmail,
    reporterName,
    category,
    description,
    locationLabel: googlePinUrl,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    photoDataUrl,
    status: 'Logged',
    escalationLevel: 'Ward Councillor',
    createdAt: new Date().toISOString()
  };

  incidents.push(incident);

  const paRecipients = users
    .filter((entry) => entry.role === 'PA Member' || entry.role === 'Admin' || entry.role === 'Server Admin')
    .map((entry) => ({ emailAddress: entry.emailAddress, displayName: entry.displayName, role: entry.role }));

  notifications.push({
    id: `notif-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    type: 'NewIncident',
    ticketReference,
    category,
    locationLabel: googlePinUrl,
    message: `New incident ${ticketReference} logged under ${category}.`,
    recipients: paRecipients,
    createdAt: new Date().toISOString()
  });

  return { incident };
}

function buildHeatmapSummary() {
  const buckets = new Map();

  for (const entry of incidents) {
    const latBucket = Number(entry.latitude || 0).toFixed(3);
    const lonBucket = Number(entry.longitude || 0).toFixed(3);
    const key = `${latBucket},${lonBucket}`;
    const current = buckets.get(key) || {
      coordinates: key,
      latitude: Number(latBucket),
      longitude: Number(lonBucket),
      totalFaults: 0,
      categories: {}
    };

    current.totalFaults += 1;
    current.categories[entry.category] = (current.categories[entry.category] || 0) + 1;
    buckets.set(key, current);
  }

  return Array.from(buckets.values()).sort((a, b) => b.totalFaults - a.totalFaults);
}

function resolveCategoryCounts() {
  const counts = {
    electrical: 0,
    smoke: 0,
    roads: 0,
    water: 0
  };

  for (const entry of incidents) {
    const text = `${entry.category} ${entry.description}`.toLowerCase();
    if (/electric|grid|power|outage/.test(text)) counts.electrical += 1;
    if (/smoke|landfill|waste|burn/.test(text)) counts.smoke += 1;
    if (/road|pothole|transport|tar/.test(text)) counts.roads += 1;
    if (/water|sewage|sanitation|pipe|leak/.test(text)) counts.water += 1;
  }

  return counts;
}

function loginBody(notice = '', returnUrl = '/dashboard') {
  return `
    <section class="auth-shell" style="max-width: 520px; margin: 0 auto;">
      <h1 style="margin-top: 0;">Portal Sign In</h1>
      <p class="muted">Use your assigned portal account to continue.</p>
      ${notice ? `<div class="notice-info">${notice}</div>` : ''}
      <form method="post" action="/login">
        <input type="hidden" name="returnUrl" value="${returnUrl}">
        <input type="hidden" id="loginMethod" name="loginMethod" value="pin">
        <div style="display:grid; gap: 1rem;">
          <div>
            <label>Email Address</label>
            <input class="form-control" type="email" name="emailAddress" placeholder="jeanmari@thesolution.co.za" required>
          </div>
          <div>
            <label id="credentialLabel">PIN</label>
            <input class="form-control" id="credentialInput" type="password" name="credential" placeholder="Enter your PIN" required>
          </div>
          <div>
            <button class="btn" type="button" id="toggleLoginMethod">Use Password Instead</button>
          </div>
        </div>
        <p style="margin-top: 1rem;"><button class="btn" type="submit">Sign In</button></p>
      </form>
      <p class="muted" style="margin-top: 1rem;">No resident account yet?</p>
      <p><a class="btn" href="/register">Create Resident Account</a></p>
    </section>
    <script>
      (function () {
        const methodField = document.getElementById('loginMethod');
        const toggleButton = document.getElementById('toggleLoginMethod');
        const label = document.getElementById('credentialLabel');
        const input = document.getElementById('credentialInput');
        if (!methodField || !toggleButton || !label || !input) return;

        toggleButton.addEventListener('click', function () {
          const usePassword = methodField.value === 'pin';
          methodField.value = usePassword ? 'password' : 'pin';
          label.textContent = usePassword ? 'Password' : 'PIN';
          input.placeholder = usePassword ? 'Enter your password' : 'Enter your PIN';
          toggleButton.textContent = usePassword ? 'Use PIN Instead' : 'Use Password Instead';
          input.focus();
        });
      })();
    </script>`;
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
  const loginMethod = String(req.body.loginMethod || 'pin').trim().toLowerCase();
  const credential = String(req.body.credential || '').trim();
  const returnUrl = String(req.body.returnUrl || '/dashboard');

  const user = users.find((entry) => entry.emailAddress.toLowerCase() === email);

  if (!user) {
    sendPage(res, 'Sign In', loginBody('Invalid login attempt. Account not found.', returnUrl), 401, { authenticated: false });
    return;
  }

  const validByPassword = loginMethod === 'password' && user.password === credential;
  const validByPin = loginMethod === 'pin' && String(user.pin || '') === credential;

  if (!validByPassword && !validByPin) {
    sendPage(res, 'Sign In', loginBody('Invalid password or PIN.', returnUrl), 401, { authenticated: false });
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
          <div><label>ID Number</label><input class="form-control" name="idNumber" required></div>
          <div><label>Email Address</label><input class="form-control" type="email" name="emailAddress" required></div>
          <div><label>Number</label><input class="form-control" name="phoneNumber" required></div>
          <div><label>Address</label><input class="form-control" name="address" required></div>
          <div><label>Password</label><input class="form-control" type="password" name="password" required></div>
          <div><label>Create Login PIN (4-8 digits)</label><input class="form-control" type="password" name="pin" pattern="\d{4,8}" required></div>
        </div>
        <div class="check-wrap" style="margin-top:1rem;">
          <label class="form-check-row"><input type="checkbox" name="consentDataCollection" value="yes" required> I consent to the collection and processing of my Name, Surname, ID Number, and Address for municipal service-delivery operations.</label>
        </div>
        <p style="margin-top: 1rem;"><button class="btn" type="submit">Register</button></p>
      </form>
    </section>`;

  sendPage(res, 'Resident Registration', body, 200, { authenticated: Boolean(req.session.user), user: req.session.user });
});

app.post('/register', (req, res) => {
  const fullName = String(req.body.fullName || '').trim();
  const surname = String(req.body.surname || '').trim();
  const idNumber = String(req.body.idNumber || '').trim();
  const emailAddress = String(req.body.emailAddress || '').trim().toLowerCase();
  const phoneNumber = String(req.body.phoneNumber || '').trim();
  const address = String(req.body.address || '').trim();
  const password = String(req.body.password || '').trim();
  const pin = String(req.body.pin || '').trim();
  const consentDataCollection = String(req.body.consentDataCollection || '').trim().toLowerCase() === 'yes';

  if (!fullName || !surname || !idNumber || !emailAddress || !phoneNumber || !address || !password || !pin || !consentDataCollection || !/^\d{4,8}$/.test(pin)) {
    const notice = 'Complete all fields, provide a numeric 4-8 digit PIN, and accept data-collection consent.';
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
            <div><label>ID Number</label><input class="form-control" name="idNumber" value="${escapeHtml(idNumber)}" required></div>
            <div><label>Email Address</label><input class="form-control" type="email" name="emailAddress" value="${escapeHtml(emailAddress)}" required></div>
            <div><label>Number</label><input class="form-control" name="phoneNumber" value="${escapeHtml(phoneNumber)}" required></div>
            <div><label>Address</label><input class="form-control" name="address" value="${escapeHtml(address)}" required></div>
            <div><label>Password</label><input class="form-control" type="password" name="password" required></div>
            <div><label>Create Login PIN (4-8 digits)</label><input class="form-control" type="password" name="pin" pattern="\d{4,8}" required></div>
          </div>
          <div class="check-wrap" style="margin-top:1rem;">
            <label class="form-check-row"><input type="checkbox" name="consentDataCollection" value="yes" ${consentDataCollection ? 'checked' : ''} required> I consent to the collection and processing of my Name, Surname, ID Number, and Address for municipal service-delivery operations.</label>
          </div>
          <p style="margin-top: 1rem;"><button class="btn" type="submit">Register</button></p>
        </form>
      </section>`;

    sendPage(res, 'Resident Registration', body, 400, { authenticated: Boolean(req.session.user), user: req.session.user });
    return;
  }

  const existing = users.find((entry) => entry.emailAddress.toLowerCase() === emailAddress || String(entry.idNumber || '') === idNumber);
  if (existing) {
    const body = `
      <section class="hero-block">
        <h1>Resident Registration</h1>
        <p class="muted">Create a portal account with the details your municipality needs.</p>
      </section>
      <section class="auth-shell" style="margin-top: 1rem;">
        <div class="notice-error">An account already exists for that email address or ID number.</div>
        <form method="post" action="/register">
          <div class="grid">
            <div><label>Full Name</label><input class="form-control" name="fullName" value="${escapeHtml(fullName)}" required></div>
            <div><label>Surname</label><input class="form-control" name="surname" value="${escapeHtml(surname)}" required></div>
            <div><label>ID Number</label><input class="form-control" name="idNumber" value="${escapeHtml(idNumber)}" required></div>
            <div><label>Email Address</label><input class="form-control" type="email" name="emailAddress" value="${escapeHtml(emailAddress)}" required></div>
            <div><label>Number</label><input class="form-control" name="phoneNumber" value="${escapeHtml(phoneNumber)}" required></div>
            <div><label>Address</label><input class="form-control" name="address" value="${escapeHtml(address)}" required></div>
            <div><label>Password</label><input class="form-control" type="password" name="password" required></div>
            <div><label>Create Login PIN (4-8 digits)</label><input class="form-control" type="password" name="pin" pattern="\d{4,8}" required></div>
          </div>
          <div class="check-wrap" style="margin-top:1rem;">
            <label class="form-check-row"><input type="checkbox" name="consentDataCollection" value="yes" checked required> I consent to the collection and processing of my Name, Surname, ID Number, and Address for municipal service-delivery operations.</label>
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
    pin,
    idNumber,
    consentGiven: true,
    displayName: `${fullName} ${surname}`,
    fullName,
    surname,
    phoneNumber,
    address,
    role: 'Resident'
  });

  const body = portalBody('Resident Registration', 'Your portal account has been created successfully.', '<section class="notice-success" style="margin-top: 1rem;">You can now sign in with your email address + ID number, using password or PIN.</section>');
  sendPage(res, 'Resident Registration', body, 200, { authenticated: Boolean(req.session.user), user: req.session.user });
});

app.get('/setup', requireRole(['Server Admin']), (req, res) => {
  const body = `
    <section class="hero-block">
      <h1>Setup</h1>
      <p class="muted">Update portal configuration including WhatsApp and live Google Maps integration keys.</p>
    </section>
    <section class="auth-shell" style="margin-top: 1rem;">
      <form method="post" action="/setup">
        <div class="grid">
          <div><label>Environment Name</label><input class="form-control" name="environmentName" value="${escapeHtml(systemConfiguration.environmentName)}"></div>
          <div><label>Site Name</label><input class="form-control" name="siteName" value="${escapeHtml(systemConfiguration.siteName)}"></div>
          <div><label>WhatsApp Chat Link</label><input class="form-control" name="whatsAppChatLink" value="${escapeHtml(systemConfiguration.whatsAppChatLink)}" placeholder="https://wa.me/27123456789" required></div>
          <div><label>Google Maps API Key</label><input class="form-control" name="googleMapsApiKey" value="${escapeHtml(systemConfiguration.googleMapsApiKey)}" placeholder="AIza..." autocomplete="off"></div>
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
  const googleMapsApiKey = String(req.body.googleMapsApiKey || '').trim();
  const whatsAppChatLink = /^https?:\/\//i.test(whatsAppChatLinkInput)
    ? whatsAppChatLinkInput
    : systemConfiguration.whatsAppChatLink;

  systemConfiguration.environmentName = environmentName;
  systemConfiguration.siteName = siteName;
  systemConfiguration.whatsAppChatLink = whatsAppChatLink;
  systemConfiguration.googleMapsApiKey = googleMapsApiKey;

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
      <p><strong>Google Maps Key:</strong> ${systemConfiguration.googleMapsApiKey ? 'Configured' : 'Not configured'}</p>
    </section>`;

  sendPage(res, 'Setup', body, 200, { authenticated: true, user: req.session.user });
});

async function processWhatsAppImportRequest(req, res) {
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
}

app.post(whatsappImportWebhookPath, requireImportWebhook, processWhatsAppImportRequest);

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
          <div><label>ID Number</label><input class="form-control" name="idNumber" required></div>
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
          <div><label>PIN (4-8 digits)</label><input class="form-control" name="pin" pattern="\d{4,8}" required></div>
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
  const idNumber = String(req.body.idNumber || '').trim();
  const emailAddress = String(req.body.emailAddress || '').trim().toLowerCase();
  const phoneNumber = String(req.body.phoneNumber || '').trim();
  const address = String(req.body.address || '').trim();
  const role = String(req.body.role || '').trim();
  const password = String(req.body.password || '').trim();
  const pin = String(req.body.pin || '').trim();

  if (!fullName || !surname || !idNumber || !emailAddress || !phoneNumber || !address || !role || !password || !/^\d{4,8}$/.test(pin) || !['PA Member', 'Admin', 'Server Admin'].includes(role)) {
    res.redirect('/residents');
    return;
  }

  const existing = users.find((entry) => entry.emailAddress.toLowerCase() === emailAddress || String(entry.idNumber || '') === idNumber);
  if (!existing) {
    users.push({
      emailAddress,
      password,
      pin,
      idNumber,
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

  const result = buildIncidentRecord({
    reporterEmail: req.session.user.emailAddress,
    reporterName: req.session.user.displayName,
    category,
    googlePinUrl,
    description,
    photoDataUrl
  });

  if (result.error) {
    sendPage(res, 'Report Incident', portalBody('Report Incident', 'Could not detect coordinates in the Google pin link.', `<section class="notice-error" style="margin-top:1rem;">${escapeHtml(result.error)}</section>`), 400, { authenticated: true, user: req.session.user });
    return;
  }

  const { incident } = result;

  const body = `
    <section class="hero-block">
      <h1>Incident Logged</h1>
      <p class="muted">Your incident was submitted successfully.</p>
    </section>
    <section class="notice-success" style="margin-top: 1rem;">
      Ticket <strong>${escapeHtml(incident.ticketReference)}</strong> logged at coordinates <strong>${escapeHtml(String(incident.latitude))}, ${escapeHtml(String(incident.longitude))}</strong>.
    </section>
    <section class="panel" style="margin-top:1rem;">
      <p><strong>Category:</strong> ${escapeHtml(incident.category)}</p>
      <p><strong>Description:</strong> ${escapeHtml(incident.description)}</p>
      <p><strong>Google Pin:</strong> <a href="${escapeHtml(incident.locationLabel)}" target="_blank" rel="noopener noreferrer">Open Map</a></p>
      ${incident.photoDataUrl ? `<p><strong>Photo:</strong> <a href="${escapeHtml(incident.photoDataUrl)}" target="_blank" rel="noopener noreferrer">View Attachment</a></p>` : '<p><strong>Photo:</strong> Not supplied</p>'}
    </section>`;

  sendPage(res, 'Incident Logged', body, 200, { authenticated: true, user: req.session.user });
});

app.get('/command-view', requireRole(['Server Admin', 'Admin', 'PA Member']), (req, res) => sendPage(res, 'Councillor & MMC Oversight', portalBody('Councillor & MMC Oversight', 'Operational oversight content can be connected here in the next iteration.', '<section class="grid" style="margin-top: 1rem;"><div class="panel"><h2>Workflow</h2><p>Placeholder for dispatch and inspection actions.</p></div><div class="panel"><h2>Status</h2><p>Placeholder for complaint status updates.</p></div></section>'), 200, { authenticated: true, user: req.session.user }));

app.get('/stats-hub', requireRole(['Server Admin', 'Admin', 'PA Member']), (req, res) => {
  const counts = resolveCategoryCounts();
  const totalActive = incidents.filter((entry) => String(entry.status || '').toLowerCase() !== 'resolved').length;
  const mapsReady = Boolean(systemConfiguration.googleMapsApiKey);

  const body = `
    <style>
      :root { --pa-green: #006837; --dark-slate: #2b2b2b; }
      .stats-hub-wrap { color: var(--dark-slate); }
      .stats-hub-header { background-color: var(--pa-green); color: white; padding: 20px; text-align: center; border-bottom: 5px solid #0b5a31; border-radius: 12px; }
      .stats-hub-header h1 { margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 1px; }
      .stats-main-counter { background: white; max-width: 800px; margin: 25px auto; padding: 30px; border-radius: 12px; text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border-left: 8px solid var(--pa-green); }
      .stats-counter-number { font-size: 54px; font-weight: bold; color: var(--pa-green); margin: 10px 0; }
      .stats-grid-live { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; max-width: 860px; margin: 0 auto; padding: 0 20px; }
      .stats-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); text-align: center; border-top: 4px solid var(--pa-green); }
      .stats-card.danger { border-top-color: #d9534f; }
      .stats-icon { font-size: 28px; margin-bottom: 10px; }
      .stats-count { font-size: 28px; font-weight: bold; margin: 5px 0; }
      .stats-label { font-size: 14px; color: #666; font-weight: 500; }
      .stats-map-placeholder { max-width: 800px; height: 300px; margin: 30px auto; background-color: #e9ecef; border: 2px dashed #0f7a3f; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #355a45; font-weight: bold; text-align: center; padding: 1rem; }
      @media (max-width: 600px) { .stats-grid-live { grid-template-columns: 1fr; } }
    </style>

    <section class="stats-hub-wrap">
      <div class="stats-hub-header">
        <h1>PA Infrastructure Tracking Command</h1>
        <small>Rand West City Local Oversight System</small>
      </div>

      <div class="stats-main-counter">
        <h2>TOTAL ACTIVE INFRASTRUCTURE FAULTS REPORTED</h2>
        <div class="stats-counter-number">${escapeHtml(String(totalActive))}</div>
        <p>Verified service delivery failures currently monitored across Randfontein and rural areas.</p>
      </div>

      <div class="stats-grid-live">
        <div class="stats-card danger">
          <div class="stats-icon">⚡</div>
          <div class="stats-count">${escapeHtml(String(counts.electrical))}</div>
          <div class="stats-label">Electrical & Grid Outages</div>
        </div>
        <div class="stats-card">
          <div class="stats-icon">💨</div>
          <div class="stats-count">${escapeHtml(String(counts.smoke))}</div>
          <div class="stats-label">Landfill Smoke Hazards</div>
        </div>
        <div class="stats-card">
          <div class="stats-icon">🛣️</div>
          <div class="stats-count">${escapeHtml(String(counts.roads))}</div>
          <div class="stats-label">Road & Pothole Faults</div>
        </div>
        <div class="stats-card">
          <div class="stats-icon">💧</div>
          <div class="stats-count">${escapeHtml(String(counts.water))}</div>
          <div class="stats-label">Water & Sewage Leaks</div>
        </div>
      </div>

      <div class="stats-map-placeholder">
        ${mapsReady
          ? 'Google Maps API key configured. Live map integration endpoint is ready for activation.'
          : 'Google Maps API key not configured. Add it in System Configuration to enable live map view.'}
      </div>
    </section>`;

  sendPage(res, 'Public Live Statistics Hub', body, 200, { authenticated: true, user: req.session.user });
});

app.get('/staff-management', requireRole(['Server Admin', 'Admin']), (req, res) => {
  res.redirect('/user-management');
});

app.get('/resident-management', requireRole(['Server Admin', 'Admin']), (req, res) => {
  const searchQuery = String(req.query.q || '').trim().toLowerCase();
  const selectedTown = String(req.query.town || '').trim();
  const sortByInput = String(req.query.sortBy || 'displayName').trim();
  const sortDir = String(req.query.sortDir || 'asc').trim().toLowerCase() === 'desc' ? 'desc' : 'asc';
  const exportStatus = String(req.query.exportStatus || '').trim();

  const residents = users
    .filter((entry) => entry.role === 'Resident')
    .map((entry) => ({
      ...entry,
      town: extractTownFromAddress(entry.address || '')
    }));

  const towns = Array.from(new Set(residents.map((entry) => entry.town).filter(Boolean))).sort((a, b) => a.localeCompare(b));

  const sortBy = ['displayName', 'emailAddress', 'phoneNumber', 'town', 'address'].includes(sortByInput)
    ? sortByInput
    : 'displayName';

  let filteredResidents = residents.filter((entry) => {
    const searchBlob = `${entry.displayName || ''} ${entry.emailAddress || ''} ${entry.phoneNumber || ''} ${entry.address || ''} ${entry.town || ''}`.toLowerCase();
    const searchMatch = !searchQuery || searchBlob.includes(searchQuery);
    const townMatch = !selectedTown || entry.town === selectedTown;
    return searchMatch && townMatch;
  });

  const direction = sortDir === 'desc' ? -1 : 1;
  filteredResidents = filteredResidents.sort((a, b) => {
    const left = String(a[sortBy] || '').toLowerCase();
    const right = String(b[sortBy] || '').toLowerCase();
    return left.localeCompare(right) * direction;
  });

  const residentRows = filteredResidents
    .map((entry) => `
      <tr>
        <td><input type="checkbox" class="resident-select" name="selectedResidents" value="${escapeHtml(entry.emailAddress)}"></td>
        <td>${escapeHtml(entry.displayName || '-')}</td>
        <td>${escapeHtml(entry.emailAddress || '-')}</td>
        <td>${escapeHtml(entry.phoneNumber || '-')}</td>
        <td>${escapeHtml(entry.town || '-')}</td>
        <td>${escapeHtml(entry.address || '-')}</td>
      </tr>`)
    .join('') || '<tr><td colspan="6">No residents match the current search/filter.</td></tr>';

  const body = `
    <section class="hero-block"><h1>Resident Management</h1><p class="muted">Search, sort, and export selected residents from this page.</p></section>

    ${exportStatus === 'none' ? '<section class="notice-error" style="margin-top:1rem;">Select at least one resident before exporting.</section>' : ''}

    <section class="panel" style="margin-top:1rem;">
      <h2>Search & Sort Residents</h2>
      <form method="get" action="/resident-management" class="grid">
        <div>
          <label>Search</label>
          <input class="form-control" name="q" value="${escapeHtml(searchQuery)}" placeholder="Name, email, phone, address, town">
        </div>
        <div>
          <label>Town</label>
          <select class="form-control" name="town">
            <option value="">All Towns</option>
            ${towns.map((town) => `<option value="${escapeHtml(town)}" ${selectedTown === town ? 'selected' : ''}>${escapeHtml(town)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label>Sort By</label>
          <select class="form-control" name="sortBy">
            ${[
              ['displayName', 'Name'],
              ['emailAddress', 'Email'],
              ['phoneNumber', 'Number'],
              ['town', 'Town'],
              ['address', 'Address']
            ].map(([value, label]) => `<option value="${value}" ${sortBy === value ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </div>
        <div>
          <label>Sort Direction</label>
          <select class="form-control" name="sortDir">
            <option value="asc" ${sortDir === 'asc' ? 'selected' : ''}>Ascending</option>
            <option value="desc" ${sortDir === 'desc' ? 'selected' : ''}>Descending</option>
          </select>
        </div>
        <div style="align-self:end;"><button class="btn" type="submit">Apply</button></div>
      </form>
    </section>

    <form method="post" action="/resident-management/export">
      <input type="hidden" name="q" value="${escapeHtml(searchQuery)}">
      <input type="hidden" name="town" value="${escapeHtml(selectedTown)}">
      <input type="hidden" name="sortBy" value="${escapeHtml(sortBy)}">
      <input type="hidden" name="sortDir" value="${escapeHtml(sortDir)}">

      <section class="panel table-wrap" style="margin-top:1rem;">
        <h2>Resident Directory</h2>
        <p class="muted">Tick residents you want to export, then click Export Selected.</p>
        <p><label><input type="checkbox" id="selectAllResidents"> Select all visible residents</label></p>
        <table class="table">
          <thead><tr><th>Select</th><th>Name</th><th>Email</th><th>Number</th><th>Town</th><th>Address</th></tr></thead>
          <tbody>${residentRows}</tbody>
        </table>
      </section>
      <p style="margin-top:1rem;"><button class="btn" type="submit">Export Selected Residents (CSV)</button></p>
    </form>

    <script>
      (function () {
        const selectAll = document.getElementById('selectAllResidents');
        if (!selectAll) return;
        selectAll.addEventListener('change', function () {
          document.querySelectorAll('.resident-select').forEach((checkbox) => {
            checkbox.checked = selectAll.checked;
          });
        });
      })();
    </script>`;

  sendPage(res, 'Resident Management', body, 200, { authenticated: true, user: req.session.user });
});

app.post('/resident-management/export', requireRole(['Server Admin', 'Admin']), (req, res) => {
  const selectedResidentsRaw = req.body.selectedResidents;
  const selectedResidents = Array.isArray(selectedResidentsRaw)
    ? selectedResidentsRaw
    : selectedResidentsRaw ? [selectedResidentsRaw] : [];

  const q = String(req.body.q || '').trim();
  const town = String(req.body.town || '').trim();
  const sortBy = String(req.body.sortBy || 'displayName').trim();
  const sortDir = String(req.body.sortDir || 'asc').trim();

  if (!selectedResidents.length) {
    const params = new URLSearchParams({ q, town, sortBy, sortDir, exportStatus: 'none' });
    res.redirect(`/resident-management?${params.toString()}`);
    return;
  }

  const selectedSet = new Set(selectedResidents.map((item) => String(item || '').toLowerCase()));
  const rows = users
    .filter((entry) => entry.role === 'Resident' && selectedSet.has(String(entry.emailAddress || '').toLowerCase()))
    .map((entry) => [
      entry.displayName || '',
      entry.emailAddress || '',
      entry.phoneNumber || '',
      extractTownFromAddress(entry.address || ''),
      entry.address || ''
    ].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','));

  const csv = ['Name,Email,Number,Town,Address', ...rows].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="residents_selected_${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
});

app.get('/user-management', requireRole(['Server Admin', 'Admin']), (req, res) => {
  const searchQuery = String(req.query.q || '').trim().toLowerCase();

  const managedUsers = users
    .filter((entry) => entry.role !== 'Resident')
    .filter((entry) => {
      if (!searchQuery) return true;
      const blob = `${entry.displayName || ''} ${entry.emailAddress || ''} ${entry.role || ''} ${entry.phoneNumber || ''} ${entry.idNumber || ''}`.toLowerCase();
      return blob.includes(searchQuery);
    });

  const userRows = managedUsers
    .map((entry) => `
      <tr>
        <td>${escapeHtml(entry.displayName || '')}</td>
        <td>${escapeHtml(entry.emailAddress || '')}</td>
        <td>${escapeHtml(entry.role || '')}</td>
        <td>
          <form method="post" action="/user-management/update" style="display:grid; gap:0.45rem;">
            <input type="hidden" name="emailAddress" value="${escapeHtml(entry.emailAddress || '')}">
            <input class="form-control" name="displayName" value="${escapeHtml(entry.displayName || '')}" placeholder="Display name" required>
            <input class="form-control" name="idNumber" value="${escapeHtml(entry.idNumber || '')}" placeholder="ID number" required>
            <input class="form-control" name="phoneNumber" value="${escapeHtml(entry.phoneNumber || '')}" placeholder="Phone number">
            <input class="form-control" name="address" value="${escapeHtml(entry.address || '')}" placeholder="Address">
            <select class="form-control" name="role">
              ${['PA Member', 'Admin', 'Server Admin'].map((role) => `<option value="${role}" ${entry.role === role ? 'selected' : ''}>${role}</option>`).join('')}
            </select>
            <input class="form-control" type="password" name="password" placeholder="Set new password (optional)">
            <input class="form-control" name="pin" pattern="\d{4,8}" placeholder="Set new PIN (4-8 digits, optional)">
            <button class="btn" type="submit">Save User</button>
          </form>
        </td>
      </tr>`)
    .join('') || '<tr><td colspan="4">No staff/admin users match the search.</td></tr>';

  const body = `
    <section class="hero-block"><h1>Staff & User Management</h1><p class="muted">Search and manage Admin, PA Member, and Server Admin accounts, including password/PIN updates.</p></section>
    <section class="panel" style="margin-top:1rem;">
      <form method="get" action="/user-management" class="grid">
        <div>
          <label>Search Users</label>
          <input class="form-control" name="q" value="${escapeHtml(searchQuery)}" placeholder="Name, email, role, phone, ID number">
        </div>
        <div style="align-self:end;"><button class="btn" type="submit">Search</button></div>
      </form>
    </section>
    <section class="panel table-wrap" style="margin-top:1rem;">
      <table class="table">
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Edit</th></tr></thead>
        <tbody>${userRows}</tbody>
      </table>
    </section>`;

  sendPage(res, 'Staff & User Management', body, 200, { authenticated: true, user: req.session.user });
});

app.post('/user-management/update', requireRole(['Server Admin', 'Admin']), (req, res) => {
  const emailAddress = String(req.body.emailAddress || '').trim().toLowerCase();
  const displayName = String(req.body.displayName || '').trim();
  const idNumber = String(req.body.idNumber || '').trim();
  const phoneNumber = String(req.body.phoneNumber || '').trim();
  const address = String(req.body.address || '').trim();
  const role = String(req.body.role || '').trim();
  const password = String(req.body.password || '').trim();
  const pin = String(req.body.pin || '').trim();

  const editableRoles = ['PA Member', 'Admin', 'Server Admin'];
  const target = users.find((entry) => entry.emailAddress.toLowerCase() === emailAddress);

  if (!target || !displayName || !idNumber || !editableRoles.includes(role) || target.role === 'Resident' || (pin && !/^\d{4,8}$/.test(pin))) {
    res.redirect('/user-management');
    return;
  }

  const duplicateId = users.find((entry) => entry !== target && String(entry.idNumber || '') === idNumber);
  if (duplicateId) {
    res.redirect('/user-management');
    return;
  }

  target.displayName = displayName;
  target.idNumber = idNumber;
  target.phoneNumber = phoneNumber;
  target.address = address;
  target.role = role;
  if (password) {
    target.password = password;
  }
  if (pin) {
    target.pin = pin;
  }

  res.redirect('/user-management');
});

app.get('/incident-management', requireRole(['Server Admin', 'Admin']), (req, res) => {
  const options = ['Ward Councillor', 'PA Member Liaison', 'Regional Coordinator', 'Provincial Desk'];

  const rows = incidents
    .slice()
    .reverse()
    .map((entry) => `
      <tr>
        <td>${escapeHtml(entry.ticketReference)}</td>
        <td>${escapeHtml(entry.reporterName)}</td>
        <td>${escapeHtml(entry.category)}</td>
        <td>${escapeHtml(entry.status || 'Logged')}</td>
        <td>${escapeHtml(entry.escalationLevel || 'Ward Councillor')}</td>
        <td>
          <form method="post" action="/incident-management/escalate" style="display:grid; gap:0.45rem;">
            <input type="hidden" name="ticketReference" value="${escapeHtml(entry.ticketReference)}">
            <select class="form-control" name="escalationLevel">
              ${options.map((item) => `<option value="${item}" ${(entry.escalationLevel || 'Ward Councillor') === item ? 'selected' : ''}>${item}</option>`).join('')}
            </select>
            <select class="form-control" name="status">
              ${['Logged', 'Pending', 'Resolved'].map((state) => `<option value="${state}" ${(entry.status || 'Logged') === state ? 'selected' : ''}>${state}</option>`).join('')}
            </select>
            <button class="btn" type="submit">Update Incident</button>
          </form>
        </td>
      </tr>`)
    .join('') || '<tr><td colspan="6">No incidents logged yet.</td></tr>';

  const body = `
    <section class="hero-block"><h1>Incident Escalations</h1><p class="muted">Escalate resident incidents to higher structures and update workflow status.</p></section>
    <section class="panel table-wrap" style="margin-top:1rem;">
      <table class="table">
        <thead><tr><th>Ticket</th><th>Resident</th><th>Category</th><th>Status</th><th>Escalation</th><th>Actions</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </section>`;

  sendPage(res, 'Incident Escalations', body, 200, { authenticated: true, user: req.session.user });
});

app.post('/incident-management/escalate', requireRole(['Server Admin', 'Admin']), (req, res) => {
  const ticketReference = String(req.body.ticketReference || '').trim();
  const escalationLevel = String(req.body.escalationLevel || '').trim();
  const status = String(req.body.status || '').trim();

  const allowedEscalations = ['Ward Councillor', 'PA Member Liaison', 'Regional Coordinator', 'Provincial Desk'];
  const allowedStatuses = ['Logged', 'Pending', 'Resolved'];

  const incident = incidents.find((entry) => entry.ticketReference === ticketReference);
  if (!incident || !allowedEscalations.includes(escalationLevel) || !allowedStatuses.includes(status)) {
    res.redirect('/incident-management');
    return;
  }

  incident.escalationLevel = escalationLevel;
  incident.status = status;

  notifications.push({
    id: `notif-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    type: 'IncidentEscalation',
    ticketReference,
    message: `Incident ${ticketReference} escalated to ${escalationLevel} with status ${status}.`,
    recipients: users
      .filter((entry) => entry.role === 'PA Member' || entry.role === 'Admin' || entry.role === 'Server Admin')
      .map((entry) => ({ emailAddress: entry.emailAddress, displayName: entry.displayName, role: entry.role })),
    createdAt: new Date().toISOString()
  });

  res.redirect('/incident-management');
});

app.get('/edit-my-user', requireLogin, (req, res) => {
  const account = users.find((entry) => entry.emailAddress.toLowerCase() === req.session.user.emailAddress.toLowerCase());
  const body = `
    <section class="hero-block"><h1>Edit My User</h1><p class="muted">Update your phone number, address, and login PIN whenever needed.</p></section>
    <section class="auth-shell" style="margin-top:1rem;">
      <form method="post" action="/edit-my-user">
        <div class="grid">
          <div><label>Email Address</label><input class="form-control" value="${escapeHtml(account?.emailAddress || req.session.user.emailAddress)}" disabled></div>
          <div><label>Phone Number</label><input class="form-control" name="phoneNumber" value="${escapeHtml(account?.phoneNumber || '')}"></div>
          <div><label>Address</label><input class="form-control" name="address" value="${escapeHtml(account?.address || '')}"></div>
          <div><label>Current PIN</label><input class="form-control" type="password" name="currentPin" placeholder="Enter current PIN to change it"></div>
          <div><label>New PIN (4-8 digits)</label><input class="form-control" name="newPin" pattern="\d{4,8}" placeholder="Leave blank to keep current PIN"></div>
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

    const currentPin = String(req.body.currentPin || '').trim();
    const newPin = String(req.body.newPin || '').trim();
    if (newPin && /^\d{4,8}$/.test(newPin) && String(account.pin || '') === currentPin) {
      account.pin = newPin;
    }
  }
  res.redirect('/edit-my-user');
});

app.get('/api/health', (req, res) => {
  res.status(200).json({
    service: 'PA Infrastructure API',
    status: 'ok',
    environment: systemConfiguration.environmentName,
    timeUtc: new Date().toISOString()
  });
});

app.get('/api/faults', requireLogin, (req, res) => {
  const role = req.session.user.role;
  const isStaff = role === 'Server Admin' || role === 'Admin' || role === 'PA Member';
  const list = isStaff
    ? incidents
    : incidents.filter((entry) => entry.reporterEmail === req.session.user.emailAddress);

  res.status(200).json({
    total: list.length,
    faults: list
  });
});

app.post('/api/faults', requireLogin, (req, res) => {
  const category = String(req.body.category || '').trim();
  const googlePinUrl = String(req.body.googlePinUrl || '').trim();
  const description = String(req.body.description || '').trim();
  const photoDataUrl = String(req.body.photoDataUrl || '').trim();

  if (!category || !googlePinUrl || !description) {
    res.status(400).json({ message: 'category, googlePinUrl, and description are required.' });
    return;
  }

  const result = buildIncidentRecord({
    reporterEmail: req.session.user.emailAddress,
    reporterName: req.session.user.displayName,
    category,
    googlePinUrl,
    description,
    photoDataUrl
  });

  if (result.error) {
    res.status(400).json({ message: result.error });
    return;
  }

  res.status(201).json({
    message: 'Fault logged successfully.',
    fault: result.incident
  });
});

app.get('/api/heatmap', requireLogin, (req, res) => {
  const role = req.session.user.role;
  const isStaff = role === 'Server Admin' || role === 'Admin' || role === 'PA Member';
  if (!isStaff) {
    res.status(403).json({ message: 'Staff access required.' });
    return;
  }

  res.status(200).json({
    totalFaults: incidents.length,
    heatmap: buildHeatmapSummary(),
    mapsConfigured: Boolean(systemConfiguration.googleMapsApiKey)
  });
});

app.get('/api/notifications', requireRole(['Server Admin', 'Admin', 'PA Member']), (req, res) => {
  const email = String(req.session.user.emailAddress || '').toLowerCase();

  const list = notifications
    .filter((entry) => (entry.recipients || []).some((recipient) => String(recipient.emailAddress || '').toLowerCase() === email))
    .slice()
    .reverse();

  res.status(200).json({
    total: list.length,
    notifications: list
  });
});

app.post('/api/whatsapp/import', requireImportWebhook, processWhatsAppImportRequest);

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
