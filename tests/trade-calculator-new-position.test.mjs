import assert from "node:assert/strict";
import test from "node:test";

import { calculateTradeScenario } from "../lib/trade-calculator/trade-calculator.ts";

test("a security without a position can be calculated from a flat baseline", () => {
  const result = calculateTradeScenario({
    securityId: "finnhub:NVDA",
    positionId: null,
    ticker: "NVDA",
    companyName: "NVIDIA Corp",
    wellsSide: null,
    wellsShares: null,
    wellsMarketValue: null,
    wellsWap: null,
    pendingManualDelta: 0,
    pendingProjectionIsValid: true,
    grossPortfolioMarketValue: 1_000_000,
    netEquity: 500_000,
    baselineMode: "WELLS_PLUS_PENDING",
    tradeAction: "BUY",
    sizingMode: "SHARES",
    sharesInput: 100,
    estimatedPrice: 178.42,
    dateTraded: "2026-09-25T12:00:00.000Z",
  });

  assert.equal(result.isValid, true);
  assert.equal(result.baselineSide, "FLAT");
  assert.equal(result.baselineExposure, 0);
  assert.equal(result.projectedSide, "LONG");
  assert.equal(result.projectedExposure, 100);
  assert.equal(result.proposedNotional, 17_842);
  assert.equal(result.exposureChangeLabel, "New Position");
  assert.equal(result.canCreateDraft, false);
  assert.equal(result.draft, null);
  assert.match(result.warnings.join(" "), /manual-trade submission is unavailable/i);
});
