import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const CANCELABLE_STATUSES = ["QUEUED", "TRIGGERED"] as const;

class QueueStateError extends Error {}

function canLogManualTrade(role?: string | null) {
  return ["ADMIN", "TRADER", "PM"].includes(role || "");
}

export async function POST(
  _request: Request,
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
          error: "You do not have permission to cancel queued trades.",
        },
        {
          status: 403,
        },
      );
    }

    const { id } = await context.params;
    const queueItemId = String(id || "").trim();

    if (!queueItemId) {
      return NextResponse.json(
        {
          error: "Trade Queue item ID is required.",
        },
        {
          status: 400,
        },
      );
    }

    const existingQueueItem = await prisma.tradeQueueItem.findUnique({
      where: {
        id: queueItemId,
      },
      select: {
        id: true,
        securityId: true,
        positionId: true,
        tradeType: true,
        shares: true,
        executionPrice: true,
        proposedTradeAt: true,
        comment: true,
        shortLocateNumber: true,
        status: true,
        triggeredAt: true,
        executedTradeId: true,
        executedAt: true,
        canceledAt: true,
      },
    });

    if (!existingQueueItem) {
      return NextResponse.json(
        {
          error: "Trade Queue item not found.",
        },
        {
          status: 404,
        },
      );
    }

    if (
      !CANCELABLE_STATUSES.includes(
        existingQueueItem.status as (typeof CANCELABLE_STATUSES)[number],
      )
    ) {
      return NextResponse.json(
        {
          error: "Only queued or triggered Trade Queue items can be canceled.",
        },
        {
          status: 409,
        },
      );
    }

    const canceledQueueItem = await prisma.$transaction(async (tx) => {
      const currentQueueItem = await tx.tradeQueueItem.findUnique({
        where: {
          id: queueItemId,
        },
        select: {
          id: true,
          securityId: true,
          positionId: true,
          tradeType: true,
          shares: true,
          executionPrice: true,
          proposedTradeAt: true,
          comment: true,
          shortLocateNumber: true,
          status: true,
          triggeredAt: true,
          executedTradeId: true,
          executedAt: true,
          canceledAt: true,
        },
      });

      if (!currentQueueItem) {
        throw new QueueStateError("Trade Queue item no longer exists.");
      }

      if (
        !CANCELABLE_STATUSES.includes(
          currentQueueItem.status as (typeof CANCELABLE_STATUSES)[number],
        )
      ) {
        throw new QueueStateError(
          "The Trade Queue item is no longer cancelable.",
        );
      }

      const canceledAt = new Date();

      await tx.flag.updateMany({
        where: {
          tradeQueueItemId: queueItemId,
          status: "OPEN",
        },
        data: {
          status: "RESOLVED",
          resolvedAt: canceledAt,
          resolvedById: currentUser.id,
        },
      });

      const queueItem = await tx.tradeQueueItem.update({
        where: {
          id: queueItemId,
        },
        data: {
          status: "CANCELED",
          canceledAt,
        },
        include: {
          security: {
            include: {
              marketData: {
                take: 1,
                orderBy: {
                  updatedAt: "desc",
                },
              },
            },
          },
          position: {
            select: {
              id: true,
              securityId: true,
              side: true,
              status: true,
              shares: true,
              marketValue: true,
              source: true,
              accountNumber: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: currentUser.id,
          action: "TRADE_QUEUE_CANCELED",
          entityType: "TRADE_QUEUE_ITEM",
          entityId: queueItem.id,
          previousValueJson: JSON.stringify({
            status: currentQueueItem.status,
            triggeredAt: currentQueueItem.triggeredAt,
            canceledAt: currentQueueItem.canceledAt,
          }),
          newValueJson: JSON.stringify({
            status: queueItem.status,
            triggeredAt: queueItem.triggeredAt,
            canceledAt: queueItem.canceledAt,
          }),
        },
      });

      return queueItem;
    });

    return NextResponse.json({
      queueItem: canceledQueueItem,
    });
  } catch (error) {
    if (error instanceof QueueStateError) {
      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: 409,
        },
      );
    }

    console.error("POST /api/trade-queue/[id]/cancel failed", error);

    return NextResponse.json(
      {
        error: "Failed to cancel the Trade Queue item.",
      },
      {
        status: 500,
      },
    );
  }
}
