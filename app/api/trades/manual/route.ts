import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_TRADE_TYPES = [
  "BUY",
  "SELL",
  "SHORT",
  "COVER",
] as const;

const VALID_ORIGINS = [
  "DASHBOARD",
  "TRADE_CALCULATOR",
] as const;

class RequestValidationError extends Error {}

function parsePositiveNumber(
  value: unknown,
  fieldName: string
) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new RequestValidationError(
      `${fieldName} must be a valid number.`
    );
  }

  if (parsed <= 0) {
    throw new RequestValidationError(
      `${fieldName} must be greater than zero.`
    );
  }

  return parsed;
}

function parseTradeType(value: unknown) {
  const tradeType = String(value || "")
    .trim()
    .toUpperCase();

  if (
    !VALID_TRADE_TYPES.includes(
      tradeType as (typeof VALID_TRADE_TYPES)[number]
    )
  ) {
    throw new RequestValidationError(
      "Trade type must be BUY, SELL, SHORT, or COVER."
    );
  }

  return tradeType as
    (typeof VALID_TRADE_TYPES)[number];
}

function parseOrigin(value: unknown) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "DASHBOARD";
  }

  const origin = String(value)
    .trim()
    .toUpperCase();

  if (
    !VALID_ORIGINS.includes(
      origin as (typeof VALID_ORIGINS)[number]
    )
  ) {
    throw new RequestValidationError(
      "Trade origin must be DASHBOARD or TRADE_CALCULATOR."
    );
  }

  return origin as
    (typeof VALID_ORIGINS)[number];
}

function parseShortLocateNumber(
  value: unknown
) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const locateNumber =
    String(value).trim();

  if (!locateNumber) {
    return null;
  }

  if (locateNumber.length > 200) {
    throw new RequestValidationError(
      "Short Locate Number must be 200 characters or fewer."
    );
  }

  return locateNumber;
}

function parseTradeDate(value: unknown) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return new Date();
  }

  const parsedDate = new Date(
    String(value)
  );

  if (
    Number.isNaN(
      parsedDate.getTime()
    )
  ) {
    throw new RequestValidationError(
      "Trade date and time must be valid."
    );
  }

  return parsedDate;
}

function canLogManualTrade(
  role?: string | null
) {
  return [
    "ADMIN",
    "TRADER",
    "PM",
  ].includes(role || "");
}

export async function POST(
  request: Request
) {
  try {
    const currentUser =
      await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json(
        {
          error:
            "Authentication required.",
        },
        {
          status: 401,
        }
      );
    }

    if (
      !canLogManualTrade(
        currentUser.role
      )
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to log trades.",
        },
        {
          status: 403,
        }
      );
    }

    const body = await request.json();

    const securityId = String(
      body.securityId || ""
    ).trim();

    const positionId = body.positionId
      ? String(body.positionId).trim()
      : null;

    if (!securityId) {
      return NextResponse.json(
        {
          error:
            "securityId is required.",
        },
        {
          status: 400,
        }
      );
    }

    const tradeType =
      parseTradeType(body.tradeType);

    const rawShares =
      parsePositiveNumber(
        body.shares,
        "Shares"
      );

    const avgPrice =
      parsePositiveNumber(
        body.avgPrice,
        "Average price"
      );

    const dateTraded =
      parseTradeDate(
        body.dateTraded
      );

    const origin = parseOrigin(
      body.origin
    );

  const userComment = body.comment
    ? String(body.comment).trim()
    : null;

  const shortLocateNumber =
    parseShortLocateNumber(
      body.shortLocateNumber
    );

  if (
    tradeType === "SHORT" &&
    !shortLocateNumber
  ) {
    throw new RequestValidationError(
      "Short Locate Number is required for a short trade."
    );
  }

  const shortLocateNote =
    tradeType === "SHORT" &&
    shortLocateNumber
      ? `Short Locate Number: ${shortLocateNumber}`
      : null;

  const comment =
    userComment && shortLocateNote
      ? `${userComment}\n\n${shortLocateNote}`
      : userComment ||
        shortLocateNote ||
        null;

    const shares =
      tradeType === "SELL" ||
      tradeType === "SHORT"
        ? -Math.abs(rawShares)
        : Math.abs(rawShares);

    const security =
      await prisma.security.findUnique({
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
        }
      );
    }

    if (positionId) {
      const position =
        await prisma.position.findUnique({
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
            error:
              "Position not found.",
          },
          {
            status: 404,
          }
        );
      }

      if (
        position.securityId !==
        securityId
      ) {
        return NextResponse.json(
          {
            error:
              "The selected position does not belong to the selected Security.",
          },
          {
            status: 400,
          }
        );
      }

      if (
        position.status !== "ACTIVE"
      ) {
        return NextResponse.json(
          {
            error:
              "Manual trades can only be added to an active position.",
          },
          {
            status: 409,
          }
        );
      }
    }

    const trade =
      await prisma.$transaction(
        async (tx) => {
          const createdTrade =
            await tx.trade.create({
              data: {
                securityId,
                positionId,
                dateTraded,
                shares,
                avgPrice,
                tradeType,
                notional:
                  shares * avgPrice,
                comment,
                source: "MANUAL",
                reconciliationStatus:
                  "MANUAL_PENDING",
                manualEnteredById:
                  currentUser.id,
                isHidden: false,
              },
              include: {
                security: true,
              },
            });

          await tx.auditLog.create({
            data: {
              actorId:
                currentUser.id,
              action:
                "MANUAL_TRADE_CREATED",
              entityType: "TRADE",
              entityId:
                createdTrade.id,
              newValueJson:
                JSON.stringify({
                  securityId,
                  ticker:
                    security.ticker,
                  positionId,
                  tradeType,
                  shares,
                  avgPrice,
                  notional:
                    createdTrade.notional,
                  dateTraded,
                  comment,
                  shortLocateNumber,
                  source:
                    createdTrade.source,
                  reconciliationStatus:
                    createdTrade.reconciliationStatus,
                  origin,
                }),
            },
          });

          return createdTrade;
        }
      );

    return NextResponse.json(
      {
        trade,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    if (
      error instanceof
      RequestValidationError
    ) {
      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: 400,
        }
      );
    }

    if (
      error instanceof SyntaxError
    ) {
      return NextResponse.json(
        {
          error:
            "Request body must be valid JSON.",
        },
        {
          status: 400,
        }
      );
    }

    console.error(
      "POST /api/trades/manual failed",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to create manual trade.",
      },
      {
        status: 500,
      }
    );
  }
}