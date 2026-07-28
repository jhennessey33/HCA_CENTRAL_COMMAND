API Specification
Position Endpoints

GET /api/positions
GET /api/positions/:id
GET /api/positions/:id/trades
GET /api/positions/:id/comments
GET /api/positions/:id/flags

Watchlist Endpoints

GET /api/watchlist
POST /api/watchlist
PATCH /api/watchlist/:id
DELETE /api/watchlist/:id

Comment Endpoints

GET /api/comments
POST /api/comments
PATCH /api/comments/:id
DELETE /api/comments/:id
POST /api/comments/:id/pin

Flag Endpoints

GET /api/flags
POST /api/flags
PATCH /api/flags/:id
POST /api/flags/:id/resolve

Market Data Endpoints

GET /api/securities/:id/market-data
POST /api/market-data/refresh

Ingestion Endpoints

GET /api/ingestion/runs
POST /api/ingestion/wells/manual-upload
POST /api/ingestion/wells/run
GET /api/ingestion/runs/:id

Audit Endpoints

GET /api/audit-logs
GET /api/audit-logs/:id
