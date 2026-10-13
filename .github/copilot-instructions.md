# Copilot Instructions

## Project Guidelines
- User preference: perform full PHP rewrite with all features, implement login/register in PHP with MySQL, and keep existing .NET files as backup but exclude them from publishing/deployment.
- User needs a top-level index file so the deployed website loads from a single entry point instead of exposing separate files.
- User wants the site to publish from Visual Studio to cPanel and run without manual file edits after deployment.
- User prefers the website visual theme to use light mode with green accents, and the stats hub must use a green-only theme (no gold).
- User wants the Patriotic Alliance logo displayed in the site header branding, with a larger header logo that maintains original quality (higher resolution/vector quality) and 'PA' removed from the header title text.
- User wants the 'Create Admin/PA User' tab removed from the portal because it is not useful.
- When a requested implementation breaks the app, perform a full rollback of local and GitHub repositories to the prior known-good state.

## User Management
- Combine staff and user management into one tab/page.
- Registration must require consent for collecting Name, Surname, ID Number, and Address.
- Login must require ID Number and support PIN login; admins must be able to reset/change user PINs.

## System Architecture
- User wants the system architecture overview to be implemented as backend behavior instead of visible UI content. The architecture should be: Mobile/Web Front-End (paatwork.co.za) -> ASP.NET Core Web API -> Private SQL Database and Anonymized AI Parsing Engine for WhatsApp exports with PII stripping and fault categorization.
- System configuration must allow setting the Google Maps API key for live maps.
- Admin+ users must be able to edit users, including passwords, and escalate incidents.
- Active PA members should receive notifications when new incidents are reported.