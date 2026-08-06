"use client";

import Badge from "@/components/common/Badge";
import LocalDateTime from "@/components/common/LocalDateTime";

type TradeQueueSectionProps = {
  queueItems: any[];
};

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function formatPrice(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }

  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatShares(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }

  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
}

function formatDistance(value: number | null) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }

  return `${value.toFixed(2)}%`;
}

function getWellsImpliedPrice(position: any) {
  const shares = toFiniteNumber(position?.shares);
  const marketValue = toFiniteNumber(position?.marketValue);

  if (shares == null || marketValue == null || shares === 0) {
    return null;
  }

  return Math.abs(marketValue / shares);
}

function getCurrentPrice(queueItem: any) {
  const marketData = queueItem.security?.marketData?.[0];
  const marketPrice = toFiniteNumber(marketData?.currentPrice);

  if (marketPrice != null) {
    return marketPrice;
  }

  return getWellsImpliedPrice(queueItem.position);
}

function getDistancePercent(
  currentPrice: number | null,
  executionPrice: number | null,
) {
  if (currentPrice == null || executionPrice == null || executionPrice <= 0) {
    return null;
  }

  return (Math.abs(currentPrice - executionPrice) / executionPrice) * 100;
}

function getCreatorLabel(queueItem: any) {
  return queueItem.createdBy?.name || queueItem.createdBy?.email || "Unknown";
}

function statusTone(status: string) {
  if (status === "TRIGGERED") {
    return "amber";
  }

  return "blue";
}

function actionTone(tradeType: string) {
  if (tradeType === "SELL" || tradeType === "SHORT") {
    return "red";
  }

  return "green";
}

function getThresholdDescription(
  tradeType: string,
  executionPrice: number | null,
) {
  const formattedExecutionPrice = formatPrice(executionPrice);

  if (tradeType === "BUY" || tradeType === "COVER") {
    return `Triggers when market price is at or below ${formattedExecutionPrice}.`;
  }

  return `Triggers when market price is at or above ${formattedExecutionPrice}.`;
}

export default function TradeQueueSection({
  queueItems,
}: TradeQueueSectionProps) {
  return (
    <section className="mb-6 overflow-hidden rounded-3xl border border-violet-200 bg-white shadow-sm">
      <div className="border-b border-violet-200 bg-violet-50 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-slate-950">
                Trade Queue
              </h3>

              <Badge tone="blue">{queueItems.length} Active</Badge>
            </div>

            <p className="mt-1 text-sm text-violet-700">
              Reviewed trades preserved for later execution. Queue items do not
              modify Wells-authoritative positions.
            </p>
          </div>

          <Badge tone="slate">Manual Review Workflow</Badge>
        </div>
      </div>

      {queueItems.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm font-medium text-slate-700">
            No active queued trades
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Reviewed trades added from the Trade Calculator will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[1450px]">
            <div className="grid grid-cols-[0.8fr_1.8fr_0.9fr_1fr_1fr_1fr_0.9fr_1fr_1.4fr_1.2fr_2fr_1.8fr] border-b border-slate-200 bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <div>Ticker</div>
              <div>Company</div>
              <div>Action</div>
              <div>Shares</div>
              <div>Execution</div>
              <div>Current</div>
              <div>Distance</div>
              <div>Status</div>
              <div>Proposed Time</div>
              <div>Creator</div>
              <div>Note</div>
              <div>Actions</div>
            </div>

            {queueItems.map((queueItem) => {
              const executionPrice = toFiniteNumber(queueItem.executionPrice);
              const currentPrice = getCurrentPrice(queueItem);
              const distancePercent = getDistancePercent(
                currentPrice,
                executionPrice,
              );

              return (
                <div
                  key={queueItem.id}
                  className={`grid grid-cols-[0.8fr_1.8fr_0.9fr_1fr_1fr_1fr_0.9fr_1fr_1.4fr_1.2fr_2fr_1.8fr] items-center border-b border-slate-100 px-4 py-3 text-xs last:border-b-0 ${
                    queueItem.status === "TRIGGERED"
                      ? "bg-amber-50 hover:bg-amber-100/60"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <div className="font-semibold text-slate-950">
                    {queueItem.security?.ticker || "—"}
                  </div>

                  <div
                    title={queueItem.security?.name || ""}
                    className="truncate pr-3 text-slate-700"
                  >
                    {queueItem.security?.name || "—"}
                  </div>

                  <div>
                    <Badge tone={actionTone(queueItem.tradeType) as any}>
                      {queueItem.tradeType}
                    </Badge>
                  </div>

                  <div className="tabular-nums text-slate-700">
                    {formatShares(toFiniteNumber(queueItem.shares))}
                  </div>

                  <div
                    className="tabular-nums text-slate-950"
                    title={getThresholdDescription(
                      queueItem.tradeType,
                      executionPrice,
                    )}
                  >
                    {formatPrice(executionPrice)}
                  </div>

                  <div className="tabular-nums text-slate-700">
                    {formatPrice(currentPrice)}
                  </div>

                  <div className="tabular-nums text-violet-700">
                    {formatDistance(distancePercent)}
                  </div>

                  <div>
                    <Badge tone={statusTone(queueItem.status) as any}>
                      {queueItem.status}
                    </Badge>
                  </div>

                  <div>
                    <LocalDateTime value={queueItem.proposedTradeAt} />
                  </div>

                  <div
                    title={getCreatorLabel(queueItem)}
                    className="truncate pr-3 text-slate-600"
                  >
                    {getCreatorLabel(queueItem)}
                  </div>

                  <div
                    title={queueItem.comment || ""}
                    className="truncate pr-3 text-slate-500"
                  >
                    {queueItem.comment || "—"}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled
                      title="Queue execution will be enabled in the execution phase."
                      className="cursor-not-allowed rounded-xl bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-400"
                    >
                      Add Trade
                    </button>

                    <button
                      type="button"
                      disabled
                      title="Queue editing will be enabled in the next phase."
                      className="cursor-not-allowed rounded-xl bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-400"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      disabled
                      title="Queue cancellation will be enabled in the next phase."
                      className="cursor-not-allowed rounded-xl bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-400"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
