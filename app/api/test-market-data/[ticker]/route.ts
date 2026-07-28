import { NextResponse } from "next/server";
import { getFmpMarketData } from "@/lib/fmp";

export async function GET(
  _request: Request,
  context: { params: Promise<{ ticker: string }> },
) {
  try {
    const params = await context.params;
    const ticker = params.ticker.toUpperCase();

    const data = await getFmpMarketData(ticker);

    return NextResponse.json({
      ticker,
      source: "FMP",
      data,
    });
  } catch (error) {
    console.error("Failed to fetch FMP test market data:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch FMP market data.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
