import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { searchFinnhubSymbols } from "@/lib/market-data/finnhub";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";

    if (!query) {
      return NextResponse.json({ results: [] });
    }

    if (query.length > 64) {
      return NextResponse.json(
        { error: "Security search is limited to 64 characters." },
        { status: 400 },
      );
    }

    const results = await searchFinnhubSymbols(query);

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Trade Calculator security search failed:", error);

    return NextResponse.json(
      { error: "Unable to search securities right now." },
      { status: 502 },
    );
  }
}
