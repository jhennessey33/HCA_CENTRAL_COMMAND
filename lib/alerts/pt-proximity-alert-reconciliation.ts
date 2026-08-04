import { Prisma } from "@prisma/client";

import { PT_ALERT_FLAG_TYPE } from "@/lib/alerts/pt-proximity";

function pricesMatch(
  currentPrice: number | null | undefined,
  alertPrice: number | null | undefined,
) {
  if (currentPrice == null && alertPrice == null) {
    return true;
  }

  if (currentPrice == null || alertPrice == null) {
    return false;
  }

  return Math.abs(currentPrice - alertPrice) <= 0.000001;
}

export async function reconcileWatchlistPtAlerts(
  tx: Prisma.TransactionClient,
  watchlistEntry: {
    id: string;
    targetPrice?: number | null;
    entryTargetPrice?: number | null;
    exitTargetPrice?: number | null;
    discussionTargetPrice?: number | null;
  },
) {
  const openAlerts = await tx.flag.findMany({
    where: {
      watchlistEntryId: watchlistEntry.id,
      flagType: PT_ALERT_FLAG_TYPE,
      status: "OPEN",
    },
    select: {
      id: true,
      metadataJson: true,
    },
  });

  for (const alert of openAlerts) {
    if (!alert.metadataJson) {
      continue;
    }

    let metadata: any;

    try {
      metadata = JSON.parse(alert.metadataJson);
    } catch {
      continue;
    }

    const targetKind = metadata?.targetKind;

    const alertTargetPrice = Number(metadata?.targetPrice);

    if (!Number.isFinite(alertTargetPrice)) {
      continue;
    }

    const currentTargetPrice =
      targetKind === "ENTRY"
        ? watchlistEntry.entryTargetPrice ??
          watchlistEntry.targetPrice ??
          null
        : targetKind === "EXIT"
          ? watchlistEntry.exitTargetPrice ?? null
          : targetKind === "DISCUSSION"
            ? watchlistEntry.discussionTargetPrice ?? null
            : null;

    if (pricesMatch(currentTargetPrice, alertTargetPrice)) {
      continue;
    }

    await tx.flag.update({
      where: {
        id: alert.id,
      },
      data: {
        status: "ARCHIVED",
      },
    });
  }
}