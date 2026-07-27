import { prisma } from "@/lib/prisma";
import { fetchFinnhubQuote } from "@/lib/market-data/finnhub";
import {
  evaluateSecurityPtAlerts,
} from "@/lib/alerts/pt-proximity-alert-service";

type MarketDataRefreshTrigger = "MANUAL" | "SCHEDULED";

type MarketDataRefreshResult = {
  source: "FINNHUB";
  trigger: MarketDataRefreshTrigger;
  skipped?: boolean;
  reason?: string;
  updatedCount: number;
  failedCount: number;
  ptAlertsEvaluated: number;
  ptAlertsCreated: number;
  ptAlertsSkippedDuplicate: number;
  ptAlertFailures: number;
  results: Array<{
    ticker: string;
    status: "UPDATED" | "FAILED";
    message?: string;
    ptAlertsCreated?: number;
  }>;
};
declare global {
  // eslint-disable-next-line no-var
  var hcaMarketDataRefreshRunning: boolean | undefined;

  // Prevents another full refresh or a new PT refresh from starting
  // while the full refresh waits for an active PT cycle to finish.
  // eslint-disable-next-line no-var
  var hcaMarketDataRefreshPending: boolean | undefined;

  // eslint-disable-next-line no-var
  var hcaPtMonitorRunning: boolean | undefined;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function refreshMarketData({
  trigger,
}: {
  trigger: MarketDataRefreshTrigger;
}): Promise<MarketDataRefreshResult> {
  if (
    globalThis.hcaMarketDataRefreshRunning ||
    globalThis.hcaMarketDataRefreshPending
  ) {
    return {
      source: "FINNHUB",
      trigger,
      skipped: true,
      reason:
        "Full market data refresh already running or pending.",
      updatedCount: 0,
      failedCount: 0,
      ptAlertsEvaluated: 0,
      ptAlertsCreated: 0,
      ptAlertsSkippedDuplicate: 0,
      ptAlertFailures: 0,
      results: [],
    };
  }

  globalThis.hcaMarketDataRefreshPending = true;

  try {
    while (globalThis.hcaPtMonitorRunning) {
      await sleep(100);
    }

    globalThis.hcaMarketDataRefreshRunning = true;
  } finally {
    globalThis.hcaMarketDataRefreshPending = false;
  }

  const ingestionRun = await prisma.ingestionRun.create({
    data: {
      source: "FINNHUB",
      status: "STARTED",
      message:
        trigger === "SCHEDULED"
          ? "Scheduled Finnhub current price refresh started."
          : "Manual Finnhub current price refresh started.",
    },
  });

  try {
    let securities = await prisma.security.findMany({
      where: {
        OR: [
          {
            positions: {
              some: {
                status: "ACTIVE",
                source: "WELLS_FARGO",
              },
            },
          },
          {
            watchlistEntries: {
              some: {
                archivedAt: null,
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

    // Fallback for dev/seeded mode if no Wells positions or watchlist securities exist.
    if (securities.length === 0) {
      securities = await prisma.security.findMany({
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
    }

    const results: MarketDataRefreshResult["results"] = [];
    let ptAlertsEvaluated = 0;
    let ptAlertsCreated = 0;
    let ptAlertsSkippedDuplicate = 0;
    let ptAlertFailures = 0;

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

        const marketDataAsOf =
          new Date();

        const data = {
          currentPrice: quote.currentPrice,
          dayChange: quote.dayChange,
          dayPctChange: quote.dayPctChange,
          source: "FINNHUB",
          marketDataSource: "FINNHUB",
          dataQuality: "REAL",
          lastMarketDataRefreshAt:
            marketDataAsOf,
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
          const ptAlertResult =
            await evaluateSecurityPtAlerts({
              securityId:
                security.id,
              ticker:
                security.ticker,
              currentPrice:
                quote.currentPrice,
              marketDataSource:
                "FINNHUB",
              marketDataAsOf,
            });

          ptAlertsEvaluated +=
            ptAlertResult.evaluatedCount;

          ptAlertsCreated +=
            ptAlertResult.createdCount;

          ptAlertsSkippedDuplicate +=
            ptAlertResult
              .skippedDuplicateCount;

          securityPtAlertsCreated =
            ptAlertResult.createdCount;

          if (
            ptAlertResult.skippedNoUserCount >
            0
          ) {
            console.warn(
              `[pt-alerts] Could not create ${ptAlertResult.skippedNoUserCount} alert(s) for ${security.ticker}: no system user was available.`
            );
          }
        } catch (error) {
          ptAlertFailures += 1;

          console.error(
            `Failed to evaluate PT alerts for ${security.ticker}:`,
            error
          );
        }

        results.push({
          ticker: security.ticker,
          status: "UPDATED",
          ptAlertsCreated:
            securityPtAlertsCreated,
        });

        // Finnhub free tier is 60 calls/minute, so stay under that.
        await sleep(1100);
      } catch (error) {
        console.error(`Failed to update ${security.ticker}:`, error);

        results.push({
          ticker: security.ticker,
          status: "FAILED",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const updatedCount = results.filter(
      (result) => result.status === "UPDATED"
    ).length;

    const failedCount = results.filter(
      (result) => result.status === "FAILED"
    ).length;

    await prisma.ingestionRun.update({
      where: {
        id: ingestionRun.id,
      },
      data: {
        status: failedCount > 0 ? "COMPLETED_WITH_WARNINGS" : "COMPLETED",
        message:
          trigger === "SCHEDULED"
            ? `Scheduled Finnhub current price refresh complete. Updated: ${updatedCount}. Failed: ${failedCount}. PT alerts created: ${ptAlertsCreated}. PT alert failures: ${ptAlertFailures}.`
            : `Manual Finnhub current price refresh complete. Updated: ${updatedCount}. Failed: ${failedCount}. PT alerts created: ${ptAlertsCreated}. PT alert failures: ${ptAlertFailures}.`,
        endedAt: new Date(),
        rowsProcessed: results.length,
        rowsFailed: failedCount,
        detailsJson:
          JSON.stringify({
            ptAlertsEvaluated,
            ptAlertsCreated,
            ptAlertsSkippedDuplicate,
            ptAlertFailures,
          }),
      },
    });

    return {
      source: "FINNHUB",
      trigger,
      updatedCount,
      failedCount,
      ptAlertsEvaluated,
      ptAlertsCreated,
      ptAlertsSkippedDuplicate,
      ptAlertFailures,
      results,
    };
  } catch (error) {
    console.error("Finnhub current price refresh failed:", error);

    await prisma.ingestionRun.update({
      where: {
        id: ingestionRun.id,
      },
      data: {
        status: "FAILED",
        message:
          error instanceof Error
            ? error.message
            : "Unknown Finnhub refresh failure.",
        endedAt: new Date(),
      },
    });

    throw error;
  } finally {
    globalThis.hcaMarketDataRefreshRunning = false;
  }
}