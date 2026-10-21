# PA At Work

Node.js complaint portal for the Patriotic Alliance. Residents log service problems. PA members dispatch a repair and mark it complete. Admins manage people and referrals. Server admins manage settings and areas.

cPanel runs this Node app from the repository root. The ASP.NET project and `php-site/` are archives and are not deployed. `pa-at-work-android/` is a separate WebView wrapper.

## Environment

Copy `.env.example` to `.env` for local development. On cPanel, set the same variables in the Node.js application settings. Do not commit `.env`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | `mysql://USER:PASSWORD@HOST:3306/DATABASE`. Encode special characters in the password. |
| `DATABASE_SOCKET` | No | MariaDB socket path, if cPanel does not connect over TCP. |
| `SESSION_SECRET` | Yes | At least 32 characters. The app will not start with a missing or short value, and there is no built-in fallback. |
| `UPLOAD_DIR` | No | Directory for complaint photos. Defaults to `storage/photos`, which is not web-accessible. On cPanel use a folder outside `public_html`. |
| `COOKIE_SECURE` | No | Set to `true` on HTTPS. |
| `TRUST_PROXY` | No | Set to `true` when cPanel terminates HTTPS in front of Node. |
| `PORT` | No | cPanel sets this. Local default is `3000`. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | For setup only | Used by `npm run create-admin`. Remove `ADMIN_PASSWORD` afterwards. |
| `WHATSAPP_IMPORT_WEBHOOK_TOKEN` | No | Bearer token for the WhatsApp import webhook. |
| `OPENAI_API_KEY` | No | Optional analytics for that webhook. |

Generate a session secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Database

The hosting database is MariaDB. `mysql2` is the driver. On startup, `npm start` applies SQL files in `migrations/`. You can also run `npm run migrate`.

Migrations create the tables and the first area, Randfontein, with wards Mohlakeng, Rural Holdings, and CBD Core. They do not create user accounts. Add further municipalities and wards in Settings after signing in as a server admin.

## First server admin

There is no password in this repository. From the app directory, with `DATABASE_URL` set:

```bash
ADMIN_EMAIL="owner@example.com" ADMIN_NAME="Site Owner" ADMIN_PASSWORD="choose-a-long-password" npm run create-admin
```

Store the password in a password manager, then unset `ADMIN_PASSWORD`. If that server admin password is lost, the same command with `--reset` replaces it:

```bash
ADMIN_EMAIL="owner@example.com" ADMIN_PASSWORD="a-new-long-password" npm run create-admin -- --reset
```

That person can then add admins and PA members from People, and assign each one to a municipality or ward. Residents register themselves.

## cPanel test copy

Use a test subdomain and a separate MariaDB database from the live site. Point the test Node application at this branch, not at `master`.

1. Create a database and user in cPanel. Grant that user only the test database.
2. Create the Node.js application with application root set to this project, startup file `server.js` (or `npm start`).
3. Set `DATABASE_URL`, `SESSION_SECRET`, `UPLOAD_DIR`, `COOKIE_SECURE=true`, and `TRUST_PROXY=true`.
4. Run NPM Install in the cPanel Node UI.
5. Open the Terminal and run `npm run create-admin` with the admin variables set for that command only.
6. Restart the app and sign in on the test hostname.

Photos are served only through `/complaints/:id/photo` after a role and area check. Do not map `UPLOAD_DIR` onto a public URL.

## Scripts

```bash
npm install
npm test
npm run migrate
npm start
```

`npm test` checks path and upload validation and does not need a database. `node scripts/smoke.js` walks each role against a running app. Set `BASE_URL`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` for a server admin that already exists. It registers temporary residents and staff in that database, so run it only on a test database.

## Roles

- Residents report a problem, see their own complaints and status updates, and see public totals (how many are on record, how many are resolved).
- PA members see complaints in their areas, record who was sent and when, and mark a complaint complete. They do not see the resident directory.
- Admins do that too, refer a complaint onward, and manage residents and staff in their areas. They cannot create or edit a server admin.
- Server admins can do the admin tasks in every area, create other server admins, and open Settings.
