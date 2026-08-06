import "server-only";

import type { Prisma } from "@prisma/client";

export const MANUAL_TRADE_ORIGINS = [
  "DASHBOARD",
  "TRADE_CALCULATOR",
  "TRADE_QUEUE",
] as const;

export type ManualTradeOrigin = (typeof MANUAL_TRADE_ORIGINS)[number];

export type CreateManualPendingTradeInput = {
  actorId: string;
  securityId: string;
  securityTicker: string;
  positionId: string | null;
  tradeType: "BUY" | "SELL" | "SHORT" | "COVER";
  shares: number;
  avgPrice: number;
  dateTraded: Date;
  comment: string | null;
  shortLocateNumber: string | null;
  origin: ManualTradeOrigin;
};

export class ManualTradeCreationError extends Error {}

function requirePositiveFiniteNumber(value: number, fieldName: string) {
  if (!Number.isFinite(value)) {
    throw new ManualTradeCreationError(`${fieldName} must be a valid number.`);
  }

  if (value <= 0) {
    throw new ManualTradeCreationError(
      `${fieldName} must be greater than zero.`,
    );
  }

  return value;
}

function buildSavedComment({
  tradeType,
  comment,
  shortLocateNumber,
}: {
  tradeType: CreateManualPendingTradeInput["tradeType"];
  comment: string | null;
  shortLocateNumber: string | null;
}) {
  const normalizedComment = comment?.trim() || null;
  const normalizedShortLocateNumber = shortLocateNumber?.trim() || null;

  if (tradeType === "SHORT" && !normalizedShortLocateNumber) {
    throw new ManualTradeCreationError(
      "Short Locate Number is required for a short trade.",
    );
  }

  const shortLocateNote =
    tradeType === "SHORT" && normalizedShortLocateNumber
      ? `Short Locate Number: ${normalizedShortLocateNumber}`
      : null;

  if (normalizedComment && shortLocateNote) {
    return `${normalizedComment}\n\n${shortLocateNote}`;
  }

  return normalizedComment || shortLocateNote || null;
}

function getSignedShares({
  tradeType,
  shares,
}: {
  tradeType: CreateManualPendingTradeInput["tradeType"];
  shares: number;
}) {
  const positiveShares = requirePositiveFiniteNumber(shares, "Shares");

  if (tradeType === "SELL" || tradeType === "SHORT") {
    return -Math.abs(positiveShares);
  }

  return Math.abs(positiveShares);
}

export async function createManualPendingTrade(
  tx: Prisma.TransactionClient,
  input: CreateManualPendingTradeInput,
) {
  const avgPrice = requirePositiveFiniteNumber(input.avgPrice, "Average price");

  if (Number.isNaN(input.dateTraded.getTime())) {
    throw new ManualTradeCreationError("Trade date and time must be valid.");
  }

  const shortLocateNumber = input.shortLocateNumber?.trim() || null;

  const comment = buildSavedComment({
    tradeType: input.tradeType,
    comment: input.comment,
    shortLocateNumber,
  });

  const shares = getSignedShares({
    tradeType: input.tradeType,
    shares: input.shares,
  });

  const createdTrade = await tx.trade.create({
    data: {
      securityId: input.securityId,
      positionId: input.positionId,
      dateTraded: input.dateTraded,
      shares,
      avgPrice,
      tradeType: input.tradeType,
      notional: shares * avgPrice,
      comment,
      source: "MANUAL",
      reconciliationStatus: "MANUAL_PENDING",
      manualEnteredById: input.actorId,
      isHidden: false,
    },
    include: {
      security: true,
    },
  });

  await tx.auditLog.create({
    data: {
      actorId: input.actorId,
      action: "MANUAL_TRADE_CREATED",
      entityType: "TRADE",
      entityId: createdTrade.id,
      newValueJson: JSON.stringify({
        securityId: input.securityId,
        ticker: input.securityTicker,
        positionId: input.positionId,
        tradeType: input.tradeType,
        shares,
        avgPrice,
        notional: createdTrade.notional,
        dateTraded: input.dateTraded,
        comment,
        shortLocateNumber,
        source: createdTrade.source,
        reconciliationStatus: createdTrade.reconciliationStatus,
        origin: input.origin,
      }),
    },
  });

  return createdTrade;
}
