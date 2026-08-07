import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createManualPendingTrade,
  ManualTradeCreationError,
} from "@/lib/trades/manual-trade-service";

const EXECUTABLE_STATUSES = ["QUEUED", "TRIGGERED"] as const;

class RequestValidationError extends Error {}

class QueueExecutionStateError extends Error {}

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

function parseTradeDate(value: unknown) {
  if (value === null || value === undefined || value === "") {
    throw new RequestValidationError(
      "Actual trade date and time are required.",
    );
  }

  const dateTraded = new Date(String(value));

  if (Number.isNaN(dateTraded.getTime())) {
    throw new RequestValidationError(
      "Actual trade date and time must be valid.",
    );
  }

  return dateTraded;
}

export async function POST(
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
          error: "You do not have permission to execute queued trades.",
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

    const avgPrice = parsePositiveNumber(
      body.avgPrice,
      "Actual execution price",
    );

    const dateTraded = parseTradeDate(body.dateTraded);

    const executionResult = await prisma.$transaction(async (tx) => {
      const queueItem = await tx.tradeQueueItem.findUnique({
        where: {
          id: queueItemId,
        },
        select: {
          id: true,
          securityId: true,
          positionId: true,
          createdById: true,
          executedTradeId: true,
          tradeType: true,
          shares: true,
          executionPrice: true,
          proposedTradeAt: true,
          comment: true,
          shortLocateNumber: true,
          shortAllocationShares: true,
          status: true,
          triggeredAt: true,
          executedAt: true,
          canceledAt: true,
          security: {
            select: {
              id: true,
              ticker: true,
              name: true,
            },
          },
        },
      });

      if (!queueItem) {
        throw new QueueExecutionStateError("Trade Queue item not found.");
      }

      if (
        !EXECUTABLE_STATUSES.includes(
          queueItem.status as (typeof EXECUTABLE_STATUSES)[number],
        )
      ) {
        throw new QueueExecutionStateError(
          "Only queued or triggered Trade Queue items can be executed.",
        );
      }

      if (queueItem.executedTradeId) {
        throw new QueueExecutionStateError(
          "This Trade Queue item has already been linked to a Trade.",
        );
      }

      const position = await tx.position.findUnique({
        where: {
          id: queueItem.positionId,
        },
        select: {
          id: true,
          securityId: true,
          status: true,
        },
      });

      if (!position) {
        throw new QueueExecutionStateError(
          "The Position associated with this Trade Queue item no longer exists.",
        );
      }

      if (position.securityId !== queueItem.securityId) {
        throw new QueueExecutionStateError(
          "The Trade Queue item Position no longer belongs to its Security.",
        );
      }

      if (position.status !== "ACTIVE") {
        throw new QueueExecutionStateError(
          "Queued trades can only be executed against an active Position.",
        );
      }

      if (queueItem.tradeType === "SHORT") {
        if (!queueItem.shortLocateNumber?.trim()) {
          throw new QueueExecutionStateError(
            "This SHORT queue item does not include a Short Locate Number. Edit the queue item before execution.",
          );
        }

        const shortAllocationShares = Number(
          queueItem.shortAllocationShares,
        );

        if (
          queueItem.shortAllocationShares == null ||
          !Number.isFinite(shortAllocationShares) ||
          shortAllocationShares <= 0 ||
          !Number.isInteger(shortAllocationShares)
        ) {
          throw new QueueExecutionStateError(
            "This SHORT queue item does not include a valid Short Allocation Shares value. Edit the queue item before execution.",
          );
        }

        const queuedShares = Number(queueItem.shares);

        if (
          !Number.isFinite(queuedShares) ||
          queuedShares <= 0 ||
          !Number.isInteger(queuedShares)
        ) {
          throw new QueueExecutionStateError(
            "This SHORT queue item does not include a valid whole-share quantity. Edit the queue item before execution.",
          );
        }

        if (queuedShares > shortAllocationShares) {
          throw new QueueExecutionStateError(
            `Queued SHORT shares of ${queuedShares.toLocaleString(
              "en-US",
            )} exceed the allocated ${shortAllocationShares.toLocaleString(
              "en-US",
            )} shares. Edit the queue item before execution.`,
          );
        }
      }

      const createdTrade = await createManualPendingTrade(tx, {
        actorId: currentUser.id,
        securityId: queueItem.securityId,
        securityTicker: queueItem.security.ticker,
        positionId: queueItem.positionId,
        tradeType: queueItem.tradeType as "BUY" | "SELL" | "SHORT" | "COVER",
        shares: queueItem.shares,
        avgPrice,
        dateTraded,
        comment: queueItem.comment,
        shortLocateNumber: queueItem.shortLocateNumber,
        shortAllocationShares: queueItem.shortAllocationShares,
        origin: "TRADE_QUEUE",
      });

      const executedAt = new Date();

      const queueUpdateResult = await tx.tradeQueueItem.updateMany({
        where: {
          id: queueItem.id,
          status: {
            in: ["QUEUED", "TRIGGERED"],
          },
          executedTradeId: null,
          canceledAt: null,
        },
        data: {
          status: "EXECUTED",
          executedTradeId: createdTrade.id,
          executedAt,
        },
      });

      if (queueUpdateResult.count !== 1) {
        throw new QueueExecutionStateError(
          "The Trade Queue item changed state before execution could be completed.",
        );
      }

      const resolvedQueueAlerts = await tx.flag.updateMany({
        where: {
          tradeQueueItemId: queueItem.id,
          status: "OPEN",
        },
        data: {
          status: "RESOLVED",
          resolvedAt: executedAt,
          resolvedById: currentUser.id,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: currentUser.id,
          action: "TRADE_QUEUE_EXECUTED",
          entityType: "TRADE_QUEUE_ITEM",
          entityId: queueItem.id,
          previousValueJson: JSON.stringify({
            status: queueItem.status,
            executedTradeId: queueItem.executedTradeId,
            executedAt: queueItem.executedAt,
            triggeredAt: queueItem.triggeredAt,
          }),
          newValueJson: JSON.stringify({
            status: "EXECUTED",
            executedTradeId: createdTrade.id,
            executedAt,
            tradeType: queueItem.tradeType,
            shares: queueItem.shares,
            shortLocateNumber: queueItem.shortLocateNumber,
            shortAllocationShares: queueItem.shortAllocationShares,
            queuedExecutionPrice: queueItem.executionPrice,
            actualExecutionPrice: avgPrice,
            proposedTradeAt: queueItem.proposedTradeAt,
            actualTradeAt: dateTraded,
            resolvedQueueAlertCount: resolvedQueueAlerts.count,
          }),
        },
      });

      const updatedQueueItem = await tx.tradeQueueItem.findUnique({
        where: {
          id: queueItem.id,
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
          executedTrade: {
            include: {
              security: true,
            },
          },
        },
      });

      if (!updatedQueueItem) {
        throw new QueueExecutionStateError(
          "The executed Trade Queue item could not be reloaded.",
        );
      }

      return {
        queueItem: updatedQueueItem,
        trade: createdTrade,
      };
    });

    return NextResponse.json(executionResult, {
      status: 201,
    });
  } catch (error) {
    if (error instanceof QueueExecutionStateError) {
      const status =
        error.message === "Trade Queue item not found." ? 404 : 409;

      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status,
        },
      );
    }

    if (
      error instanceof RequestValidationError ||
      error instanceof ManualTradeCreationError
    ) {
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

    console.error("POST /api/trade-queue/[id]/execute failed", error);

    return NextResponse.json(
      {
        error: "Failed to execute the Trade Queue item.",
      },
      {
        status: 500,
      },
    );
  }
}
