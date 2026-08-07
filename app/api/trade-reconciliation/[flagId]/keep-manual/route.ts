import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canCreateFlags } from "@/lib/permissions";
import {
  keepManualTradeForFlag,
  TradeReconciliationStateError,
} from "@/lib/reconciliation/trade-reconciliation-service";

export async function POST(
  request: Request,
  context: { params: Promise<{ flagId: string }> },
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    if (!canCreateFlags(user.role)) {
      return NextResponse.json(
        { error: "You do not have permission to resolve trade reviews." },
        { status: 403 },
      );
    }

    const { flagId } = await context.params;

    const result = await keepManualTradeForFlag({
      flagId,
      userId: user.id,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof TradeReconciliationStateError) {
      const status = error.message === "Flag not found." ? 404 : 409;

      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status,
        },
      );
    }
    console.error("keep-manual failed", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to keep manual trade.",
      },
      { status: 500 },
    );
  }
}
