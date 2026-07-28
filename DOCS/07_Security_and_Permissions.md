Security and Permissions
Authentication
All users must authenticate before accessing the app.
Authorization
Every write action must check permissions.
Roles

- Admin
- Trader
- Analyst
- Portfolio Manager
- Read-only Viewer
- Compliance Viewer
  Sensitive Actions
  Require authorization:

- Create/edit/delete comments.
- Create/resolve flags.
- Add/edit watchlist entries.
- Edit target prices.
- Upload files.
- Run ingestion.
- Export data.
- Change permissions.
  Audit Requirements
  Every sensitive action should create an audit log.
