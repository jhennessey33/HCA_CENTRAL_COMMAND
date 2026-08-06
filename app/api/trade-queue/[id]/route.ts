import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const EDITABLE_STATUSES = ["QUEUED", "TRIGGERED"] as const;

class RequestValidationError extends Error {}

function canLogManualTrade(role?: string | null) {
  return ["ADMIN", "TRADER", "PM"].includes(role || "");
}

function parsePositiveNumber(value: unknown, fieldName: string) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    throw new RequestValidationError(`${fieldName} must be a valid number.`);
  }

  if (parsedValue <= 0) {
    throw new RequestValidationError(`${fieldName} must be greater than zero.`);
  }

  return parsedValue;
}

function parseProposedTradeAt(value: unknown) {
  if (value === null || value === undefined || value === "") {
    throw new RequestValidationError(
      "Proposed trade date and time are required.",
    );
  }

  const proposedTradeAt = new Date(String(value));

  if (Number.isNaN(proposedTradeAt.getTime())) {
    throw new RequestValidationError(
      "Proposed trade date and time must be valid.",
    );
  }

  return proposedTradeAt;
}

function parseOptionalComment(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  const comment = String(value).trim();

  if (!comment) {
    return null;
  }

  if (comment.length > 5000) {
    throw new RequestValidationError(
      "Comment must be 5,000 characters or fewer.",
    );
  }

  return comment;
}

function parseShortLocateNumber(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  const shortLocateNumber = String(value).trim();

  if (!shortLocateNumber) {
    return null;
  }

  if (shortLocateNumber.length > 200) {
    throw new RequestValidationError(
      "Short Locate Number must be 200 characters or fewer.",
    );
  }

  return shortLocateNumber;
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
          error: "You do not have permission to edit queued trades.",
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

    const body = await request.json();

    const shares = parsePositiveNumber(body.shares, "Shares");
    const executionPrice = parsePositiveNumber(
      body.executionPrice,
      "Execution price",
    );
    const proposedTradeAt = parseProposedTradeAt(body.proposedTradeAt);
    const comment = parseOptionalComment(body.comment);
    const shortLocateNumber = parseShortLocateNumber(body.shortLocateNumber);

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
      !EDITABLE_STATUSES.includes(
        existingQueueItem.status as (typeof EDITABLE_STATUSES)[number],
      )
    ) {
      return NextResponse.json(
        {
          error: "Only queued or triggered Trade Queue items can be edited.",
        },
        {
          status: 409,
        },
      );
    }

    if (existingQueueItem.tradeType === "SHORT" && !shortLocateNumber) {
      throw new RequestValidationError(
        "Short Locate Number is required for a short trade.",
      );
    }

    const activePosition = await prisma.position.findFirst({
      where: {
        id: existingQueueItem.positionId,
        securityId: existingQueueItem.securityId,
        status: "ACTIVE",
      },
      select: {
        id: true,
      },
    });

    if (!activePosition) {
      return NextResponse.json(
        {
          error:
            "The Trade Queue item is no longer associated with an active position.",
        },
        {
          status: 409,
        },
      );
    }

    const updatedQueueItem = await prisma.$transaction(async (tx) => {
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
        throw new RequestValidationError("Trade Queue item no longer exists.");
      }

      if (
        !EDITABLE_STATUSES.includes(
          currentQueueItem.status as (typeof EDITABLE_STATUSES)[number],
        )
      ) {
        throw new RequestValidationError(
          "The Trade Queue item is no longer editable.",
        );
      }

      const wasTriggered = currentQueueItem.status === "TRIGGERED";

      if (wasTriggered) {
        await tx.flag.updateMany({
          where: {
            tradeQueueItemId: queueItemId,
            status: "OPEN",
          },
          data: {
            status: "RESOLVED",
            resolvedAt: new Date(),
            resolvedById: currentUser.id,
          },
        });
      }

      const queueItem = await tx.tradeQueueItem.update({
        where: {
          id: queueItemId,
        },
        data: {
          shares,
          executionPrice,
          proposedTradeAt,
          comment,
          shortLocateNumber,
          status: wasTriggered ? "QUEUED" : currentQueueItem.status,
          triggeredAt: wasTriggered ? null : currentQueueItem.triggeredAt,
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
          action: "TRADE_QUEUE_UPDATED",
          entityType: "TRADE_QUEUE_ITEM",
          entityId: queueItem.id,
          previousValueJson: JSON.stringify({
            shares: currentQueueItem.shares,
            executionPrice: currentQueueItem.executionPrice,
            proposedTradeAt: currentQueueItem.proposedTradeAt,
            comment: currentQueueItem.comment,
            shortLocateNumber: currentQueueItem.shortLocateNumber,
            status: currentQueueItem.status,
            triggeredAt: currentQueueItem.triggeredAt,
          }),
          newValueJson: JSON.stringify({
            shares: queueItem.shares,
            executionPrice: queueItem.executionPrice,
            proposedTradeAt: queueItem.proposedTradeAt,
            comment: queueItem.comment,
            shortLocateNumber: queueItem.shortLocateNumber,
            status: queueItem.status,
            triggeredAt: queueItem.triggeredAt,
            resetFromTriggered: wasTriggered,
          }),
        },
      });

      return queueItem;
    });

    return NextResponse.json({
      queueItem: updatedQueueItem,
    });
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: 400,
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

    console.error("PATCH /api/trade-queue/[id] failed", error);

    return NextResponse.json(
      {
        error: "Failed to update the Trade Queue item.",
      },
      {
        status: 500,
      },
    );
  }
}
