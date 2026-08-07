import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  createManualPendingTrade,
  MANUAL_TRADE_ORIGINS,
  ManualTradeCreationError,
  type ManualTradeOrigin,
} from "@/lib/trades/manual-trade-service";
import { prisma } from "@/lib/prisma";

const VALID_TRADE_TYPES = ["BUY", "SELL", "SHORT", "COVER"] as const;

type ValidTradeType = (typeof VALID_TRADE_TYPES)[number];

class RequestValidationError extends Error {}

function parsePositiveNumber(value: unknown, fieldName: string) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new RequestValidationError(`${fieldName} must be a valid number.`);
  }

  if (parsed <= 0) {
    throw new RequestValidationError(`${fieldName} must be greater than zero.`);
  }

  return parsed;
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

function parseOrigin(value: unknown): ManualTradeOrigin {
  if (value === null || value === undefined || value === "") {
    return "DASHBOARD";
  }

  const origin = String(value).trim().toUpperCase();

  if (!MANUAL_TRADE_ORIGINS.includes(origin as ManualTradeOrigin)) {
    throw new RequestValidationError(
      "Trade origin must be DASHBOARD, TRADE_CALCULATOR, or TRADE_QUEUE.",
    );
  }

  return origin as ManualTradeOrigin;
}

function parseShortLocateNumber(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  const locateNumber = String(value).trim();

  if (!locateNumber) {
    return null;
  }

  if (locateNumber.length > 200) {
    throw new RequestValidationError(
      "Short Locate Number must be 200 characters or fewer.",
    );
  }

  return locateNumber;
}

function parseTradeDate(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return new Date();
  }

  const parsedDate = new Date(String(value));

  if (Number.isNaN(parsedDate.getTime())) {
    throw new RequestValidationError("Trade date and time must be valid.");
  }

  return parsedDate;
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
          error: "You do not have permission to log trades.",
        },
        {
          status: 403,
        },
      );
    }

    const body = await request.json();

    const securityId = String(body.securityId || "").trim();

    const positionId = body.positionId ? String(body.positionId).trim() : null;

    if (!securityId) {
      return NextResponse.json(
        {
          error: "securityId is required.",
        },
        {
          status: 400,
        },
      );
    }

    const tradeType = parseTradeType(body.tradeType);

    const shares = parsePositiveNumber(body.shares, "Shares");

    const avgPrice = parsePositiveNumber(body.avgPrice, "Average price");

    const dateTraded = parseTradeDate(body.dateTraded);

    const origin = parseOrigin(body.origin);

    const userComment = body.comment ? String(body.comment).trim() : null;

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

    if (positionId) {
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
            error: "Manual trades can only be added to an active position.",
          },
          {
            status: 409,
          },
        );
      }
    }

    const trade = await prisma.$transaction(async (tx) =>
      createManualPendingTrade(tx, {
        actorId: currentUser.id,
        securityId,
        securityTicker: security.ticker,
        positionId,
        tradeType,
        shares,
        avgPrice,
        dateTraded,
        comment: userComment,
        shortLocateNumber,
        origin,
      }),
    );

    return NextResponse.json(
      {
        trade,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
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

    console.error("POST /api/trades/manual failed", error);

    return NextResponse.json(
      {
        error: "Failed to create manual trade.",
      },
      {
        status: 500,
      },
    );
  }
}
