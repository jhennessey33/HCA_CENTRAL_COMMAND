"use client";

import { useEffect, useState } from "react";
import Badge from "@/components/common/Badge";
import LocalDateTime from "@/components/common/LocalDateTime";

type TradeQueueSectionProps = {
  queueItems: any[];
  highlightedQueueItemId: string | null;
  onQueueItemUpdated: (queueItem: any) => void;
  onQueueItemCanceled: (queueItemId: string) => void;
  onQueueItemExecuted: (queueItemId: string, trade: any) => void;
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

function getLocalDateTimeInputValue(value: string | Date) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const timezoneOffsetMilliseconds = date.getTimezoneOffset() * 60 * 1000;

  return new Date(date.getTime() - timezoneOffsetMilliseconds)
    .toISOString()
    .slice(0, 16);
}

function serializeLocalDateTime(value: string) {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate.toISOString();
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

function EditTradeQueueModal({
  queueItem,
  onClose,
  onSaved,
}: {
  queueItem: any;
  onClose: () => void;
  onSaved: (queueItem: any) => void;
}) {
  const [sharesInput, setSharesInput] = useState(
    String(queueItem.shares ?? ""),
  );
  const [executionPriceInput, setExecutionPriceInput] = useState(
    String(queueItem.executionPrice ?? ""),
  );
  const [proposedTradeAtInput, setProposedTradeAtInput] = useState(
    getLocalDateTimeInputValue(queueItem.proposedTradeAt),
  );
  const [commentInput, setCommentInput] = useState(queueItem.comment || "");
  const [shortLocateNumberInput, setShortLocateNumberInput] = useState(
    queueItem.shortLocateNumber || "",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  async function handleSave() {
    const shares = Number(sharesInput);
    const executionPrice = Number(executionPriceInput);
    const proposedTradeAt = serializeLocalDateTime(proposedTradeAtInput);

    if (!Number.isFinite(shares) || shares <= 0) {
      setSaveError("Shares must be greater than zero.");
      return;
    }

    if (!Number.isFinite(executionPrice) || executionPrice <= 0) {
      setSaveError("Execution price must be greater than zero.");
      return;
    }

    if (!proposedTradeAt) {
      setSaveError("Proposed trade date and time must be valid.");
      return;
    }

    if (queueItem.tradeType === "SHORT" && !shortLocateNumberInput.trim()) {
      setSaveError("Short Locate Number is required for a short trade.");
      return;
    }

    try {
      setIsSaving(true);
      setSaveError("");

      const response = await fetch(`/api/trade-queue/${queueItem.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          shares,
          executionPrice,
          proposedTradeAt,
          comment: commentInput,
          shortLocateNumber: shortLocateNumberInput,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update the Trade Queue item.");
      }

      onSaved(data.queueItem);
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Failed to update the Trade Queue item.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-semibold text-slate-950">
                Edit Trade Queue Item
              </h3>

              <Badge tone={actionTone(queueItem.tradeType) as any}>
                {queueItem.tradeType}
              </Badge>

              <Badge tone={statusTone(queueItem.status) as any}>
                {queueItem.status}
              </Badge>
            </div>

            <p className="mt-1 text-sm text-slate-500">
              {queueItem.security?.ticker || "Unknown"} -{" "}
              {queueItem.security?.name || "Unknown Security"}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close edit modal"
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        <div className="space-y-5 p-6">
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Immutable Trade Details
            </p>

            <div className="mt-3 grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Security
                </p>
                <p className="mt-1 font-semibold text-slate-950">
                  {queueItem.security?.ticker || "—"}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Action
                </p>
                <p className="mt-1 font-semibold text-slate-950">
                  {queueItem.tradeType}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Position
                </p>
                <p
                  title={queueItem.position?.id || ""}
                  className="mt-1 truncate font-semibold text-slate-950"
                >
                  {queueItem.position?.side || "—"}
                  {queueItem.position?.accountNumber
                    ? ` - ${queueItem.position.accountNumber}`
                    : ""}
                </p>
              </div>
            </div>

            <p className="mt-3 text-xs leading-5 text-slate-500">
              Security, Position, and trade action cannot be changed. Cancel and
              recreate the queue item if any of those details are incorrect.
            </p>
          </section>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700">
                Shares
              </label>

              <input
                value={sharesInput}
                onChange={(event) => setSharesInput(event.target.value)}
                disabled={isSaving}
                inputMode="decimal"
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Execution Price
              </label>

              <div className="relative mt-2">
                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm text-slate-400">
                  $
                </span>

                <input
                  value={executionPriceInput}
                  onChange={(event) =>
                    setExecutionPriceInput(event.target.value)
                  }
                  disabled={isSaving}
                  inputMode="decimal"
                  className="w-full rounded-2xl border border-slate-200 py-3 pl-8 pr-4 text-sm outline-none focus:ring-2 focus:ring-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50"
                />
              </div>

              <p className="mt-1 text-xs text-slate-500">
                This is the exact market-price threshold monitored for this
                queued trade.
              </p>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Proposed Trade Date and Time
            </label>

            <input
              type="datetime-local"
              value={proposedTradeAtInput}
              onChange={(event) => setProposedTradeAtInput(event.target.value)}
              disabled={isSaving}
              step="60"
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50"
            />
          </div>

          {queueItem.tradeType === "SHORT" ? (
            <div>
              <label className="text-sm font-medium text-slate-700">
                Short Locate Number
                <span className="ml-1 text-rose-600">*</span>
              </label>

              <input
                value={shortLocateNumberInput}
                onChange={(event) =>
                  setShortLocateNumberInput(event.target.value)
                }
                disabled={isSaving}
                required
                autoComplete="off"
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50"
              />
            </div>
          ) : null}

          <div>
            <label className="text-sm font-medium text-slate-700">
              Trade Note
            </label>

            <textarea
              value={commentInput}
              onChange={(event) => setCommentInput(event.target.value)}
              disabled={isSaving}
              placeholder="Optional rationale or queue note..."
              className="mt-2 h-28 w-full resize-none rounded-2xl border border-slate-200 p-4 text-sm outline-none focus:ring-2 focus:ring-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50"
            />
          </div>

          {queueItem.status === "TRIGGERED" ? (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
              Saving changes will reset this item to QUEUED, clear its prior
              trigger timestamp, and resolve its old open queue alerts. The
              revised execution price can then trigger a new alert later.
            </section>
          ) : null}

          <section className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm leading-6 text-violet-800">
            Editing this queue item does not create a Trade and does not change
            Wells-authoritative Position values, WAP, market value, portfolio
            weight, tax lots, or P&amp;L.
          </section>

          {saveError ? (
            <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">
              {saveError}
            </section>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 p-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSaving ? "Saving..." : "Save Queue Item"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ExecuteTradeQueueModal({
  queueItem,
  onClose,
  onExecuted,
}: {
  queueItem: any;
  onClose: () => void;
  onExecuted: (queueItemId: string, trade: any) => void;
}) {
  const [actualPriceInput, setActualPriceInput] = useState(
    String(queueItem.executionPrice ?? ""),
  );
  const [actualTradeAtInput, setActualTradeAtInput] = useState(
    getLocalDateTimeInputValue(queueItem.proposedTradeAt),
  );
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionError, setExecutionError] = useState("");

  const actualPrice = toFiniteNumber(actualPriceInput);
  const queuedExecutionPrice = toFiniteNumber(queueItem.executionPrice);
  const actualTradeAt = serializeLocalDateTime(actualTradeAtInput);

  const estimatedNotional =
    actualPrice != null && actualPrice > 0
      ? Number(queueItem.shares) * actualPrice
      : null;

  async function handleExecute() {
    if (actualPrice == null || actualPrice <= 0) {
      setExecutionError("Actual execution price must be greater than zero.");
      return;
    }

    if (!actualTradeAt) {
      setExecutionError("Actual trade date and time must be valid.");
      return;
    }

    try {
      setIsExecuting(true);
      setExecutionError("");

      const response = await fetch(`/api/trade-queue/${queueItem.id}/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          avgPrice: actualPrice,
          dateTraded: actualTradeAt,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to execute the Trade Queue item.",
        );
      }

      if (!data.trade || !data.queueItem) {
        throw new Error(
          "The execution response did not include the created Trade.",
        );
      }

      onExecuted(data.queueItem.id, data.trade);
    } catch (error) {
      setExecutionError(
        error instanceof Error
          ? error.message
          : "Failed to execute the Trade Queue item.",
      );
    } finally {
      setIsExecuting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-semibold text-slate-950">
                Confirm Trade Execution
              </h3>

              <Badge tone={actionTone(queueItem.tradeType) as any}>
                {queueItem.tradeType}
              </Badge>

              <Badge tone={statusTone(queueItem.status) as any}>
                {queueItem.status}
              </Badge>
            </div>

            <p className="mt-1 text-sm text-slate-500">
              {queueItem.security?.ticker || "Unknown"} -{" "}
              {queueItem.security?.name || "Unknown Security"}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isExecuting}
            aria-label="Close execution confirmation"
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        <div className="space-y-5 p-6">
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Queued Trade
            </p>

            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Security
                </p>

                <p className="mt-1 font-semibold text-slate-950">
                  {queueItem.security?.ticker || "—"}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Action
                </p>

                <p className="mt-1 font-semibold text-slate-950">
                  {queueItem.tradeType}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Shares
                </p>

                <p className="mt-1 font-semibold tabular-nums text-slate-950">
                  {formatShares(toFiniteNumber(queueItem.shares))}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Queue Status
                </p>

                <p className="mt-1 font-semibold text-slate-950">
                  {queueItem.status}
                </p>
              </div>
            </div>
          </section>

          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Actual Fill Details
            </p>

            <p className="mt-1 text-sm leading-6 text-slate-600">
              Adjust the execution price and timestamp to match the actual fill
              before creating the Manual Pending Trade.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Actual Execution Price
                </label>

                <div className="relative mt-2">
                  <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm text-slate-400">
                    $
                  </span>

                  <input
                    value={actualPriceInput}
                    onChange={(event) =>
                      setActualPriceInput(event.target.value)
                    }
                    disabled={isExecuting}
                    inputMode="decimal"
                    className="w-full rounded-2xl border border-slate-200 py-3 pl-8 pr-4 text-sm outline-none focus:ring-2 focus:ring-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50"
                  />
                </div>

                <p className="mt-1 text-xs text-slate-500">
                  Queued threshold: {formatPrice(queuedExecutionPrice)}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">
                  Actual Trade Date and Time
                </label>

                <input
                  type="datetime-local"
                  value={actualTradeAtInput}
                  onChange={(event) =>
                    setActualTradeAtInput(event.target.value)
                  }
                  disabled={isExecuting}
                  step="60"
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50"
                />

                <p className="mt-1 text-xs text-slate-500">
                  Initially populated from the proposed queue time.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
              Execution Summary
            </p>

            <div className="mt-3 grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-white p-3 ring-1 ring-violet-100">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Signed Direction
                </p>

                <p className="mt-1 font-semibold text-slate-950">
                  {queueItem.tradeType === "SELL" ||
                  queueItem.tradeType === "SHORT"
                    ? "Negative Shares"
                    : "Positive Shares"}
                </p>
              </div>

              <div className="rounded-xl bg-white p-3 ring-1 ring-violet-100">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Actual Price
                </p>

                <p className="mt-1 font-semibold tabular-nums text-slate-950">
                  {formatPrice(actualPrice)}
                </p>
              </div>

              <div className="rounded-xl bg-white p-3 ring-1 ring-violet-100">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Estimated Notional
                </p>

                <p className="mt-1 font-semibold tabular-nums text-slate-950">
                  {formatPrice(estimatedNotional)}
                </p>
              </div>
            </div>
          </section>

          {queueItem.comment ? (
            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Queue Note
              </p>

              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {queueItem.comment}
              </p>
            </section>
          ) : null}

          {queueItem.tradeType === "SHORT" ? (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                Short Locate Number
              </p>

              <p className="mt-2 text-sm font-semibold text-amber-900">
                {queueItem.shortLocateNumber || "Missing"}
              </p>
            </section>
          ) : null}

          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
            <p className="font-semibold">Manual Pending conversion</p>

            <p className="mt-1">
              Confirming this action will create a Manual Pending Trade for
              Wells reconciliation, mark this queue item as EXECUTED, link the
              Trade to the queue item, and resolve linked open queue alerts.
            </p>
          </section>

          <section className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm leading-6 text-violet-800">
            This action does not place a broker order and does not directly
            modify Wells-authoritative Position shares, WAP, market value,
            portfolio weight, cost basis, tax lots, or P&amp;L.
          </section>

          {executionError ? (
            <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">
              {executionError}
            </section>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 p-4">
          <p className="text-xs text-slate-500">
            This conversion is transactional and cannot be partially completed.
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isExecuting}
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Back to Queue
            </button>

            <button
              type="button"
              onClick={handleExecute}
              disabled={isExecuting}
              className="rounded-2xl bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isExecuting ? "Adding Trade..." : "Confirm Add Trade"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TradeQueueSection({
  queueItems,
  highlightedQueueItemId,
  onQueueItemUpdated,
  onQueueItemCanceled,
  onQueueItemExecuted,
}: TradeQueueSectionProps) {
  const [editingQueueItem, setEditingQueueItem] = useState<any | null>(null);
  const [executingQueueItem, setExecutingQueueItem] = useState<any | null>(
    null,
  );
  const [confirmCancelQueueItemId, setConfirmCancelQueueItemId] = useState<
    string | null
  >(null);
  const [cancelingQueueItemId, setCancelingQueueItemId] = useState<
    string | null
  >(null);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (!highlightedQueueItemId) {
      return;
    }

    const matchingQueueItem = queueItems.find(
      (queueItem) => queueItem.id === highlightedQueueItemId,
    );

    if (!matchingQueueItem) {
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      const queueItemElement = document.getElementById(
        `trade-queue-item-${highlightedQueueItemId}`,
      );

      queueItemElement?.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [highlightedQueueItemId, queueItems]);

  useEffect(() => {
    if (!confirmCancelQueueItemId) {
      return;
    }

    const timeout = setTimeout(() => {
      setConfirmCancelQueueItemId(null);
    }, 5000);

    return () => clearTimeout(timeout);
  }, [confirmCancelQueueItemId]);

  async function handleCancelQueueItem(queueItemId: string) {
    try {
      setCancelingQueueItemId(queueItemId);
      setActionError("");

      const response = await fetch(`/api/trade-queue/${queueItemId}/cancel`, {
        method: "POST",
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to cancel the Trade Queue item.");
      }

      onQueueItemCanceled(queueItemId);
      setConfirmCancelQueueItemId(null);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Failed to cancel the Trade Queue item.",
      );
    } finally {
      setCancelingQueueItemId(null);
    }
  }

  function handleEditSaved(updatedQueueItem: any) {
    onQueueItemUpdated(updatedQueueItem);
    setEditingQueueItem(null);
    setActionError("");
  }

  function handleExecutionCompleted(queueItemId: string, trade: any) {
    onQueueItemExecuted(queueItemId, trade);
    setExecutingQueueItem(null);
    setConfirmCancelQueueItemId(null);
    setActionError("");
  }

  return (
    <>
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
                Reviewed trades preserved for later execution. Queue items do
                not modify Wells-authoritative positions.
              </p>
            </div>

            <Badge tone="slate">Manual Review Workflow</Badge>
          </div>
        </div>

        {highlightedQueueItemId &&
        !queueItems.some(
          (queueItem) => queueItem.id === highlightedQueueItemId,
        ) ? (
          <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">
            The requested Trade Queue item is not currently active. It may have
            been executed, canceled, or edited from another session.
          </div>
        ) : null}

        {actionError ? (
          <div className="border-b border-rose-200 bg-rose-50 px-5 py-3 text-sm font-medium text-rose-700">
            {actionError}
          </div>
        ) : null}

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
                const isCanceling = cancelingQueueItemId === queueItem.id;
                const isConfirmingCancel =
                  confirmCancelQueueItemId === queueItem.id;

                return (
                  <div
                    id={`trade-queue-item-${queueItem.id}`}
                    key={queueItem.id}
                    data-trade-queue-item-id={queueItem.id}
                    className={`relative grid grid-cols-[0.8fr_1.8fr_0.9fr_1fr_1fr_1fr_0.9fr_1fr_1.4fr_1.2fr_2fr_1.8fr] items-center border-b px-4 py-3 text-xs transition-all duration-300 last:border-b-0 ${
                      highlightedQueueItemId === queueItem.id
                        ? "z-10 border-emerald-300 bg-emerald-50 ring-2 ring-inset ring-emerald-500 shadow-sm"
                        : queueItem.status === "TRIGGERED"
                          ? "border-slate-100 bg-amber-50 hover:bg-amber-100/60"
                          : "border-slate-100 hover:bg-slate-50"
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
                        onClick={() => {
                          setActionError("");
                          setConfirmCancelQueueItemId(null);
                          setEditingQueueItem(null);
                          setExecutingQueueItem(queueItem);
                        }}
                        disabled={isCanceling}
                        className="rounded-xl bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Add Trade
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActionError("");
                          setConfirmCancelQueueItemId(null);
                          setEditingQueueItem(queueItem);
                        }}
                        disabled={isCanceling}
                        className="rounded-xl bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Edit
                      </button>

                      {isCanceling ? (
                        <span className="px-2 py-1 text-[11px] font-semibold text-slate-500">
                          Canceling...
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setActionError("");

                            if (isConfirmingCancel) {
                              void handleCancelQueueItem(queueItem.id);
                              return;
                            }

                            setConfirmCancelQueueItemId(queueItem.id);
                          }}
                          className={`rounded-xl px-2 py-1 text-[11px] font-medium ${
                            isConfirmingCancel
                              ? "bg-rose-600 text-white hover:bg-rose-700"
                              : "text-rose-600 hover:bg-rose-50"
                          }`}
                        >
                          {isConfirmingCancel ? "Confirm Cancel" : "Cancel"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {editingQueueItem ? (
        <EditTradeQueueModal
          queueItem={editingQueueItem}
          onClose={() => setEditingQueueItem(null)}
          onSaved={handleEditSaved}
        />
      ) : null}
      {executingQueueItem ? (
        <ExecuteTradeQueueModal
          queueItem={executingQueueItem}
          onClose={() => setExecutingQueueItem(null)}
          onExecuted={handleExecutionCompleted}
        />
      ) : null}
    </>
  );
}
