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
  shortAllocationShares: number | null;
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

function requirePositiveWholeNumber(value: number, fieldName: string) {
  const parsedValue = requirePositiveFiniteNumber(value, fieldName);

  if (!Number.isInteger(parsedValue)) {
    throw new ManualTradeCreationError(`${fieldName} must be a whole number.`);
  }

  return parsedValue;
}

function buildSavedComment({
  tradeType,
  comment,
  shortLocateNumber,
  shortAllocationShares,
}: {
  tradeType: CreateManualPendingTradeInput["tradeType"];
  comment: string | null;
  shortLocateNumber: string | null;
  shortAllocationShares: number | null;
}) {
  const normalizedComment = comment?.trim() || null;

  const normalizedShortLocateNumber = shortLocateNumber?.trim() || null;

  if (tradeType !== "SHORT") {
    return normalizedComment;
  }

  if (!normalizedShortLocateNumber) {
    throw new ManualTradeCreationError(
      "Short Locate Number is required for a short trade.",
    );
  }

  if (shortAllocationShares == null) {
    throw new ManualTradeCreationError(
      "Short Allocation Shares are required for a short trade.",
    );
  }

  const validatedAllocation = requirePositiveWholeNumber(
    shortAllocationShares,
    "Short Allocation Shares",
  );

  const shortControlNote = [
    `Short Locate Number: ${normalizedShortLocateNumber}`,
    `Short Allocation Shares: ${validatedAllocation.toLocaleString("en-US")}`,
  ].join("\n");

  if (normalizedComment) {
    return `${normalizedComment}\n\n${shortControlNote}`;
  }

  return shortControlNote;
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

  const positiveShares = requirePositiveWholeNumber(
    Math.abs(input.shares),
    "Shares",
  );

  const shortAllocationShares =
    input.tradeType === "SHORT" ? input.shortAllocationShares : null;

  if (input.tradeType === "SHORT") {
    if (shortAllocationShares == null) {
      throw new ManualTradeCreationError(
        "Short Allocation Shares are required for a short trade.",
      );
    }

    const validatedAllocation = requirePositiveWholeNumber(
      shortAllocationShares,
      "Short Allocation Shares",
    );

    if (positiveShares > validatedAllocation) {
      throw new ManualTradeCreationError(
        `Proposed SHORT shares of ${positiveShares.toLocaleString(
          "en-US",
        )} exceed the allocated ${validatedAllocation.toLocaleString(
          "en-US",
        )} shares.`,
      );
    }
  }

  const comment = buildSavedComment({
    tradeType: input.tradeType,
    comment: input.comment,
    shortLocateNumber,
    shortAllocationShares,
  });

  const shares = getSignedShares({
    tradeType: input.tradeType,
    shares: positiveShares,
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
        shortAllocationShares,
        source: createdTrade.source,
        reconciliationStatus: createdTrade.reconciliationStatus,
        origin: input.origin,
      }),
    },
  });

  return createdTrade;
}
