const express = require('express');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

function pageShell(title, body) {
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
    <div class="site-brand">PA Infrastructure Portal</div>
    <nav class="site-nav">
      <a href="/">Home</a>
      <a href="/dashboard">Dashboard</a>
      <a href="/login">Sign In</a>
      <a href="/register">Register</a>
      <a href="/privacy">Privacy</a>
      <a href="/setup">Setup</a>
      <a href="/residents">Residents</a>
      <a href="/command-view">Command View</a>
      <a href="/stats-hub">Stats Hub</a>
    </nav>
  </header>
  <main class="site-main">
    <section class="hero-card">
      ${body}
    </section>
  </main>
  <footer class="site-footer">
    <small>Node.js version for cPanel deployment</small>
  </footer>
</body>
</html>`;
}

function sendPage(res, title, body, status = 200) {
  res.status(status).type('html').send(pageShell(title, body));
}

app.get('/', (req, res) => {
  sendPage(
    res,
    'PA Infrastructure Portal',
    '<h1>PA Infrastructure Portal</h1><p class="muted">The Node.js version is now serving the main portal pages.</p><div class="grid"><section class="panel"><h2>Resident Services</h2><p>Report issues, view guidance, and access account actions from the Node.js portal.</p></section><section class="panel"><h2>Operations</h2><p>Dashboard, oversight, and stats pages are now available in the Node app.</p></section><section class="panel"><h2>Setup</h2><p>The setup page is available for future configuration work if you want to add persistence.</p></section></div>'
  );
});

app.get('/privacy', (req, res) => sendPage(res, 'Privacy Policy', '<h1>Privacy Policy</h1><p>Use this page to detail your site\'s privacy policy.</p><p class="muted">This is the Node.js version of the privacy page.</p>'));
app.get('/login', (req, res) => sendPage(res, 'Sign In', '<h1>Sign In</h1><p class="muted">This page is wired for Node.js deployment. Authentication can be added in the next pass.</p><form method="post" action="/login"><div class="grid"><div><label>Email Address</label><input class="form-control" type="email" name="emailAddress" placeholder="jeanmari@thesolution.co.za"></div><div><label>Password</label><input class="form-control" type="password" name="password" placeholder="Your password"></div></div><p style="margin-top:1rem;"><button class="btn" type="submit">Sign In</button></p></form>'));
app.post('/login', (req, res) => sendPage(res, 'Sign In', '<h1>Sign In</h1><div class="panel" style="margin-bottom:1rem;">Sign-in is available in the next phase of the Node.js rewrite.</div><form method="post" action="/login"><div class="grid"><div><label>Email Address</label><input class="form-control" type="email" name="emailAddress" placeholder="jeanmari@thesolution.co.za"></div><div><label>Password</label><input class="form-control" type="password" name="password" placeholder="Your password"></div></div><p style="margin-top:1rem;"><button class="btn" type="submit">Sign In</button></p></form>'));
app.get('/register', (req, res) => sendPage(res, 'Resident Registration', '<h1>Resident Registration</h1><p class="muted">This page mirrors the PHP site structure and can be expanded for full account creation.</p><form method="post" action="/register"><div class="grid"><div><label>Username</label><input class="form-control" name="username"></div><div><label>Email Address</label><input class="form-control" type="email" name="emailAddress"></div><div><label>First Name</label><input class="form-control" name="firstName"></div><div><label>Last Name</label><input class="form-control" name="lastName"></div></div><p style="margin-top:1rem;"><button class="btn" type="submit">Register</button></p></form>'));
app.post('/register', (req, res) => sendPage(res, 'Resident Registration', '<h1>Resident Registration</h1><div class="panel" style="margin-bottom:1rem;">Registration is a placeholder in this Node.js build.</div><form method="post" action="/register"><div class="grid"><div><label>Username</label><input class="form-control" name="username"></div><div><label>Email Address</label><input class="form-control" type="email" name="emailAddress"></div><div><label>First Name</label><input class="form-control" name="firstName"></div><div><label>Last Name</label><input class="form-control" name="lastName"></div></div><p style="margin-top:1rem;"><button class="btn" type="submit">Register</button></p></form>'));
app.get('/setup', (req, res) => sendPage(res, 'Setup', '<h1>Setup</h1><p class="muted">This Node.js page is ready for cPanel deployment and can be extended later for persistence or configuration.</p><form method="post" action="/setup"><div class="grid"><div><label>Environment Name</label><input class="form-control" name="environmentName" value="production"></div><div><label>Site Name</label><input class="form-control" name="siteName" value="PA Infrastructure Portal"></div></div><p style="margin-top:1rem;"><button class="btn" type="submit">Save Setup</button></p></form>'));
app.post('/setup', (req, res) => sendPage(res, 'Setup', '<h1>Setup</h1><div class="panel" style="margin-bottom:1rem;">Setup completed in the current Node.js scaffold.</div><form method="post" action="/setup"><div class="grid"><div><label>Environment Name</label><input class="form-control" name="environmentName" value="production"></div><div><label>Site Name</label><input class="form-control" name="siteName" value="PA Infrastructure Portal"></div></div><p style="margin-top:1rem;"><button class="btn" type="submit">Save Setup</button></p></form>'));
app.get('/dashboard', (req, res) => sendPage(res, 'Dashboard', '<h1>Dashboard</h1><p class="muted">A lightweight Node.js dashboard placeholder that can be expanded into the full portal later.</p><div class="grid"><section class="panel"><h2>Logged Complaints</h2><p>0</p></section><section class="panel"><h2>Resolved</h2><p>0</p></section><section class="panel"><h2>Pending</h2><p>0</p></section></div>'));
app.get('/residents', (req, res) => sendPage(res, 'Residents Directory', '<h1>Residents Directory</h1><p class="muted">This is the Node.js page for resident management and export features.</p><section class="panel"><p>No resident data is loaded yet in this Node.js phase.</p></section>'));
app.get('/command-view', (req, res) => sendPage(res, 'Councillor & MMC Oversight', '<h1>Councillor & MMC Oversight</h1><p class="muted">Operational oversight content can be connected here in the next iteration.</p><section class="grid"><div class="panel"><h2>Workflow</h2><p>Placeholder for dispatch and inspection actions.</p></div><div class="panel"><h2>Status</h2><p>Placeholder for complaint status updates.</p></div></section>'));
app.get('/stats-hub', (req, res) => sendPage(res, 'Public Live Statistics Hub', '<h1>Public Live Statistics Hub</h1><p class="muted">The live stats hub is available as a Node.js page.</p><section class="grid"><div class="panel"><h2>Total Issues</h2><p>0</p></div><div class="panel"><h2>Electrical</h2><p>0</p></div><div class="panel"><h2>Roads</h2><p>0</p></div><div class="panel"><h2>Water</h2><p>0</p></div></section>'));

app.use((req, res) => {
  sendPage(res, 'Not Found', `<h1>404</h1><p>Page not found: <strong>${req.path}</strong></p>`, 404);
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
