type FinnhubQuoteResponse = {
  c?: number;
  d?: number;
  dp?: number;
  h?: number;
  l?: number;
  o?: number;
  pc?: number;
  t?: number;
};

type FinnhubSymbolSearchResponse = {
  result?: Array<{
    description?: string;
    displaySymbol?: string;
    symbol?: string;
    type?: string;
  }>;
};

export type FinnhubSymbolSearchResult = {
  ticker: string;
  name: string;
  type: string | null;
};

export type FinnhubQuote = {
  currentPrice: number;
  dayChange: number | null;
  dayPctChange: number | null;
  highOfDay: number | null;
  lowOfDay: number | null;
  openPrice: number | null;
  previousClose: number | null;
};

function toNumber(value: unknown) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return null;
  }

  return numberValue;
}

function getFinnhubApiKey() {
  const apiKey = process.env.FINNHUB_API_KEY;

  if (!apiKey) {
    throw new Error("FINNHUB_API_KEY is not configured.");
  }

  return apiKey;
}

export async function searchFinnhubSymbols(
  query: string,
  limit = 10,
): Promise<FinnhubSymbolSearchResult[]> {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return [];
  }

  const url = new URL("https://finnhub.io/api/v1/search");
  url.searchParams.set("q", normalizedQuery);
  url.searchParams.set("token", getFinnhubApiKey());

  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Finnhub symbol search failed: ${response.status}`);
  }

  const data = (await response.json()) as FinnhubSymbolSearchResponse;
  const resultLimit = Math.max(1, Math.min(Math.floor(limit), 20));
  const seenTickers = new Set<string>();

  return (Array.isArray(data.result) ? data.result : [])
    .flatMap((result) => {
      const ticker = String(result.symbol || result.displaySymbol || "")
        .trim()
        .toUpperCase();

      const securityType = String(result.type || "").trim();

      if (
        !ticker ||
        seenTickers.has(ticker) ||
        !/^[A-Z0-9.-]+$/.test(ticker) ||
        (securityType && !/(stock|adr|reit|etf|etp)/i.test(securityType))
      ) {
        return [];
      }

      seenTickers.add(ticker);

      return [
        {
          ticker,
          name: String(result.description || ticker).trim() || ticker,
          type: securityType || null,
        },
      ];
    })
    .slice(0, resultLimit);
}

export async function fetchFinnhubQuote(
  ticker: string,
): Promise<FinnhubQuote | null> {
  const normalizedTicker = ticker.trim().toUpperCase();

  if (!normalizedTicker) {
    return null;
  }

  const url = new URL("https://finnhub.io/api/v1/quote");
  url.searchParams.set("symbol", normalizedTicker);
  url.searchParams.set("token", getFinnhubApiKey());

  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Finnhub quote request failed for ${normalizedTicker}: ${response.status}`,
    );
  }

  const data = (await response.json()) as FinnhubQuoteResponse;

  const currentPrice = toNumber(data.c);

  if (currentPrice == null || currentPrice <= 0) {
    return null;
  }

  return {
    currentPrice,
    dayChange: toNumber(data.d),
    dayPctChange: toNumber(data.dp),
    highOfDay: toNumber(data.h),
    lowOfDay: toNumber(data.l),
    openPrice: toNumber(data.o),
    previousClose: toNumber(data.pc),
  };
}
