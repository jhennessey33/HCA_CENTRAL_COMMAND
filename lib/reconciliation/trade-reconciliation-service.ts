import { prisma } from "@/lib/prisma";
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
