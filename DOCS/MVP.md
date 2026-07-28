You are a senior full-stack software engineer and product-minded architect.

Your task is to build the first working MVP of an internal hedge fund portfolio operations application called:

HCA Central Command

This is NOT a trading execution platform. It does not place trades, route orders, or execute transactions. It is an internal command center for traders to organize active positions, watchlists, past positions, trade history, notes/comments, flags, exit rationales, and audit history.

The project should be built as a production-minded MVP with clean architecture, reusable components, strong database design, and clear extension points for future Wells Fargo report ingestion, Bloomberg API enrichment, and bank SSO integration.

==================================================
PROJECT GOAL
==================================================

Build a working local/development version of HCA Central Command that includes:

1. A dashboard showing active long and short positions.
2. A watchlist page showing long and short watchlist names.
3. A past positions page showing closed positions and exit rationale.
4. A ticker detail side panel showing trade history, comments, flags, and market data access.
5. A comment system with comment timeline.
6. A flag system.
7. A global comments page.
8. A basic alerts page.
9. A settings page.
10. A PostgreSQL database schema using Prisma.
11. Seed data for demo/testing.
12. Basic local username/password authentication.
13. Basic role support.
14. Audit logging for internal user actions.
15. Mock/stub integrations for Wells Fargo and Bloomberg.

Do not build Wells Fargo SFTP, Bloomberg API, or bank SSO yet. Create clean stubs/interfaces so those can be added later.

==================================================
CRITICAL UI REFERENCE: MATCH EXISTING PROTOTYPE
==================================================

The final MVP UI must closely match the provided React prototype.

Treat the supplied prototype code as the visual and interaction reference for the real application. Do not redesign the product from scratch. Recreate the prototype’s layout, styling, spacing, density, table structure, side panel behavior, modals, badges, and overall trader-command-center feel as closely as possible while replacing mock state/data with real database-backed data.

The prototype code should be saved in the repo as:

docs/prototype-reference/HcaCentralCommandPrototype.tsx

Use this file as a reference implementation for:

- Layout
- Styling
- Component structure
- Interaction patterns
- Table density
- Side panel behavior
- Modal behavior
- Navigation
- Sample data shape

The production implementation should not remain one giant component. Break the prototype into reusable components, but preserve the visual result.
Use the supplied HCA Central Command prototype code as the visual reference. The real app should look and behave like the prototype: left sidebar, top search/header, stat cards, green/red/yellow section headers, dense trader tables, right-side ticker detail panel, comment timeline cards, rounded modals, slate/white styling, badges, flags, and market-data modal. Refactor the prototype into reusable components and database-backed pages, but preserve the UI/UX closely.

==================================================
VISUAL DESIGN REQUIREMENTS FROM PROTOTYPE
==================================================

The app should visually match these prototype characteristics:

1. Overall Layout

- Full-height desktop application.
- Left sidebar navigation.
- Main content area.
- Top header/search bar.
- Optional right-side ticker detail panel.
- Light slate/white professional theme.
- Desktop-first UI.

2. Sidebar

- Width approximately 18rem / 288px.
- White background.
- Slate borders.
- Rounded navigation items.
- Active nav item uses dark slate/black background with white text.
- Sidebar includes:
  - HCA Central Command title
  - Portfolio operations hub subtitle
  - Navigation items:
    - Home / Positions
    - Watchlist
    - Past Positions
    - Notes or Comments
    - Alerts
    - Settings
  - Compliance Mode card pinned near bottom.

3. Header

- Height approximately 80px.
- White background.
- Search input on left/middle.
- Search input should be rounded, light slate background, with search icon.
- Right side should show:
  - Live data/mock data badge
  - Bell icon button
  - User profile card/avatar

4. Main Dashboard

- Use large page title:
  - “Home Page / Position Display”
- Subtitle text should explain active long/short positions.
- Include Quick Comment button on the right.
- Include four stat cards similar to prototype:
  - Total Market Value
  - Position P&L Proxy
  - Day P&L
  - Commented Items
- Include filter bar with chips:
  - All
  - Long
  - Short
  - Winners
  - Losers
  - Flagged
  - Technology
  - Semiconductors
- Include sort control on right:
  - “Sort: Total % Change”

5. Section Headers

- Long Positions header should be green.
- Short Positions header should be red.
- Past Positions header should be yellow.
- Headers should be centered, uppercase, bold, compact, and span the table width.

6. Position Tables

- Tables should be dense and spreadsheet-like.
- Use white table background.
- Use rounded card container.
- Use subtle borders and shadow.
- Header row should use slate-50 background.
- Text should be small: roughly text-xs for rows and text-[11px] for headers.
- Row hover should use slate-50.
- Selected row should use slate-100.
- Flagged tickers should show amber flag icon beside ticker.

Position table columns must visually match the prototype:

- Ticker
- Company Name
- Current Price
- % Change In Trading Day
- Mrkt Value Of Position
- % Of Portfolio
- Total # Of Shares
- WAP
- Total % Change
- Market Data
- Comment Section

7. Watchlist Tables

- Use the same visual table format.
- Separate Long Watchlist and Short Watchlist.
- Long header green.
- Short header red.
- Columns:
  - Ticker # / Name
  - Current Price
  - Buy PT or Short PT
  - % From PT
  - Market Data
  - Comment Section

8. Past Positions Table

- Yellow section header.
- Columns:
  - Ticker
  - Company Name
  - Price Bought/Sold
  - Price Sold/Covered
  - Comment Section
- Under each row, display a light-slate exit rationale strip:
  - “Exit rationale: [text]”

9. Right-Side Ticker Detail Panel

- Opens from the right when user clicks a ticker.
- Width approximately 460px.
- White background.
- Border-left and shadow.
- Use framer-motion style slide-in animation if available.
- Header includes:
  - Ticker
  - Side/status badge
  - Flag badge if flagged
  - Company name
  - Close button
- Summary cards in two-column grid:
  - Current Price
  - WAP / Point
  - Shares
  - Total % Change
- Action buttons:
  - Comment
  - Flag
  - Market Data
  - Export icon button
- Main body includes:
  - Trade History From Ticker Click
  - Comment Section
  - Comment Timeline

10. Trade History Panel

- Dense mini-table with six columns:
  - Ticker
  - Date Traded
  - Shares Traded
  - Avg Price
  - PT History
  - Comment
- Use rounded border container.
- Header row should be slate-50.
- Text should be small.

11. Comment Section

- Current/main comment displayed in a rounded slate-50 box.
- Label should be “Comment Section”.

12. Comment Timeline

- Label should be “Comment Timeline”.
- Timeline entries should use card-style layout:
  - Rounded border
  - Category badge at top left
  - Timestamp at top right
  - Comment text below
  - Author line at bottom
- This should match the original prototype’s notes timeline style.

13. Comment Modal

- Centered modal with backdrop blur/dim.
- Rounded-3xl white card.
- Title: “Comment Section”
- Subtitle: “[TICKER] • timestamp and author are captured automatically”
- Category buttons:
  - Comment
  - Thesis
  - Risk
  - Catalyst
  - Trade
  - Exit
- Existing comment box.
- Textarea.
- Cancel and Save Comment buttons.
- Save button dark slate/black.

14. Market Data Modal

- Centered modal with backdrop blur/dim.
- Rounded-3xl white card.
- Title: “Market Data”
- Subtitle: “[TICKER] • [Company]”
- Field table with alternating slate/white rows.
- Fields:
  - VWAP
  - 52 Week High
  - 52 Week Low
  - Beta
  - Avg Volume
  - Short Float
  - Market Cap
  - P/LTM EPS
  - Price/Tang Book
  - P/NTM EPS
  - Price/Book
  - Total Debt/EBITDA
  - EPS

15. Add Stock Modal

- Similar modal style.
- Fields:
  - Ticker
  - Long Watchlist / Short Watchlist select
  - Buy PT / Short PT
  - Comment section
- Add Stock button should use dark slate/black.

16. Alerts Page

- Use card list layout.
- Each alert card should include:
  - Priority icon block
  - Ticker
  - Type badge
  - Priority badge
  - Description
  - Review button

17. Settings Page

- Use card grid layout.
- Include cards for:
  - Permissions
  - Audit Trail
  - Data Refresh
  - Trader Shortcuts

==================================================
IMPLEMENTATION EXPECTATION
==================================================

The prototype is currently written as a single React component with mock arrays. The real app should refactor this into clean components but preserve the exact experience.

Suggested mapping:

Prototype component/function:

- Badge → components/ui/Badge.tsx
- NavItem → components/layout/NavItem.tsx
- StatCard → components/dashboard/StatCard.tsx
- SectionBar → components/common/SectionBar.tsx
- PositionGrid → components/positions/PositionGrid.tsx
- WatchlistGrid → components/watchlist/WatchlistGrid.tsx
- PastPositionsGrid → components/past-positions/PastPositionsGrid.tsx
- TransactionsPanel → components/positions/TickerDetailPanel.tsx
- NoteModal → components/comments/CommentModal.tsx
- MarketDataModal → components/market-data/MarketDataModal.tsx
- AddStockModal → components/watchlist/AddStockModal.tsx

Important:

- Do not use browser-only mock arrays as the final data source.
- Replace mock arrays with API/database-backed data.
- Keep the same visual layout and interactions.
- Use the prototype data arrays as seed data inspiration.
- Use the prototype styling as the default design system.
- The UI should look like a polished version of the prototype, not a generic admin dashboard.

==================================================
PROTOTYPE CODE NOTE
==================================================

The provided prototype code may include HTML-escaped characters such as:

&gt;
&lt;
&amp;

When saving the prototype as a .tsx reference file, convert escaped characters back to valid JSX syntax:

&gt; becomes >
&lt; becomes <
&amp; becomes &

Do not copy escaped JSX directly into production code without fixing it.

==================================================
RECOMMENDED TECH STACK
==================================================

Use the following unless there is a strong reason not to:

- Next.js
- TypeScript
- React
- Tailwind CSS
- Prisma ORM
- PostgreSQL
- bcrypt or argon2 for password hashing
- Cookie/session-based authentication
- Server-side API routes
- shadcn/ui-style component patterns if available
- Lucide icons if useful

If using Next.js App Router, organize code cleanly with app routes, server actions or API routes, components, lib utilities, and Prisma client.

==================================================
HIGH-LEVEL ARCHITECTURE
==================================================

Use this conceptual architecture:

Frontend UI
↓
API / Server Actions
↓
Domain Services
↓
Prisma / PostgreSQL
↓
External Integration Stubs

The most important internal data layer is:

- Comments
- Comment timeline
- Flags
- Watchlist entries
- Target buy/short prices
- Exit rationale
- Pinned current view, optional/future
- User audit trail
- App-specific permissions

External future data sources:

- Wells Fargo reports/SFTP for official positions, trades, WAP, shares, market value, past positions.
- Bloomberg API for price, market data, reference data, valuation metrics, fundamentals.

==================================================
APPLICATION PAGES
==================================================

Build these pages:

1. `/login`
   - Username/email and password login.
   - Authenticate against local users table.
   - Store hashed passwords only.
   - Redirect authenticated users to `/`.

2. `/`
   - Home / Position Display.
   - Shows Long Positions and Short Positions sections.
   - Each section is table-like, dense, and trader-friendly.

3. `/watchlist`
   - Shows Long Watchlist and Short Watchlist sections.
   - Allows adding watchlist names through a modal or form.

4. `/past-positions`
   - Shows closed positions.
   - Each row includes ticker, company, bought/sold or sold/covered price, comment action, and visible exit rationale underneath the row.

5. `/comments`
   - Global searchable comments/timeline view.
   - Shows comments across active positions, watchlist entries, and past positions.

6. `/alerts`
   - Shows open/resolved alert/flag items.
   - MVP can be backed by flags.

7. `/settings`
   - Shows prototype settings, permissions overview, data refresh placeholders, and audit concept explanations.

==================================================
UI DESIGN REQUIREMENTS
==================================================

Use a professional, high-density, trader-friendly UI.

General design style:

- Desktop-first.
- Sidebar navigation.
- Top search bar.
- Clean white/slate background.
- Rounded cards.
- Dense but readable tables.
- Badges for side/status/flags.
- Right-side detail panel for ticker click.
- Modals for market data and comments.
- Minimal unnecessary decoration.

Primary navigation:

- Home / Positions
- Watchlist
- Past Positions
- Comments
- Alerts
- Settings

Use a persistent left sidebar.

==================================================
HOME / POSITION DISPLAY REQUIREMENTS
==================================================

The Home page must show two sections:

1. Long Positions
2. Short Positions

Each position row must include these columns:

- Ticker
- Company Name
- Current Price
- % Change In Trading Day
- Market Value Of Position
- % Of Portfolio
- Total # Of Shares
- WAP
- Total % Change
- Market Data action button
- Comment Section action button
- Flag indicator if flagged

Interactions:

- Clicking ticker opens ticker detail side panel.
- Clicking Market Data opens market data modal.
- Clicking Comment opens comment modal.
- User can search by ticker, company, side, sector, or comment text.
- User can filter by:
  - All
  - Long
  - Short
  - Winners
  - Losers
  - Flagged
  - Sector
- Flagged rows must show a visible flag icon near the ticker.

==================================================
WATCHLIST REQUIREMENTS
==================================================

Watchlist page must show:

1. Long Watchlist
2. Short Watchlist

Each row must include:

- Ticker / company name
- Current price
- Buy PT for long watchlist or Short PT for short watchlist
- % from PT
- Market Data action
- Comment Section action
- Flag indicator if flagged

Interactions:

- Add Stock button opens modal/form.
- Add Stock form captures:
  - ticker
  - side: LONG or SHORT
  - target price
  - initial comment
- Clicking ticker opens ticker detail side panel.
- Clicking Market Data opens market data modal.
- Clicking Comment opens comment modal.

==================================================
PAST POSITIONS REQUIREMENTS
==================================================

Past Positions page must show a table with:

- Ticker
- Company Name
- Price Bought/Sold
- Price Sold/Covered
- Comment Section action

Under each past position row, display:

- Exit rationale: [comment text]

Interactions:

- Clicking ticker opens ticker detail side panel.
- Clicking Comment opens comment modal.
- Comment modal must include Exit as a category.

==================================================
TICKER DETAIL SIDE PANEL REQUIREMENTS
==================================================

Clicking a ticker from Dashboard, Watchlist, or Past Positions opens a right-side panel.

The panel must show:

Header:

- Ticker
- Company name
- Side/status badge
- Flag badge if flagged

Summary cards:

- Current price, if available
- WAP or target point
- Shares, if applicable
- Total % change or % from target point

Actions:

- Comment
- Flag
- Market Data
- Export placeholder
- Close

Trade History section:
Table columns:

- Ticker
- Date Traded
- Shares Traded
- Avg Price
- PT History
- Comment

Comment Section:

- Show latest/main comment text.

Comment Timeline:
Use card-style timeline entries.
Each timeline card includes:

- Category badge
- Timestamp
- Text
- Author

The timeline should look similar to a professional notes feed.

==================================================
COMMENT SYSTEM REQUIREMENTS
==================================================

Comments are one of the most important pieces of the product.

Comment categories must include:

- Comment
- Thesis
- Risk
- Catalyst
- Trade
- Exit

Future-friendly optional categories:

- Valuation
- Position sizing
- PM Comment
- Research
- Earnings
- Meeting Note

Each comment must store:

- id
- securityId
- positionId, nullable
- watchlistEntryId, nullable
- tag/category
- content
- authorId
- createdAt
- updatedAt
- archivedAt, nullable
- isPinned, boolean default false

Interactions:

- User can add a comment from row action or detail panel.
- User selects category.
- User writes content.
- Author and timestamp are captured automatically.
- New comment appears in timeline.
- Comment creation creates audit log.
- Comment edit, if implemented, creates audit log.

==================================================
FLAG SYSTEM REQUIREMENTS
==================================================

Flags identify names requiring attention.

Flag types should include:

- Risk Review
- Earnings Upcoming
- Valuation Stretched
- Thesis Changed
- Candidate
- Under Review
- Margin Pressure
- Credit Watch
- Quality Risk
- Event-driven
- Custom

Each flag must store:

- id
- securityId
- positionId, nullable
- watchlistEntryId, nullable
- flagType
- description
- priority: LOW, MEDIUM, HIGH
- status: OPEN, RESOLVED, ARCHIVED
- createdBy
- createdAt
- resolvedBy, nullable
- resolvedAt, nullable

Interactions:

- User can click Flag in ticker detail panel.
- For MVP, it can open a simple modal or create a sample flag.
- Flag must appear near ticker in relevant table.
- Flag creation creates audit log.
- Alerts page can display open flags.

==================================================
MARKET DATA REQUIREMENTS
==================================================

Market data is mocked/cached in MVP.

Market Data modal must show:

- VWAP
- 52 Week High
- 52 Week Low
- Beta
- Avg Volume
- Short Float
- Market Cap
- P/LTM EPS
- Price/Tang Book
- P/NTM EPS
- Price/Book
- Total Debt/EBITDA
- EPS

Data source should be mock market_data_cache table or seeded data.

Add future integration placeholder:

- BloombergMarketDataProvider
- MockMarketDataProvider

The app should call an abstraction such as `getMarketDataForSecurity(securityId)` so Bloomberg can replace the mock later.

==================================================
AUTHENTICATION REQUIREMENTS
==================================================

For MVP, implement simple local authentication.

Requirements:

- Users table.
- Passwords must be hashed, never plaintext.
- Login page.
- Session cookie.
- Protected routes.
- Logout.
- Roles:
  - ADMIN
  - TRADER
  - ANALYST
  - PM
  - VIEWER
  - COMPLIANCE

For now, seed users:

- admin@example.com / password: password123
- trader1@example.com / password: password123
- trader2@example.com / password: password123

Hash the passwords in seed script.

Design auth so it can later be replaced by bank SSO without rewriting the app.

Create an auth abstraction such as:

- getCurrentUser()
- requireAuth()
- requireRole()
- createSession()
- destroySession()

Future SSO should map bank identity into internal HCA user records.

==================================================
PERMISSIONS REQUIREMENTS
==================================================

MVP can implement simple role checks.

Basic rules:

ADMIN:

- Can do everything.

TRADER:

- Can view, comment, flag, edit watchlist, set target prices.

ANALYST:

- Can view, comment, edit watchlist.

PM:

- Can view, comment, flag, resolve flags, pin current views if implemented.

VIEWER:

- Can view only.

COMPLIANCE:

- Can view audit logs and all historical comments.

At minimum:

- Only authenticated users can access the app.
- Only non-viewers can create comments and flags.
- Only admin can access deeper settings/audit controls if implemented.

==================================================
AUDIT LOG REQUIREMENTS
==================================================

Audit logging is required for internal workflow actions.

Create audit_logs table and helper function:

- createAuditLog(actorId, action, entityType, entityId, previousValue, newValue)

Log these actions:

- COMMENT_CREATED
- COMMENT_UPDATED
- COMMENT_ARCHIVED
- FLAG_CREATED
- FLAG_RESOLVED
- WATCHLIST_ENTRY_CREATED
- WATCHLIST_ENTRY_UPDATED
- WATCHLIST_ENTRY_ARCHIVED
- TARGET_PRICE_CHANGED
- EXIT_RATIONALE_CREATED
- EXIT_RATIONALE_UPDATED
- MARKET_DATA_VIEWED, optional
- EXPORT_CREATED, optional
- USER_LOGIN, optional
- INGESTION_RUN_STARTED
- INGESTION_RUN_COMPLETED
- INGESTION_RUN_FAILED

Audit log table should include:

- id
- actorId
- action
- entityType
- entityId
- previousValue JSON
- newValue JSON
- ipAddress nullable
- userAgent nullable
- createdAt

==================================================
DATABASE MODEL REQUIREMENTS
==================================================

Use Prisma with PostgreSQL.

Create models for:

- User
- Role or enum Role
- Security
- Position
- Trade
- WatchlistEntry
- Comment
- Flag
- MarketDataCache
- IngestionRun
- AuditLog
- Attachment, optional/future

Important modeling rule:

Do not attach comments only to ticker strings. Use stable IDs:

- securityId
- positionId
- watchlistEntryId

This prevents ambiguity when the same ticker appears as active position, past position, watchlist entry, or future reopened position.

Use enums where useful:

- PositionSide: LONG, SHORT
- PositionStatus: ACTIVE, CLOSED
- CommentTag
- FlagPriority
- FlagStatus
- UserRole
- IngestionStatus

==================================================
SEED DATA REQUIREMENTS
==================================================

Seed realistic demo data.

Users:

- Admin
- Trader 1
- Trader 2
- Viewer

Securities:

- AAPL
- MSFT
- NVDA
- AMZN
- LLY
- TSLA
- BA
- NFLX
- AMD
- SHOP
- UBER
- CRWD
- SNOW
- COIN
- RIVN
- PLTR
- CVNA
- GME
- META
- DIS
- PYPL
- INTC

Active long positions:

- AAPL
- MSFT
- NVDA
- AMZN
- LLY

Active short positions:

- TSLA
- BA
- NFLX

Long watchlist:

- AMD
- SHOP
- UBER
- CRWD
- SNOW

Short watchlist:

- COIN
- RIVN
- PLTR
- CVNA
- GME

Past positions:

- META
- TSLA
- NFLX
- BA
- DIS
- PYPL
- INTC

Add realistic:

- comments
- comment timelines
- flags
- trades
- market data cache rows
- exit rationales

==================================================
API REQUIREMENTS
==================================================

Create API routes for:

Positions:

- GET /api/positions
- GET /api/positions/:id
- GET /api/positions/:id/trades
- GET /api/positions/:id/comments
- GET /api/positions/:id/flags

Watchlist:

- GET /api/watchlist
- POST /api/watchlist
- PATCH /api/watchlist/:id
- DELETE /api/watchlist/:id

Comments:

- GET /api/comments
- POST /api/comments
- PATCH /api/comments/:id
- DELETE /api/comments/:id
- POST /api/comments/:id/pin, optional

Flags:

- GET /api/flags
- POST /api/flags
- PATCH /api/flags/:id
- POST /api/flags/:id/resolve

Market Data:

- GET /api/securities/:id/market-data
- POST /api/market-data/refresh, stub

Audit:

- GET /api/audit-logs, admin/compliance only

Ingestion:

- GET /api/ingestion/runs
- POST /api/ingestion/wells/manual-upload, stub
- POST /api/ingestion/wells/run, stub

All write routes must:

- require authentication
- validate input
- check permissions
- create audit logs where appropriate

==================================================
DATA INGESTION STUBS
==================================================

Do not build real Wells integration yet.

Create placeholder/stub services:

- WellsReportIngestionService
- BloombergMarketDataService

Wells service should have methods like:

- parsePositionReport(file)
- parseTradeReport(file)
- parsePastPositionsReport(file)
- runManualImport(file)
- runSftpImport()

For now, these can be no-op or return mocked results.

Add ingestion_runs table and UI/API to view mock ingestion runs.

==================================================
FOLDER STRUCTURE
==================================================

Use a clean structure similar to:

app/
login/
page.tsx
page.tsx
watchlist/
past-positions/
comments/
alerts/
settings/
api/
positions/
watchlist/
comments/
flags/
market-data/
audit-logs/
ingestion/

components/
layout/
AppShell.tsx
Sidebar.tsx
TopBar.tsx
positions/
PositionGrid.tsx
TickerDetailPanel.tsx
watchlist/
WatchlistGrid.tsx
AddWatchlistModal.tsx
past-positions/
PastPositionsGrid.tsx
comments/
CommentModal.tsx
CommentTimeline.tsx
CommentCard.tsx
flags/
FlagModal.tsx
FlagBadge.tsx
market-data/
MarketDataModal.tsx
ui/
Badge.tsx
Button.tsx
Card.tsx

lib/
auth.ts
permissions.ts
prisma.ts
audit.ts
market-data.ts
wells-ingestion.ts
validation.ts
format.ts

prisma/
schema.prisma
seed.ts

types/
index.ts

==================================================
COMPONENT REQUIREMENTS
==================================================

Build reusable components:

AppShell:

- Sidebar + top search + main content area.

PositionGrid:

- Takes title, tone, positions, callbacks.
- Displays long/short sections.

WatchlistGrid:

- Takes title, tone, watchlist entries, callbacks.

TickerDetailPanel:

- Opens on ticker click.
- Displays trade history, comment section, comment timeline, actions.

CommentModal:

- Allows category selection and comment entry.
- Categories include Comment, Thesis, Risk, Catalyst, Trade, Exit.

MarketDataModal:

- Displays required market data fields.

FlagModal:

- Allows flag type, priority, description.
- Creates flag.

PastPositionsGrid:

- Shows exit rationale under rows.

GlobalComments:

- Card/timeline style list of all comments.

==================================================
VALIDATION REQUIREMENTS
==================================================

Validate inputs:

Comment:

- content required
- tag required
- valid related entity must be provided

Watchlist entry:

- ticker required
- side required
- target price numeric if entered

Flag:

- flag type required
- priority valid
- at least one related entity

Auth:

- email required
- password required

Use Zod if appropriate.

==================================================
ERROR HANDLING REQUIREMENTS
==================================================

- Display friendly UI errors.
- API routes should return structured JSON errors.
- Do not expose stack traces to user.
- Log server errors.
- If market data missing, show N/A.
- If no comments exist, show empty state.
- If no trade history exists, show empty state.

==================================================
TESTING REQUIREMENTS
==================================================

Add basic tests if feasible.

Minimum tests:

- Comment creation creates comment and audit log.
- Flag creation creates flag and audit log.
- Watchlist creation works.
- Viewer cannot create comments.
- Position list returns active positions.
- Global comments returns comments across entity types.

If full test setup is too much for the first pass, at least structure code in a way that is testable.

==================================================
MVP ACCEPTANCE CRITERIA
==================================================

The MVP is complete when:

1. User can log in.
2. User can view Home / Positions.
3. User can see Long and Short Positions.
4. User can click ticker and open detail panel.
5. User can view trade history in detail panel.
6. User can view comment section and comment timeline.
7. User can create a new comment.
8. User can create or view flags.
9. User can view Market Data modal.
10. User can view Watchlist with long/short sections.
11. User can add a watchlist entry.
12. User can view Past Positions with exit rationale under each row.
13. User can view global comments.
14. User actions create audit logs.
15. Seed data loads successfully.
16. App runs locally with PostgreSQL.
17. Code is cleanly organized and ready for future Wells/Bloomberg/SSO integration.

==================================================
IMPORTANT DEVELOPMENT NOTES
==================================================

Prioritize:

- Clean data model
- Internal workflow functionality
- Comments/timelines/flags
- Shared database-backed state
- Extensibility

Do not over-focus on:

- Real Bloomberg integration
- Real Wells ingestion
- Bank SSO
- Perfect production infrastructure
- Advanced alerts
- AI summaries

Those are future phases.

The core principle is:

A trader should be able to click any ticker and understand the position, trade history, current internal view, comments, flags, and relevant market context in under ten seconds.

Start by generating the project scaffold, Prisma schema, seed data, basic auth, and core pages. Then implement the dashboard and ticker detail panel first.
