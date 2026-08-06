import { Prisma } from "@prisma/client";
import {
  evaluateTradeQueueExecution,
  TRADE_QUEUE_EXECUTION_ALERT_TYPE,
  TRADE_QUEUE_EXECUTION_FLAG_TYPE,
} from "@/lib/alerts/trade-queue-execution";
import { prisma } from "@/lib/prisma";
import { getSystemFlagUserId } from "@/lib/reconciliation/trade-reconciliation-service";

export type EvaluateSecurityTradeQueueAlertsInput = {
  securityId: string;
  ticker: string;
  currentPrice: number;
  marketDataSource?: string | null;
  marketDataAsOf: Date;
};

export type EvaluateSecurityTradeQueueAlertsResult = {
  evaluatedCount: number;
  thresholdReachedCount: number;
  triggeredCount: number;
  createdCount: number;
  skippedStateChangedCount: number;
  skippedDuplicateCount: number;
  skippedNoUserCount: number;
  createdFlagIds: string[];
  triggeredQueueItemIds: string[];
};

function buildDescription({
  ticker,
  tradeType,
  shares,
  currentPrice,
  executionPrice,
}: {
  ticker: string;
  tradeType: string;
  shares: number;
  currentPrice: number;
  executionPrice: number;
}) {
  return `${ticker} ${tradeType} queue threshold was reached for ${shares.toLocaleString(
    "en-US",
    {
      maximumFractionDigits: 4,
    },
  )} shares. Current price: $${currentPrice.toFixed(
    2,
  )}. Execution price: $${executionPrice.toFixed(2)}.`;
}

export async function evaluateSecurityTradeQueueAlerts({
  securityId,
  ticker,
  currentPrice,
  marketDataSource,
  marketDataAsOf,
}: EvaluateSecurityTradeQueueAlertsInput): Promise<EvaluateSecurityTradeQueueAlertsResult> {
  const result: EvaluateSecurityTradeQueueAlertsResult = {
    evaluatedCount: 0,
    thresholdReachedCount: 0,
    triggeredCount: 0,
    createdCount: 0,
    skippedStateChangedCount: 0,
    skippedDuplicateCount: 0,
    skippedNoUserCount: 0,
    createdFlagIds: [],
    triggeredQueueItemIds: [],
  };

  const queueItems = await prisma.tradeQueueItem.findMany({
    where: {
      securityId,
      status: "QUEUED",
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
      createdById: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (!queueItems.length) {
    return result;
  }

  const systemUserId = await getSystemFlagUserId();

  for (const queueItem of queueItems) {
    result.evaluatedCount += 1;

    const evaluation = evaluateTradeQueueExecution({
      tradeQueueItemId: queueItem.id,
      tradeType: queueItem.tradeType,
      executionPrice: queueItem.executionPrice,
      currentPrice,
    });

    if (
      !evaluation.isEligible ||
      !evaluation.isThresholdReached ||
      !evaluation.alertKey ||
      !evaluation.tradeType ||
      evaluation.executionPrice == null ||
      evaluation.currentPrice == null ||
      evaluation.distancePercent == null ||
      !evaluation.triggerDirection
    ) {
      continue;
    }

    result.thresholdReachedCount += 1;

    if (!systemUserId) {
      result.skippedNoUserCount += 1;
      continue;
    }

    const alertKey = evaluation.alertKey;
    const triggeredAt = new Date();

    const transactionResult = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const currentQueueItem = await tx.tradeQueueItem.findUnique({
          where: {
            id: queueItem.id,
          },
          select: {
            id: true,
            securityId: true,
            positionId: true,
            tradeType: true,
            shares: true,
            executionPrice: true,
            proposedTradeAt: true,
            status: true,
            triggeredAt: true,
            executedTradeId: true,
            canceledAt: true,
          },
        });

        if (
          !currentQueueItem ||
          currentQueueItem.status !== "QUEUED" ||
          currentQueueItem.triggeredAt !== null ||
          currentQueueItem.executedTradeId !== null ||
          currentQueueItem.canceledAt !== null
        ) {
          return {
            outcome: "STATE_CHANGED" as const,
            flagId: null,
          };
        }

        const currentEvaluation = evaluateTradeQueueExecution({
          tradeQueueItemId: currentQueueItem.id,
          tradeType: currentQueueItem.tradeType,
          executionPrice: currentQueueItem.executionPrice,
          currentPrice,
        });

        if (
          !currentEvaluation.isEligible ||
          !currentEvaluation.isThresholdReached ||
          !currentEvaluation.alertKey ||
          !currentEvaluation.tradeType ||
          currentEvaluation.executionPrice == null ||
          currentEvaluation.currentPrice == null ||
          currentEvaluation.distancePercent == null ||
          !currentEvaluation.triggerDirection
        ) {
          return {
            outcome: "STATE_CHANGED" as const,
            flagId: null,
          };
        }

        const duplicateSearchValue = `"alertKey":"${currentEvaluation.alertKey}"`;

        const existingFlag = await tx.flag.findFirst({
          where: {
            tradeQueueItemId: currentQueueItem.id,
            flagType: TRADE_QUEUE_EXECUTION_FLAG_TYPE,
            metadataJson: {
              contains: duplicateSearchValue,
            },
          },
          select: {
            id: true,
          },
        });

        if (existingFlag) {
          return {
            outcome: "DUPLICATE" as const,
            flagId: existingFlag.id,
          };
        }

        const queueUpdateResult = await tx.tradeQueueItem.updateMany({
          where: {
            id: currentQueueItem.id,
            status: "QUEUED",
            triggeredAt: null,
            executedTradeId: null,
            canceledAt: null,
          },
          data: {
            status: "TRIGGERED",
            triggeredAt,
          },
        });

        if (queueUpdateResult.count !== 1) {
          return {
            outcome: "STATE_CHANGED" as const,
            flagId: null,
          };
        }

        const metadata = {
          alertKey: currentEvaluation.alertKey,
          alertType: TRADE_QUEUE_EXECUTION_ALERT_TYPE,
          tradeQueueItemId: currentQueueItem.id,
          securityId: currentQueueItem.securityId,
          positionId: currentQueueItem.positionId,
          ticker,
          tradeType: currentEvaluation.tradeType,
          shares: currentQueueItem.shares,
          executionPrice: currentEvaluation.executionPrice,
          currentPrice: currentEvaluation.currentPrice,
          distancePercent: currentEvaluation.distancePercent,
          triggerDirection: currentEvaluation.triggerDirection,
          proposedTradeAt: currentQueueItem.proposedTradeAt.toISOString(),
          marketDataSource: marketDataSource || null,
          marketDataAsOf: marketDataAsOf.toISOString(),
          triggeredAt: triggeredAt.toISOString(),
        };

        const flag = await tx.flag.create({
          data: {
            securityId: currentQueueItem.securityId,
            positionId: currentQueueItem.positionId,
            tradeQueueItemId: currentQueueItem.id,
            watchlistEntryId: null,
            flagType: TRADE_QUEUE_EXECUTION_FLAG_TYPE,
            description: buildDescription({
              ticker,
              tradeType: currentEvaluation.tradeType,
              shares: currentQueueItem.shares,
              currentPrice: currentEvaluation.currentPrice,
              executionPrice: currentEvaluation.executionPrice,
            }),
            reminderAt: null,
            priority: "HIGH",
            status: "OPEN",
            createdById: systemUserId,
            metadataJson: JSON.stringify(metadata),
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: systemUserId,
            action: "TRADE_QUEUE_TRIGGERED",
            entityType: "TRADE_QUEUE_ITEM",
            entityId: currentQueueItem.id,
            previousValueJson: JSON.stringify({
              status: "QUEUED",
              triggeredAt: null,
            }),
            newValueJson: JSON.stringify({
              status: "TRIGGERED",
              flagId: flag.id,
              ...metadata,
            }),
          },
        });

        return {
          outcome: "CREATED" as const,
          flagId: flag.id,
        };
      },
    );

    if (transactionResult.outcome === "STATE_CHANGED") {
      result.skippedStateChangedCount += 1;
      continue;
    }

    if (transactionResult.outcome === "DUPLICATE") {
      result.skippedDuplicateCount += 1;
      continue;
    }

    result.triggeredCount += 1;
    result.createdCount += 1;
    result.createdFlagIds.push(transactionResult.flagId);
    result.triggeredQueueItemIds.push(queueItem.id);
  }

  return result;
}
