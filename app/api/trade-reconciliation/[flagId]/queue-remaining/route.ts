import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canCreateFlags } from "@/lib/permissions";
import {
  queueRemainingTradeForFlag,
  TradeReconciliationStateError,
} from "@/lib/reconciliation/trade-reconciliation-service";

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      flagId: string;
    }>;
  },
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "Authentication required.",
        },
        {
          status: 401,
        },
      );
    }

    if (!canCreateFlags(user.role)) {
      return NextResponse.json(
        {
          error: "You do not have permission to resolve Trade reviews.",
        },
        {
          status: 403,
        },
      );
    }

    const { flagId } = await context.params;

    const body = await request.json();

    const result = await queueRemainingTradeForFlag({
      flagId,
      userId: user.id,
      executionPrice: body.executionPrice,
      proposedTradeAt: body.proposedTradeAt,
      comment: body.comment,
      shortLocateNumber: body.shortLocateNumber,
      shortAllocationShares: body.shortAllocationShares,
    });

    return NextResponse.json(result, {
      status: 201,
    });
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

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        {
          error: "Request body must be valid JSON.",
        },
        {
          status: 400,
        },
      );
    }

    console.error("queue-remaining failed", error);

    return NextResponse.json(
      {
        error: "Failed to add the remaining shares to the Trade Queue.",
      },
      {
        status: 500,
      },
    );
  }
}
