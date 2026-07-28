import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function canLogManualTrade(role?: string | null) {
  return ["ADMIN", "TRADER", "PM"].includes(role || "");
}

export async function DELETE(
  request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json(
        {
          error: "Authentication required.",
        },
        {
          status: 401,
        },
      );
    }

    if (!canLogManualTrade(currentUser.role)) {
      return NextResponse.json(
        {
          error: "You do not have permission to delete manual trades.",
        },
        {
          status: 403,
        },
      );
    }

    const { id } = await context.params;

    const trade = await prisma.trade.findUnique({
      where: {
        id,
      },
    });

    if (!trade) {
      return NextResponse.json(
        {
          error: "Trade not found.",
        },
        {
          status: 404,
        },
      );
    }

    if (trade.source !== "MANUAL") {
      return NextResponse.json(
        {
          error: "Only manual trades may be deleted.",
        },
        {
          status: 400,
        },
      );
    }

    if (trade.isHidden) {
      return NextResponse.json(
        {
          error: "Trade has already been deleted.",
        },
        {
          status: 409,
        },
      );
    }

    if (trade.reconciliationStatus !== "MANUAL_PENDING") {
      return NextResponse.json(
        {
          error: "Only pending manual trades may be deleted.",
        },
        {
          status: 409,
        },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.trade.update({
        where: {
          id: trade.id,
        },
        data: {
          isHidden: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: currentUser.id,
          action: "MANUAL_TRADE_DELETED",
          entityType: "TRADE",
          entityId: trade.id,
          previousValueJson: JSON.stringify({
            tradeId: trade.id,
            securityId: trade.securityId,
            positionId: trade.positionId,
            tradeType: trade.tradeType,
            shares: trade.shares,
            avgPrice: trade.avgPrice,
            source: trade.source,
            reconciliationStatus: trade.reconciliationStatus,
          }),
        },
      });
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("DELETE /api/trades/manual/[id] failed", error);

    return NextResponse.json(
      {
        error: "Failed to delete manual trade.",
      },
      {
        status: 500,
      },
    );
  }
}
