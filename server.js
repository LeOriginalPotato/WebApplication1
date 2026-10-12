const path = require('path');
const express = require('express');

const app = express();
const port = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

function render(res, view, data = {}) {
  res.render(`pages/${view}`, {
    siteTitle: 'PA Infrastructure Portal',
    ...data
  });
}

app.get('/', (req, res) => render(res, 'home'));
app.get('/privacy', (req, res) => render(res, 'privacy'));
app.get('/login', (req, res) => render(res, 'login'));
app.post('/login', (req, res) => render(res, 'login', { notice: 'Sign-in is available in the next phase of the Node.js rewrite.' }));
app.get('/register', (req, res) => render(res, 'register'));
app.post('/register', (req, res) => render(res, 'register', { notice: 'Registration is a placeholder in this Node.js build.' }));
app.get('/setup', (req, res) => render(res, 'setup'));
app.post('/setup', (req, res) => render(res, 'setup', { notice: 'Setup completed in the current Node.js scaffold.' }));
app.get('/dashboard', (req, res) => render(res, 'dashboard'));
app.get('/residents', (req, res) => render(res, 'residents'));
app.get('/command-view', (req, res) => render(res, 'command-view'));
app.get('/stats-hub', (req, res) => render(res, 'stats-hub'));

app.use((req, res) => {
  res.status(404);
  render(res, 'not-found', { requestedPath: req.path });
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
