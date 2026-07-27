"use client";

import { useMemo, useState, useEffect } from "react";
import Badge from "@/components/common/Badge";
import LocalDateTime from "@/components/common/LocalDateTime";
import { getDisplayCurrentPrice } from "@/lib/dashboard/position-metrics";
import {
  buildTradeHistoryAnalytics,
  type TradeHistoryRow,
} from "@/lib/dashboard/trade-history-analytics";

type TradeFilter = "ALL" | "ENTRIES" | "EXITS";
type TradeSort = "NEWEST" | "OLDEST";

type ExpandedTradeHistoryModalProps = {
  position: any | null;
  onClose: () => void;
  onTradeDeleted: (
    positionId: string,
    tradeId: string
  ) => void;
  onTradeNoteUpdated: (
    positionId: string,
    tradeId: string,
    comment: string | null
  ) => void;
};

function formatMoney(
  value: number | null | undefined
) {
  if (
    value == null ||
    !Number.isFinite(value)
  ) {
    return "—";
  }

  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function formatPrice(
  value: number | null | undefined
) {
  if (
    value == null ||
    !Number.isFinite(value)
  ) {
    return "—";
  }

  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatNumber(
  value: number | null | undefined
) {
  if (
    value == null ||
    !Number.isFinite(value)
  ) {
    return "—";
  }

  return value.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });
}
function formatSignedNumber(
  value: number | null | undefined
) {
  if (
    value == null ||
    !Number.isFinite(value)
  ) {
    return "—";
  }

  if (Math.abs(value) < 0.000001) {
    return "—";
  }

  const formattedValue = Math.abs(
    value
  ).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });

  return `${value > 0 ? "+" : "-"}${formattedValue}`;
}
``
function formatPercent(
  value: number | null | undefined
) {
  if (
    value == null ||
    !Number.isFinite(value)
  ) {
    return "—";
  }

  return `${value >= 0 ? "+" : ""}${value.toFixed(
    1
  )}%`;
}

function percentageClass(
  value: number | null | undefined
) {
  if (value == null) {
    return "text-slate-500";
  }

  return value >= 0
    ? "text-emerald-600"
    : "text-rose-600";
}
function signedValueClass(
  value: number | null | undefined
) {
  if (
    value == null ||
    Math.abs(value) < 0.000001
  ) {
    return "text-slate-500";
  }

  return value > 0
    ? "text-emerald-600"
    : "text-rose-600";
}
function sourceTone(source?: string | null) {
  if (source === "WELLS_FARGO") {
    return "green";
  }

  if (source === "MANUAL") {
    return "amber";
  }

  if (source === "SYSTEM") {
    return "blue";
  }

  return "slate";
}

function formatSource(source?: string | null) {
  if (source === "WELLS_FARGO") {
    return "Wells";
  }

  if (source === "MANUAL") {
    return "Manual";
  }

  if (source === "SYSTEM") {
    return "System Generated";
  }

  return source || "Unknown";
}

function reconciliationTone(
  status?: string | null,
  source?: string | null
) {
 if (
    source === "SYSTEM" &&
    status === "MANUAL_PENDING"
  ) {
    return "blue";
  }

  if (status === "MATCHED") {
    return "blue";
  }

  if (status === "REVIEW_REQUIRED") {
    return "red";
  }

  if (status === "MANUAL_PENDING") {
    return "amber";
  }

  return "slate";
}

function formatReconciliationStatus(
  status?: string | null,
  source?: string | null
) {
  if (
    source === "SYSTEM" &&
    status === "MANUAL_PENDING"
  ) {
    return "Pending Completion";
  }

  if (!status) {
    return "—";
  }

  return status
    .split("_")
    .map(
      (word) =>
        `${word.charAt(0)}${word
          .slice(1)
          .toLowerCase()}`
    )
    .join(" ");
}

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: React.ReactNode;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <div className="mt-2 text-xl font-semibold text-slate-950">
        {value}
      </div>

      <p className="mt-1 text-xs text-slate-500">
        {detail}
      </p>
    </div>
  );
}

function TradeHistoryTableRow({
  row,
  confirmDeleteTradeId,
  setConfirmDeleteTradeId,
  deletingTradeId,
  onDeleteTrade,
  onEditNote,
}: {
  row: TradeHistoryRow;
  confirmDeleteTradeId: string | null;
  setConfirmDeleteTradeId: (
    id: string | null
  ) => void;
  deletingTradeId: string | null;
  onDeleteTrade: (
    tradeId: string
  ) => Promise<void>;
  onEditNote: (trade: any) => void;
}) {
  return (
    <div className="grid min-w-[1800px] grid-cols-13 items-center gap-1 border-b border-slate-100 px-4 py-3 text-xs last:border-b-0 hover:bg-slate-50">
      <div>
        <LocalDateTime
          value={row.trade.dateTraded}
          className="text-xs text-slate-700"
        />
      </div>

    <div className="flex flex-col items-start gap-1">
        <Badge
          tone={
            row.isEntry
              ? "green"
              : row.isExit
                ? "red"
                : "slate"
          }
        >
          {row.tradeType}
        </Badge>

       <span
        className={`text-[10px] font-semibold uppercase tracking-wide ${
          row.isPendingManual
            ? "text-violet-600"
            : "text-slate-400"
        }`}
      >
        {row.trade.source === "SYSTEM" &&
        row.trade.reconciliationStatus ===
          "MANUAL_PENDING"
          ? "Completion Remaining"
          : row.isPendingManual
            ? "Projected"
            : "History"}
      </span>
      </div>

      <div className="font-medium text-slate-950">
        {formatNumber(row.absoluteShares)}
      </div>

      <div>
        {formatPrice(row.trade.avgPrice)}
      </div>

      <div>{formatMoney(row.notional)}</div>

      <div>
        {formatNumber(row.positionBefore)}
      </div>

      <div>
        {formatNumber(row.positionAfter)}
      </div>

      <div
        className={`font-semibold ${
          row.positionChangePct == null
            ? "text-slate-600"
            : percentageClass(
                row.positionChangePct
              )
        }`}
      >
        {row.positionChangeLabel}
      </div>

      <div
        className={`font-semibold ${percentageClass(
          row.executionVsCurrentPct
        )}`}
      >
        {formatPercent(
          row.executionVsCurrentPct
        )}
      </div>

      <div>
        <Badge
          tone={
            sourceTone(
              row.trade.source
            ) as
              | "green"
              | "amber"
              | "blue"
              | "slate"
          }
        >
          {formatSource(row.trade.source)}
        </Badge>
      </div>

     <div>
      {row.trade.reconciliationStatus ? (
        <Badge
          tone={
            reconciliationTone(
              row.trade.reconciliationStatus,
              row.trade.source
            ) as
              | "blue"
              | "red"
              | "amber"
              | "slate"
          }
        >
          {formatReconciliationStatus(
            row.trade.reconciliationStatus,
            row.trade.source
          )}
        </Badge>
      ) : (
        <span className="text-slate-400">
          —
        </span>
      )}
    </div>

      <div
        title={row.trade.comment || ""}
        className="truncate text-slate-500"
      >
        {row.trade.comment || "—"}
      </div>
      <div className="flex items-center gap-1">
        {row.trade.source === "MANUAL" &&
        row.trade.reconciliationStatus ===
          "MANUAL_PENDING" ? (
          <>
            <button
              type="button"
              onClick={() => onEditNote(row.trade)}
              className="rounded-xl bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
            >
              {row.trade.comment
                ? "Edit Note"
                : "Add Note"}
            </button>

            {deletingTradeId === row.trade.id ? (
              <span className="text-xs font-semibold text-slate-500">
                Deleting...
              </span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (
                    confirmDeleteTradeId ===
                    row.trade.id
                  ) {
                    onDeleteTrade(
                      row.trade.id
                    );
                    return;
                  }

                  setConfirmDeleteTradeId(
                    row.trade.id
                  );
                }}
                className={`inline-flex items-center justify-center rounded-xl ${
                  confirmDeleteTradeId ===
                  row.trade.id
                    ? "bg-rose-600 text-white hover:bg-rose-700"
                    : "h-8 w-8 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                }`}
              >
                {confirmDeleteTradeId ===
                  row.trade.id ? (
                    "Confirm"
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 6h18" />
                      <path d="M8 6V4h8v2" />
                      <path d="M6 6l1 15h10l1-15" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                    </svg>
                  )}
              </button>
            )}
          </>
        ) : (
          <span className="text-slate-400">
            —
          </span>
        )}
      </div>

    </div>
  );
}

export default function ExpandedTradeHistoryModal({
  position,
  onClose,
  onTradeDeleted,
  onTradeNoteUpdated,
}: ExpandedTradeHistoryModalProps) {

  const [tradeFilter, setTradeFilter] =
    useState<TradeFilter>("ALL");

  const [tradeSort, setTradeSort] =
    useState<TradeSort>("NEWEST");

  const [
    hiddenTradeIds,
    setHiddenTradeIds,
  ] = useState<string[]>([]);
  const [localTrades, setLocalTrades] =
  useState<any[]>([]);

  const [
    confirmDeleteTradeId,
    setConfirmDeleteTradeId,
  ] = useState<string | null>(null);

  const [
    deletingTradeId,
    setDeletingTradeId,
  ] = useState<string | null>(null);

  const [editingTrade, setEditingTrade] =
  useState<any | null>(null);

  const [tradeNote, setTradeNote] =
    useState("");

  useEffect(() => {
    if (!confirmDeleteTradeId) {
      return;
    }

    const timeout = setTimeout(() => {
      setConfirmDeleteTradeId(null);
    }, 5000);

    return () => clearTimeout(timeout);
  }, [confirmDeleteTradeId]);

  useEffect(() => {
    setLocalTrades(
      Array.isArray(position?.trades)
        ? position.trades
        : []
    );
  }, [position]);

  const currentPrice = position
    ? getDisplayCurrentPrice(position)
    : null;

    const visibleTrades = useMemo(
      () =>
        localTrades.filter(
        (trade: any) =>
          !hiddenTradeIds.includes(
            trade.id
          )
      ),
    [localTrades, hiddenTradeIds]
  );

  const analytics = useMemo(
    () =>
      buildTradeHistoryAnalytics({
        positionSide:
          position?.side || "LONG",
        currentShares:
          position?.shares ?? null,
        currentPrice,
        trades: visibleTrades,
      }),
    [
      position,
      currentPrice,
      visibleTrades,
    ]
  );

  async function handleDeleteTrade(
    tradeId: string
  ) {
    try {
      setDeletingTradeId(tradeId);

      const response = await fetch(
        `/api/trades/manual/${tradeId}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to delete trade."
        );
      }

      setHiddenTradeIds(
        (currentIds) => [
          ...currentIds,
          tradeId,
        ]
      );
      onTradeDeleted(
        position.id,
        tradeId
      );

      setConfirmDeleteTradeId(null);
    } finally {
      setDeletingTradeId(null);
    }
  }
  async function handleSaveTradeNote() {
    if (!editingTrade) {
      return;
    }

    const response = await fetch(
      `/api/trades/manual/${editingTrade.id}/note`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          comment: tradeNote,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      window.alert(
        data.error ||
          "Failed to save trade note."
      );

      return;
    }

    setLocalTrades((currentTrades) =>
      currentTrades.map((trade) =>
        trade.id === editingTrade.id
          ? {
              ...trade,
              comment:
                tradeNote || null,
            }
          : trade
      )
    );
    onTradeNoteUpdated(
      position.id,
      editingTrade.id,
      tradeNote || null
    );

    setEditingTrade(null);
  }
  const displayedRows = useMemo(() => {
    const filteredRows =
      analytics.rows.filter((row) => {
        if (tradeFilter === "ENTRIES") {
          return row.isEntry;
        }

        if (tradeFilter === "EXITS") {
          return row.isExit;
        }

        return true;
      });

    if (tradeSort === "OLDEST") {
      return [...filteredRows].reverse();
    }

    return filteredRows;
  }, [
    analytics.rows,
    tradeFilter,
    tradeSort,
  ]);

  if (!position) {
    return null;
  }

  const isShort =
    position.side === "SHORT";

  const entryLabel = isShort
    ? "Avg Short Price"
    : "Avg Buy Price";

  const exitLabel = isShort
    ? "Avg Cover Price"
    : "Avg Sell Price";

  const currentExposure =
    Math.abs(Number(position.shares) || 0);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-[1800px] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white p-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold text-slate-950">
                Expanded Trade History
              </h2>

              <Badge
                tone={
                  isShort ? "red" : "green"
                }
              >
                {position.side}
              </Badge>
            </div>

            <p className="mt-1 text-sm text-slate-500">
              {position.security.ticker} •{" "}
              {position.security.name}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
                    <section>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-8">
              <SummaryCard
                label="Wells Position"
                value={
                  <span>
                    {formatNumber(
                      analytics.wellsExposure
                    )}{" "}
                    <span className="text-sm text-slate-500">
                      {isShort
                        ? "Short"
                        : "Long"}
                    </span>
                  </span>
                }
                detail="Authoritative Wells exposure"
              />

              <SummaryCard
                label="Pending Manual Delta"
                value={
                  <span
                    className={signedValueClass(
                      analytics.pendingManualDelta
                    )}
                  >
                    {formatSignedNumber(
                      analytics.pendingManualDelta
                    )}
                  </span>
                }
                detail="Net unreconciled adjustment"
              />

              <SummaryCard
                label="Projected Position"
                value={
                  analytics.projectedExposure !=
                  null ? (
                    <span>
                      {formatNumber(
                        analytics.projectedExposure
                      )}{" "}
                      <span className="text-sm text-slate-500">
                        {isShort
                          ? "Short"
                          : "Long"}
                      </span>
                    </span>
                  ) : (
                    "Invalid"
                  )
                }
                detail="Wells plus pending manual trades"
              />

              <SummaryCard
                label="Pending Trades"
                value={
                  analytics.pendingTradeCount
                }
                detail="Awaiting reconciliation"
              />

              <SummaryCard
                label="Trade Count"
                value={analytics.tradeCount}
                detail={`${analytics.entryTradeCount} entries • ${analytics.exitTradeCount} exits`}
              />

              <SummaryCard
                label="Gross Notional"
                value={formatMoney(
                  analytics.grossTradeNotional
                )}
                detail="Absolute traded notional"
              />

              <SummaryCard
                label={entryLabel}
                value={formatPrice(
                  analytics.weightedEntryPrice
                )}
                detail="Share-weighted entries"
              />

              <SummaryCard
                label={exitLabel}
                value={formatPrice(
                  analytics.weightedExitPrice
                )}
                detail="Share-weighted exits"
              />
            </div>

            <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              Total visible share activity:{" "}
              <span className="font-semibold text-slate-950">
                {formatNumber(
                  analytics.totalSharesTraded
                )}
              </span>{" "}
              shares across{" "}
              <span className="font-semibold text-slate-950">
                {analytics.tradeCount}
              </span>{" "}
              visible trades.
            </div>
          </section>

          <section className="mt-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <p className="text-xs text-slate-500">
                  First Trade
                </p>

                <div className="mt-1 font-semibold text-slate-950">
                  <LocalDateTime
                    value={
                      analytics.firstTradeAt
                    }
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <p className="text-xs text-slate-500">
                  Most Recent Trade
                </p>

                <div className="mt-1 font-semibold text-slate-950">
                  <LocalDateTime
                    value={
                      analytics.mostRecentTradeAt
                    }
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <p className="text-xs text-slate-500">
                  Days Since Last Trade
                </p>

                <p className="mt-1 font-semibold text-slate-950">
                  {analytics.daysSinceLastTrade ??
                    "—"}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <p className="text-xs text-slate-500">
                  Largest Add
                </p>

                <p
                  className={`mt-1 font-semibold ${percentageClass(
                    analytics.largestAddPct
                  )}`}
                >
                  {formatPercent(
                    analytics.largestAddPct
                  )}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <p className="text-xs text-slate-500">
                  Largest Reduction
                </p>

                <p
                  className={`mt-1 font-semibold ${percentageClass(
                    analytics.largestReductionPct
                  )}`}
                >
                  {formatPercent(
                    analytics.largestReductionPct
                  )}
                </p>
              </div>
            </div>
          </section>

                  <section className="mt-4">
            {analytics.pendingTradeCount > 0 ? (
              analytics.pendingProjectionIsValid ? (
                <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm leading-6 text-violet-800">
                  <span className="font-semibold">
                    Pending trade projection.
                  </span>{" "}
                  The authoritative Wells position of{" "}
                  <span className="font-semibold">
                    {formatNumber(
                      analytics.wellsExposure
                    )}
                  </span>{" "}
                  shares is used as the baseline. The{" "}
                  <span className="font-semibold">
                    {analytics.pendingTradeCount}
                  </span>{" "}
                  pending manual{" "}
                  {analytics.pendingTradeCount === 1
                    ? "trade projects"
                    : "trades project"}{" "}
                  the position to{" "}
                  <span className="font-semibold">
                    {formatNumber(
                      analytics.projectedExposure
                    )}
                  </span>{" "}
                  shares. Official dashboard metrics
                  remain Wells-derived until
                  reconciliation.
                </div>
              ) : (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-800">
                  <span className="font-semibold">
                    Invalid pending projection.
                  </span>{" "}
                  Applying the pending manual trades
                  to the Wells baseline would produce
                  an invalid negative exposure. Review
                  the pending trades before relying on
                  projected position values.
                </div>
              )
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                No pending manual trades. The projected
                position equals the authoritative Wells
                position.
              </div>
            )}
          </section>


          <section className="mt-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3">
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["ALL", "All"],
                    ["ENTRIES", "Entries"],
                    ["EXITS", "Exits"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      setTradeFilter(value)
                    }
                    className={`rounded-xl px-3 py-2 text-sm font-medium ${
                      tradeFilter === value
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">
                  Showing {displayedRows.length} of{" "}
                  {analytics.tradeCount} trades
                </span>

                <select
                  value={tradeSort}
                  onChange={(event) =>
                    setTradeSort(
                      event.target
                        .value as TradeSort
                    )
                  }
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="NEWEST">
                    Newest First
                  </option>
                  <option value="OLDEST">
                    Oldest First
                  </option>
                </select>
              </div>
            </div>

            <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="overflow-x-auto">
                <div className="grid min-w-[1800px] grid-cols-13 gap-1 border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <div>Date Traded</div>
                    <div>Type</div>
                    <div>Shares</div>
                    <div>Avg Price</div>
                    <div>Notional</div>
                    <div>Exposure Before</div>
                    <div>Exposure After</div>

                    <div>% Change</div>
                    <div>Entry vs Current</div>
                    <div>Source</div>
                    <div>Reconciliation</div>
                    <div>Note</div>
                    <div>Actions</div>
                </div>

                {displayedRows.length ? (
                  displayedRows.map((row) => (
                  <TradeHistoryTableRow
                    key={row.trade.id}
                    row={row}
                    confirmDeleteTradeId={
                      confirmDeleteTradeId
                    }
                    setConfirmDeleteTradeId={
                      setConfirmDeleteTradeId
                    }
                    deletingTradeId={
                      deletingTradeId
                    }
                    onDeleteTrade={
                      handleDeleteTrade
                    }
                    onEditNote={(trade) => {
                      setEditingTrade(trade);
                      setTradeNote(
                        trade.comment || ""
                      );
                    }}
                  />
                  ))
                ) : (
                  <div className="px-6 py-10 text-center text-sm text-slate-500">
                    No trades matched the selected
                    filter.
                  </div>
                )}
              </div>
            </div>

            <p className="mt-2 text-xs leading-5 text-slate-500">
              Rows labeled Projected are pending
              manual trades applied forward from the
              current Wells position. Rows labeled
              History are non-pending visible trades
              reconstructed backward from the Wells
              position. Entry vs Current compares
              entry execution price with the current
              market price. Exit trades display an em
              dash because realized performance
              requires an authoritative lot-matching
              methodology.
            </p>

          </section>
        </div>
        {editingTrade ? (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/30 p-4">
            <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">
                    {editingTrade.comment
                      ? "Edit Trade Note"
                      : "Add Trade Note"}
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    {position.security.ticker}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setEditingTrade(null)
                  }
                  className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
                >
                  ✕
                </button>
              </div>

              <textarea
                value={tradeNote}
                onChange={(event) =>
                  setTradeNote(
                    event.target.value
                  )
                }
                className="mt-4 h-32 w-full resize-none rounded-2xl border border-slate-200 p-4 text-sm outline-none focus:ring-2 focus:ring-slate-900"
                placeholder="Enter trade note..."
              />

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setEditingTrade(null)
                  }
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSaveTradeNote}
                  className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                >
                  Save Note
                </button>
              </div>
            </div>
          </div>
        ) : null}
        <div className="flex shrink-0 justify-end border-t border-slate-200 bg-white p-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
