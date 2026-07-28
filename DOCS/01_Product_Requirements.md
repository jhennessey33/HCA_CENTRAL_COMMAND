HCA Central Command — Product Requirements
Product Vision
HCA Central Command is an internal hedge fund command center that combines official portfolio data, market-data enrichment, and internal investment memory into one trader-friendly interface.
Product Problem
Current workflows rely on manually downloaded reports, fragmented notes, spreadsheets, and trader memory. This creates friction when traders need to quickly understand current positions, watchlist candidates, historical trades, and why decisions were made.
Product Solution
Create a centralized web application that:

- Displays active long and short positions.
- Displays watchlists and past positions.
- Preserves comments, flags, timelines, and exit rationale.
- Enriches securities with market data.
- Maintains an audit trail.
- Supports future Wells and Bloomberg integrations.
  Users

- Traders
- Portfolio managers
- Analysts
- Operations users
- Compliance viewers
  Primary User Stories

As a trader, I want to see all active long and short positions so I can monitor the book quickly.
As a trader, I want to click a ticker and see trade history so I can understand how we built the position.
As an analyst, I want to add thesis/risk/catalyst comments so the team can understand our current view.
As a PM, I want to see the comment timeline so I can understand how thinking evolved.
As a trader, I want to flag a position so it gets reviewed.
As a user, I want to see exit rationale under past positions so we preserve why positions were closed.
As an operations user, I want ingestion logs so I know whether Wells data loaded correctly.

MVP Features

- Home page with long/short positions.
- Watchlist with long/short sections.
- Past positions with exit rationales.
- Ticker detail side panel.
- Trade history.
- Market data modal.
- Comments and comment timeline.
- Flags.
- Global comments.
- Basic audit log.
  Out of Scope

- Trade execution.
- Order management.
- Portfolio optimization.
- Official compliance replacement.
- Official NAV accounting.
