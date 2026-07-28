import { refreshMarketData } from "@/lib/market-data/refresh-market-data-service";

const FIFTEEN_MINUTES = 15 * 60 * 1000;

declare global {
  // eslint-disable-next-line no-var
  var hcaMarketDataSchedulerStarted: boolean | undefined;
}

if (!globalThis.hcaMarketDataSchedulerStarted) {
  globalThis.hcaMarketDataSchedulerStarted = true;

  console.log(
    "[market-data-scheduler] Starting automatic 15-minute Finnhub refresh.",
  );

  setInterval(async () => {
    try {
      console.log("[market-data-scheduler] Running scheduled refresh.");

      const result = await refreshMarketData({
        trigger: "SCHEDULED",
      });

      if (result.skipped) {
        console.log("[market-data-scheduler] Refresh skipped:", result.reason);
        return;
      }

      console.log("[market-data-scheduler] Refresh complete:", {
        updatedCount: result.updatedCount,
        failedCount: result.failedCount,
        ptAlertsEvaluated: result.ptAlertsEvaluated,
        ptAlertsCreated: result.ptAlertsCreated,
        ptAlertsSkippedDuplicate: result.ptAlertsSkippedDuplicate,
        ptAlertFailures: result.ptAlertFailures,
      });
    } catch (error) {
      console.error("[market-data-scheduler] Scheduled refresh failed:", error);
    }
  }, FIFTEEN_MINUTES);
}
