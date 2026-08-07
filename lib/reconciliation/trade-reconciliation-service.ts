import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  RECONCILIATION_FLAG_TYPE,
  RECONCILIATION_STATUS,
  TRADE_SOURCES,
} from "./trade-reconciliation-constants";

function parseMetadata(metadataJson?: string | null) {
  if (!metadataJson) return null;

  try {
    return JSON.parse(metadataJson);
  } catch {
    return null;
  }
}

export class TradeReconciliationStateError extends Error {}

export async function getSystemFlagUserId() {
  const adminUser = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
  });

  if (adminUser) return adminUser.id;

  const complianceUser = await prisma.user.findFirst({
    where: { role: "COMPLIANCE" },
    orderBy: { createdAt: "asc" },
  });

  if (complianceUser) return complianceUser.id;

  const anyUser = await prisma.user.findFirst({
    orderBy: { createdAt: "asc" },
  });

  return anyUser?.id ?? null;
}

export async function createTradeReconciliationFlag(params: {
  securityId: string;
  positionId?: string | null;
  createdById: string;
  manualTradeId: string;
  wellsTradeId: string;
  wellsTransactionId?: string | null;
  ticker?: string | null;
  tradeType?: string | null;
  reason: string;
  differences: Record<string, unknown>;
}) {
  const existingReviewFlag = await prisma.flag.findFirst({
    where: {
      securityId: params.securityId,
      positionId: params.positionId ?? undefined,
      status: "OPEN",
      flagType: RECONCILIATION_FLAG_TYPE,
      metadataJson: {
        contains: params.manualTradeId,
      },
    },
  });

  if (existingReviewFlag) return existingReviewFlag;

  return await prisma.flag.create({
    data: {
      securityId: params.securityId,
      positionId: params.positionId ?? undefined,
      flagType: RECONCILIATION_FLAG_TYPE,
      priority: "HIGH",
      status: "OPEN",
      description:
        "Manual trade and Wells transaction appear similar but differ. Review required.",
      createdById: params.createdById,
      metadataJson: JSON.stringify({
        manualTradeId: params.manualTradeId,
        wellsTradeId: params.wellsTradeId,
        wellsTransactionId: params.wellsTransactionId,
        ticker: params.ticker,
        tradeType: params.tradeType,
        reason: params.reason,
        differences: params.differences,
      }),
    },
  });
}

const VALID_QUEUE_TRADE_TYPES = ["BUY", "SELL", "SHORT", "COVER"] as const;

type QueueTradeType = (typeof VALID_QUEUE_TRADE_TYPES)[number];

function parseQueueTradeType(value: unknown): QueueTradeType {
  const tradeType = String(value || "")
    .trim()
    .toUpperCase();

  if (!VALID_QUEUE_TRADE_TYPES.includes(tradeType as QueueTradeType)) {
    throw new TradeReconciliationStateError(
      "The reconciliation does not contain a valid Trade action.",
    );
  }

  return tradeType as QueueTradeType;
}

function requirePositiveNumber(value: unknown, fieldName: string) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    throw new TradeReconciliationStateError(
      `${fieldName} must be a valid number.`,
    );
  }

  if (parsedValue <= 0) {
    throw new TradeReconciliationStateError(
      `${fieldName} must be greater than zero.`,
    );
  }

  return parsedValue;
}

function requirePositiveWholeNumber(value: unknown, fieldName: string) {
  const parsedValue = requirePositiveNumber(value, fieldName);

  if (!Number.isInteger(parsedValue)) {
    throw new TradeReconciliationStateError(
      `${fieldName} must be a whole number.`,
    );
  }

  return parsedValue;
}

function getSignedDirection(tradeType: QueueTradeType) {
  return tradeType === "SELL" || tradeType === "SHORT" ? -1 : 1;
}

const resolvedFlagInclude = {
  security: true,
  position: true,
  tradeQueueItem: true,
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
  resolvedBy: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
} satisfies Prisma.FlagInclude;

export async function acceptWellsTradeForFlag(params: {
  flagId: string;
  userId: string;
}) {
  const flag = await prisma.flag.findUnique({
    where: { id: params.flagId },
  });

  if (!flag) {
    throw new Error("Flag not found.");
  }

  if (flag.flagType !== RECONCILIATION_FLAG_TYPE) {
    throw new Error("Flag is not a trade reconciliation review.");
  }

  if (flag.status !== "OPEN") {
    throw new TradeReconciliationStateError(
      "This Trade reconciliation review has already been resolved.",
    );
  }

  if (flag.tradeQueueItemId) {
    throw new TradeReconciliationStateError(
      "This Trade reconciliation review is already linked to a Trade Queue item.",
    );
  }

  const metadata = parseMetadata(flag.metadataJson);
  const manualTradeId = metadata?.manualTradeId;
  const wellsTradeId = metadata?.wellsTradeId;

  if (!manualTradeId || !wellsTradeId) {
    throw new Error("Trade reconciliation metadata is incomplete.");
  }

  const originalManualTrade = await prisma.trade.findUnique({
    where: {
      id: manualTradeId,
    },
    select: {
      id: true,
      comment: true,
    },
  });

  if (!originalManualTrade) {
    throw new Error("Manual trade not found.");
  }

  const now = new Date();

  const [manualTrade, wellsTrade, resolvedFlag] = await prisma.$transaction([
    prisma.trade.update({
      where: { id: manualTradeId },
      data: {
        reconciliationStatus: RECONCILIATION_STATUS.SUPERSEDED_BY_WELLS,
        matchedTradeId: wellsTradeId,
        reconciledAt: now,
        isHidden: true,
        reconciliationNotes:
          "Trader accepted Wells trade during reconciliation review.",
      },
    }),

    prisma.trade.update({
      where: {
        id: wellsTradeId,
      },
      data: {
        comment: originalManualTrade.comment,
        reconciliationStatus: RECONCILIATION_STATUS.MATCHED,
        matchedTradeId: manualTradeId,
        reconciledAt: now,
        isHidden: false,
        reconciliationNotes:
          "Trader accepted Wells trade during reconciliation review.",
      },
    }),

    prisma.flag.update({
      where: { id: params.flagId },
      data: {
        status: "RESOLVED",
        resolvedById: params.userId,
        resolvedAt: now,
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
        resolvedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    }),
  ]);

  await prisma.auditLog.create({
    data: {
      actorId: params.userId,
      action: "TRADE_RECONCILIATION_ACCEPT_WELLS",
      entityType: "FLAG",
      entityId: params.flagId,
      previousValueJson: JSON.stringify({
        flagStatus: flag.status,
        manualTradeId,
        wellsTradeId,
        manualTradeComment: originalManualTrade.comment,
      }),
      newValueJson: JSON.stringify({
        flagStatus: resolvedFlag.status,
        manualTrade: {
          id: manualTrade.id,
          reconciliationStatus: manualTrade.reconciliationStatus,
          isHidden: manualTrade.isHidden,
        },
        wellsTrade: {
          id: wellsTrade.id,
          reconciliationStatus: wellsTrade.reconciliationStatus,
          isHidden: wellsTrade.isHidden,
        },
      }),
    },
  });

  return {
    flag: resolvedFlag,
    manualTrade,
    wellsTrade,
  };
}

export async function keepManualTradeForFlag(params: {
  flagId: string;
  userId: string;
}) {
  const flag = await prisma.flag.findUnique({
    where: { id: params.flagId },
  });

  if (!flag) {
    throw new Error("Flag not found.");
  }

  if (flag.flagType !== RECONCILIATION_FLAG_TYPE) {
    throw new Error("Flag is not a trade reconciliation review.");
  }

  const metadata = parseMetadata(flag.metadataJson);
  const manualTradeId = metadata?.manualTradeId;
  const wellsTradeId = metadata?.wellsTradeId;

  if (!manualTradeId || !wellsTradeId) {
    throw new Error("Trade reconciliation metadata is incomplete.");
  }

  const now = new Date();

  const [manualTrade, wellsTrade, resolvedFlag] = await prisma.$transaction([
    prisma.trade.update({
      where: { id: manualTradeId },
      data: {
        reconciliationStatus: RECONCILIATION_STATUS.MATCHED,
        matchedTradeId: wellsTradeId,
        reconciledAt: now,
        isHidden: false,
        reconciliationNotes:
          "Trader kept manual trade during reconciliation review.",
      },
    }),

    prisma.trade.update({
      where: { id: wellsTradeId },
      data: {
        reconciliationStatus: RECONCILIATION_STATUS.SUPERSEDED_BY_MANUAL,
        matchedTradeId: manualTradeId,
        reconciledAt: now,
        isHidden: true,
        reconciliationNotes:
          "Trader kept manual trade during reconciliation review.",
      },
    }),

    prisma.flag.update({
      where: { id: params.flagId },
      data: {
        status: "RESOLVED",
        resolvedById: params.userId,
        resolvedAt: now,
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
        resolvedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    }),
  ]);

  await prisma.auditLog.create({
    data: {
      actorId: params.userId,
      action: "TRADE_RECONCILIATION_KEEP_MANUAL",
      entityType: "FLAG",
      entityId: params.flagId,
      previousValueJson: JSON.stringify({
        flagStatus: flag.status,
        manualTradeId,
        wellsTradeId,
      }),
      newValueJson: JSON.stringify({
        flagStatus: resolvedFlag.status,
        manualTrade: {
          id: manualTrade.id,
          reconciliationStatus: manualTrade.reconciliationStatus,
          isHidden: manualTrade.isHidden,
        },
        wellsTrade: {
          id: wellsTrade.id,
          reconciliationStatus: wellsTrade.reconciliationStatus,
          isHidden: wellsTrade.isHidden,
          comment: wellsTrade.comment,
        },
      }),
    },
  });

  return {
    flag: resolvedFlag,
    manualTrade,
    wellsTrade,
  };
}
export async function queueRemainingTradeForFlag(params: {
  flagId: string;
  userId: string;
  executionPrice?: unknown;
  proposedTradeAt?: unknown;
  comment?: unknown;
  shortLocateNumber?: unknown;
  shortAllocationShares?: unknown;
}) {
  const flagId = String(params.flagId || "").trim();

  if (!flagId) {
    throw new TradeReconciliationStateError("Flag ID is required.");
  }

  return prisma.$transaction(async (tx) => {
    const flag = await tx.flag.findUnique({
      where: {
        id: flagId,
      },
      select: {
        id: true,
        securityId: true,
        positionId: true,
        tradeQueueItemId: true,
        flagType: true,
        status: true,
        resolvedById: true,
        resolvedAt: true,
        metadataJson: true,
      },
    });

    if (!flag) {
      throw new TradeReconciliationStateError("Flag not found.");
    }

    if (flag.flagType !== RECONCILIATION_FLAG_TYPE) {
      throw new TradeReconciliationStateError(
        "Flag is not a Trade reconciliation review.",
      );
    }

    if (flag.status !== "OPEN") {
      throw new TradeReconciliationStateError(
        "This Trade reconciliation review has already been resolved.",
      );
    }

    if (flag.tradeQueueItemId) {
      throw new TradeReconciliationStateError(
        "This Trade reconciliation review is already linked to a Trade Queue item.",
      );
    }

    const metadata = parseMetadata(flag.metadataJson);

    if (metadata?.differences?.reconciliationKind !== "PARTIAL_COMPLETION") {
      throw new TradeReconciliationStateError(
        "Only partial-completion reconciliation reviews can add remaining shares to the Trade Queue.",
      );
    }

    const manualTradeId = String(metadata?.manualTradeId || "").trim();

    const wellsTradeId = String(metadata?.wellsTradeId || "").trim();

    if (!manualTradeId || !wellsTradeId) {
      throw new TradeReconciliationStateError(
        "Trade reconciliation metadata is incomplete.",
      );
    }

    const [manualTrade, wellsTrade] = await Promise.all([
      tx.trade.findUnique({
        where: {
          id: manualTradeId,
        },
        select: {
          id: true,
          securityId: true,
          positionId: true,
          dateTraded: true,
          shares: true,
          avgPrice: true,
          tradeType: true,
          comment: true,
          source: true,
          reconciliationStatus: true,
          matchedTradeId: true,
          isHidden: true,
        },
      }),
      tx.trade.findUnique({
        where: {
          id: wellsTradeId,
        },
        select: {
          id: true,
          securityId: true,
          positionId: true,
          dateTraded: true,
          shares: true,
          avgPrice: true,
          tradeType: true,
          comment: true,
          source: true,
          reconciliationStatus: true,
          matchedTradeId: true,
          isHidden: true,
        },
      }),
    ]);

    if (!manualTrade) {
      throw new TradeReconciliationStateError(
        "The Manual Trade no longer exists.",
      );
    }

    if (!wellsTrade) {
      throw new TradeReconciliationStateError(
        "The Wells Trade no longer exists.",
      );
    }

    if (manualTrade.source !== TRADE_SOURCES.MANUAL) {
      throw new TradeReconciliationStateError(
        "The expected Trade is no longer a Manual Trade.",
      );
    }

    if (wellsTrade.source !== TRADE_SOURCES.WELLS_FARGO) {
      throw new TradeReconciliationStateError(
        "The imported Trade is no longer a Wells Trade.",
      );
    }

    if (
      manualTrade.reconciliationStatus !==
        RECONCILIATION_STATUS.REVIEW_REQUIRED ||
      wellsTrade.reconciliationStatus !== RECONCILIATION_STATUS.REVIEW_REQUIRED
    ) {
      throw new TradeReconciliationStateError(
        "The reconciliation Trades are no longer awaiting review.",
      );
    }

    if (
      manualTrade.securityId !== wellsTrade.securityId ||
      manualTrade.securityId !== flag.securityId
    ) {
      throw new TradeReconciliationStateError(
        "The reconciliation Trades no longer belong to the same Security.",
      );
    }

    const positionId =
      manualTrade.positionId || wellsTrade.positionId || flag.positionId;

    if (!positionId) {
      throw new TradeReconciliationStateError(
        "The remaining Trade cannot be queued without a Position.",
      );
    }

    const position = await tx.position.findUnique({
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
      throw new TradeReconciliationStateError(
        "The Position associated with this reconciliation no longer exists.",
      );
    }

    if (position.securityId !== manualTrade.securityId) {
      throw new TradeReconciliationStateError(
        "The reconciliation Position no longer belongs to its Security.",
      );
    }

    if (position.status !== "ACTIVE") {
      throw new TradeReconciliationStateError(
        "Remaining shares can only be added to the Trade Queue for an active Position.",
      );
    }

    const tradeType = parseQueueTradeType(manualTrade.tradeType);

    if (wellsTrade.tradeType !== tradeType) {
      throw new TradeReconciliationStateError(
        "The Manual and Wells Trade actions no longer match.",
      );
    }

    const manualShares = Number(manualTrade.shares);

    const wellsShares = Number(wellsTrade.shares);

    if (!Number.isFinite(manualShares) || !Number.isFinite(wellsShares)) {
      throw new TradeReconciliationStateError(
        "The reconciliation Trade quantities are invalid.",
      );
    }

    if (
      Math.sign(manualShares) !== getSignedDirection(tradeType) ||
      Math.sign(wellsShares) !== getSignedDirection(tradeType)
    ) {
      throw new TradeReconciliationStateError(
        "The reconciliation Trade directions are inconsistent.",
      );
    }

    const remainingSignedShares = manualShares - wellsShares;

    if (Math.sign(remainingSignedShares) !== getSignedDirection(tradeType)) {
      throw new TradeReconciliationStateError(
        "The Wells quantity is not a valid partial completion of the Manual Trade.",
      );
    }

    const remainingShares = requirePositiveWholeNumber(
      Math.abs(remainingSignedShares),
      "Remaining shares",
    );

    const executionPrice =
      params.executionPrice === null ||
      params.executionPrice === undefined ||
      params.executionPrice === ""
        ? requirePositiveNumber(manualTrade.avgPrice, "Execution price")
        : requirePositiveNumber(params.executionPrice, "Execution price");

    const proposedTradeAt =
      params.proposedTradeAt === null ||
      params.proposedTradeAt === undefined ||
      params.proposedTradeAt === ""
        ? new Date(manualTrade.dateTraded)
        : new Date(String(params.proposedTradeAt));

    if (Number.isNaN(proposedTradeAt.getTime())) {
      throw new TradeReconciliationStateError(
        "Proposed Trade date and time must be valid.",
      );
    }

    const requestedComment =
      params.comment === null || params.comment === undefined
        ? manualTrade.comment
        : String(params.comment).trim() || null;

    let shortLocateNumber: string | null = null;

    let shortAllocationShares: number | null = null;

    if (tradeType === "SHORT") {
      shortLocateNumber = String(params.shortLocateNumber || "").trim();

      if (!shortLocateNumber) {
        throw new TradeReconciliationStateError(
          "Short Locate Number is required to queue the remaining SHORT shares.",
        );
      }

      if (shortLocateNumber.length > 200) {
        throw new TradeReconciliationStateError(
          "Short Locate Number must be 200 characters or fewer.",
        );
      }

      if (
        params.shortAllocationShares === null ||
        params.shortAllocationShares === undefined ||
        params.shortAllocationShares === ""
      ) {
        throw new TradeReconciliationStateError(
          "Short Allocation Shares are required to queue the remaining SHORT shares.",
        );
      }

      shortAllocationShares = requirePositiveWholeNumber(
        params.shortAllocationShares,
        "Short Allocation Shares",
      );

      if (remainingShares > shortAllocationShares) {
        throw new TradeReconciliationStateError(
          `Remaining SHORT shares of ${remainingShares.toLocaleString(
            "en-US",
          )} exceed the allocated ${shortAllocationShares.toLocaleString(
            "en-US",
          )} shares.`,
        );
      }
    }

    const now = new Date();

    const resolutionNote =
      "Trader accepted the Wells partial fill and added the remaining shares to the Trade Queue.";

    const queueItem = await tx.tradeQueueItem.create({
      data: {
        securityId: manualTrade.securityId,
        positionId,
        createdById: params.userId,
        tradeType,
        shares: remainingShares,
        executionPrice,
        proposedTradeAt,
        comment: requestedComment,
        shortLocateNumber,
        shortAllocationShares,
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

    const updatedManualTrade = await tx.trade.update({
      where: {
        id: manualTrade.id,
      },
      data: {
        reconciliationStatus: RECONCILIATION_STATUS.SUPERSEDED_BY_WELLS,
        matchedTradeId: wellsTrade.id,
        reconciledAt: now,
        isHidden: true,
        reconciliationNotes: resolutionNote,
      },
    });

    const updatedWellsTrade = await tx.trade.update({
      where: {
        id: wellsTrade.id,
      },
      data: {
        comment: manualTrade.comment,
        reconciliationStatus: RECONCILIATION_STATUS.MATCHED,
        matchedTradeId: manualTrade.id,
        reconciledAt: now,
        isHidden: false,
        reconciliationNotes: resolutionNote,
      },
    });

    const updatedMetadata = {
      ...metadata,
      resolution: {
        decision: "ACCEPT_WELLS_AND_QUEUE_REMAINING",
        resolvedAt: now.toISOString(),
        resolvedById: params.userId,
        tradeQueueItemId: queueItem.id,
        durableManualShares: manualShares,
        durableWellsShares: wellsShares,
        remainingSignedShares,
        remainingShares,
        executionPrice,
        proposedTradeAt: proposedTradeAt.toISOString(),
      },
    };

    const resolvedFlag = await tx.flag.update({
      where: {
        id: flag.id,
      },
      data: {
        tradeQueueItemId: queueItem.id,
        status: "RESOLVED",
        resolvedById: params.userId,
        resolvedAt: now,
        metadataJson: JSON.stringify(updatedMetadata),
      },
      include: resolvedFlagInclude,
    });

    await tx.auditLog.create({
      data: {
        actorId: params.userId,
        action: "TRADE_QUEUE_CREATED",
        entityType: "TRADE_QUEUE_ITEM",
        entityId: queueItem.id,
        newValueJson: JSON.stringify({
          tradeQueueItemId: queueItem.id,
          origin: "TRADE_RECONCILIATION",
          reconciliationFlagId: flag.id,
          manualTradeId: manualTrade.id,
          wellsTradeId: wellsTrade.id,
          securityId: queueItem.securityId,
          positionId: queueItem.positionId,
          tradeType,
          shares: remainingShares,
          executionPrice,
          proposedTradeAt,
          comment: requestedComment,
          shortLocateNumber,
          shortAllocationShares,
          status: queueItem.status,
        }),
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: params.userId,
        action: "TRADE_RECONCILIATION_DIFFERENCE_QUEUED",
        entityType: "FLAG",
        entityId: flag.id,
        previousValueJson: JSON.stringify({
          flagStatus: flag.status,
          tradeQueueItemId: flag.tradeQueueItemId,
          manualTrade,
          wellsTrade,
        }),
        newValueJson: JSON.stringify({
          flagStatus: resolvedFlag.status,
          decision: "ACCEPT_WELLS_AND_QUEUE_REMAINING",
          tradeQueueItemId: queueItem.id,
          remainingSignedShares,
          remainingShares,
          manualTrade: {
            id: updatedManualTrade.id,
            reconciliationStatus: updatedManualTrade.reconciliationStatus,
            isHidden: updatedManualTrade.isHidden,
          },
          wellsTrade: {
            id: updatedWellsTrade.id,
            reconciliationStatus: updatedWellsTrade.reconciliationStatus,
            isHidden: updatedWellsTrade.isHidden,
          },
        }),
      },
    });

    return {
      flag: resolvedFlag,
      queueItem,
      manualTrade: updatedManualTrade,
      wellsTrade: updatedWellsTrade,
    };
  });
}
