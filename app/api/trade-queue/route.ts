import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_TRADE_TYPES = ["BUY", "SELL", "SHORT", "COVER"] as const;

type ValidTradeType = (typeof VALID_TRADE_TYPES)[number];

class RequestValidationError extends Error {}

function parseRequiredId(value: unknown, fieldName: string) {
  const parsedValue = String(value || "").trim();

  if (!parsedValue) {
    throw new RequestValidationError(`${fieldName} is required.`);
  }

  return parsedValue;
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

function parseTradeType(value: unknown): ValidTradeType {
  const tradeType = String(value || "")
    .trim()
    .toUpperCase();

  if (!VALID_TRADE_TYPES.includes(tradeType as ValidTradeType)) {
    throw new RequestValidationError(
      "Trade type must be BUY, SELL, SHORT, or COVER.",
    );
  }

  return tradeType as ValidTradeType;
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

function canLogManualTrade(role?: string | null) {
  return ["ADMIN", "TRADER", "PM"].includes(role || "");
}

export async function POST(request: Request) {
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
          error: "You do not have permission to add trades to the queue.",
        },
        {
          status: 403,
        },
      );
    }

    const body = await request.json();

    const securityId = parseRequiredId(body.securityId, "securityId");

    const positionId = parseRequiredId(body.positionId, "positionId");

    const tradeType = parseTradeType(body.tradeType);

    const shares = parsePositiveNumber(body.shares, "Shares");

    const executionPrice = parsePositiveNumber(
      body.executionPrice,
      "Execution price",
    );

    const proposedTradeAt = parseProposedTradeAt(body.proposedTradeAt);

    const comment = parseOptionalComment(body.comment);

    const shortLocateNumber = parseShortLocateNumber(body.shortLocateNumber);

    if (tradeType === "SHORT" && !shortLocateNumber) {
      throw new RequestValidationError(
        "Short Locate Number is required for a short trade.",
      );
    }

    const security = await prisma.security.findUnique({
      where: {
        id: securityId,
      },
      select: {
        id: true,
        ticker: true,
        name: true,
      },
    });

    if (!security) {
      return NextResponse.json(
        {
          error: "Security not found.",
        },
        {
          status: 404,
        },
      );
    }

    const position = await prisma.position.findUnique({
      where: {
        id: positionId,
      },
      select: {
        id: true,
        securityId: true,
        status: true,
      },
    });

    if (!position) {
      return NextResponse.json(
        {
          error: "Position not found.",
        },
        {
          status: 404,
        },
      );
    }

    if (position.securityId !== securityId) {
      return NextResponse.json(
        {
          error:
            "The selected position does not belong to the selected Security.",
        },
        {
          status: 400,
        },
      );
    }

    if (position.status !== "ACTIVE") {
      return NextResponse.json(
        {
          error: "Trades can only be queued for an active position.",
        },
        {
          status: 409,
        },
      );
    }

    const queueItem = await prisma.$transaction(async (tx) => {
      const createdQueueItem = await tx.tradeQueueItem.create({
        data: {
          securityId,
          positionId,
          createdById: currentUser.id,
          tradeType,
          shares,
          executionPrice,
          proposedTradeAt,
          comment,
          shortLocateNumber,
          status: "QUEUED",
        },
        include: {
          security: true,
          position: true,
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
          action: "TRADE_QUEUE_CREATED",
          entityType: "TRADE_QUEUE_ITEM",
          entityId: createdQueueItem.id,
          newValueJson: JSON.stringify({
            tradeQueueItemId: createdQueueItem.id,
            securityId,
            ticker: security.ticker,
            positionId,
            tradeType,
            shares,
            executionPrice,
            proposedTradeAt,
            comment,
            shortLocateNumber,
            status: createdQueueItem.status,
            createdById: currentUser.id,
            origin: "TRADE_CALCULATOR",
          }),
        },
      });

      return createdQueueItem;
    });

    return NextResponse.json(
      {
        queueItem,
      },
      {
        status: 201,
      },
    );
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

    console.error("POST /api/trade-queue failed", error);

    return NextResponse.json(
      {
        error: "Failed to add trade to the queue.",
      },
      {
        status: 500,
      },
    );
  }
}
