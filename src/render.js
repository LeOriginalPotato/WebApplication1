const { CATEGORIES, ESCALATIONS, ASSIGNABLE_BY_ADMIN, ASSIGNABLE_BY_SERVER_ADMIN } = require('./security');

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatWhen(value) {
  if (!value) return '';
  const text = String(value).replace(' ', 'T');
  const date = new Date(text.endsWith('Z') ? text : `${text}Z`);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-ZA', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Johannesburg',
  }).format(date);
}

function statusClass(status) {
  if (status === 'Resolved') return 'is-resolved';
  if (status === 'In progress') return 'is-progress';
  return 'is-received';
}

function pill(status) {
  return `<span class="pill ${statusClass(status)}">${esc(status)}</span>`;
}

function csrfField(token) {
  return `<input type="hidden" name="_csrf" value="${esc(token)}">`;
}

function notice(flash) {
  if (!flash || !flash.text) return '';
  const kind = flash.type === 'error' ? 'error' : 'success';
  return `<div class="notice ${kind}" role="status">${esc(flash.text)}</div>`;
}

function primaryNav(user) {
  if (!user) return [];
  if (user.role === 'Resident') {
    return [
      ['home', '/', 'Home'],
      ['report', '/report', 'Report'],
      ['reports', '/my-reports', 'My reports'],
      ['more', '/more', 'More'],
    ];
  }
  const items = [
    ['complaints', '/complaints', 'Complaints'],
    ['map', '/map', 'Map'],
  ];
  if (user.role === 'Admin' || user.role === 'Server Admin') items.push(['people', '/people', 'People']);
  items.push(['more', '/more', 'More']);
  return items;
}

function navLinks(user, active, className) {
  return primaryNav(user).map(([key, href, label]) => {
    const current = key === active ? ' aria-current="page" class="is-active"' : '';
    return `<a href="${href}"${current}>${label}</a>`;
  }).join('');
}

function layout({ title, settings, user, unread = 0, active = '', body }) {
  const siteName = settings?.site_name || 'PA At Work';
  const home = !user ? '/login' : user.role === 'Resident' ? '/' : '/complaints';
  const whatsapp = settings?.whatsapp_link
    ? `<a class="whatsapp" href="${esc(settings.whatsapp_link)}" target="_blank" rel="noopener noreferrer">WhatsApp</a>`
    : '';
  const tools = user
    ? `<a class="bell" href="/notifications" aria-label="Notifications${unread ? `, ${unread} unread` : ''}">Alerts${unread ? `<span class="badge">${esc(unread)}</span>` : ''}</a>`
    : `<a class="header-link" href="/login">Sign in</a><a class="header-link" href="/register">Register</a>`;
  const desktop = user ? `<nav class="header-nav" aria-label="Primary">${navLinks(user, active)}</nav>` : '';
  const bottom = user
    ? `<nav class="bottom-nav" aria-label="Primary">${navLinks(user, active)}</nav>`
    : '';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#e7f7ed">
  <title>${esc(title)} · ${esc(siteName)}</title>
  <link rel="icon" href="/images/pa-logo.png">
  <link rel="stylesheet" href="/styles/site.css">
</head>
<body>
  <header class="site-header">
    <div class="site-header-inner">
      <a class="brand" href="${home}">
        <img src="/images/pa-logo.png" alt="" width="44" height="44">
        <span><strong>${esc(siteName)}</strong><small>A Patriotic Alliance service</small></span>
      </a>
      ${desktop}
      <div class="header-tools">${whatsapp}${tools}</div>
    </div>
  </header>
  <main class="site-main">${body}</main>
  <footer class="site-footer"><div class="site-footer-inner"><span>${esc(siteName)}</span><a href="/privacy">Privacy</a></div></footer>
  ${bottom}
</body>
</html>`;
}

function page(opts, inner) {
  return layout({ ...opts, body: `${notice(opts.flash)}${inner}` });
}

function placeLabel(complaint) {
  return [complaint.wardName, complaint.municipalityName].filter(Boolean).join(', ');
}

function complaintCard(complaint, href, { showPhoto = true } = {}) {
  const photo = showPhoto && complaint.photoStoredName
    ? `<img class="thumb" src="/complaints/${Number(complaint.id)}/photo" alt="Photo of the ${esc(complaint.category)}">`
    : '';
  const where = placeLabel(complaint);
  return `<article class="card">
    <div class="card-top"><strong>${esc(complaint.ticketReference)}</strong>${pill(complaint.status)}</div>
    <h2>${esc(complaint.category)}</h2>
    <p>${esc(where)}</p>
    <p>${esc(complaint.address)}</p>
    ${photo}
    <p><a class="btn" href="${href}">Open</a></p>
  </article>`;
}

function areaFields(areas, { municipalityId = '', wardId = '' } = {}) {
  const municipalities = areas.filter((area) => area.kind === 'municipality');
  const wards = areas.filter((area) => area.kind === 'ward');
  const muniOptions = municipalities.map((area) => `<option value="${area.id}"${Number(municipalityId) === area.id ? ' selected' : ''}>${esc(area.name)}</option>`).join('');
  const wardOptions = wards.map((area) => `<option value="${area.id}" data-parent="${area.parent_id}"${Number(wardId) === area.id ? ' selected' : ''}>${esc(area.parent_name ? `${area.parent_name} · ${area.name}` : area.name)}</option>`).join('');
  return `<div class="grid">
    <label>Municipality<select class="control" id="municipality" name="municipalityId" required><option value="">Choose</option>${muniOptions}</select></label>
    <label>Ward<select class="control" id="ward" name="wardId" required><option value="">Choose</option>${wardOptions}</select></label>
  </div>`;
}

function wardFilterScript() {
  return `<script>
(function () {
  var muni = document.getElementById('municipality');
  var ward = document.getElementById('ward');
  if (!muni || !ward) return;
  function filterWards() {
    var parent = muni.value;
    Array.prototype.forEach.call(ward.options, function (opt) {
      if (!opt.value) return;
      var show = opt.getAttribute('data-parent') === parent;
      opt.hidden = !show;
      opt.disabled = !show;
    });
    if (ward.selectedOptions[0] && ward.selectedOptions[0].disabled) ward.value = '';
  }
  muni.addEventListener('change', filterWards);
  filterWards();
})();
</script>`;
}

function loginPage(opts) {
  const inner = `<section class="panel narrow">
    <h1>Sign in</h1>
    <p class="muted">Use the email and password or PIN for your PA At Work account.</p>
    <form method="post" action="/login">
      ${csrfField(opts.csrf)}
      <input type="hidden" name="returnUrl" value="${esc(opts.returnUrl || '')}">
      <input type="hidden" id="loginMethod" name="loginMethod" value="password">
      <label>Email<input class="control" type="email" name="email" autocomplete="username" required></label>
      <label id="credentialLabel">Password<input class="control" id="credential" type="password" name="credential" autocomplete="current-password" required></label>
      <button class="text-button" type="button" id="toggleLogin">Use PIN instead</button>
      <button class="btn" type="submit">Sign in</button>
    </form>
    <p class="muted">No account yet? <a href="/register">Register as a resident</a></p>
  </section>
  <script>
  (function () {
    var method = document.getElementById('loginMethod');
    var toggle = document.getElementById('toggleLogin');
    var label = document.getElementById('credentialLabel');
    var input = document.getElementById('credential');
    toggle.addEventListener('click', function () {
      var usePin = method.value !== 'pin';
      method.value = usePin ? 'pin' : 'password';
      label.firstChild.textContent = usePin ? 'PIN' : 'Password';
      input.autocomplete = usePin ? 'one-time-code' : 'current-password';
      toggle.textContent = usePin ? 'Use password instead' : 'Use PIN instead';
      input.focus();
    });
  })();
  </script>`;
  return page({ ...opts, title: 'Sign in', active: '' }, inner);
}

function registerPage(opts) {
  const values = opts.values || {};
  const inner = `<section class="panel">
    <h1>Register</h1>
    <p class="muted">Create a resident account so you can log service problems and follow them.</p>
    <form method="post" action="/register">
      ${csrfField(opts.csrf)}
      <div class="grid">
        <label>Name<input class="control" name="fullName" value="${esc(values.fullName)}" required></label>
        <label>Surname<input class="control" name="surname" value="${esc(values.surname)}" required></label>
        <label>Email<input class="control" type="email" name="email" value="${esc(values.email)}" autocomplete="username" required></label>
        <label>Phone<input class="control" name="phone" value="${esc(values.phone)}" autocomplete="tel" required></label>
      </div>
      <label>Street address<input class="control" name="address" value="${esc(values.address)}" required></label>
      ${areaFields(opts.areas, values)}
      <label>ID number <span class="muted">(optional)</span><input class="control" name="idNumber" value="${esc(values.idNumber)}" autocomplete="off"></label>
      <div class="grid">
        <label>Password<input class="control" type="password" name="password" autocomplete="new-password" minlength="10" required></label>
        <label>PIN (4–8 digits)<input class="control" type="password" name="pin" inputmode="numeric" pattern="\\d{4,8}" autocomplete="new-password" required></label>
      </div>
      <label class="check"><input type="checkbox" name="consent" value="yes" required> I agree that PA At Work may store my name, contact details, and complaint photos so the party can follow up service delivery.</label>
      <button class="btn" type="submit">Create account</button>
    </form>
  </section>${wardFilterScript()}`;
  return page({ ...opts, title: 'Register' }, inner);
}

function residentHomePage(opts) {
  const first = (opts.user.displayName || '').split(' ')[0] || 'there';
  const list = opts.complaints.slice(0, 3).map((item) => complaintCard(item, `/my-reports/${item.id}`)).join('')
    || '<p class="muted">You have not logged a complaint yet.</p>';
  const inner = `<section class="hero">
      <h1>Good day, ${esc(first)}.</h1>
      <p>Report a service problem in your area, then follow it here.</p>
      <p><a class="btn" href="/report">Report a problem</a></p>
    </section>
    <section class="totals" aria-label="Public complaint totals">
      <article><span>On record</span><strong>${esc(opts.totals.total)}</strong></article>
      <article><span>Resolved</span><strong>${esc(opts.totals.resolved)}</strong></article>
    </section>
    <p class="muted">These are totals for the whole service. They do not show anyone else's complaint or personal details.</p>
    <section><h2>Your latest reports</h2>${list}<p><a href="/my-reports">All my reports</a></p></section>`;
  return page({ ...opts, title: 'Home', active: 'home' }, inner);
}

function reportPage(opts) {
  const values = opts.values || {};
  const tiles = CATEGORIES.map((category) => `
    <label class="tile"><input type="radio" name="category" value="${esc(category)}"${values.category === category ? ' checked' : ''} required><span>${esc(category)}</span></label>
  `).join('');
  const inner = `<section class="panel">
    <h1>Report a problem</h1>
    <p class="muted">Choose what is wrong, say where it is, and add a photo if you can.</p>
    <form method="post" action="/report" enctype="multipart/form-data">
      ${csrfField(opts.csrf)}
      <fieldset class="tiles">${tiles}</fieldset>
      <label>What happened?<textarea class="control" name="description" rows="4" required>${esc(values.description)}</textarea></label>
      <label>Street address<input class="control" name="address" value="${esc(values.address)}" required></label>
      ${areaFields(opts.areas, values)}
      <div class="location-row">
        <button class="btn secondary" type="button" id="useLocation">Use my location</button>
        <p id="locStatus" class="muted"></p>
      </div>
      <div class="grid">
        <label>Latitude<input class="control" id="latitude" name="latitude" value="${esc(values.latitude)}" inputmode="decimal"></label>
        <label>Longitude<input class="control" id="longitude" name="longitude" value="${esc(values.longitude)}" inputmode="decimal"></label>
      </div>
      <label class="photo-field">Photo<input class="control" id="photo" type="file" name="photo" accept="image/*" capture="environment"></label>
      <img id="photoPreview" class="preview" alt="Selected photo preview" hidden>
      <div class="submit-bar"><button class="btn" type="submit">Submit complaint</button></div>
    </form>
  </section>
  ${wardFilterScript()}
  <script>
  (function () {
    var input = document.getElementById('photo');
    var preview = document.getElementById('photoPreview');
    var loc = document.getElementById('useLocation');
    var lat = document.getElementById('latitude');
    var lng = document.getElementById('longitude');
    var status = document.getElementById('locStatus');
    if (input && preview) {
      input.addEventListener('change', function () {
        var file = input.files && input.files[0];
        if (!file) { preview.hidden = true; return; }
        preview.src = URL.createObjectURL(file);
        preview.hidden = false;
      });
    }
    if (loc && navigator.geolocation) {
      loc.addEventListener('click', function () {
        status.textContent = 'Finding your location…';
        navigator.geolocation.getCurrentPosition(function (pos) {
          lat.value = pos.coords.latitude.toFixed(6);
          lng.value = pos.coords.longitude.toFixed(6);
          status.textContent = 'Location added. Check the street address as well.';
        }, function () {
          status.textContent = 'Location is unavailable. Type the address instead.';
        }, { enableHighAccuracy: true, timeout: 10000 });
      });
    }
  })();
  </script>`;
  return page({ ...opts, title: 'Report', active: 'report' }, inner);
}

function myReportsPage(opts) {
  const list = opts.complaints.map((item) => complaintCard(item, `/my-reports/${item.id}`)).join('')
    || '<p class="muted">No complaints yet. <a href="/report">Report a problem</a>.</p>';
  return page({ ...opts, title: 'My reports', active: 'reports' }, `<h1>My reports</h1>${list}`);
}

function timeline(updates) {
  if (!updates.length) return '';
  const items = updates.map((update) => `<li><strong>${esc(update.status)}</strong><span>${esc(formatWhen(update.created_at))}</span><p>${esc(update.note)}</p></li>`).join('');
  return `<ol class="timeline">${items}</ol>`;
}

function reportDetailPage(opts) {
  const complaint = opts.complaint;
  const photo = complaint.photoStoredName
    ? `<img class="photo" src="/complaints/${complaint.id}/photo" alt="Photo you attached">`
    : '';
  const inner = `<p><a href="/my-reports">Back to my reports</a></p>
    <article class="panel">
      <div class="card-top"><h1>${esc(complaint.ticketReference)}</h1>${pill(complaint.status)}</div>
      <p><strong>${esc(complaint.category)}</strong> · ${esc(placeLabel(complaint))}</p>
      <p>${esc(complaint.address)}</p>
      <p>${esc(complaint.description)}</p>
      ${complaint.assigneeLabel ? `<p>Sent: ${esc(complaint.assigneeLabel)}${complaint.dispatchedAt ? ` · ${esc(formatWhen(complaint.dispatchedAt))}` : ''}</p>` : ''}
      ${complaint.escalationLevel ? `<p>Referred to ${esc(complaint.escalationLevel)}</p>` : ''}
      ${photo}
      <h2>Updates</h2>
      ${timeline(opts.updates)}
    </article>`;
  return page({ ...opts, title: complaint.ticketReference, active: 'reports' }, inner);
}

function complaintsPage(opts) {
  const filters = opts.filters || {};
  const statusOptions = ['', 'Received', 'In progress', 'Resolved'].map((status) => {
    const label = status || 'All statuses';
    return `<option value="${esc(status)}"${filters.status === status ? ' selected' : ''}>${label}</option>`;
  }).join('');
  const categoryOptions = [''].concat(CATEGORIES).map((category) => {
    const label = category || 'All categories';
    return `<option value="${esc(category)}"${filters.category === category ? ' selected' : ''}>${label}</option>`;
  }).join('');
  const list = opts.complaints.map((item) => complaintCard(item, `/complaints/${item.id}`)).join('')
    || '<p class="muted">No complaints in your areas yet.</p>';
  const inner = `<h1>Complaints</h1>
    <p class="muted">Location, description, photo, and category only. Resident contact details are not shown.</p>
    <form class="filters" method="get" action="/complaints">
      <label>Status<select class="control" name="status">${statusOptions}</select></label>
      <label>Category<select class="control" name="category">${categoryOptions}</select></label>
      <button class="btn secondary" type="submit">Filter</button>
    </form>
    ${list}`;
  return page({ ...opts, title: 'Complaints', active: 'complaints' }, inner);
}

function complaintDetailPage(opts) {
  const complaint = opts.complaint;
  const photo = complaint.photoStoredName
    ? `<p><img class="photo" src="/complaints/${complaint.id}/photo" alt="Photo of the problem"></p>`
    : '';
  const mapLink = complaint.latitude !== null && complaint.longitude !== null
    ? `<p><a href="https://www.openstreetmap.org/?mlat=${encodeURIComponent(complaint.latitude)}&mlon=${encodeURIComponent(complaint.longitude)}#map=16/${encodeURIComponent(complaint.latitude)}/${encodeURIComponent(complaint.longitude)}" target="_blank" rel="noopener noreferrer">Open location</a></p>`
    : '';
  const closed = complaint.status === 'Resolved';
  const dispatch = closed ? '' : `<form method="post" action="/complaints/${complaint.id}/dispatch">
      ${csrfField(opts.csrf)}
      <label>Who was sent?<input class="control" name="assignee" value="${esc(complaint.assigneeLabel)}" required></label>
      <button class="btn" type="submit">${complaint.assigneeLabel ? 'Update dispatch' : 'Dispatch'}</button>
    </form>`;
  const complete = closed ? '' : `<form method="post" action="/complaints/${complaint.id}/complete" onsubmit="return confirm('Mark this complaint complete?')">
      ${csrfField(opts.csrf)}
      <button class="btn" type="submit">Mark complete</button>
    </form>`;
  const escalate = opts.canEscalate && !closed ? `<form method="post" action="/complaints/${complaint.id}/escalate">
      ${csrfField(opts.csrf)}
      <label>Refer to<select class="control" name="level">${ESCALATIONS.map((level) => `<option${complaint.escalationLevel === level ? ' selected' : ''}>${esc(level)}</option>`).join('')}</select></label>
      <button class="btn secondary" type="submit">Save referral</button>
    </form>` : (complaint.escalationLevel ? `<p>Referred to ${esc(complaint.escalationLevel)}</p>` : '');
  const inner = `<p><a href="/complaints">Back to complaints</a></p>
    <article class="panel">
      <div class="card-top"><h1>${esc(complaint.ticketReference)}</h1>${pill(complaint.status)}</div>
      <p><strong>${esc(complaint.category)}</strong> · ${esc(placeLabel(complaint))}</p>
      <p>${esc(complaint.address)}</p>
      ${mapLink}
      <p>${esc(complaint.description)}</p>
      ${photo}
      ${dispatch}
      ${complete}
      ${escalate}
      <h2>Updates</h2>
      ${timeline(opts.updates)}
    </article>`;
  return page({ ...opts, title: complaint.ticketReference, active: 'complaints' }, inner);
}

function mapPage(opts) {
  const counts = CATEGORIES.map((category) => {
    const found = opts.counts.find((row) => row.category === category);
    return `<article><span>${esc(category)}</span><strong>${esc(found ? found.total : 0)}</strong></article>`;
  }).join('');
  const pins = opts.complaints.map((complaint) => {
    const link = complaint.latitude !== null && complaint.longitude !== null
      ? `<a href="https://www.openstreetmap.org/?mlat=${encodeURIComponent(complaint.latitude)}&mlon=${encodeURIComponent(complaint.longitude)}#map=16/${encodeURIComponent(complaint.latitude)}/${encodeURIComponent(complaint.longitude)}" target="_blank" rel="noopener noreferrer">Map</a>`
      : '';
    return `<article class="card"><div class="card-top"><strong>${esc(complaint.category)}</strong>${pill(complaint.status)}</div><p>${esc(placeLabel(complaint))}</p><p>${esc(complaint.address)}</p><p>${link} <a href="/complaints/${complaint.id}">Open</a></p></article>`;
  }).join('') || '<p class="muted">No located complaints in your areas yet.</p>';
  const inner = `<h1>Map</h1>
    <p class="muted">${esc(opts.scopeLabel)}</p>
    <section class="totals"><article><span>On record</span><strong>${esc(opts.total)}</strong></article><article><span>Resolved</span><strong>${esc(opts.resolved)}</strong></article></section>
    <section class="totals">${counts}</section>
    ${pins}`;
  return page({ ...opts, title: 'Map', active: 'map' }, inner);
}

function peoplePage(opts) {
  const residents = opts.residents.map((person) => `
    <article class="card person">
      <label class="check"><input type="checkbox" name="selected" value="${person.id}"> <strong>${esc(person.display_name)}</strong></label>
      <p>${esc(person.email)}</p>
      <p>${esc(person.phone || 'No phone')} · ${esc([person.municipality_name, person.ward_name].filter(Boolean).join(' · ') || 'No area')}</p>
      <p>${esc(person.address || '')}</p>
      ${opts.showId && person.id_number ? `<p>ID ${esc(person.id_number)}</p>` : ''}
    </article>`).join('') || '<p class="muted">No residents in your areas.</p>';
  const areaChecks = (selected) => opts.areas.map((area) => {
    const checked = selected && selected.includes(area.id) ? ' checked' : '';
    const label = area.kind === 'ward' && area.parent_name ? `${area.parent_name} · ${area.name}` : area.name;
    return `<label class="check"><input type="checkbox" name="areas" value="${area.id}"${checked}> ${esc(label)} <span class="muted">${esc(area.kind)}</span></label>`;
  }).join('');
  const roleOptions = (selected, roles) => roles.map((role) => `<option${selected === role ? ' selected' : ''}>${esc(role)}</option>`).join('');
  const roles = opts.user.role === 'Server Admin' ? ASSIGNABLE_BY_SERVER_ADMIN : ASSIGNABLE_BY_ADMIN;
  const staff = opts.staff.map((person) => `
    <article class="card">
      <h3>${esc(person.display_name)}</h3>
      <p>${esc(person.email)} · ${esc(person.role)}</p>
      <p>${esc((person.areas || []).map((area) => area.name).join(', ') || 'All areas')}</p>
      <form method="post" action="/people/staff/${person.id}">
        ${csrfField(opts.csrf)}
        <label>Name<input class="control" name="displayName" value="${esc(person.display_name)}" required></label>
        <label>Phone<input class="control" name="phone" value="${esc(person.phone || '')}"></label>
        <label>Role<select class="control" name="role">${roleOptions(person.role, person.role === 'Server Admin' ? ASSIGNABLE_BY_SERVER_ADMIN : roles)}</select></label>
        <fieldset><legend>Areas</legend>${areaChecks((person.areas || []).map((area) => area.id))}</fieldset>
        <label>New password <span class="muted">(optional)</span><input class="control" type="password" name="password" autocomplete="new-password"></label>
        <label>New PIN <span class="muted">(optional)</span><input class="control" name="pin" inputmode="numeric" pattern="\\d{4,8}"></label>
        <button class="btn secondary" type="submit">Save</button>
      </form>
    </article>`).join('') || '<p class="muted">No staff in your areas.</p>';
  const inner = `<h1>People</h1>
    <section>
      <h2>Residents</h2>
      <form method="get" action="/people" class="filters">
        <label>Search<input class="control" name="q" value="${esc(opts.search)}" placeholder="Name, email, area"></label>
        <button class="btn secondary" type="submit">Search</button>
      </form>
      <form method="post" action="/people/export">
        ${csrfField(opts.csrf)}
        <input type="hidden" name="q" value="${esc(opts.search)}">
        ${residents}
        <button class="btn secondary" type="submit">Export selected</button>
      </form>
    </section>
    <section>
      <h2>Staff</h2>
      <article class="panel">
        <h3>Add staff</h3>
        <form method="post" action="/people/staff">
          ${csrfField(opts.csrf)}
          <div class="grid">
            <label>Name<input class="control" name="fullName" required></label>
            <label>Surname<input class="control" name="surname" required></label>
            <label>Email<input class="control" type="email" name="email" required></label>
            <label>Phone<input class="control" name="phone"></label>
          </div>
          <label>Role<select class="control" name="role">${roleOptions('PA Member', roles)}</select></label>
          <fieldset><legend>Areas</legend><p class="muted">Required for PA members and admins. A server admin can cover every area.</p>${areaChecks([])}</fieldset>
          <div class="grid">
            <label>Password<input class="control" type="password" name="password" minlength="10" autocomplete="new-password" required></label>
            <label>PIN<input class="control" name="pin" inputmode="numeric" pattern="\\d{4,8}" required></label>
          </div>
          <button class="btn" type="submit">Add staff</button>
        </form>
      </article>
      ${staff}
    </section>`;
  return page({ ...opts, title: 'People', active: 'people' }, inner);
}

function morePage(opts) {
  const links = [
    ['/notifications', 'Notifications'],
    ['/profile', 'Profile'],
    ['/privacy', 'Privacy'],
  ];
  if (opts.user.role === 'Resident') links.splice(2, 0, ['/section78', 'Rates objection']);
  if (opts.user.role === 'Admin' || opts.user.role === 'Server Admin') links.push(['/rates', 'Rates objections']);
  if (opts.user.role === 'Server Admin') links.push(['/settings', 'Settings']);
  const list = links.map(([href, label]) => `<a class="more-link" href="${href}">${label}</a>`).join('');
  const inner = `<h1>More</h1><div class="more-list">${list}</div>
    <form method="post" action="/logout">${csrfField(opts.csrf)}<button class="btn secondary" type="submit">Sign out</button></form>`;
  return page({ ...opts, title: 'More', active: 'more' }, inner);
}

function notificationsPage(opts) {
  const hrefFor = (id) => opts.user.role === 'Resident' ? `/my-reports/${id}` : `/complaints/${id}`;
  const list = opts.notifications.map((item) => {
    const unread = item.read_at ? '' : ' is-unread';
    const link = item.complaint_id ? `<a href="${hrefFor(item.complaint_id)}">${esc(item.message)}</a>` : esc(item.message);
    return `<article class="card${unread}"><p>${link}</p><p class="muted">${esc(formatWhen(item.created_at))}</p></article>`;
  }).join('') || '<p class="muted">No notifications yet.</p>';
  const inner = `<h1>Notifications</h1>
    <form method="post" action="/notifications/read">${csrfField(opts.csrf)}<button class="btn secondary" type="submit">Mark all read</button></form>
    ${list}`;
  return page({ ...opts, title: 'Notifications', active: 'more' }, inner);
}

function profilePage(opts) {
  const user = opts.user;
  const inner = `<section class="panel">
    <h1>Profile</h1>
    <form method="post" action="/profile">
      ${csrfField(opts.csrf)}
      <label>Email<input class="control" value="${esc(user.email)}" disabled></label>
      <label>Phone<input class="control" name="phone" value="${esc(user.phone)}" required></label>
      <label>Address<input class="control" name="address" value="${esc(user.address)}"></label>
      ${user.role === 'Resident' ? areaFields(opts.areas, { municipalityId: opts.municipalityId, wardId: opts.wardId }) : ''}
      <label>Current password<input class="control" type="password" name="currentPassword" autocomplete="current-password"></label>
      <label>New PIN <span class="muted">(optional, 4–8 digits)</span><input class="control" name="newPin" inputmode="numeric" pattern="\\d{4,8}"></label>
      <button class="btn" type="submit">Save profile</button>
    </form>
  </section>${user.role === 'Resident' ? wardFilterScript() : ''}`;
  return page({ ...opts, title: 'Profile', active: 'more' }, inner);
}

function section78Page(opts) {
  const previous = (opts.previous || []).map((item) => `<article class="card"><strong>${esc(item.reference_code)}</strong><p>${esc(item.property_address)}</p><p class="muted">${esc(formatWhen(item.created_at))}</p></article>`).join('');
  const inner = `<section class="panel">
    <h1>Rates objection</h1>
    <p class="muted">This is for a municipal rates or property-category dispute. It is separate from a pothole or outage report.</p>
    <form method="post" action="/section78">
      ${csrfField(opts.csrf)}
      <label>Property address<input class="control" name="propertyAddress" required></label>
      <label>Municipal account number<input class="control" name="municipalAccountNumber" required></label>
      <div class="grid">
        <label>Erf or stand<input class="control" name="erfNumber" required></label>
        <label>Title deed number<input class="control" name="titleDeedNumber" required></label>
      </div>
      <label>Actual use of the property<input class="control" name="actualDominantUse" required></label>
      <label>Category you are disputing<input class="control" name="propertyCategoryDispute" required></label>
      <label>Your statement<textarea class="control" name="ownerStatement" rows="5" required></textarea></label>
      <label class="check"><input type="checkbox" name="noFormalNotice" value="yes" required> I did not receive a formal reclassification notice.</label>
      <label class="check"><input type="checkbox" name="noSection78Documents" value="yes" required> I did not receive the Section 78 documents.</label>
      <label class="check"><input type="checkbox" name="consent" value="yes" required> I agree that PA may use these details to raise the dispute with the municipality.</label>
      <button class="btn" type="submit">Submit objection</button>
    </form>
    ${previous ? `<h2>Your objections</h2>${previous}` : ''}
  </section>`;
  return page({ ...opts, title: 'Rates objection', active: 'more' }, inner);
}

function ratesPage(opts) {
  const list = opts.disputes.map((item) => `<article class="card">
      <div class="card-top"><strong>${esc(item.reference_code)}</strong><span class="muted">${esc(formatWhen(item.created_at))}</span></div>
      <p>${esc(item.display_name)} · ${esc(item.municipality_name || '')}</p>
      <p>${esc(item.property_address)}</p>
      <p>Account ${esc(item.municipal_account_number)} · Erf ${esc(item.erf_number)}</p>
      <p>${esc(item.property_category_dispute)}</p>
      <p>${esc(item.owner_statement)}</p>
    </article>`).join('') || '<p class="muted">No rates objections in your areas.</p>';
  return page({ ...opts, title: 'Rates objections', active: 'more' }, `<h1>Rates objections</h1>${list}`);
}

function settingsPage(opts) {
  const settings = opts.settings;
  const municipalities = opts.areas.filter((area) => area.kind === 'municipality');
  const areaList = opts.areas.map((area) => `<li>${esc(area.kind === 'ward' && area.parent_name ? `${area.parent_name} · ${area.name}` : area.name)} <span class="muted">${esc(area.kind)}</span></li>`).join('');
  const muniOptions = municipalities.map((area) => `<option value="${area.id}">${esc(area.name)}</option>`).join('');
  const inner = `<h1>Settings</h1>
    <section class="panel">
      <form method="post" action="/settings">
        ${csrfField(opts.csrf)}
        <label>Site name<input class="control" name="siteName" value="${esc(settings.site_name)}" required></label>
        <label>WhatsApp link<input class="control" name="whatsappLink" value="${esc(settings.whatsapp_link)}" placeholder="https://wa.me/27..."></label>
        <label>Google Maps key <span class="muted">(optional, not shown to other roles)</span><input class="control" name="mapsKey" value="${esc(settings.google_maps_api_key)}" autocomplete="off"></label>
        <button class="btn" type="submit">Save settings</button>
      </form>
    </section>
    <section class="panel">
      <h2>Areas</h2>
      <ul>${areaList}</ul>
      <form method="post" action="/settings/areas">
        ${csrfField(opts.csrf)}
        <input type="hidden" name="kind" value="municipality">
        <label>New municipality<input class="control" name="name" required></label>
        <button class="btn secondary" type="submit">Add municipality</button>
      </form>
      <form method="post" action="/settings/areas">
        ${csrfField(opts.csrf)}
        <input type="hidden" name="kind" value="ward">
        <label>Municipality<select class="control" name="parentId" required>${muniOptions}</select></label>
        <label>New ward<input class="control" name="name" required></label>
        <button class="btn secondary" type="submit">Add ward</button>
      </form>
    </section>`;
  return page({ ...opts, title: 'Settings', active: 'more' }, inner);
}

function privacyPage(opts) {
  const inner = `<article class="panel">
    <h1>Privacy</h1>
    <p>PA At Work stores the details a resident gives when they register or log a complaint: name, contact details, the area, the description, and any photo.</p>
    <p>A resident can see their own complaints and the status updates on those complaints. They can also see how many complaints are on record and how many are resolved. Those totals do not include other people's complaints.</p>
    <p>PA members who handle a complaint can see its category, description, place, and photo. They do not get the resident directory. Admins in that area can manage accounts. Photos are stored on this server and are not placed in a public folder.</p>
    <p>Rates objections are kept for the municipality dispute and are visible to the resident who filed them and to admins for that area.</p>
  </article>`;
  return page({ ...opts, title: 'Privacy', active: opts.user ? 'more' : '' }, inner);
}

function messagePage(opts) {
  const inner = `<section class="panel narrow"><h1>${esc(opts.heading)}</h1><p>${esc(opts.message)}</p>${opts.extra || ''}</section>`;
  return page({ ...opts, title: opts.heading }, inner);
}

module.exports = {
  esc,
  loginPage,
  registerPage,
  residentHomePage,
  reportPage,
  myReportsPage,
  reportDetailPage,
  complaintsPage,
  complaintDetailPage,
  mapPage,
  peoplePage,
  morePage,
  notificationsPage,
  profilePage,
  section78Page,
  ratesPage,
  settingsPage,
  privacyPage,
  messagePage,
};
