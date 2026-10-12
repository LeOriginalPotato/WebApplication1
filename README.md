# WebApplication1 Node.js Deployment

This repository now includes an Express-based Node.js app at the repository root so it can be deployed with cPanel's Node.js application feature. The app is self-contained and does not require separate view files.

## Start locally
```bash
npm install
npm start
```

## Routes
- `/`
- `/privacy`
- `/login`
- `/register`
- `/setup`
- `/dashboard`
- `/residents`
- `/command-view`
- `/stats-hub`

## cPanel settings
- Application path: repository root
- Startup command: `npm start`
- Port: use the port assigned by cPanel
- Deployment target: the Node app root in the repository, not `php-site/`

## Notes
- The legacy PHP site is kept in `php-site/` as a backup only.
- Static assets are served from `public/`.
- The app renders pages directly from `server.js`, so no EJS views are required on the server.
- If cPanel is still showing older content, verify the Node.js application path and restart the app after deployment.
- Default portal logins are seeded in the Node app for now, including `jeanmari@thesolution.co.za` / `Foktogbokka`.
