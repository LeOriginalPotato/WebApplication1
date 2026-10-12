# PHP migration (full feature rewrite)

This folder is a PHP + MySQL rewrite of the original ASP.NET application.

## What was migrated
- Authentication and role-based access (Server Admin, Admin, PA Member, Resident)
- Resident registration and profile editing
- Managed user creation and management
- Fault logging + resident complaint queue
- Oversight workflow updates (dispatch, findings, resolve)
- Residents list + CSV export
- Section 78 dispute submission with document uploads
- System configuration page + API
- Stats hub and privacy page
- AI WhatsApp analysis endpoint (OpenAI API)

## Folder map
- `public/index.php` - single front controller (pages + API routes)
- `public/.htaccess` - URL rewriting to `index.php`
- `app/` - bootstrap, DB, auth/session helpers
- `views/` - page templates
- `database/schema.mysql.sql` - MySQL schema + seed data
- `storage/uploads/` - uploaded documents

## Quick start
1. Publish the site files.
2. Open `https://your-domain/setup` once.
3. Enter cPanel MySQL credentials in the setup form and submit.
4. The app writes `app/config.local.json` and initializes schema automatically.

## Seed credentials
- `jeanmari@thesolution.co.za` / `Foktogbokka`
- `jean@thesolution.co.za` / `888@JP`
- `admin@pa.local` / `Password123!`
- `pamember@pa.local` / `Password123!`
- `resident@pa.local` / `Password123!`

Seed rows use transition-friendly passwords for first login. Update each account password after deployment.

## Publish guidance (keep .NET files as backup)
Deploy **only** the `php-site` directory.
Do not deploy the .NET project files (`*.cs`, `*.csproj`, `Program.cs`, `Controllers/`, `Views/`, etc.).

## Visual Studio publish profiles
Two publish profiles were added in `Properties/PublishProfiles/`:
- `PhpSiteOnly.pubxml` (Folder publish for local verification)
- `PhpSiteOnlyFtp.pubxml` (FTP publish to cPanel)

When using these profiles, the project publish pipeline is overridden to include only files from `php-site/**` (excluding `php-site/storage/uploads/**`).

Use `PhpSiteOnlyFtp` in Visual Studio Publish UI to deploy PHP files without publishing .NET runtime binaries.
