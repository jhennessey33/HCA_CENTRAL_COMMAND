"use client";

import { useRouter } from "next/navigation";
import LocalDateTime from "@/components/common/LocalDateTime";
import Badge from "@/components/common/Badge";
import { useEffect, useMemo, useRef, useState } from "react";
import { canCreateFlags } from "@/lib/client-permissions";
import CurrentUserPill from "@/components/auth/CurrentUserPill";
import AppSidebar from "@/components/common/AppSidebar";
type AlertsClientProps = {
  initialFlags: any[];
  securities: any[];
};

function priorityTone(priority: string) {
  if (priority === "HIGH") return "red";
  if (priority === "MEDIUM") return "amber";
  return "slate";
}

function statusTone(status: string) {
  if (status === "OPEN") return "red";
  if (status === "RESOLVED") return "green";
  return "slate";
}

function getContextLabel(flag: any) {
  if (flag.watchlistEntryId) return "Watchlist";
  if (flag.position?.status === "CLOSED") return "Past Position";
  if (flag.position?.status === "ACTIVE") return "Active Position";
  if (flag.securityId) return "Security";
  return "General";
}

function isPtProximityAlert(flag: any) {
  return flag.flagType === "PT Proximity Alert";
}

function isTradeQueueExecutionAlert(flag: any) {
  return flag.flagType === "Trade Queue Execution Alert";
}

function parseFlagMetadata(flag: any) {
  if (!flag.metadataJson) return null;

  try {
    return JSON.parse(flag.metadataJson);
  } catch {
    return null;
  }
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

function formatReconciliationShares(value: unknown) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    return "—";
  }

  return Math.abs(parsedValue).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });
}

function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatPtPrice(value: unknown) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "—";
  }

  return numericValue.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPtDistance(value: unknown) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "—";
  }

  return `${numericValue.toFixed(2)}%`;
}
function formatQueueShares(value: unknown) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "—";
  }

  return numericValue.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
}

function getPtContextLabel(flag: any, metadata: any) {
  if (metadata?.context === "WATCHLIST" || flag.watchlistEntryId) {
    return metadata?.side === "SHORT" ? "Short Watchlist" : "Long Watchlist";
  }

  if (metadata?.context === "POSITION" || flag.positionId) {
    return metadata?.side === "SHORT" ? "Short Position" : "Long Position";
  }

  return "Security";
}

function AlertCard({
  flag,
  onResolve,
  canResolve,
}: {
  flag: any;
  onResolve: (flagId: string) => Promise<void>;
  canResolve: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const isOpen = flag.status === "OPEN";

  const iconClass =
    flag.priority === "HIGH"
      ? "bg-rose-50 text-rose-600"
      : flag.priority === "MEDIUM"
        ? "bg-amber-50 text-amber-600"
        : "bg-slate-50 text-slate-500";

  useEffect(() => {
    if (!confirming) {
      return;
    }

    const timeout = setTimeout(() => {
      setConfirming(false);
    }, 5000);

    return () => clearTimeout(timeout);
  }, [confirming]);

  async function handleConfirmResolve() {
    try {
      setIsResolving(true);
      await onResolve(flag.id);
    } finally {
      setIsResolving(false);
      setConfirming(false);
    }
  }
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex min-w-0 items-center gap-4">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl font-semibold ${iconClass}`}
        >
          {isOpen ? "!" : "✓"}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-950">
              {flag.security?.ticker || "General"}
            </h3>

            <Badge tone="blue">{flag.flagType}</Badge>

            <Badge tone={priorityTone(flag.priority) as any}>
              {flag.priority}
            </Badge>

            <Badge tone={statusTone(flag.status) as any}>{flag.status}</Badge>

            <Badge>{getContextLabel(flag)}</Badge>
          </div>

          <p className="mt-1 text-sm text-slate-600">
            {flag.description ||
              `${flag.flagType} alert for ${
                flag.security?.ticker || "General"
              }.`}
          </p>
          {flag.reminderAt ? (
            <p className="mt-2 text-xs font-semibold text-violet-700">
              Due{" "}
              <LocalDateTime
                value={flag.reminderAt}
                className="text-xs font-semibold text-violet-700"
              />
            </p>
          ) : null}
          <p className="mt-2 text-xs text-slate-400">
            Created{" "}
            <LocalDateTime
              value={flag.createdAt}
              className="text-xs text-slate-400"
            />{" "}
            by {flag.createdBy?.name || flag.createdBy?.email || "Unknown"}
          </p>
        </div>
      </div>

      {flag.status === "RESOLVED" ? (
        <button
          disabled
          className="ml-4 shrink-0 cursor-not-allowed rounded-2xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-400"
        >
          Resolved
        </button>
      ) : canResolve ? (
        <div className="ml-4 shrink-0">
          {isResolving ? (
            <button
              disabled
              className="cursor-not-allowed rounded-2xl bg-slate-400 px-4 py-2 text-sm font-medium text-white"
            >
              Resolving...
            </button>
          ) : confirming ? (
            <div className="flex gap-2">
              <button
                onClick={handleConfirmResolve}
                className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Confirm Resolve
              </button>

              <button
                onClick={() => setConfirming(false)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Resolve
            </button>
          )}
        </div>
      ) : (
        <button
          disabled
          className="ml-4 shrink-0 cursor-not-allowed rounded-2xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-400"
        >
          Read Only
        </button>
      )}
    </div>
  );
}

function QueueReconciliationRemainingModal({
  flag,
  onClose,
  onQueued,
}: {
  flag: any;
  onClose: () => void;
  onQueued: (result: { flag: any; queueItem: any }) => void;
}) {
  const metadata = parseFlagMetadata(flag);
  const differences = metadata?.differences || {};

  const tradeType = String(
    differences.proposedQueueTradeType || metadata?.tradeType || "",
  )
    .trim()
    .toUpperCase();

  const remainingShares = Number(
    differences.proposedQueueShares ??
      differences.remainingAbsoluteShares ??
      Math.abs(Number(differences.remainingShares)),
  );

  const defaultExecutionPrice = Number(
    differences.proposedQueueExecutionPrice ?? differences.manualAvgPrice,
  );

  const defaultProposedTradeAt =
    differences.proposedQueueTradeAt || new Date().toISOString();

  const [executionPriceInput, setExecutionPriceInput] = useState(
    Number.isFinite(defaultExecutionPrice) ? String(defaultExecutionPrice) : "",
  );

  const [proposedTradeAtInput, setProposedTradeAtInput] = useState(
    getLocalDateTimeInputValue(defaultProposedTradeAt),
  );

  const [commentInput, setCommentInput] = useState(
    String(differences.originalManualComment || ""),
  );

  const [shortLocateNumberInput, setShortLocateNumberInput] = useState("");

  const [shortAllocationSharesInput, setShortAllocationSharesInput] = useState(
    tradeType === "SHORT" && Number.isFinite(remainingShares)
      ? String(remainingShares)
      : "",
  );

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [submissionError, setSubmissionError] = useState("");

  const executionPrice = Number(executionPriceInput);

  const shortAllocationShares = Number(shortAllocationSharesInput);

  const isShort = tradeType === "SHORT";

  const shortAllocationIsInvalid =
    isShort &&
    (!shortAllocationSharesInput.trim() ||
      !Number.isFinite(shortAllocationShares) ||
      shortAllocationShares <= 0 ||
      !Number.isInteger(shortAllocationShares) ||
      (Number.isFinite(remainingShares) &&
        remainingShares > shortAllocationShares));

  const canSubmit =
    Number.isFinite(remainingShares) &&
    remainingShares > 0 &&
    Number.isInteger(remainingShares) &&
    Number.isFinite(executionPrice) &&
    executionPrice > 0 &&
    Boolean(proposedTradeAtInput) &&
    (!isShort ||
      (Boolean(shortLocateNumberInput.trim()) && !shortAllocationIsInvalid));

  async function handleSubmit() {
    setSubmissionError("");

    if (!Number.isFinite(executionPrice) || executionPrice <= 0) {
      setSubmissionError("Execution price must be greater than zero.");
      return;
    }

    const proposedTradeAt = serializeLocalDateTime(proposedTradeAtInput);

    if (!proposedTradeAt) {
      setSubmissionError("Proposed Trade date and time must be valid.");
      return;
    }

    if (isShort && !shortLocateNumberInput.trim()) {
      setSubmissionError("Short Locate Number is required.");
      return;
    }

    if (isShort && shortAllocationIsInvalid) {
      setSubmissionError(
        "Short Allocation Shares must be a positive whole number covering all remaining SHORT shares.",
      );
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await fetch(
        `/api/trade-reconciliation/${flag.id}/queue-remaining`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            executionPrice,
            proposedTradeAt,
            comment: commentInput,
            shortLocateNumber: isShort ? shortLocateNumberInput : null,
            shortAllocationShares: isShort ? shortAllocationShares : null,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to add the remaining shares to the Trade Queue.",
        );
      }

      if (!data.flag || !data.queueItem) {
        throw new Error(
          "The reconciliation response did not include the resolved Flag and Trade Queue item.",
        );
      }

      onQueued({
        flag: data.flag,
        queueItem: data.queueItem,
      });
    } catch (error) {
      setSubmissionError(
        error instanceof Error
          ? error.message
          : "Failed to add the remaining shares to the Trade Queue.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-6">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">
              Add Remaining Shares to Queue
            </h2>

            <p className="mt-1 text-sm leading-6 text-slate-500">
              Accept the Wells partial fill and preserve the unfilled difference
              in the Trade Queue.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close queue reconciliation modal"
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            ×
          </button>
        </div>

        <div className="space-y-5 p-6">
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Reconciliation Decision
            </p>

            <p className="mt-2 text-sm leading-6 text-amber-900">
              Wells will become the accepted historical Trade. The original
              Manual Trade will be superseded and hidden. Only the remaining
              shares will be added to the Trade Queue.
            </p>
          </section>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Action
              </p>

              <p className="mt-2 font-semibold text-slate-950">
                {tradeType || "—"}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Remaining Shares
              </p>

              <p className="mt-2 font-semibold tabular-nums text-slate-950">
                {formatReconciliationShares(remainingShares)}
              </p>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Execution Threshold
            </label>

            <div className="relative mt-2">
              <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm text-slate-400">
                $
              </span>

              <input
                value={executionPriceInput}
                onChange={(event) => setExecutionPriceInput(event.target.value)}
                disabled={isSubmitting}
                inputMode="decimal"
                placeholder="0.00"
                className="w-full rounded-2xl border border-slate-200 py-3 pl-8 pr-4 text-sm outline-none focus:ring-2 focus:ring-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50"
              />
            </div>

            <p className="mt-1 text-xs leading-5 text-slate-500">
              The queue monitor will use this price as its action-aware trigger
              threshold.
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Proposed Trade Date and Time
            </label>

            <input
              type="datetime-local"
              value={proposedTradeAtInput}
              onChange={(event) => setProposedTradeAtInput(event.target.value)}
              disabled={isSubmitting}
              step="60"
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50"
            />
          </div>

          {isShort ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                  disabled={isSubmitting}
                  autoComplete="off"
                  placeholder="Enter locate number"
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">
                  Short Allocation Shares
                  <span className="ml-1 text-rose-600">*</span>
                </label>

                <input
                  value={shortAllocationSharesInput}
                  onChange={(event) =>
                    setShortAllocationSharesInput(event.target.value)
                  }
                  disabled={isSubmitting}
                  inputMode="numeric"
                  min="1"
                  step="1"
                  placeholder="Enter allocated shares"
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50"
                />
              </div>

              {Number.isFinite(shortAllocationShares) &&
              Number.isFinite(remainingShares) &&
              remainingShares > shortAllocationShares ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium leading-6 text-amber-800 md:col-span-2">
                  Remaining SHORT shares of{" "}
                  {formatReconciliationShares(remainingShares)} exceed the
                  allocated {formatReconciliationShares(shortAllocationShares)}{" "}
                  shares.
                </div>
              ) : null}
            </div>
          ) : null}

          <div>
            <label className="text-sm font-medium text-slate-700">
              Queue Note
            </label>

            <textarea
              value={commentInput}
              onChange={(event) => setCommentInput(event.target.value)}
              disabled={isSubmitting}
              placeholder="Optional rationale or queue note..."
              className="mt-2 h-28 w-full resize-none rounded-2xl border border-slate-200 p-4 text-sm outline-none focus:ring-2 focus:ring-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50"
            />
          </div>

          {submissionError ? (
            <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">
              {submissionError}
            </section>
          ) : null}

          <section className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm leading-6 text-violet-800">
            This operation does not create a Trade, place a broker order, or
            modify the Wells-authoritative Position or tax lots. A Trade is
            created only when the queue item is explicitly executed.
          </section>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 p-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !canSubmit}
            className="rounded-2xl bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSubmitting
              ? "Adding to Queue..."
              : "Accept Wells & Add to Queue"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TradeReconciliationAlertCard({
  flag,
  onAcceptWells,
  onKeepManual,
  onQueueRemaining,
  canResolve,
}: {
  flag: any;
  onAcceptWells: (flagId: string) => Promise<void>;
  onKeepManual: (flagId: string) => Promise<void>;
  onQueueRemaining: (flag: any) => void;
  canResolve: boolean;
}) {
  const metadata = parseFlagMetadata(flag);

  const differences = metadata?.differences || {};

  const isPartialCompletion =
    differences.reconciliationKind === "PARTIAL_COMPLETION";

  const isResolved = flag.status === "RESOLVED";

  return (
    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="amber">Trade Reconciliation</Badge>

            <Badge tone={priorityTone(flag.priority) as any}>
              {flag.priority}
            </Badge>

            <Badge tone={statusTone(flag.status) as any}>{flag.status}</Badge>

            <Badge>{getContextLabel(flag)}</Badge>
          </div>

          <h3 className="mt-3 text-lg font-semibold text-slate-950">
            {flag.security?.ticker || metadata?.ticker || "N/A"} trade needs
            review
          </h3>

          <p className="mt-1 text-sm leading-6 text-slate-700">
            {flag.description ||
              "Manual trade and Wells transaction appear similar but differ. Review required."}
          </p>

          <p className="mt-2 text-xs text-slate-500">
            Created{" "}
            <LocalDateTime
              value={flag.createdAt}
              className="text-xs text-slate-500"
            />{" "}
            by {flag.createdBy?.name || flag.createdBy?.email || "Unknown"}
          </p>
        </div>

        {isResolved ? (
          <button
            disabled
            className="shrink-0 cursor-not-allowed rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-400"
          >
            Resolved
          </button>
        ) : canResolve ? (
          <div className="flex shrink-0 flex-col gap-2">
            <button
              type="button"
              onClick={() => onAcceptWells(flag.id)}
              className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Accept Wells
            </button>

            {isPartialCompletion ? (
              <button
                type="button"
                onClick={() => onQueueRemaining(flag)}
                className="rounded-2xl bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-800"
              >
                Add Remaining to Queue
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onKeepManual(flag.id)}
                className="rounded-2xl border border-amber-200 bg-white px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100"
              >
                Keep Manual
              </button>
            )}
          </div>
        ) : (
          <button
            disabled
            className="shrink-0 cursor-not-allowed rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-400"
          >
            Read Only
          </button>
        )}
      </div>
      {isPartialCompletion ? (
        <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-2xl bg-white p-4 ring-1 ring-amber-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Original Request
            </p>

            <p className="mt-2 text-lg font-semibold tabular-nums text-slate-950">
              {formatReconciliationShares(differences.originalManualShares)}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-4 ring-1 ring-amber-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Wells Completed
            </p>

            <p className="mt-2 text-lg font-semibold tabular-nums text-emerald-700">
              {formatReconciliationShares(differences.wellsCompletedShares)}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-4 ring-1 ring-amber-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Remaining
            </p>

            <p className="mt-2 text-lg font-semibold tabular-nums text-violet-700">
              {formatReconciliationShares(differences.remainingShares)}
            </p>
          </div>
        </div>
      ) : null}
      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl bg-white p-4 ring-1 ring-amber-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {Number(differences.partialCandidateCount) > 1
              ? "Selected Manual Candidate"
              : "Manual Trade"}
          </p>
          {Number(differences.partialCandidateCount) > 1 ? (
            <p className="mt-1 text-xs font-medium text-amber-700">
              {differences.partialCandidateCount} manual trades qualify for
              review
            </p>
          ) : null}
          <div className="mt-3 space-y-2 text-slate-700">
            <div className="flex justify-between gap-4">
              <span>Trade ID</span>
              <span className="truncate font-semibold text-slate-950">
                {metadata?.manualTradeId || "—"}
              </span>
            </div>

            <div className="flex justify-between gap-4">
              <span>Shares</span>
              <span className="font-semibold text-slate-950">
                {formatReconciliationShares(
                  differences.originalManualShares ?? differences.manualShares,
                )}
              </span>
            </div>

            <div className="flex justify-between gap-4">
              <span>Avg Price</span>
              <span className="font-semibold text-slate-950">
                {differences.manualAvgPrice ?? "—"}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 ring-1 ring-amber-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Wells Trade
          </p>

          <div className="mt-3 space-y-2 text-slate-700">
            <div className="flex justify-between gap-4">
              <span>Trade ID</span>
              <span className="truncate font-semibold text-slate-950">
                {metadata?.wellsTradeId || "—"}
              </span>
            </div>

            <div className="flex justify-between gap-4">
              <span>Shares</span>
              <span className="font-semibold text-slate-950">
                {formatReconciliationShares(
                  differences.wellsCompletedShares ?? differences.wellsShares,
                )}
              </span>
            </div>

            <div className="flex justify-between gap-4">
              <span>Avg Price</span>
              <span className="font-semibold text-slate-950">
                {differences.wellsAvgPrice ?? "—"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {metadata?.reason ? (
        <div className="mt-4 rounded-2xl bg-white p-4 text-sm text-slate-700 ring-1 ring-amber-100">
          <span className="font-semibold text-slate-950">Reason:</span>{" "}
          {metadata.reason}
        </div>
      ) : null}
    </div>
  );
}

function PtProximityAlertCard({
  flag,
  onResolve,
  canResolve,
}: {
  flag: any;
  onResolve: (flagId: string) => Promise<void>;
  canResolve: boolean;
}) {
  const metadata = parseFlagMetadata(flag);

  const [confirmingResolve, setConfirmingResolve] = useState(false);

  const [isResolving, setIsResolving] = useState(false);

  const [resolveError, setResolveError] = useState("");

  useEffect(() => {
    if (!confirmingResolve) {
      return;
    }

    const timeout = setTimeout(() => {
      setConfirmingResolve(false);
    }, 5000);

    return () => clearTimeout(timeout);
  }, [confirmingResolve]);

  async function handleConfirmResolve() {
    try {
      setIsResolving(true);
      setResolveError("");

      await onResolve(flag.id);
    } catch (error) {
      setResolveError(
        error instanceof Error ? error.message : "Failed to resolve PT alert.",
      );
    } finally {
      setIsResolving(false);
      setConfirmingResolve(false);
    }
  }

  return (
    <div className="rounded-3xl border border-violet-200 bg-violet-50 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="blue">PT Alert</Badge>

            <Badge tone="amber">
              {metadata?.targetLabel || "Price Target"}
            </Badge>

            <Badge>{getPtContextLabel(flag, metadata)}</Badge>

            <Badge tone={priorityTone(flag.priority) as any}>
              {flag.priority}
            </Badge>
          </div>

          <h3 className="mt-3 text-lg font-semibold text-slate-950">
            {flag.security?.ticker || metadata?.ticker || "Unknown Security"} is
            approaching its {metadata?.targetLabel || "price target"}
          </h3>

          <p className="mt-1 text-sm leading-6 text-slate-700">
            {flag.description ||
              "A monitored Security is within the configured PT proximity range."}
          </p>

          <p className="mt-2 text-xs text-slate-500">
            Alert created{" "}
            <LocalDateTime
              value={flag.createdAt}
              className="text-xs text-slate-500"
            />
          </p>
        </div>

        {canResolve ? (
          <div className="shrink-0">
            {isResolving ? (
              <button
                type="button"
                disabled
                className="cursor-not-allowed rounded-2xl bg-slate-400 px-4 py-2 text-sm font-medium text-white"
              >
                Resolving...
              </button>
            ) : confirmingResolve ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleConfirmResolve}
                  className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  Confirm Resolve
                </button>

                <button
                  type="button"
                  onClick={() => setConfirmingResolve(false)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingResolve(true)}
                className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Resolve
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            disabled
            className="shrink-0 cursor-not-allowed rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-400"
          >
            Read Only
          </button>
        )}
      </div>

      <div className="mt-5 grid grid-cols-4 gap-3 text-sm">
        <div className="rounded-2xl bg-white p-4 ring-1 ring-violet-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Current Price
          </p>

          <p className="mt-2 text-lg font-semibold text-slate-950 tabular-nums">
            {formatPtPrice(metadata?.currentPrice)}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-4 ring-1 ring-violet-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {metadata?.targetLabel || "Target Price"}
          </p>

          <p className="mt-2 text-lg font-semibold text-slate-950 tabular-nums">
            {formatPtPrice(metadata?.targetPrice)}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-4 ring-1 ring-violet-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Distance
          </p>

          <p className="mt-2 text-lg font-semibold text-violet-700 tabular-nums">
            {formatPtDistance(metadata?.distancePercent)}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-4 ring-1 ring-violet-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Trigger Range
          </p>

          <p className="mt-2 text-lg font-semibold text-slate-950 tabular-nums">
            Within {formatPtDistance(metadata?.triggerPercent)}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl bg-white p-4 ring-1 ring-violet-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Market Data
          </p>

          <div className="mt-2 space-y-1 text-slate-700">
            <p>
              Source:{" "}
              <span className="font-semibold text-slate-950">
                {metadata?.marketDataSource || "Unknown"}
              </span>
            </p>

            <p>
              Price As Of:{" "}
              <span className="font-semibold text-slate-950">
                {metadata?.marketDataAsOf
                  ? formatDateTime(metadata.marketDataAsOf)
                  : "—"}
              </span>
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 ring-1 ring-violet-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Monitoring Context
          </p>

          <div className="mt-2 space-y-1 text-slate-700">
            <p>
              Side:{" "}
              <span className="font-semibold text-slate-950">
                {metadata?.side || "—"}
              </span>
            </p>

            <p>
              Target Kind:{" "}
              <span className="font-semibold text-slate-950">
                {metadata?.targetKind || "—"}
              </span>
            </p>
          </div>
        </div>
      </div>

      {resolveError ? (
        <div className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ring-1 ring-rose-100">
          {resolveError}
        </div>
      ) : null}
    </div>
  );
}

function TradeQueueExecutionAlertCard({
  flag,
  onResolve,
  onOpenTradeQueue,
  canResolve,
}: {
  flag: any;
  onResolve: (flagId: string) => Promise<void>;
  onOpenTradeQueue: (flag: any) => void;
  canResolve: boolean;
}) {
  const metadata = parseFlagMetadata(flag);
  const [confirmingResolve, setConfirmingResolve] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [resolveError, setResolveError] = useState("");

  const tradeQueueItemId =
    flag.tradeQueueItemId || metadata?.tradeQueueItemId || null;

  const ticker =
    flag.security?.ticker || metadata?.ticker || "Unknown Security";

  useEffect(() => {
    if (!confirmingResolve) {
      return;
    }

    const timeout = setTimeout(() => {
      setConfirmingResolve(false);
    }, 5000);

    return () => clearTimeout(timeout);
  }, [confirmingResolve]);

  async function handleConfirmResolve() {
    try {
      setIsResolving(true);
      setResolveError("");
      await onResolve(flag.id);
    } catch (error) {
      setResolveError(
        error instanceof Error
          ? error.message
          : "Failed to resolve Trade Queue alert.",
      );
    } finally {
      setIsResolving(false);
      setConfirmingResolve(false);
    }
  }

  return (
    <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="green">Trade Queue Alert</Badge>

            {metadata?.tradeType ? (
              <Badge
                tone={
                  metadata.tradeType === "SELL" ||
                  metadata.tradeType === "SHORT"
                    ? "red"
                    : "green"
                }
              >
                {metadata.tradeType}
              </Badge>
            ) : null}

            <Badge tone={priorityTone(flag.priority) as any}>
              {flag.priority}
            </Badge>

            <Badge tone={statusTone(flag.status) as any}>{flag.status}</Badge>
          </div>

          <h3 className="mt-3 text-lg font-semibold text-slate-950">
            {ticker} reached its Trade Queue execution threshold
          </h3>

          <p className="mt-1 text-sm leading-6 text-slate-700">
            {flag.description ||
              "A queued trade reached its action-aware execution threshold."}
          </p>

          <p className="mt-2 text-xs text-slate-500">
            Alert created{" "}
            <LocalDateTime
              value={flag.createdAt}
              className="text-xs text-slate-500"
            />
          </p>
        </div>

        <button
          type="button"
          onClick={() => onOpenTradeQueue(flag)}
          disabled={!tradeQueueItemId}
          title={
            tradeQueueItemId
              ? "Open this item in the Trade Queue."
              : "This alert does not include a Trade Queue item ID."
          }
          className="shrink-0 rounded-2xl bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
        >
          Open Trade Queue
        </button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        <div className="rounded-2xl bg-white p-4 ring-1 ring-emerald-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Current Price
          </p>

          <p className="mt-2 text-lg font-semibold tabular-nums text-slate-950">
            {formatPtPrice(metadata?.currentPrice)}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-4 ring-1 ring-emerald-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Execution Price
          </p>

          <p className="mt-2 text-lg font-semibold tabular-nums text-slate-950">
            {formatPtPrice(metadata?.executionPrice)}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-4 ring-1 ring-emerald-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Distance
          </p>

          <p className="mt-2 text-lg font-semibold tabular-nums text-emerald-700">
            {formatPtDistance(metadata?.distancePercent)}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-4 ring-1 ring-emerald-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Shares
          </p>

          <p className="mt-2 text-lg font-semibold tabular-nums text-slate-950">
            {formatQueueShares(metadata?.shares)}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
        <div className="rounded-2xl bg-white p-4 ring-1 ring-emerald-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Trigger Details
          </p>

          <div className="mt-2 space-y-1 text-slate-700">
            <p>
              Action:{" "}
              <span className="font-semibold text-slate-950">
                {metadata?.tradeType || "—"}
              </span>
            </p>

            <p>
              Direction:{" "}
              <span className="font-semibold text-slate-950">
                {metadata?.triggerDirection || "—"}
              </span>
            </p>

            <p>
              Triggered At:{" "}
              <span className="font-semibold text-slate-950">
                {metadata?.triggeredAt
                  ? formatDateTime(metadata.triggeredAt)
                  : "—"}
              </span>
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 ring-1 ring-emerald-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Market Data
          </p>

          <div className="mt-2 space-y-1 text-slate-700">
            <p>
              Source:{" "}
              <span className="font-semibold text-slate-950">
                {metadata?.marketDataSource || "Unknown"}
              </span>
            </p>

            <p>
              Price As Of:{" "}
              <span className="font-semibold text-slate-950">
                {metadata?.marketDataAsOf
                  ? formatDateTime(metadata.marketDataAsOf)
                  : "—"}
              </span>
            </p>

            <p>
              Queue Item:{" "}
              <span
                title={tradeQueueItemId || ""}
                className="font-semibold text-slate-950"
              >
                {tradeQueueItemId || "—"}
              </span>
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-emerald-200 bg-white p-4 text-sm leading-6 text-slate-700">
        Opening the Trade Queue does not execute the item. Final execution
        requires confirmation of the actual price and trade timestamp.
      </div>

      {canResolve ? (
        <div className="mt-4 flex justify-end">
          {isResolving ? (
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-2xl bg-slate-400 px-4 py-2 text-sm font-medium text-white"
            >
              Resolving...
            </button>
          ) : confirmingResolve ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleConfirmResolve}
                className="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
              >
                Confirm Resolve Alert
              </button>

              <button
                type="button"
                onClick={() => setConfirmingResolve(false)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingResolve(true)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Resolve Alert Only
            </button>
          )}
        </div>
      ) : null}

      {resolveError ? (
        <div className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ring-1 ring-rose-100">
          {resolveError}
        </div>
      ) : null}
    </div>
  );
}

function AlertGroup({
  title,
  description,
  count,
  tone,
  children,
}: {
  title: string;
  description: string;
  count: number;
  tone: "red" | "amber" | "blue" | "green" | "slate";
  children: React.ReactNode;
}) {
  const toneClasses = {
    red: "border-rose-200 bg-rose-50 text-rose-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
  };

  return (
    <section className="space-y-3">
      <div
        className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${toneClasses[tone]}`}
      >
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>

          <p className="mt-0.5 text-xs opacity-80">{description}</p>
        </div>

        <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-white px-2 text-sm font-bold shadow-sm">
          {count}
        </span>
      </div>

      <div className="space-y-3">{children}</div>
    </section>
  );
}

function CreateFlagModal({
  open,
  onClose,
  onSave,
  securities,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (payload: {
    securityId: string | null;
    flagType: string;
    priority: string;
    description: string;
    reminderAt: string | null;
  }) => Promise<void>;
  securities: any[];
}) {
  const [associationType, setAssociationType] = useState<
    "GENERAL" | "SECURITY"
  >("GENERAL");

  const [securityId, setSecurityId] = useState("");
  const [securityQuery, setSecurityQuery] = useState("");
  const [isSecurityDropdownOpen, setIsSecurityDropdownOpen] = useState(false);
  const [highlightedSecurityIndex, setHighlightedSecurityIndex] = useState(0);

  const securityComboboxRef = useRef<HTMLDivElement | null>(null);

  const [flagType, setFlagType] = useState("REMINDER");
  const [priority, setPriority] = useState("MEDIUM");
  const [description, setDescription] = useState("");
  const [reminderAt, setReminderAt] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const flagTypes = [
    "REMINDER",
    "Agenda",
    "Risk Review",
    "Earnings Upcoming",
    "Valuation Stretched",
    "Thesis Changed",
    "Candidate",
    "Under Review",
    "Margin Pressure",
    "Credit Watch",
    "Quality Risk",
    "Event-driven",
    "Custom",
  ];

  const selectedSecurity =
    securities.find((security) => security.id === securityId) ?? null;

  const filteredSecurities = useMemo(() => {
    const normalizedQuery = securityQuery.trim().toLowerCase();

    return securities
      .filter((security) => {
        if (!normalizedQuery) {
          return true;
        }

        const searchable = [
          security.ticker,
          security.name,
          security.sector,
          security.industry,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchable.includes(normalizedQuery);
      })
      .slice(0, 50);
  }, [securities, securityQuery]);

  const isReminder = flagType.trim().toUpperCase() === "REMINDER";

  useEffect(() => {
    setHighlightedSecurityIndex(0);
  }, [securityQuery]);

  useEffect(() => {
    if (!open) {
      setIsSecurityDropdownOpen(false);
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;

      if (
        securityComboboxRef.current &&
        !securityComboboxRef.current.contains(target)
      ) {
        setIsSecurityDropdownOpen(false);

        setSecurityQuery(
          selectedSecurity
            ? `${selectedSecurity.ticker} — ${selectedSecurity.name}`
            : "",
        );
      }
    }

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [open, selectedSecurity]);

  function resetForm() {
    setAssociationType("GENERAL");
    setSecurityId("");
    setSecurityQuery("");
    setFlagType("REMINDER");
    setPriority("MEDIUM");
    setDescription("");
    setReminderAt("");
    setError("");
  }

  function handleClose() {
    if (isSaving) {
      return;
    }

    resetForm();
    onClose();
  }
  function handleSecurityChange(selectedSecurityId: string) {
    const security =
      securities.find((option) => option.id === selectedSecurityId) ?? null;

    setSecurityId(selectedSecurityId);

    setSecurityQuery(security ? `${security.ticker} — ${security.name}` : "");

    setIsSecurityDropdownOpen(false);
    setHighlightedSecurityIndex(0);
    setError("");
  }

  function handleClearSecurity() {
    setSecurityId("");
    setSecurityQuery("");
    setIsSecurityDropdownOpen(true);
    setHighlightedSecurityIndex(0);
    setError("");
  }

  function handleSecurityKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    const optionCount = filteredSecurities.length;

    if (event.key === "Escape") {
      setIsSecurityDropdownOpen(false);

      setSecurityQuery(
        selectedSecurity
          ? `${selectedSecurity.ticker} — ${selectedSecurity.name}`
          : "",
      );

      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsSecurityDropdownOpen(true);

      setHighlightedSecurityIndex((currentIndex) =>
        Math.min(currentIndex + 1, Math.max(optionCount - 1, 0)),
      );

      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsSecurityDropdownOpen(true);

      setHighlightedSecurityIndex((currentIndex) =>
        Math.max(currentIndex - 1, 0),
      );

      return;
    }

    if (event.key === "Enter" && isSecurityDropdownOpen) {
      event.preventDefault();

      const highlightedSecurity = filteredSecurities[highlightedSecurityIndex];

      if (highlightedSecurity) {
        handleSecurityChange(highlightedSecurity.id);
      }
    }
  }
  async function handleSave() {
    setError("");

    if (associationType === "SECURITY" && !securityId) {
      setError("Please select a Security.");
      return;
    }

    if (!flagType.trim()) {
      setError("Please select a flag type.");
      return;
    }

    if (isReminder && !description.trim()) {
      setError("A description is required for reminders.");
      return;
    }

    if (isReminder && !reminderAt) {
      setError("A reminder date and time are required.");
      return;
    }

    let serializedReminderAt: string | null = null;

    if (reminderAt) {
      const parsedReminderAt = new Date(reminderAt);

      if (Number.isNaN(parsedReminderAt.getTime())) {
        setError("Enter a valid reminder date and time.");
        return;
      }

      serializedReminderAt = parsedReminderAt.toISOString();
    }

    setIsSaving(true);

    try {
      await onSave({
        securityId: associationType === "SECURITY" ? securityId : null,
        flagType,
        priority,
        description,
        reminderAt: serializedReminderAt,
      });

      resetForm();
      onClose();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to create flag.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-xl overflow-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">
              New Flag / Reminder
            </h2>

            <p className="mt-1 text-sm leading-6 text-slate-500">
              Create a General operational item or associate it with a Security.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={isSaving}
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            ✕
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">
              Association
            </label>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setAssociationType("GENERAL");
                  setSecurityId("");
                  setSecurityQuery("");
                  setIsSecurityDropdownOpen(false);
                  setHighlightedSecurityIndex(0);
                  setError("");
                }}
                disabled={isSaving}
                className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${
                  associationType === "GENERAL"
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                General
              </button>

              <button
                type="button"
                onClick={() => {
                  setAssociationType("SECURITY");
                  setError("");
                }}
                disabled={isSaving}
                className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${
                  associationType === "SECURITY"
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                Security
              </button>
            </div>

            <p className="mt-1 text-xs text-slate-500">
              {associationType === "GENERAL"
                ? "This item will appear as General and will not be tied to a stock."
                : "This item will be associated with the selected Security."}
            </p>
          </div>

          {associationType === "SECURITY" ? (
            <div ref={securityComboboxRef} className="relative">
              <label className="text-sm font-medium text-slate-700">
                Security
              </label>

              <p className="mt-1 text-xs text-slate-500">
                Search by ticker, company, sector, or industry.
              </p>

              <div className="relative mt-2">
                <input
                  value={securityQuery}
                  onFocus={() => {
                    if (securityId) {
                      setSecurityQuery("");
                    }

                    setIsSecurityDropdownOpen(true);
                  }}
                  onChange={(event) => {
                    setSecurityQuery(event.target.value);

                    if (securityId) {
                      setSecurityId("");
                    }

                    setIsSecurityDropdownOpen(true);
                    setError("");
                  }}
                  onKeyDown={handleSecurityKeyDown}
                  placeholder="Search ticker, company, sector, or industry..."
                  autoComplete="off"
                  role="combobox"
                  aria-expanded={isSecurityDropdownOpen}
                  aria-controls="alert-security-options"
                  aria-autocomplete="list"
                  disabled={isSaving}
                  className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-4 pr-20 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50"
                />

                <div className="absolute inset-y-0 right-3 flex items-center gap-1">
                  {securityId || securityQuery ? (
                    <button
                      type="button"
                      onClick={handleClearSecurity}
                      disabled={isSaving}
                      aria-label="Clear selected security"
                      className="rounded-lg px-2 py-1 text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      ✕
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() =>
                      setIsSecurityDropdownOpen((current) => !current)
                    }
                    disabled={isSaving}
                    aria-label="Toggle security options"
                    className="rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    ▼
                  </button>
                </div>
              </div>

              {isSecurityDropdownOpen ? (
                <div
                  id="alert-security-options"
                  role="listbox"
                  className="absolute z-40 mt-2 max-h-80 w-full overflow-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl"
                >
                  {filteredSecurities.length ? (
                    filteredSecurities.map((security, index) => {
                      const isHighlighted = highlightedSecurityIndex === index;

                      const isSelected = securityId === security.id;

                      return (
                        <button
                          key={security.id}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onMouseEnter={() =>
                            setHighlightedSecurityIndex(index)
                          }
                          onMouseDown={(event) => {
                            event.preventDefault();
                            handleSecurityChange(security.id);
                          }}
                          className={`flex w-full items-start justify-between gap-4 rounded-xl px-3 py-2.5 text-left ${
                            isHighlighted || isSelected
                              ? "bg-slate-100"
                              : "hover:bg-slate-50"
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-slate-950">
                                {security.ticker}
                              </span>

                              {security.sector ? (
                                <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                                  {security.sector}
                                </span>
                              ) : null}
                            </div>

                            <p className="mt-0.5 truncate text-xs text-slate-600">
                              {security.name}
                            </p>

                            {security.industry ? (
                              <p className="mt-0.5 truncate text-[11px] text-slate-400">
                                {security.industry}
                              </p>
                            ) : null}
                          </div>

                          {isSelected ? (
                            <span className="shrink-0 text-sm font-semibold text-emerald-600">
                              ✓
                            </span>
                          ) : null}
                        </button>
                      );
                    })
                  ) : (
                    <div className="px-4 py-6 text-center">
                      <p className="text-sm font-medium text-slate-700">
                        No securities matched
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Try another ticker, company, sector, or industry.
                      </p>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}

          <div>
            <label className="text-sm font-medium text-slate-700">
              Flag Type
            </label>

            <select
              value={flagType}
              onChange={(event) => {
                setFlagType(event.target.value);
                setError("");
              }}
              disabled={isSaving}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50"
            >
              {flagTypes.map((type) => (
                <option key={type} value={type}>
                  {type === "REMINDER" ? "Reminder" : type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Priority
            </label>

            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
              disabled={isSaving}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Date and Time{" "}
              {isReminder ? (
                <span className="text-rose-600">*</span>
              ) : (
                <span className="font-normal text-slate-400">— Optional</span>
              )}
            </label>

            <input
              value={reminderAt}
              onChange={(event) => setReminderAt(event.target.value)}
              type="datetime-local"
              required={isReminder}
              disabled={isSaving}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50"
            />

            <p className="mt-1 text-xs text-slate-500">
              {isReminder
                ? "Required for reminders."
                : "Optional for regular flags."}
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Description{" "}
              {isReminder ? <span className="text-rose-600">*</span> : null}
            </label>

            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={isSaving}
              className="mt-2 h-28 w-full resize-none rounded-2xl border border-slate-200 p-4 text-sm outline-none focus:ring-2 focus:ring-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50"
              placeholder={
                isReminder
                  ? "Describe what needs to be remembered..."
                  : "Describe why this item needs attention..."
              }
            />
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSaving}
            className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving
              ? "Saving..."
              : isReminder
                ? "Create Reminder"
                : "Create Flag"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AlertsClient({
  initialFlags,
  securities,
}: AlertsClientProps) {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [flags, setFlags] = useState<any[]>(initialFlags);
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [isCreateFlagOpen, setIsCreateFlagOpen] = useState(false);
  const [queueRemainingFlag, setQueueRemainingFlag] = useState<any | null>(
    null,
  );
  useEffect(() => {
    async function loadCurrentUser() {
      const response = await fetch("/api/auth/me");

      if (!response.ok) return;

      const data = await response.json();
      setCurrentUser(data.user);
    }

    loadCurrentUser();
  }, []);
  async function handleCreateFlag(payload: {
    securityId: string | null;
    flagType: string;
    priority: string;
    description: string;
    reminderAt: string | null;
  }) {
    const response = await fetch("/api/flags", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        securityId: payload.securityId,
        positionId: null,
        watchlistEntryId: null,
        flagType: payload.flagType,
        priority: payload.priority,
        description: payload.description,
        reminderAt: payload.reminderAt,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to create flag.");
    }

    setFlags((currentFlags) => [
      data.flag,
      ...currentFlags.filter((flag) => flag.id !== data.flag.id),
    ]);
  }
  const filteredFlags = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const sortedFlags = [...flags].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    if (!normalizedQuery) return sortedFlags;

    return sortedFlags.filter((flag) => {
      const searchable = [
        flag.security?.ticker,
        flag.security?.name,
        flag.security ? null : "General",
        flag.metadataJson,
        isPtProximityAlert(flag) ? "PT Alert Price Target Proximity" : null,
        isTradeQueueExecutionAlert(flag)
          ? "Trade Queue Alert Execution Threshold"
          : null,
        flag.flagType,
        flag.description,
        flag.priority,
        flag.status,
        flag.reminderAt,
        getContextLabel(flag),
        flag.createdBy?.name,
        flag.createdBy?.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(normalizedQuery);
    });
  }, [flags, query]);

  const openFlags = flags.filter((flag) => flag.status === "OPEN");

  const highPriority = flags.filter((flag) => flag.priority === "HIGH");

  const userCanResolveFlags = canCreateFlags(currentUser?.role);

  const now = new Date();

  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );

  const startOfTomorrow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  );

  const endOfUpcomingWindow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 8,
  );

  const overdueFlags = filteredFlags.filter((flag) => {
    if (!flag.reminderAt) return false;

    const reminderDate = new Date(flag.reminderAt);

    return reminderDate < startOfToday;
  });

  const todayFlags = filteredFlags.filter((flag) => {
    if (!flag.reminderAt) return false;

    const reminderDate = new Date(flag.reminderAt);

    return reminderDate >= startOfToday && reminderDate < startOfTomorrow;
  });

  const upcomingFlags = filteredFlags.filter((flag) => {
    if (!flag.reminderAt) return false;

    const reminderDate = new Date(flag.reminderAt);

    return (
      reminderDate >= startOfTomorrow && reminderDate < endOfUpcomingWindow
    );
  });

  const laterFlags = filteredFlags.filter((flag) => {
    if (!flag.reminderAt) return false;

    const reminderDate = new Date(flag.reminderAt);

    return reminderDate >= endOfUpcomingWindow;
  });

  const tradeQueueAlertFlags = filteredFlags.filter(
    (flag) => flag.status === "OPEN" && isTradeQueueExecutionAlert(flag),
  );

  const ptAlertFlags = filteredFlags.filter(
    (flag) => flag.status === "OPEN" && isPtProximityAlert(flag),
  );

  const agendaFlags = filteredFlags.filter(
    (flag) => flag.status === "OPEN" && flag.flagType === "Agenda",
  );

  const undatedFlags = filteredFlags.filter(
    (flag) =>
      !flag.reminderAt &&
      flag.flagType !== "Agenda" &&
      !isPtProximityAlert(flag) &&
      !isTradeQueueExecutionAlert(flag),
  );

  const dueSoonCount =
    overdueFlags.length + todayFlags.length + upcomingFlags.length;

  async function handleAcceptWells(flagId: string) {
    const response = await fetch(
      `/api/trade-reconciliation/${flagId}/accept-wells`,
      {
        method: "POST",
      },
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to accept Wells trade.");
    }

    const resolvedFlag = data.flag;

    setFlags((currentFlags) =>
      currentFlags.map((flag) =>
        flag.id === resolvedFlag.id ? resolvedFlag : flag,
      ),
    );
  }
  function handleQueueRemainingCompleted(result: {
    flag: any;
    queueItem: any;
  }) {
    setFlags((currentFlags) =>
      currentFlags.map((flag) =>
        flag.id === result.flag.id ? result.flag : flag,
      ),
    );

    setQueueRemainingFlag(null);
  }
  async function handleKeepManual(flagId: string) {
    const response = await fetch(
      `/api/trade-reconciliation/${flagId}/keep-manual`,
      {
        method: "POST",
      },
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to keep manual trade.");
    }

    const resolvedFlag = data.flag;

    setFlags((currentFlags) =>
      currentFlags.map((flag) =>
        flag.id === resolvedFlag.id ? resolvedFlag : flag,
      ),
    );
  }

  async function handleResolveFlag(flagId: string) {
    const response = await fetch(`/api/flags/${flagId}/resolve`, {
      method: "POST",
    });

    if (!response.ok) {
      throw new Error("Failed to resolve flag.");
    }

    const data = await response.json();
    const resolvedFlag = data.flag;

    setFlags((currentFlags) =>
      currentFlags.map((flag) =>
        flag.id === resolvedFlag.id ? resolvedFlag : flag,
      ),
    );
  }

  function handleOpenTradeQueue(flag: any) {
    const metadata = parseFlagMetadata(flag);

    const tradeQueueItemId =
      flag.tradeQueueItemId || metadata?.tradeQueueItemId || null;

    if (!tradeQueueItemId) {
      window.alert("This alert does not include a Trade Queue item ID.");
      return;
    }

    router.push(`/trades?queueItem=${encodeURIComponent(tradeQueueItemId)}`);
  }

  function renderFlag(flag: any) {
    if (isTradeQueueExecutionAlert(flag)) {
      return (
        <TradeQueueExecutionAlertCard
          key={flag.id}
          flag={flag}
          onResolve={handleResolveFlag}
          onOpenTradeQueue={handleOpenTradeQueue}
          canResolve={userCanResolveFlags}
        />
      );
    }

    if (isPtProximityAlert(flag)) {
      return (
        <PtProximityAlertCard
          key={flag.id}
          flag={flag}
          onResolve={handleResolveFlag}
          canResolve={userCanResolveFlags}
        />
      );
    }

    if (flag.flagType === "Trade Reconciliation Review") {
      return (
        <TradeReconciliationAlertCard
          key={flag.id}
          flag={flag}
          onAcceptWells={handleAcceptWells}
          onKeepManual={handleKeepManual}
          onQueueRemaining={setQueueRemainingFlag}
          canResolve={userCanResolveFlags}
        />
      );
    }

    return (
      <AlertCard
        key={flag.id}
        flag={flag}
        onResolve={handleResolveFlag}
        canResolve={userCanResolveFlags}
      />
    );
  }
  return (
    <main className="h-screen overflow-hidden bg-slate-100 text-slate-900">
      <div className="flex h-full">
        <AppSidebar activePage="/alerts" />

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-20 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
            <div>
              <p className="text-sm font-medium text-slate-900">Alert Center</p>
              <p className="text-xs text-slate-500">
                Open flags and review workflow
              </p>
            </div>

            <div className="ml-4 flex items-center gap-3">
              <CurrentUserPill />
            </div>
          </header>

          <div className="min-w-0 flex-1 overflow-auto p-6">
            <div className="space-y-5">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-semibold tracking-tight">
                    Alert Center
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Review flags and reminders across Securities, positions,
                    watchlists, and General operations.
                  </p>
                </div>

                {userCanResolveFlags ? (
                  <button
                    type="button"
                    onClick={() => setIsCreateFlagOpen(true)}
                    className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                  >
                    New Flag / Reminder
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="cursor-not-allowed rounded-2xl bg-slate-200 px-4 py-2 text-sm font-medium text-slate-500"
                  >
                    Read Only
                  </button>
                )}
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Total Alerts
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    {openFlags.length}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Open flags and reminders
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Open
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-rose-600">
                    {openFlags.length}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Require review</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    High Priority
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-amber-600">
                    {highPriority.length}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Open items requiring attention
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Due Soon
                  </p>

                  <p className="mt-2 text-2xl font-semibold text-violet-600">
                    {dueSoonCount}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Overdue, today, or next 7 days
                  </p>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search ticker, General, reminder, alert type, priority, description, or date..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div className="space-y-3">
                {filteredFlags.length ? (
                  <div className="space-y-6">
                    {overdueFlags.length ? (
                      <AlertGroup
                        title="Overdue"
                        description="Open items dated before today"
                        count={overdueFlags.length}
                        tone="red"
                      >
                        {overdueFlags.map(renderFlag)}
                      </AlertGroup>
                    ) : null}

                    {todayFlags.length ? (
                      <AlertGroup
                        title="Today"
                        description="Open items due today"
                        count={todayFlags.length}
                        tone="amber"
                      >
                        {todayFlags.map(renderFlag)}
                      </AlertGroup>
                    ) : null}

                    {upcomingFlags.length ? (
                      <AlertGroup
                        title="Next 7 Days"
                        description="Open items due during the next seven calendar days"
                        count={upcomingFlags.length}
                        tone="blue"
                      >
                        {upcomingFlags.map(renderFlag)}
                      </AlertGroup>
                    ) : null}

                    {laterFlags.length ? (
                      <AlertGroup
                        title="Later"
                        description="Dated items beyond the upcoming seven-day window"
                        count={laterFlags.length}
                        tone="slate"
                      >
                        {laterFlags.map(renderFlag)}
                      </AlertGroup>
                    ) : null}
                    {tradeQueueAlertFlags.length ? (
                      <AlertGroup
                        title="Trade Queue Alerts"
                        description="Queued trades whose action-aware execution thresholds have been reached"
                        count={tradeQueueAlertFlags.length}
                        tone="green"
                      >
                        {tradeQueueAlertFlags.map(renderFlag)}
                      </AlertGroup>
                    ) : null}
                    {ptAlertFlags.length ? (
                      <AlertGroup
                        title="PT Alerts"
                        description="Securities within 2% of a monitored entry, exit, or discussion price target"
                        count={ptAlertFlags.length}
                        tone="blue"
                      >
                        {ptAlertFlags.map(renderFlag)}
                      </AlertGroup>
                    ) : null}
                    {agendaFlags.length ? (
                      <AlertGroup
                        title="Agenda"
                        description="Open operational items and ongoing work"
                        count={agendaFlags.length}
                        tone="green"
                      >
                        {agendaFlags.map(renderFlag)}
                      </AlertGroup>
                    ) : null}
                    {undatedFlags.length ? (
                      <AlertGroup
                        title="No Date"
                        description="Open flags without a scheduled date or time"
                        count={undatedFlags.length}
                        tone="slate"
                      >
                        {undatedFlags.map(renderFlag)}
                      </AlertGroup>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
                    No alerts matched your search.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
      <CreateFlagModal
        open={isCreateFlagOpen}
        onClose={() => setIsCreateFlagOpen(false)}
        onSave={handleCreateFlag}
        securities={securities}
      />
      {queueRemainingFlag ? (
        <QueueReconciliationRemainingModal
          flag={queueRemainingFlag}
          onClose={() => setQueueRemainingFlag(null)}
          onQueued={handleQueueRemainingCompleted}
        />
      ) : null}
    </main>
  );
}
