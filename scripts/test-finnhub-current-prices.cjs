const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

function loadDotEnv() {
  const envPath = path.join(process.cwd(), ".env");

  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalsIndex = trimmed.indexOf("=");

    if (equalsIndex === -1) continue;

    const key = trimmed.slice(0, equalsIndex).trim();
    const rawValue = trimmed.slice(equalsIndex + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeTicker(ticker) {
  return String(ticker || "")
    .trim()
    .toUpperCase();
}

async function fetchFinnhubQuote(ticker) {
  const apiKey = process.env.FINNHUB_API_KEY;

  if (!apiKey) {
    throw new Error("FINNHUB_API_KEY is not configured in .env");
  }

  const normalizedTicker = normalizeTicker(ticker);

  const url = new URL("https://finnhub.io/api/v1/quote");
  url.searchParams.set("symbol", normalizedTicker);
  url.searchParams.set("token", apiKey);

  const response = await fetch(url);

  if (!response.ok) {
    return {
      ok: false,
      ticker: normalizedTicker,
      reason: `HTTP_${response.status}`,
      data: null,
    };
  }

  const data = await response.json();
  const currentPrice = Number(data.c);

  if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
    return {
      ok: false,
      ticker: normalizedTicker,
      reason: "NO_CURRENT_PRICE",
      data,
    };
  }

  return {
    ok: true,
    ticker: normalizedTicker,
    currentPrice,
    dayChange: Number.isFinite(Number(data.d)) ? Number(data.d) : null,
    dayPctChange: Number.isFinite(Number(data.dp)) ? Number(data.dp) : null,
    highOfDay: Number.isFinite(Number(data.h)) ? Number(data.h) : null,
    lowOfDay: Number.isFinite(Number(data.l)) ? Number(data.l) : null,
    openPrice: Number.isFinite(Number(data.o)) ? Number(data.o) : null,
    previousClose: Number.isFinite(Number(data.pc)) ? Number(data.pc) : null,
    data,
  };
}

async function getPortfolioTickers(prisma) {
  let positions;

  try {
    positions = await prisma.position.findMany({
      where: {
        source: "WELLS_FARGO",
      },
      include: {
        security: true,
      },
    });
  } catch {
    positions = await prisma.position.findMany({
      include: {
        security: true,
      },
    });
  }

  const tickerMap = new Map();

  for (const position of positions) {
    const ticker = normalizeTicker(position.security?.ticker);

    if (!ticker) continue;

    tickerMap.set(ticker, {
      ticker,
      name: position.security?.name || "",
    });
  }

  if (tickerMap.size > 0) {
    return Array.from(tickerMap.values()).sort((a, b) =>
      a.ticker.localeCompare(b.ticker),
    );
  }

  const securities = await prisma.security.findMany({
    orderBy: {
      ticker: "asc",
    },
  });

  return securities
    .map((security) => ({
      ticker: normalizeTicker(security.ticker),
      name: security.name || "",
    }))
    .filter((security) => security.ticker);
}

async function main() {
  loadDotEnv();

  const prisma = new PrismaClient();

  try {
    const tickers = await getPortfolioTickers(prisma);

    console.log(
      `Testing Finnhub current price coverage for ${tickers.length} tickers...\n`,
    );

    const results = [];

    for (const security of tickers) {
      try {
        const result = await fetchFinnhubQuote(security.ticker);

        results.push({
          ...result,
          name: security.name,
        });

        if (result.ok) {
          console.log(
            `[OK]   ${result.ticker.padEnd(8)} $${result.currentPrice.toFixed(2)}`,
          );
        } else {
          console.log(`[MISS] ${result.ticker.padEnd(8)} ${result.reason}`);
        }
      } catch (error) {
        results.push({
          ok: false,
          ticker: security.ticker,
          name: security.name,
          reason: error instanceof Error ? error.message : "UNKNOWN_ERROR",
        });

        console.log(
          `[ERR]  ${security.ticker.padEnd(8)} ${error instanceof Error ? error.message : "UNKNOWN_ERROR"}`,
        );
      }

      // Finnhub free tier is 60 calls/minute. This keeps us under that.
      await sleep(1100);
    }

    const okCount = results.filter((result) => result.ok).length;
    const failCount = results.length - okCount;

    console.log("\nSummary");
    console.log("-------");
    console.log(`Total tickers: ${results.length}`);
    console.log(`Prices found: ${okCount}`);
    console.log(`Missing/failed: ${failCount}`);

    const outputPath = path.join(
      process.cwd(),
      "scripts",
      "finnhub-quote-test-results.json",
    );

    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));

    console.log(`\nSaved detailed results to: ${outputPath}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
