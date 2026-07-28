import { refreshPtMonitorMarketData } from "@/lib/alerts/pt-monitor-service";

const FIVE_MINUTES = 5 * 60 * 1000;

declare global {
  // eslint-disable-next-line no-var
  var hcaPtMonitorSchedulerStarted: boolean | undefined;
}

if (!globalThis.hcaPtMonitorSchedulerStarted) {
  globalThis.hcaPtMonitorSchedulerStarted = true;

  console.log("[pt-monitor-scheduler] Starting automatic 5-minute PT refresh.");

  setInterval(async () => {
    try {
      console.log("[pt-monitor-scheduler] Running scheduled PT refresh.");

      const result = await refreshPtMonitorMarketData();

      if (result.skipped) {
        console.log("[pt-monitor-scheduler] Refresh skipped:", result.reason);
        return;
      }

      console.log("[pt-monitor-scheduler] Refresh complete:", {
        monitoredSecurityCount: result.monitoredSecurityCount,
        updatedCount: result.updatedCount,
        failedCount: result.failedCount,
        ptAlertsEvaluated: result.ptAlertsEvaluated,
        ptAlertsCreated: result.ptAlertsCreated,
        ptAlertsSkippedDuplicate: result.ptAlertsSkippedDuplicate,
        ptAlertFailures: result.ptAlertFailures,
      });
    } catch (error) {
      console.error(
        "[pt-monitor-scheduler] Scheduled PT refresh failed:",
        error,
      );
    }
  }, FIVE_MINUTES);
}
