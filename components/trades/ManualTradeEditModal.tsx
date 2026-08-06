"use client";

import { useState } from "react";
import Badge from "@/components/common/Badge";

type ManualTradeEditModalProps = {
  trade: any;
  onClose: () => void;
  onSaved: (trade: any) => void;
};

const TRADE_ACTIONS = ["BUY", "SELL", "SHORT", "COVER"] as const;

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

function formatMoney(value: number | null | undefined) {
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

function actionTone(tradeType: string) {
  if (tradeType === "SELL" || tradeType === "SHORT") {
    return "red";
  }

  return "green";
}

export default function ManualTradeEditModal({
  trade,
  onClose,
  onSaved,
}: ManualTradeEditModalProps) {
  const initialTradeType =
    TRADE_ACTIONS.find((tradeAction) => tradeAction === trade.tradeType) ||
    "BUY";

  const [tradeType, setTradeType] =
    useState<(typeof TRADE_ACTIONS)[number]>(initialTradeType);

  const [sharesInput, setSharesInput] = useState(
    String(Math.abs(Number(trade.shares) || 0)),
  );

  const [avgPriceInput, setAvgPriceInput] = useState(
    String(trade.avgPrice ?? ""),
  );

  const [dateTradedInput, setDateTradedInput] = useState(
    getLocalDateTimeInputValue(trade.dateTraded),
  );

  const [commentInput, setCommentInput] = useState(trade.comment || "");

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const shares = Number(sharesInput);
  const avgPrice = Number(avgPriceInput);

  const estimatedSignedShares =
    Number.isFinite(shares) && shares > 0
      ? tradeType === "SELL" || tradeType === "SHORT"
        ? -Math.abs(shares)
        : Math.abs(shares)
      : null;

  const estimatedNotional =
    estimatedSignedShares != null && Number.isFinite(avgPrice) && avgPrice > 0
      ? estimatedSignedShares * avgPrice
      : null;

  async function handleSave() {
    if (!Number.isFinite(shares) || shares <= 0) {
      setSaveError("Shares must be greater than zero.");
      return;
    }

    if (!Number.isInteger(shares)) {
      setSaveError("Shares must be a whole number.");
      return;
    }

    if (!Number.isFinite(avgPrice) || avgPrice <= 0) {
      setSaveError("Average price must be greater than zero.");
      return;
    }

    const dateTraded = serializeLocalDateTime(dateTradedInput);

    if (!dateTraded) {
      setSaveError("Trade date and time must be valid.");
      return;
    }

    try {
      setIsSaving(true);
      setSaveError("");

      const response = await fetch(`/api/trades/manual/${trade.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          tradeType,
          shares,
          avgPrice,
          dateTraded,
          comment: commentInput,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update manual trade.");
      }

      if (!data.trade) {
        throw new Error("The update response did not include the Trade.");
      }

      onSaved(data.trade);
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Failed to update manual trade.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 p-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-semibold text-slate-950">
                Edit Manual Pending Trade
              </h3>

              <Badge tone={actionTone(tradeType) as any}>{tradeType}</Badge>

              <Badge tone="amber">Manual Pending</Badge>
            </div>

            <p className="mt-1 text-sm text-slate-500">
              {trade.ticker || trade.security?.ticker || "Unknown"} -{" "}
              {trade.company || trade.security?.name || "Unknown Security"}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close manual trade editor"
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-auto p-6">
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Immutable Associations
            </p>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Security
                </p>

                <p className="mt-1 font-semibold text-slate-950">
                  {trade.ticker || trade.security?.ticker || "—"}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Position
                </p>

                <p
                  title={trade.positionId || ""}
                  className="mt-1 truncate font-semibold text-slate-950"
                >
                  {trade.side || "Active Position"}
                </p>
              </div>
            </div>

            <p className="mt-3 text-xs leading-5 text-slate-500">
              The Security and Position cannot be changed. This record will
              remain a Manual Pending Trade after the edit.
            </p>
          </section>

          <section>
            <label className="text-sm font-medium text-slate-700">
              Trade Action
            </label>

            <div className="mt-2 grid grid-cols-4 gap-2">
              {TRADE_ACTIONS.map((action) => (
                <button
                  key={action}
                  type="button"
                  onClick={() => setTradeType(action)}
                  disabled={isSaving}
                  className={`rounded-2xl px-3 py-3 text-sm font-medium ${
                    tradeType === action
                      ? action === "SELL" || action === "SHORT"
                        ? "bg-rose-700 text-white"
                        : "bg-emerald-700 text-white"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  {action}
                </button>
              ))}
            </div>
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
                inputMode="numeric"
                min="1"
                step="1"
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50"
              />

              <p className="mt-1 text-xs text-slate-500">
                Enter a positive whole-share quantity. The server applies the
                correct sign for the selected action.
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Average Execution Price
              </label>

              <div className="relative mt-2">
                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm text-slate-400">
                  $
                </span>

                <input
                  value={avgPriceInput}
                  onChange={(event) => setAvgPriceInput(event.target.value)}
                  disabled={isSaving}
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  className="w-full rounded-2xl border border-slate-200 py-3 pl-8 pr-4 text-sm outline-none focus:ring-2 focus:ring-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Trade Date and Time
            </label>

            <input
              type="datetime-local"
              value={dateTradedInput}
              onChange={(event) => setDateTradedInput(event.target.value)}
              disabled={isSaving}
              step="60"
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Trade Note
            </label>

            <textarea
              value={commentInput}
              onChange={(event) => setCommentInput(event.target.value)}
              disabled={isSaving}
              placeholder="Optional trade note..."
              className="mt-2 h-28 w-full resize-none rounded-2xl border border-slate-200 p-4 text-sm outline-none focus:ring-2 focus:ring-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50"
            />
          </div>

          <section className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
              Revised Trade Summary
            </p>

            <div className="mt-3 grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-white p-3 ring-1 ring-violet-100">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Signed Shares
                </p>

                <p className="mt-1 font-semibold tabular-nums text-slate-950">
                  {estimatedSignedShares != null
                    ? estimatedSignedShares.toLocaleString("en-US")
                    : "—"}
                </p>
              </div>

              <div className="rounded-xl bg-white p-3 ring-1 ring-violet-100">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Average Price
                </p>

                <p className="mt-1 font-semibold tabular-nums text-slate-950">
                  {Number.isFinite(avgPrice) && avgPrice > 0
                    ? formatMoney(avgPrice)
                    : "—"}
                </p>
              </div>

              <div className="rounded-xl bg-white p-3 ring-1 ring-violet-100">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Signed Notional
                </p>

                <p className="mt-1 font-semibold tabular-nums text-slate-950">
                  {formatMoney(estimatedNotional)}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
            <p className="font-semibold">Pending reconciliation record</p>

            <p className="mt-1">
              Saving will update this unreconciled Manual Pending Trade and
              create an audit record. The Trade will still require later Wells
              reconciliation.
            </p>
          </section>

          <section className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm leading-6 text-violet-800">
            This edit does not place a broker order and does not directly modify
            Wells-authoritative Position shares, WAP, market value, portfolio
            weight, cost basis, tax lots, or P&amp;L.
          </section>

          {saveError ? (
            <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">
              {saveError}
            </section>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 p-4">
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
            {isSaving ? "Saving..." : "Save Trade"}
          </button>
        </div>
      </div>
    </div>
  );
}
