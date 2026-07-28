import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function canLogManualTrade(role?: string | null) {
  return ["ADMIN", "TRADER", "PM"].includes(role || "");
}

export async function PATCH(
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
          error: "You do not have permission to edit trade notes.",
        },
        {
          status: 403,
        },
      );
    }

    const { id } = await context.params;

    const body = await request.json();

    const comment = String(body.comment || "").trim();

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
          error: "Only manual trades may be edited.",
        },
        {
          status: 400,
        },
      );
    }

    const updatedTrade = await prisma.$transaction(async (tx) => {
      const updated = await tx.trade.update({
        where: {
          id: trade.id,
        },
        data: {
          comment: comment || null,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: currentUser.id,
          action: "MANUAL_TRADE_NOTE_UPDATED",
          entityType: "TRADE",
          entityId: trade.id,
          previousValueJson: JSON.stringify({
            comment: trade.comment,
          }),
          newValueJson: JSON.stringify({
            comment: comment || null,
          }),
        },
      });

      return updated;
    });

    return NextResponse.json({
      trade: updatedTrade,
    });
  } catch (error) {
    console.error("PATCH /api/trades/manual/[id]/note failed", error);

    return NextResponse.json(
      {
        error: "Failed to update trade note.",
      },
      {
        status: 500,
      },
    );
  }
}
