import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { fetchFinnhubQuote } from "@/lib/market-data/finnhub";

export async function GET(
  _request: Request,
  context: { params: Promise<{ ticker: string }> },
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    const { ticker: tickerParam } = await context.params;
    const ticker = decodeURIComponent(tickerParam).trim().toUpperCase();

    if (!ticker || !/^[A-Z0-9.-]{1,20}$/.test(ticker)) {
      return NextResponse.json(
        { error: "A valid ticker is required." },
        { status: 400 },
      );
    }

    const quote = await fetchFinnhubQuote(ticker);

    if (!quote) {
      return NextResponse.json(
        { error: `No current Finnhub price is available for ${ticker}.` },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ticker,
      source: "FINNHUB",
      currentPrice: quote.currentPrice,
      asOf: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Trade Calculator security quote failed:", error);

    return NextResponse.json(
      { error: "Unable to load the current price right now." },
      { status: 502 },
    );
  }
}
