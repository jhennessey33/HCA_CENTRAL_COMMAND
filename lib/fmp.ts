type FmpMarketData = {
  currentPrice: number | null;
  vwap: number | null;
  high52w: number | null;
  low52w: number | null;
  beta: number | null;
  avgVolume: number | null;
  shortFloat: number | null;
  marketCap: number | null;
  peLtm: number | null;
  priceToTangBook: number | null;
  peNtm: number | null;
  priceToBook: number | null;
  debtToEbitda: number | null;
  eps: number | null;
};

const FMP_BASE_URL = "https://financialmodelingprep.com/stable";

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;

  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : null;
}

async function fetchFmpJson<T>(path: string): Promise<T | null> {
  const apiKey = process.env.FMP_API_KEY;

  if (!apiKey) {
    throw new Error("Missing FMP_API_KEY environment variable.");
  }

  const separator = path.includes("?") ? "&" : "?";
  const url = `${FMP_BASE_URL}${path}${separator}apikey=${apiKey}`;

  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`FMP request failed: ${response.status} ${text}`);
  }

  return response.json() as Promise<T>;
}

function extractFirst(response: unknown): any | null {
  return Array.isArray(response) ? (response[0] ?? null) : null;
}

function emptyMarketData(): FmpMarketData {
  return {
    currentPrice: null,
    vwap: null,
    high52w: null,
    low52w: null,
    beta: null,
    avgVolume: null,
    shortFloat: null,
    marketCap: null,
    peLtm: null,
    priceToTangBook: null,
    peNtm: null,
    priceToBook: null,
    debtToEbitda: null,
    eps: null,
  };
}

export async function getFmpMarketData(ticker: string): Promise<FmpMarketData> {
  const symbol = ticker.trim().toUpperCase();

  try {
    const quoteResponse = await fetchFmpJson<any[]>(
      `/quote?symbol=${encodeURIComponent(symbol)}`,
    );

    const quote = extractFirst(quoteResponse);

    if (!quote) {
      throw new Error(`No FMP quote data returned for ${symbol}.`);
    }

    return {
      currentPrice: toNumber(quote.price),
      vwap: toNumber(quote.vwap) ?? toNumber(quote.volumeWeightedAveragePrice),
      high52w: toNumber(quote.yearHigh),
      low52w: toNumber(quote.yearLow),
      beta: toNumber(quote.beta),
      avgVolume: toNumber(quote.avgVolume) ?? toNumber(quote.volume),
      shortFloat: null,
      marketCap: toNumber(quote.marketCap),
      peLtm: toNumber(quote.pe),
      priceToTangBook: null,
      peNtm: null,
      priceToBook: null,
      debtToEbitda: null,
      eps: toNumber(quote.eps),
    };
  } catch (fullQuoteError) {
    console.warn(
      `FMP full quote failed for ${symbol}. Trying quote-short fallback.`,
      fullQuoteError,
    );

    try {
      const shortQuoteResponse = await fetchFmpJson<any[]>(
        `/quote-short?symbol=${encodeURIComponent(symbol)}`,
      );

      const shortQuote = extractFirst(shortQuoteResponse);

      if (!shortQuote) {
        throw new Error(`No FMP short quote data returned for ${symbol}.`);
      }

      return {
        ...emptyMarketData(),
        currentPrice: toNumber(shortQuote.price),
        avgVolume: toNumber(shortQuote.volume),
      };
    } catch (shortQuoteError) {
      console.warn(
        `FMP quote-short fallback failed for ${symbol}.`,
        shortQuoteError,
      );

      throw fullQuoteError;
    }
  }
}
