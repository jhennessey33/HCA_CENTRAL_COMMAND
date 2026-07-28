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

export async function fetchFinnhubQuote(
  ticker: string,
): Promise<FinnhubQuote | null> {
  const apiKey = process.env.FINNHUB_API_KEY;

  if (!apiKey) {
    throw new Error("FINNHUB_API_KEY is not configured.");
  }

  const normalizedTicker = ticker.trim().toUpperCase();

  if (!normalizedTicker) {
    return null;
  }

  const url = new URL("https://finnhub.io/api/v1/quote");
  url.searchParams.set("symbol", normalizedTicker);
  url.searchParams.set("token", apiKey);

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
