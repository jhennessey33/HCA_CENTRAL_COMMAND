"use client";

import { useEffect, useMemo, useState } from "react";

import AppSidebar from "@/components/common/AppSidebar";
import Badge from "@/components/common/Badge";
import CurrentUserPill from "@/components/auth/CurrentUserPill";
import LocalDateTime from "@/components/common/LocalDateTime";
import TradeQueueSection from "@/components/trades/TradeQueueSection";
import ManualTradeEditModal from "@/components/trades/ManualTradeEditModal";

type FundEquitySnapshot = {
  id: string;
  asOfDate: string;
  netEquity: number;
  source: string;
};

type TradesClientProps = {
  positions: any[];
  fundEquitySnapshots: FundEquitySnapshot[];
  initialQueuedTrades: any[];
};
function formatMoney(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }

  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function formatAccountingMoney(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }

  const formattedValue = Math.abs(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  return value < 0 ? `(${formattedValue})` : formattedValue;
}

function formatExposurePercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }

  const formattedValue = Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });

  return value < 0 ? `(${formattedValue}%)` : `${formattedValue}%`;
}

function formatBps(value: number | null) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }

  const roundedValue = Math.round(value);

  return `${roundedValue > 0 ? "+" : ""}${roundedValue.toLocaleString(
    "en-US",
  )} bps`;
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

function reconciliationTone(status?: string | null, source?: string | null) {
  if (source === "SYSTEM" && status === "MANUAL_PENDING") {
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
  source?: string | null,
) {
  if (source === "SYSTEM" && status === "MANUAL_PENDING") {
    return "Pending Completion";
  }

  if (!status) {
    return "—";
  }

  return status
    .split("_")
    .map((word) => `${word.charAt(0)}${word.slice(1).toLowerCase()}`)
    .join(" ");
}

function getLocalDateKey(value: string | Date) {
  const date = new Date(value);

  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getSnapshotDateKey(value: string | Date) {
  const date = new Date(value);

  const year = date.getUTCFullYear();

  const month = String(date.getUTCMonth() + 1).padStart(2, "0");

  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
function formatDay(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}
function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <p className="text-2xl font-semibold text-slate-950 tabular-nums">
          {value}
        </p>

        {detail ? (
          <div className="flex flex-wrap items-center gap-2">{detail}</div>
        ) : null}
      </div>
    </div>
  );
}

export default function TradesClient({
  positions,
  fundEquitySnapshots,
  initialQueuedTrades,
}: TradesClientProps) {
  const [localPositions, setLocalPositions] = useState<any[]>(positions);

  const [localQueueItems, setLocalQueueItems] =
    useState<any[]>(initialQueuedTrades);

  const [highlightedQueueItemId, setHighlightedQueueItemId] = useState<
    string | null
  >(null);

  const [query, setQuery] = useState("");

  const [tradeFilter, setTradeFilter] = useState("ALL");

  const [editingTrade, setEditingTrade] = useState<any | null>(null);

  const [confirmDeleteTradeId, setConfirmDeleteTradeId] = useState<
    string | null
  >(null);

  const [deletingTradeId, setDeletingTradeId] = useState<string | null>(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);

    const queueItemId = searchParams.get("queueItem")?.trim();

    setHighlightedQueueItemId(queueItemId || null);
  }, []);

  useEffect(() => {
    if (!confirmDeleteTradeId) {
      return;
    }

    const timeout = setTimeout(() => {
      setConfirmDeleteTradeId(null);
    }, 5000);

    return () => clearTimeout(timeout);
  }, [confirmDeleteTradeId]);

  const allTrades = useMemo<any[]>(() => {
    return localPositions.flatMap((position) =>
      (position.trades || []).map((trade: any) => ({
        ...trade,
        ticker: position.security.ticker,
        company: position.security.name,
        side: position.side,
      })),
    );
  }, [localPositions]);

  const filteredTrades = useMemo(() => {
    return allTrades.filter((trade) => {
      const searchable = [
        trade.ticker,
        trade.company,
        trade.tradeType,
        trade.comment,
        trade.source,
        trade.reconciliationStatus,
        formatSource(trade.source),
        trade.source === "WELLS_FARGO"
          ? null
          : formatReconciliationStatus(
              trade.reconciliationStatus,
              trade.source,
            ),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !query.trim() || searchable.includes(query.toLowerCase());

      const matchesFilter =
        tradeFilter === "ALL" ||
        trade.tradeType === tradeFilter ||
        (tradeFilter === "PENDING" &&
          trade.reconciliationStatus === "MANUAL_PENDING") ||
        (tradeFilter === "MANUAL" && trade.source === "MANUAL") ||
        (tradeFilter === "WELLS" && trade.source === "WELLS_FARGO");

      return matchesSearch && matchesFilter;
    });
  }, [allTrades, query, tradeFilter]);

  const groupedTrades = useMemo(() => {
    const groups = new Map<string, any[]>();

    [...filteredTrades]
      .sort(
        (a, b) =>
          new Date(b.dateTraded).getTime() - new Date(a.dateTraded).getTime(),
      )
      .forEach((trade) => {
        const dateKey = getLocalDateKey(trade.dateTraded);

        if (!groups.has(dateKey)) {
          groups.set(dateKey, []);
        }

        groups.get(dateKey)!.push(trade);
      });

    return Array.from(groups.entries());
  }, [filteredTrades]);

  const investmentSummary = useMemo(() => {
    return localPositions.reduce(
      (totals, position) => {
        if (position.status && position.status !== "ACTIVE") {
          return totals;
        }

        const marketValue = Number(position.marketValue);

        if (!Number.isFinite(marketValue)) {
          return totals;
        }

        const absoluteMarketValue = Math.abs(marketValue);

        if (position.side === "SHORT") {
          totals.shortInvestments += absoluteMarketValue;
        } else if (position.side === "LONG") {
          totals.longInvestments += absoluteMarketValue;
        }

        return totals;
      },
      {
        longInvestments: 0,
        shortInvestments: 0,
      },
    );
  }, [localPositions]);

  const grossInvestments =
    investmentSummary.longInvestments + investmentSummary.shortInvestments;

  const netInvestments =
    investmentSummary.longInvestments - investmentSummary.shortInvestments;

  const latestFundEquitySnapshot = useMemo(() => {
    return (
      [...fundEquitySnapshots].sort(
        (a, b) =>
          new Date(b.asOfDate).getTime() - new Date(a.asOfDate).getTime(),
      )[0] ?? null
    );
  }, [fundEquitySnapshots]);

  const latestNetEquity = Number(latestFundEquitySnapshot?.netEquity);

  const hasValidLatestNetEquity =
    Number.isFinite(latestNetEquity) && latestNetEquity > 0;

  const grossInvestmentPercent = hasValidLatestNetEquity
    ? (grossInvestments / latestNetEquity) * 100
    : null;

  const netInvestmentPercent = hasValidLatestNetEquity
    ? (netInvestments / latestNetEquity) * 100
    : null;

  function updateLocalQueueItem(updatedQueueItem: any) {
    setLocalQueueItems((currentQueueItems) =>
      currentQueueItems.map((queueItem) =>
        queueItem.id === updatedQueueItem.id ? updatedQueueItem : queueItem,
      ),
    );
  }

  function removeLocalQueueItem(queueItemId: string) {
    setLocalQueueItems((currentQueueItems) =>
      currentQueueItems.filter((queueItem) => queueItem.id !== queueItemId),
    );

    setHighlightedQueueItemId((currentHighlightedId) =>
      currentHighlightedId === queueItemId ? null : currentHighlightedId,
    );
  }

  function handleLocalQueueItemExecuted(queueItemId: string, trade: any) {
    setLocalQueueItems((currentQueueItems) =>
      currentQueueItems.filter((queueItem) => queueItem.id !== queueItemId),
    );

    setHighlightedQueueItemId((currentHighlightedId) =>
      currentHighlightedId === queueItemId ? null : currentHighlightedId,
    );

    setLocalPositions((currentPositions) =>
      currentPositions.map((position) => {
        if (position.id !== trade.positionId) {
          return position;
        }

        const existingTrades = Array.isArray(position.trades)
          ? position.trades
          : [];

        if (
          existingTrades.some(
            (existingTrade: any) => existingTrade.id === trade.id,
          )
        ) {
          return position;
        }

        return {
          ...position,
          trades: [trade, ...existingTrades],
        };
      }),
    );
  }

  function updateLocalTrade(tradeId: string, updates: Record<string, unknown>) {
    setLocalPositions((currentPositions) =>
      currentPositions.map((position) => ({
        ...position,
        trades: (position.trades || []).map((trade: any) =>
          trade.id === tradeId
            ? {
                ...trade,
                ...updates,
              }
            : trade,
        ),
      })),
    );
  }

  function removeLocalTrade(tradeId: string) {
    setLocalPositions((currentPositions) =>
      currentPositions.map((position) => ({
        ...position,
        trades: (position.trades || []).filter(
          (trade: any) => trade.id !== tradeId,
        ),
      })),
    );
  }

  async function handleDeleteTrade(tradeId: string) {
    try {
      setDeletingTradeId(tradeId);

      const response = await fetch(`/api/trades/manual/${tradeId}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete trade.");
      }

      removeLocalTrade(tradeId);

      setConfirmDeleteTradeId(null);
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Failed to delete trade.",
      );
    } finally {
      setDeletingTradeId(null);
    }
  }

  function handleOpenTradeEditor(trade: any) {
    setEditingTrade(trade);
  }

  function handleManualTradeSaved(updatedTrade: any) {
    updateLocalTrade(updatedTrade.id, updatedTrade);
    setEditingTrade(null);
  }

  return (
    <main className="h-screen overflow-hidden bg-slate-100 text-slate-900">
      <div className="flex h-full">
        <AppSidebar activePage="/trades" />

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-20 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
            <div>
              <p className="text-sm font-medium text-slate-900">Trades</p>

              <p className="text-xs text-slate-500">Global trade history</p>
            </div>

            <CurrentUserPill />
          </header>

          <div className="overflow-auto p-6">
            <div className="mb-6">
              <h2 className="text-3xl font-semibold tracking-tight">Trades</h2>

              <p className="mt-1 text-sm text-slate-500">
                Global trade history grouped by day.
              </p>
            </div>

            <div className="mb-6 grid grid-cols-3 gap-4">
              <SummaryCard
                label="Gross Investments"
                value={formatAccountingMoney(grossInvestments)}
                detail={
                  <>
                    <Badge tone="green">
                      Long{" "}
                      {formatAccountingMoney(investmentSummary.longInvestments)}
                    </Badge>

                    <Badge tone="red">
                      Short{" "}
                      {formatAccountingMoney(
                        investmentSummary.shortInvestments,
                      )}
                    </Badge>
                  </>
                }
              />

              <SummaryCard
                label="Net Investments"
                value={formatAccountingMoney(netInvestments)}
                detail={
                  <Badge tone={netInvestments < 0 ? "red" : "green"}>
                    {netInvestments < 0 ? "Net Short" : "Net Long"}
                  </Badge>
                }
              />

              <SummaryCard
                label="Gross / Net"
                value={
                  <span>
                    {formatExposurePercent(grossInvestmentPercent)}
                    <span className="mx-2 text-slate-300">/</span>
                    <span
                      className={
                        netInvestmentPercent != null && netInvestmentPercent < 0
                          ? "text-rose-600"
                          : "text-emerald-600"
                      }
                    >
                      {formatExposurePercent(netInvestmentPercent)}
                    </span>
                  </span>
                }
                detail={
                  latestFundEquitySnapshot ? (
                    <span
                      className="text-xs text-slate-500"
                      title={`Calculated using Net Equity of ${formatMoney(
                        latestNetEquity,
                      )} as of ${formatDay(
                        getSnapshotDateKey(latestFundEquitySnapshot.asOfDate),
                      )}`}
                    >
                      Net Equity as of{" "}
                      {formatDay(
                        getSnapshotDateKey(latestFundEquitySnapshot.asOfDate),
                      )}
                    </span>
                  ) : (
                    <Badge tone="amber">No Net Equity</Badge>
                  )
                }
              />
            </div>

            <TradeQueueSection
              queueItems={localQueueItems}
              highlightedQueueItemId={highlightedQueueItemId}
              onQueueItemUpdated={updateLocalQueueItem}
              onQueueItemCanceled={removeLocalQueueItem}
              onQueueItemExecuted={handleLocalQueueItemExecuted}
            />

            <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-3">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search ticker, company, trade type, note..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
              />
            </div>

            <div className="mb-6 flex flex-wrap gap-2">
              {[
                "ALL",
                "BUY",
                "SELL",
                "SHORT",
                "COVER",
                "PENDING",
                "MANUAL",
                "WELLS",
              ].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setTradeFilter(filter)}
                  className={`rounded-xl px-3 py-2 text-sm ${
                    tradeFilter === filter
                      ? "bg-slate-900 text-white"
                      : "border border-slate-200 bg-white"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            <div className="space-y-6">
              {groupedTrades.map(([date, trades]) => {
                const dayNotional = trades.reduce(
                  (sum, trade) =>
                    sum +
                    Math.abs(
                      Number(trade.shares || 0) * Number(trade.avgPrice || 0),
                    ),
                  0,
                );
                const dayExposureChanges = trades.reduce(
                  (totals, trade) => {
                    const tradeNotional = Math.abs(
                      Number(trade.shares ?? 0) * Number(trade.avgPrice ?? 0),
                    );

                    if (trade.tradeType === "BUY") {
                      totals.longNotional += tradeNotional;
                    } else if (trade.tradeType === "SELL") {
                      totals.longNotional -= tradeNotional;
                    } else if (trade.tradeType === "SHORT") {
                      totals.shortNotional += tradeNotional;
                    } else if (trade.tradeType === "COVER") {
                      totals.shortNotional -= tradeNotional;
                    }

                    return totals;
                  },
                  {
                    longNotional: 0,
                    shortNotional: 0,
                  },
                );

                const applicableFundEquity =
                  fundEquitySnapshots.find(
                    (snapshot) => getSnapshotDateKey(snapshot.asOfDate) <= date,
                  ) ?? null;

                const dayNetEquity = Number(applicableFundEquity?.netEquity);

                const hasValidDayNetEquity =
                  Number.isFinite(dayNetEquity) && dayNetEquity > 0;

                const dayLongExposureBps = hasValidDayNetEquity
                  ? (dayExposureChanges.longNotional / dayNetEquity) * 10_000
                  : null;

                const dayShortExposureBps = hasValidDayNetEquity
                  ? (dayExposureChanges.shortNotional / dayNetEquity) * 10_000
                  : null;
                const dayPending = trades.filter(
                  (trade) => trade.reconciliationStatus === "MANUAL_PENDING",
                ).length;

                return (
                  <div
                    key={date}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                  >
                    <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-950">
                            {formatDay(date)}
                          </h3>

                          <p className="mt-1 text-sm text-slate-500">
                            Trade Count: {trades.length}
                            {dayPending > 0 ? ` • ${dayPending} Pending` : ""}
                          </p>
                        </div>

                        <div className="flex items-center gap-5">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <span
                              title={
                                applicableFundEquity
                                  ? `Calculated using Net Equity of ${formatMoney(
                                      dayNetEquity,
                                    )} as of ${formatDay(
                                      getSnapshotDateKey(
                                        applicableFundEquity.asOfDate,
                                      ),
                                    )}`
                                  : "No Net Equity snapshot was available on or before this trade date."
                              }
                              className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 tabular-nums"
                            >
                              Long {formatBps(dayLongExposureBps)}
                            </span>

                            <span
                              title={
                                applicableFundEquity
                                  ? `Calculated using Net Equity of ${formatMoney(
                                      dayNetEquity,
                                    )} as of ${formatDay(
                                      getSnapshotDateKey(
                                        applicableFundEquity.asOfDate,
                                      ),
                                    )}`
                                  : "No Net Equity snapshot was available on or before this trade date."
                              }
                              className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 tabular-nums"
                            >
                              Short {formatBps(dayShortExposureBps)}
                            </span>
                          </div>

                          <div className="text-right">
                            <p className="text-xs uppercase tracking-wide text-slate-500">
                              Gross Notional
                            </p>

                            <p className="text-xl font-semibold text-slate-950 tabular-nums">
                              {formatMoney(dayNotional)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <div className="grid grid-cols-[0.8fr_2fr_1.4fr_0.9fr_1fr_1fr_1.2fr_1fr_1.4fr_2.2fr_1.6fr] border-b bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        <div>Ticker</div>
                        <div>Company</div>
                        <div>Time</div>
                        <div>Type</div>
                        <div>Shares</div>
                        <div>Avg Price</div>
                        <div>Notional</div>
                        <div>Source</div>
                        <div>Reconciliation</div>
                        <div>Note</div>
                        <div>Actions</div>
                      </div>

                      {trades.map((trade) => (
                        <div
                          key={trade.id}
                          className="grid grid-cols-[0.8fr_2fr_1.4fr_0.9fr_1fr_1fr_1.2fr_1fr_1.4fr_2.2fr_1.6fr] items-center border-b border-slate-100 px-3 py-2 text-xs hover:bg-slate-50"
                        >
                          <div className="font-semibold text-slate-950">
                            {trade.ticker}
                          </div>

                          <div className="truncate text-slate-700">
                            {trade.company}
                          </div>

                          <div>
                            <LocalDateTime value={trade.dateTraded} />
                          </div>

                          <div>
                            <Badge
                              tone={
                                trade.tradeType === "BUY" ||
                                trade.tradeType === "SHORT"
                                  ? "green"
                                  : "red"
                              }
                            >
                              {trade.tradeType}
                            </Badge>
                          </div>

                          <div>
                            {Number(trade.shares || 0).toLocaleString()}
                          </div>

                          <div>{formatMoney(Number(trade.avgPrice || 0))}</div>

                          <div>
                            {formatMoney(
                              Number(trade.shares || 0) *
                                Number(trade.avgPrice || 0),
                            )}
                          </div>

                          <div>
                            <Badge tone={sourceTone(trade.source) as any}>
                              {formatSource(trade.source)}
                            </Badge>
                          </div>

                          <div>
                            {trade.source === "WELLS_FARGO" ? null : (
                              <Badge
                                tone={
                                  reconciliationTone(
                                    trade.reconciliationStatus,
                                    trade.source,
                                  ) as any
                                }
                              >
                                {formatReconciliationStatus(
                                  trade.reconciliationStatus,
                                  trade.source,
                                )}
                              </Badge>
                            )}
                          </div>

                          <div
                            title={trade.comment || ""}
                            className="truncate text-slate-500"
                          >
                            {trade.comment || "—"}
                          </div>

                          <div className="flex items-center gap-1">
                            {trade.source === "MANUAL" &&
                            trade.reconciliationStatus === "MANUAL_PENDING" ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleOpenTradeEditor(trade)}
                                  className="rounded-xl bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-100"
                                >
                                  Edit
                                </button>

                                {deletingTradeId === trade.id ? (
                                  <span className="text-[11px] font-semibold text-slate-500">
                                    Deleting...
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (confirmDeleteTradeId === trade.id) {
                                        handleDeleteTrade(trade.id);

                                        return;
                                      }

                                      setConfirmDeleteTradeId(trade.id);
                                    }}
                                    className={`inline-flex min-h-7 items-center justify-center rounded-xl px-2 py-1 text-[11px] font-medium ${
                                      confirmDeleteTradeId === trade.id
                                        ? "bg-rose-600 text-white hover:bg-rose-700"
                                        : "text-rose-600 hover:bg-rose-50"
                                    }`}
                                  >
                                    {confirmDeleteTradeId === trade.id
                                      ? "Confirm"
                                      : "Delete"}
                                  </button>
                                )}
                              </>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {editingTrade ? (
        <ManualTradeEditModal
          trade={editingTrade}
          onClose={() => setEditingTrade(null)}
          onSaved={handleManualTradeSaved}
        />
      ) : null}
    </main>
  );
}
