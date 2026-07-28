System Architecture
Recommended Stack
Frontend:

- Next.js or React.
- TypeScript.
- Tailwind CSS.
- shadcn/ui style components.
  Backend:

- Node.js with NestJS or Express.
- TypeScript.
- REST API.
  Database:

- PostgreSQL.
- Prisma or Drizzle ORM.
  Cache:

- Redis, optional for market data and background jobs.
  Jobs:

- BullMQ or equivalent background job queue.
  Storage:

- S3-compatible object storage for raw reports and attachments.
  Auth:

- Enterprise SSO if available.
- Otherwise email/password or internal auth for MVP.
  Architecture Layers

UI Layer
API Layer
Domain Service Layer
Persistence Layer
Integration Layer
Audit Layer

Core Services

- PositionService
- TradeService
- SecurityService
- WatchlistService
- CommentService
- FlagService
- MarketDataService
- WellsIngestionService
- AuditLogService
- PermissionService
  Key Design Principles

- External data is read/imported, internal data is owned.
- Do not block UI on Bloomberg failures.
- Preserve raw Wells files.
- Audit all internal actions.
- Keep comments and flags attached to stable entity IDs
