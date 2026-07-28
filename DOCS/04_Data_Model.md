Data Model Overview
Main Entities

- User
- Role
- Security
- Position
- Trade
- WatchlistEntry
- Comment
- Flag
- MarketDataCache
- IngestionRun
- AuditLog
- Attachment
  Relationship Summary

Security has many Positions.
Security has many Trades.
Security has many Comments.
Security has many Flags.
Security has many WatchlistEntries.
Position has many Trades.
Position has many Comments.
Position has many Flags.
WatchlistEntry has many Comments.
WatchlistEntry has many Flags.
User creates Comments, Flags, WatchlistEntries, and AuditLogs.

Critical Modeling Decision
Do not model comments only by ticker string. Comments should attach to stable database IDs such as security_id, position_id, or watchlist_entry_id.
This prevents ambiguity when a ticker appears as:

- Active long position.
- Past position.
- Watchlist entry.
- Reopened future position.
