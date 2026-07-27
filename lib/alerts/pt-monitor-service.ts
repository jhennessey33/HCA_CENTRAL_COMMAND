import { evaluateSecurityPtAlerts } from "@/lib/alerts/pt-proximity-alert-service";
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
  results: Array<{
    ticker: string;
    status: "UPDATED" | "FAILED";
    message?: string;
    ptAlertsCreated?: number;
  }>;
};

declare global {
  // Shared with the full market-data refresh so the two Finnhub
  // workflows cannot run concurrently in the same Node process.
  // eslint-disable-next-line no-var
  var hcaMarketDataRefreshRunning: boolean | undefined;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createSkippedResult(
  reason: string
): PtMonitorRefreshResult {
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
    results: [],
  };
}

export async function refreshPtMonitorMarketData(): Promise<PtMonitorRefreshResult> {
  if (globalThis.hcaMarketDataRefreshRunning) {
    return createSkippedResult(
      "Another market data refresh is already running."
    );
  }

  globalThis.hcaMarketDataRefreshRunning = true;

  try {
    const securities = await prisma.security.findMany({
      where: {
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
            ],
          },
        },
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

    for (const security of securities) {
      try {
        const existingMarketData =
          security.marketData[0] ?? null;

        const quote = await fetchFinnhubQuote(
          security.ticker
        );

        if (!quote) {
          results.push({
            ticker: security.ticker,
            status: "FAILED",
            message:
              "No Finnhub current price returned.",
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
              securityId: security.id,
              ticker: security.ticker,
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
              `[pt-monitor] Could not create ${ptAlertResult.skippedNoUserCount} alert(s) for ${security.ticker}: no system user was available.`
            );
          }
        } catch (error) {
          ptAlertFailures += 1;

          console.error(
            `[pt-monitor] Failed to evaluate PT alerts for ${security.ticker}:`,
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
        console.error(
          `[pt-monitor] Failed to update ${security.ticker}:`,
          error
        );

        results.push({
          ticker: security.ticker,
          status: "FAILED",
          message:
            error instanceof Error
              ? error.message
              : "Unknown error",
        });
      }
    }

    const updatedCount = results.filter(
      (result) =>
        result.status === "UPDATED"
    ).length;

    const failedCount = results.filter(
      (result) =>
        result.status === "FAILED"
    ).length;

    return {
      source: "FINNHUB",
      monitoredSecurityCount:
        securities.length,
      updatedCount,
      failedCount,
      ptAlertsEvaluated,
      ptAlertsCreated,
      ptAlertsSkippedDuplicate,
      ptAlertFailures,
      results,
    };
  } finally {
    globalThis.hcaMarketDataRefreshRunning = false;
  }
}