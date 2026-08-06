import { evaluateSecurityPtAlerts } from "@/lib/alerts/pt-proximity-alert-service";
import { evaluateSecurityTradeQueueAlerts } from "@/lib/alerts/trade-queue-alert-service";
import { fetchFinnhubQuote } from "@/lib/market-data/finnhub";
import { prisma } from "@/lib/prisma";

export type PtMonitorRefreshResult = {
  source: "FINNHUB";
  skipped?: boolean;
  reason?: string;
  monitoredSecurityCount: number;
  updatedCount: number;
  failedCount: number;

  ptAlertsEvaluated: number;
  ptAlertsCreated: number;
  ptAlertsSkippedDuplicate: number;
  ptAlertFailures: number;

  tradeQueueAlertsEvaluated: number;
  tradeQueueThresholdsReached: number;
  tradeQueueItemsTriggered: number;
  tradeQueueAlertsCreated: number;
  tradeQueueAlertsSkippedDuplicate: number;
  tradeQueueAlertsSkippedStateChanged: number;
  tradeQueueAlertsSkippedNoUser: number;
  tradeQueueAlertFailures: number;

  results: Array<{
    ticker: string;
    status: "UPDATED" | "FAILED";
    message?: string;
    ptAlertsCreated?: number;
    tradeQueueAlertsCreated?: number;
    tradeQueueItemsTriggered?: number;
  }>;
};
declare global {
  // eslint-disable-next-line no-var
  var hcaPtMonitorRunning: boolean | undefined;

  // Set while a full market-data refresh is waiting to start.
  // eslint-disable-next-line no-var
  var hcaMarketDataRefreshPending: boolean | undefined;

  // eslint-disable-next-line no-var
  var hcaMarketDataRefreshRunning: boolean | undefined;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createSkippedResult(reason: string): PtMonitorRefreshResult {
  return {
    source: "FINNHUB",
    skipped: true,
    reason,
    monitoredSecurityCount: 0,
    updatedCount: 0,
    failedCount: 0,

    ptAlertsEvaluated: 0,
    ptAlertsCreated: 0,
    ptAlertsSkippedDuplicate: 0,
    ptAlertFailures: 0,

    tradeQueueAlertsEvaluated: 0,
    tradeQueueThresholdsReached: 0,
    tradeQueueItemsTriggered: 0,
    tradeQueueAlertsCreated: 0,
    tradeQueueAlertsSkippedDuplicate: 0,
    tradeQueueAlertsSkippedStateChanged: 0,
    tradeQueueAlertsSkippedNoUser: 0,
    tradeQueueAlertFailures: 0,

    results: [],
  };
}

export async function refreshPtMonitorMarketData(): Promise<PtMonitorRefreshResult> {
  if (
    globalThis.hcaMarketDataRefreshRunning ||
    globalThis.hcaMarketDataRefreshPending
  ) {
    return createSkippedResult(
      "Full market data refresh is running or pending.",
    );
  }

  if (globalThis.hcaPtMonitorRunning) {
    return createSkippedResult("PT monitor refresh is already running.");
  }

  globalThis.hcaPtMonitorRunning = true;

  try {
    const securities = await prisma.security.findMany({
      where: {
        OR: [
          {
            watchlistEntries: {
              some: {
                archivedAt: null,
                OR: [
                  {
                    entryTargetPrice: {
                      not: null,
                    },
                  },
                  {
                    targetPrice: {
                      not: null,
                    },
                  },
                  {
                    exitTargetPrice: {
                      not: null,
                    },
                  },
                  {
                    discussionTargetPrice: {
                      not: null,
                    },
                  },
                ],
              },
            },
          },
          {
            tradeQueueItems: {
              some: {
                status: "QUEUED",
              },
            },
          },
        ],
      },
      orderBy: {
        ticker: "asc",
      },
      include: {
        marketData: {
          orderBy: {
            updatedAt: "desc",
          },
          take: 1,
        },
      },
    });

    const results: PtMonitorRefreshResult["results"] = [];

    let ptAlertsEvaluated = 0;
    let ptAlertsCreated = 0;
    let ptAlertsSkippedDuplicate = 0;
    let ptAlertFailures = 0;

    let tradeQueueAlertsEvaluated = 0;
    let tradeQueueThresholdsReached = 0;
    let tradeQueueItemsTriggered = 0;
    let tradeQueueAlertsCreated = 0;
    let tradeQueueAlertsSkippedDuplicate = 0;
    let tradeQueueAlertsSkippedStateChanged = 0;
    let tradeQueueAlertsSkippedNoUser = 0;
    let tradeQueueAlertFailures = 0;

    for (const security of securities) {
      try {
        const existingMarketData = security.marketData[0] ?? null;

        const quote = await fetchFinnhubQuote(security.ticker);

        if (!quote) {
          results.push({
            ticker: security.ticker,
            status: "FAILED",
            message: "No Finnhub current price returned.",
          });

          // Finnhub free tier is 60 calls/minute, so stay under that.
          await sleep(1100);
          continue;
        }

        const marketDataAsOf = new Date();

        const data = {
          currentPrice: quote.currentPrice,
          dayChange: quote.dayChange,
          dayPctChange: quote.dayPctChange,
          source: "FINNHUB",
          marketDataSource: "FINNHUB",
          dataQuality: "REAL",
          lastMarketDataRefreshAt: marketDataAsOf,
        };

        if (existingMarketData) {
          await prisma.marketDataCache.update({
            where: {
              id: existingMarketData.id,
            },
            data,
          });
        } else {
          await prisma.marketDataCache.create({
            data: {
              securityId: security.id,
              ...data,
            },
          });
        }

        let securityPtAlertsCreated = 0;

        try {
          const ptAlertResult = await evaluateSecurityPtAlerts({
            securityId: security.id,
            ticker: security.ticker,
            currentPrice: quote.currentPrice,
            marketDataSource: "FINNHUB",
            marketDataAsOf,
          });

          ptAlertsEvaluated += ptAlertResult.evaluatedCount;
          ptAlertsCreated += ptAlertResult.createdCount;
          ptAlertsSkippedDuplicate += ptAlertResult.skippedDuplicateCount;
          securityPtAlertsCreated = ptAlertResult.createdCount;

          if (ptAlertResult.skippedNoUserCount > 0) {
            console.warn(
              `[pt-monitor] Could not create ${ptAlertResult.skippedNoUserCount} PT alert(s) for ${security.ticker}: no system user was available.`,
            );
          }
        } catch (error) {
          ptAlertFailures += 1;

          console.error(
            `[pt-monitor] Failed to evaluate PT alerts for ${security.ticker}:`,
            error,
          );
        }

        let securityTradeQueueAlertsCreated = 0;
        let securityTradeQueueItemsTriggered = 0;

        try {
          const tradeQueueAlertResult = await evaluateSecurityTradeQueueAlerts({
            securityId: security.id,
            ticker: security.ticker,
            currentPrice: quote.currentPrice,
            marketDataSource: "FINNHUB",
            marketDataAsOf,
          });

          tradeQueueAlertsEvaluated += tradeQueueAlertResult.evaluatedCount;

          tradeQueueThresholdsReached +=
            tradeQueueAlertResult.thresholdReachedCount;

          tradeQueueItemsTriggered += tradeQueueAlertResult.triggeredCount;

          tradeQueueAlertsCreated += tradeQueueAlertResult.createdCount;

          tradeQueueAlertsSkippedDuplicate +=
            tradeQueueAlertResult.skippedDuplicateCount;

          tradeQueueAlertsSkippedStateChanged +=
            tradeQueueAlertResult.skippedStateChangedCount;

          tradeQueueAlertsSkippedNoUser +=
            tradeQueueAlertResult.skippedNoUserCount;

          securityTradeQueueAlertsCreated = tradeQueueAlertResult.createdCount;

          securityTradeQueueItemsTriggered =
            tradeQueueAlertResult.triggeredCount;

          if (tradeQueueAlertResult.skippedNoUserCount > 0) {
            console.warn(
              `[pt-monitor] Could not trigger ${tradeQueueAlertResult.skippedNoUserCount} Trade Queue item(s) for ${security.ticker}: no system user was available.`,
            );
          }
        } catch (error) {
          tradeQueueAlertFailures += 1;

          console.error(
            `[pt-monitor] Failed to evaluate Trade Queue alerts for ${security.ticker}:`,
            error,
          );
        }

        results.push({
          ticker: security.ticker,
          status: "UPDATED",
          ptAlertsCreated: securityPtAlertsCreated,
          tradeQueueAlertsCreated: securityTradeQueueAlertsCreated,
          tradeQueueItemsTriggered: securityTradeQueueItemsTriggered,
        });

        results.push({
          ticker: security.ticker,
          status: "UPDATED",
          ptAlertsCreated: securityPtAlertsCreated,
        });

        // Finnhub free tier is 60 calls/minute, so stay under that.
        await sleep(1100);
      } catch (error) {
        console.error(
          `[pt-monitor] Failed to update ${security.ticker}:`,
          error,
        );

        results.push({
          ticker: security.ticker,
          status: "FAILED",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const updatedCount = results.filter(
      (result) => result.status === "UPDATED",
    ).length;

    const failedCount = results.filter(
      (result) => result.status === "FAILED",
    ).length;

    return {
      source: "FINNHUB",
      monitoredSecurityCount: securities.length,
      updatedCount,
      failedCount,

      ptAlertsEvaluated,
      ptAlertsCreated,
      ptAlertsSkippedDuplicate,
      ptAlertFailures,

      tradeQueueAlertsEvaluated,
      tradeQueueThresholdsReached,
      tradeQueueItemsTriggered,
      tradeQueueAlertsCreated,
      tradeQueueAlertsSkippedDuplicate,
      tradeQueueAlertsSkippedStateChanged,
      tradeQueueAlertsSkippedNoUser,
      tradeQueueAlertFailures,

      results,
    };
  } finally {
    globalThis.hcaPtMonitorRunning = false;
  }
}
