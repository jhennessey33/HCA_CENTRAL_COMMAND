import { NextResponse } from "next/server";
import { refreshMarketData } from "@/lib/market-data/refresh-market-data-service";
import { getCurrentUser } from "@/lib/auth";

export async function POST() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 },
      );
    }

    const result = await refreshMarketData({
      trigger: "MANUAL",
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Finnhub current price refresh failed.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
