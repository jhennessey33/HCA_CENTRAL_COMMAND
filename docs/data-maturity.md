# Data Maturity Policy

This document defines HCA Central Command's data maturity categories, source ownership, and cleanup rules for seeded and placeholder data.

## 1. Data Categories

- `LIVE`
  - Data that comes from a real provider and is considered authoritative.
  - Should be used directly in calculations and displayed without placeholder treatment.

- `CALCULATED`
  - Data derived from one or more authoritative source fields.
  - The value is only valid when all required inputs are valid.

- `SEEDED_REFERENCE`
  - Seeded data used to bootstrap the system, typically for security master or metadata.
  - These values are reference data and should remain in place unless a real source replaces them.

- `SEEDED_POSITION`
  - Seeded positions, trades, watchlist entries, comments, and flags.
  - These are valid seeded business objects that should not be deleted simply because they are seeded.

- `PLACEHOLDER`
  - Seeded values that exist only to prevent empty records, not because they reflect real data.
  - Placeholders should never be used in calculations.

- `FUTURE_SOURCE`
  - Fields that are expected to be sourced from a future provider integration.
  - Until the future source is available, values should be treated as missing.

- `UNAVAILABLE`
  - Fields that cannot be sourced or calculated at the moment.
  - The UI should represent them as unavailable or N/A.

## 2. Seeded business data must stay

Seeded securities, watchlists, comments, flags, positions, and trades are part of the project’s seeded experience. They should not be deleted solely because they were seeded.

These seeded objects provide context, sample workflow, and user-facing examples of how the application should behave.

## 3. Placeholder market-data numbers must never be used in calculations

Placeholder values are not real data. They exist only to avoid empty records or to fill seeded data during early prototyping.

- Any `PLACEHOLDER` field must be excluded from calculations.
- Calculated metrics should only be derived from `LIVE` or valid `CALCULATED` values.
- If a placeholder field is present, the application should treat it as missing for ratio and valuation math.

## 4. Current source ownership

### FMP

These fields are currently owned by the FMP market data provider:

- `currentPrice`
- `marketCap`
- `high52w`
- `low52w`
- `avgVolume`

### SEC_EDGAR

These fields are currently owned by the SEC EDGAR fundamentals provider:

- `cik`
- `revenue`
- `revenueTtm`
- `netIncome`
- `netIncomeTtm`
- `cashAndEquivalents`
- `totalDebt`
- `shareholdersEquity`
- `bookValue`
- `bookValuePerShare`
- `tangibleBookValue`
- `tangibleBookValuePerShare`
- `eps`
- `epsTtm`

### CALCULATED

These fields are derived from other source fields and calculated in the app:

- `peLtm`
- `priceToBook`
- `priceToTangBook`
- `debtToEbitda`
- `enterpriseValue`

### SEEDED_POSITION

These fields are seeded position/trade data and should remain as seeded reference values until Wells Fargo or another position source is integrated:

- position `shares`
- `wap`
- `marketValue`
- `portfolioPct`
- trade history
- `openedAt`
- `closedAt`

### FUTURE_SOURCE

These fields are expected to come from a future source and should not be treated as authoritative until that source is integrated:

- Wells Fargo positions
- `beta`
- `vwap` if not reliably sourced
- `shortFloat`
- `shortInterestShares`
- `floatShares`
- `epsNtm`
- `peNtm`

## 5. Cleanup rule

If a field is classified as `PLACEHOLDER` or `FUTURE_SOURCE` and no real provider value exists, the UI should show `N/A` rather than displaying a fake seeded value.

This ensures that the application does not mislead users with placeholder data and preserves the distinction between real data and seeded or anticipated values.
