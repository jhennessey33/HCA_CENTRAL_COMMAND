import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_TRADE_TYPES = ["BUY", "SELL", "SHORT", "COVER"] as const;

type ValidTradeType = (typeof VALID_TRADE_TYPES)[number];

class RequestValidationError extends Error {}

class TradeStateError extends Error {}

function canLogManualTrade(role?: string | null) {
  return ["ADMIN", "TRADER", "PM"].includes(role || "");
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

function parseWholePositiveShares(value: unknown) {
  const shares = Number(value);

  if (!Number.isFinite(shares)) {
    throw new RequestValidationError(
      "Shares must be a valid number.",
    );
  }

  if (shares <= 0) {
    throw new RequestValidationError(
      "Shares must be greater than zero.",
    );
  }

  if (!Number.isInteger(shares)) {
    throw new RequestValidationError(
      "Shares must be a whole number.",
    );
  }

  return shares;
}

function parsePositivePrice(value: unknown) {
  const avgPrice = Number(value);

  if (!Number.isFinite(avgPrice)) {
    throw new RequestValidationError(
      "Average price must be a valid number.",
    );
  }

  if (avgPrice <= 0) {
    throw new RequestValidationError(
      "Average price must be greater than zero.",
    );
  }

  return avgPrice;
}

function parseTradeDate(value: unknown) {
  if (value === null || value === undefined || value === "") {
    throw new RequestValidationError(
      "Trade date and time are required.",
    );
  }

  const dateTraded = new Date(String(value));

  if (Number.isNaN(dateTraded.getTime())) {
    throw new RequestValidationError(
      "Trade date and time must be valid.",
    );
  }

  return dateTraded;
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

function getSignedShares({
  tradeType,
  shares,
}: {
  tradeType: ValidTradeType;
  shares: number;
}) {
  if (tradeType === "SELL" || tradeType === "SHORT") {
    return -Math.abs(shares);
  }

  return Math.abs(shares);
}

function assertEditableManualTrade(trade: {
  source: string | null;
  reconciliationStatus: string | null;
  isHidden: boolean;
}) {
  if (trade.source !== "MANUAL") {
    throw new TradeStateError(
      "Only manually entered trades may be edited.",
    );
  }

  if (trade.isHidden) {
    throw new TradeStateError(
      "Deleted manual trades cannot be edited.",
    );
  }

  if (trade.reconciliationStatus !== "MANUAL_PENDING") {
    throw new TradeStateError(
      "Only pending manual trades may be edited.",
    );
  }
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
          error: "You do not have permission to edit manual trades.",
        },
        {
          status: 403,
        },
      );
    }

    const { id } = await context.params;
    const tradeId = String(id || "").trim();

    if (!tradeId) {
      return NextResponse.json(
        {
          error: "Trade ID is required.",
        },
        {
          status: 400,
        },
      );
    }

    const body = await request.json();

    const tradeType = parseTradeType(body.tradeType);
    const positiveShares = parseWholePositiveShares(body.shares);
    const avgPrice = parsePositivePrice(body.avgPrice);
    const dateTraded = parseTradeDate(body.dateTraded);
    const comment = parseOptionalComment(body.comment);

    const existingTrade = await prisma.trade.findUnique({
      where: {
        id: tradeId,
      },
      select: {
        id: true,
        securityId: true,
        positionId: true,
        dateTraded: true,
        shares: true,
        avgPrice: true,
        tradeType: true,
        notional: true,
        comment: true,
        source: true,
        reconciliationStatus: true,
        reconciliationGroupId: true,
        matchedTradeId: true,
        reconciledAt: true,
        manualEnteredById: true,
        isHidden: true,
      },
    });

    if (!existingTrade) {
      return NextResponse.json(
        {
          error: "Trade not found.",
        },
        {
          status: 404,
        },
      );
    }

    try {
      assertEditableManualTrade(existingTrade);
    } catch (error) {
      if (error instanceof TradeStateError) {
        return NextResponse.json(
          {
            error: error.message,
          },
          {
            status: 409,
          },
        );
      }

      throw error;
    }

    if (!existingTrade.positionId) {
      return NextResponse.json(
        {
          error:
            "The manual trade is not associated with a Position and cannot be edited.",
        },
        {
          status: 409,
        },
      );
    }

    const position = await prisma.position.findUnique({
      where: {
        id: existingTrade.positionId,
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
            "The Position associated with this manual trade no longer exists.",
        },
        {
          status: 409,
        },
      );
    }

    if (position.securityId !== existingTrade.securityId) {
      return NextResponse.json(
        {
          error:
            "The manual trade Position no longer belongs to its Security.",
        },
        {
          status: 409,
        },
      );
    }

    if (position.status !== "ACTIVE") {
      return NextResponse.json(
        {
          error:
            "Manual trades can only be edited while their Position is active.",
        },
        {
          status: 409,
        },
      );
    }

    const signedShares = getSignedShares({
      tradeType,
      shares: positiveShares,
    });

    const notional = signedShares * avgPrice;

    const updatedTrade = await prisma.$transaction(async (tx) => {
      const currentTrade = await tx.trade.findUnique({
        where: {
          id: tradeId,
        },
        select: {
          id: true,
          securityId: true,
          positionId: true,
          dateTraded: true,
          shares: true,
          avgPrice: true,
          tradeType: true,
          notional: true,
          comment: true,
          source: true,
          reconciliationStatus: true,
          reconciliationGroupId: true,
          matchedTradeId: true,
          reconciledAt: true,
          manualEnteredById: true,
          isHidden: true,
        },
      });

      if (!currentTrade) {
        throw new TradeStateError(
          "The manual trade no longer exists.",
        );
      }

      assertEditableManualTrade(currentTrade);

      if (
        currentTrade.securityId !== existingTrade.securityId ||
        currentTrade.positionId !== existingTrade.positionId
      ) {
        throw new TradeStateError(
          "The manual trade association changed before the edit could be completed.",
        );
      }

      const trade = await tx.trade.update({
        where: {
          id: tradeId,
        },
        data: {
          tradeType,
          shares: signedShares,
          avgPrice,
          notional,
          dateTraded,
          comment,
        },
        include: {
          security: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: currentUser.id,
          action: "MANUAL_TRADE_UPDATED",
          entityType: "TRADE",
          entityId: trade.id,
          previousValueJson: JSON.stringify({
            tradeId: currentTrade.id,
            securityId: currentTrade.securityId,
            positionId: currentTrade.positionId,
            tradeType: currentTrade.tradeType,
            shares: currentTrade.shares,
            avgPrice: currentTrade.avgPrice,
            notional: currentTrade.notional,
            dateTraded: currentTrade.dateTraded,
            comment: currentTrade.comment,
            source: currentTrade.source,
            reconciliationStatus:
              currentTrade.reconciliationStatus,
            manualEnteredById: currentTrade.manualEnteredById,
          }),
          newValueJson: JSON.stringify({
            tradeId: trade.id,
            securityId: trade.securityId,
            positionId: trade.positionId,
            tradeType: trade.tradeType,
            shares: trade.shares,
            avgPrice: trade.avgPrice,
            notional: trade.notional,
            dateTraded: trade.dateTraded,
            comment: trade.comment,
            source: trade.source,
            reconciliationStatus:
              trade.reconciliationStatus,
            manualEnteredById: trade.manualEnteredById,
          }),
        },
      });

      return trade;
    });

    return NextResponse.json({
      trade: updatedTrade,
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

    if (error instanceof TradeStateError) {
      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: 409,
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

    console.error("PATCH /api/trades/manual/[id] failed", error);

    return NextResponse.json(
      {
        error: "Failed to update manual trade.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function DELETE(
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
          error: "You do not have permission to delete manual trades.",
        },
        {
          status: 403,
        },
      );
    }

    const { id } = await context.params;
    const tradeId = String(id || "").trim();

    if (!tradeId) {
      return NextResponse.json(
        {
          error: "Trade ID is required.",
        },
        {
          status: 400,
        },
      );
    }

    const trade = await prisma.trade.findUnique({
      where: {
        id: tradeId,
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
      const currentTrade = await tx.trade.findUnique({
        where: {
          id: tradeId,
        },
        select: {
          id: true,
          securityId: true,
          positionId: true,
          tradeType: true,
          shares: true,
          avgPrice: true,
          notional: true,
          dateTraded: true,
          comment: true,
          source: true,
          reconciliationStatus: true,
          isHidden: true,
        },
      });

      if (!currentTrade) {
        throw new TradeStateError(
          "The manual trade no longer exists.",
        );
      }

      assertEditableManualTrade(currentTrade);

      await tx.trade.update({
        where: {
          id: currentTrade.id,
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
          entityId: currentTrade.id,
          previousValueJson: JSON.stringify({
            tradeId: currentTrade.id,
            securityId: currentTrade.securityId,
            positionId: currentTrade.positionId,
            tradeType: currentTrade.tradeType,
            shares: currentTrade.shares,
            avgPrice: currentTrade.avgPrice,
            notional: currentTrade.notional,
            dateTraded: currentTrade.dateTraded,
            comment: currentTrade.comment,
            source: currentTrade.source,
            reconciliationStatus:
              currentTrade.reconciliationStatus,
            isHidden: currentTrade.isHidden,
          }),
          newValueJson: JSON.stringify({
            tradeId: currentTrade.id,
            isHidden: true,
          }),
        },
      });
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    if (error instanceof TradeStateError) {
      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: 409,
        },
      );
    }

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