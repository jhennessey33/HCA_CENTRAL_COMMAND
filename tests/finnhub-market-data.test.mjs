import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchFinnhubQuote,
  searchFinnhubSymbols,
} from "../lib/market-data/finnhub.ts";

test("Finnhub search returns unique stock-like securities", async () => {
  const originalApiKey = process.env.FINNHUB_API_KEY;
  const originalFetch = globalThis.fetch;

  process.env.FINNHUB_API_KEY = "test-key";
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));

    assert.equal(url.pathname, "/api/v1/search");
    assert.equal(url.searchParams.get("q"), "apple");
    assert.equal(url.searchParams.get("token"), "test-key");
    assert.deepEqual(init, { cache: "no-store" });

    return Response.json({
      result: [
        {
          description: "Apple Inc",
          displaySymbol: "AAPL",
          symbol: "AAPL",
          type: "Common Stock",
        },
        {
          description: "Duplicate Apple",
          symbol: "AAPL",
          type: "Common Stock",
        },
        {
          description: "Bitcoin",
          symbol: "BINANCE:BTCUSDT",
          type: "Crypto",
        },
      ],
    });
  };

  try {
    assert.deepEqual(await searchFinnhubSymbols(" apple "), [
      {
        ticker: "AAPL",
        name: "Apple Inc",
        type: "Common Stock",
      },
    ]);
  } finally {
    globalThis.fetch = originalFetch;

    if (originalApiKey === undefined) {
      delete process.env.FINNHUB_API_KEY;
    } else {
      process.env.FINNHUB_API_KEY = originalApiKey;
    }
  }
});

test("Finnhub quote supplies the current price for an external ticker", async () => {
  const originalApiKey = process.env.FINNHUB_API_KEY;
  const originalFetch = globalThis.fetch;

  process.env.FINNHUB_API_KEY = "test-key";
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));

    assert.equal(url.pathname, "/api/v1/quote");
    assert.equal(url.searchParams.get("symbol"), "NVDA");

    return Response.json({
      c: 178.42,
      d: 1.25,
      dp: 0.71,
      h: 180,
      l: 175,
      o: 176,
      pc: 177.17,
    });
  };

  try {
    const quote = await fetchFinnhubQuote(" nvda ");

    assert.equal(quote?.currentPrice, 178.42);
  } finally {
    globalThis.fetch = originalFetch;

    if (originalApiKey === undefined) {
      delete process.env.FINNHUB_API_KEY;
    } else {
      process.env.FINNHUB_API_KEY = originalApiKey;
    }
  }
});
