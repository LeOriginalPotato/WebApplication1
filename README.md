# WebApplication1 Node.js Deployment

This repository now includes an Express-based Node.js app at the repository root so it can be deployed with cPanel's Node.js application feature.

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

## Notes
- The legacy PHP site is kept in `php-site/` as a backup.
- Static assets are served from `public/`.
- Page templates are in `views/pages/`.
