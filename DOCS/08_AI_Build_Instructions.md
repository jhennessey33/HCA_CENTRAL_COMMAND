Instructions for AI Coding Agent
Build Goal
Build HCA Central Command as a production-minded internal web application. Prioritize correctness, clean architecture, data model quality, and extensibility over decorative UI work.
Recommended App Structure

/apps
/web
/components
/pages or /app
/hooks
/lib
/styles
/api
/controllers
/services
/repositories
/middleware
/jobs
/integrations
/packages
/types
/db
/ui

Initial Build Order

1. Create database schema.
2. Seed sample users, securities, positions, trades, watchlist entries, comments, and flags.
3. Build API endpoints for positions, watchlist, comments, flags, market data.
4. Build Home / Positions UI.
5. Build ticker detail panel.
6. Build comment modal and timeline.
7. Build watchlist.
8. Build past positions.
9. Build global comments.
10. Build audit log service.
11. Add mock ingestion.
12. Add integration stubs for Wells and Bloomberg.
    Frontend Requirements

- Use reusable components for tables, badges, modals, timelines, and detail panels.
- Keep long/short sections visually distinct.
- Preserve spreadsheet density.
- Make ticker click open side panel.
- Make market-data click open modal or drawer.
- Make comment click open modal.
- Show flag icons near tickers.
  Backend Requirements

- Use service/repository pattern.
- Validate all inputs.
- Create audit logs on write actions.
- Use stable IDs, not ticker strings, for relationships.
- Use transactions where multiple related records are created.
  Testing Expectations
  Unit tests:

- Comment creation.
- Flag creation.
- Watchlist creation.
- Permission checks.
- Ingestion parsing.
  Integration tests:

- Position list endpoint.
- Comment timeline endpoint.
- Watchlist endpoint.
- Audit logging after writes.
  Mock Data Requirements
  Seed data should include:

- Active long positions.
- Active short positions.
- Long watchlist.
- Short watchlist.
- Past positions.
- Comment timelines.
- Flags.
- Market-data cache rows.
