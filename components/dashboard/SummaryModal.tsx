"use client";
import {
  getDisplayCurrentPrice,
  getDisplayDayPctChange,
} from "@/lib/dashboard/position-metrics";
import { useMemo, useState } from "react";

type FundEquitySnapshot = {
  id: string;
  asOfDate: string;
  netEquity: number;
  source: string;
};

type SummaryModalProps = {
  open: boolean;
  onClose: () => void;
  positions: any[];
  fundEquitySnapshot:
    | FundEquitySnapshot
    | null;
};

function formatMoney(value: number | null | undefined) {
  return (value ?? 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function formatPrice(value: number | null | undefined) {
  if (value == null) return "—";

  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatNumber(value: number | null | undefined) {
  if (value == null) return "—";

  return value.toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });
}

function formatPercent(value: number | null | undefined) {
  if (value == null) {
    return "—";
  }

  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function getPerformanceClass(
  value: number | null | undefined
) {
  const numericValue = Number(value ?? 0);

  if (numericValue > 0) {
    return "font-semibold text-emerald-600";
  }

  if (numericValue < 0) {
    return "font-semibold text-rose-600";
  }

  return "font-semibold text-slate-600";
}

function getSignedMarketValue(
  position: any
) {
  const marketValue = Math.abs(
    Number(
      position.marketValue ?? 0
    )
  );

  return position.side === "SHORT"
    ? -marketValue
    : marketValue;
}

function formatEquityPercent(
  value: number | null | undefined
) {
  if (
    value == null ||
    !Number.isFinite(value)
  ) {
    return "—";
  }

  const roundedValue =
    Math.abs(value) < 0.005
      ? 0
      : value;

  if (roundedValue < 0) {
    return `(${Math.abs(
      roundedValue
    ).toFixed(2)})`;
  }

  return roundedValue.toFixed(2);
}

function getDayPnl(position: any) {
  const marketValue = Number(
    position.marketValue || 0
  );

  const dayPctChange =
  getDisplayDayPctChange(position) || 0;

  return (
    (marketValue * dayPctChange) /
    100
  );
}

function ReportTable({
  title,
  columns,
  rows,
  numericColumns = [],
  emptyMessage = "No positions available.",
}: {
  title: string;
  columns: string[];
  rows: React.ReactNode[][];
  numericColumns?: number[];
  emptyMessage?: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <h3 className="font-semibold text-slate-900">
          {title}
        </h3>
      </div>

      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {columns.map((column, columnIndex) => {
                const isNumeric =
                    numericColumns.includes(columnIndex);

                return (
                    <th
                    key={column}
                    className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 ${
                        isNumeric
                        ? "text-right tabular-nums"
                        : "text-left"
                    }`}
                    >
                    {column}
                    </th>
                );
                })}
            </tr>
          </thead>

          <tbody>
            {rows.length > 0 ? (
                rows.map((row, index) => (
                <tr
                    key={index}
                    className="border-b border-slate-100 hover:bg-slate-50"
                >
                    {row.map((cell, cellIndex) => {
                    const isNumeric =
                        numericColumns.includes(cellIndex);

                    return (
                        <td
                        key={cellIndex}
                        className={`px-4 py-3 ${
                            isNumeric
                            ? "text-right tabular-nums"
                            : "text-left"
                        }`}
                        >
                        {cell}
                        </td>
                    );
                    })}
                </tr>
                ))
            ) : (
                <tr>
                <td
                    colSpan={columns.length}
                    className="px-4 py-10 text-center text-sm text-slate-500"
                >
                    {emptyMessage}
                </td>
                </tr>
            )}
            </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SummaryModal({
  open,
  onClose,
  positions,
  fundEquitySnapshot,
}: SummaryModalProps) {
  const [activeTab, setActiveTab] =
    useState("EXECUTIVE");

  const analytics = useMemo(() => {
    const netEquity = Number(
      fundEquitySnapshot?.netEquity
    );

    const hasValidNetEquity =
      Number.isFinite(netEquity) &&
      netEquity > 0;

    const positionsWithDayPnl =
      positions.map((position) => ({
        ...position,
        calculatedDayPnl:
          getDayPnl(position),
      }));

    const profitRankings =
        positionsWithDayPnl
            .filter(
            (position) =>
                position.calculatedDayPnl > 0
            )
            .sort(
            (a, b) =>
                b.calculatedDayPnl -
                a.calculatedDayPnl
            )
            .slice(0, 10);

    const lossRankings =
        positionsWithDayPnl
            .filter(
            (position) =>
                position.calculatedDayPnl < 0
            )
            .sort(
            (a, b) =>
                a.calculatedDayPnl -
                b.calculatedDayPnl
            )
            .slice(0, 10);

    const sortByDayChangeDescending = (
  a: any,
  b: any
) => {
  const aDayChange =
    getDisplayDayPctChange(a) ?? 0;

  const bDayChange =
    getDisplayDayPctChange(b) ?? 0;

  return bDayChange - aDayChange;
};

const longPositions =
  positionsWithDayPnl
    .filter(
      (position) =>
        position.side === "LONG"
    )
    .sort(
      sortByDayChangeDescending
    );

const shortPositions =
  positionsWithDayPnl
    .filter(
      (position) =>
        position.side === "SHORT"
    )
    .sort(
      sortByDayChangeDescending
    );

  const signedSectorMarketValues =
    positions.reduce(
      (
        accumulator,
        position
      ) => {
        const sector =
          position.security?.sector ||
          "Unclassified";

        const signedMarketValue =
          getSignedMarketValue(
            position
          );

        accumulator[sector] =
          (
            accumulator[sector] ??
            0
          ) + signedMarketValue;

        return accumulator;
      },
      {} as Record<string, number>
    );

let netSecuritiesMarketValue = 0;

for (
  const marketValue of Object.values(
    signedSectorMarketValues
  ) as number[]
) {
  netSecuritiesMarketValue +=
    marketValue;
}
  const cashMarketValue =
    hasValidNetEquity
      ? netEquity -
        netSecuritiesMarketValue
      : null;
  
  const categoryEquityRows =
    hasValidNetEquity
      ? [
          ...Object.entries(
            signedSectorMarketValues
          ).map(
            ([
              category,
              marketValue,
            ]) => ({
              category,
              marketValue:
                Number(
                  marketValue
                ),
              equityPct:
                (
                  Number(
                    marketValue
                  ) /
                  netEquity
                ) * 100,
            })
          ),
          {
            category: "Cash",
            marketValue:
              cashMarketValue ?? 0,
            equityPct:
              (
                (
                  cashMarketValue ??
                  0
                ) /
                netEquity
              ) * 100,
          },
        ].sort(
          (a, b) =>
            a.category.localeCompare(
              b.category
            )
        )
      : [];

  const totalEquityPct =
    categoryEquityRows.reduce(
      (
        sum,
        category
      ) =>
        sum +
        category.equityPct,
      0
    );

  return {
    profitRankings,
    lossRankings,
    longPositions,
    shortPositions,
    categoryEquityRows,
    totalEquityPct,
    netEquity:
      hasValidNetEquity
        ? netEquity
        : null,
  };
}, [
    positions,
    fundEquitySnapshot,
  ]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="flex h-[92vh] w-full max-w-[1700px] flex-col overflow-hidden rounded-3xl bg-slate-100 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white p-6">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">
              Fund Report Center
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Executive summary and
              portfolio reporting.
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        <div className="border-b border-slate-200 bg-white px-6 py-3">
          <div className="flex gap-2">
            <button
              onClick={() =>
                setActiveTab(
                  "EXECUTIVE"
                )
              }
              className={`rounded-xl px-4 py-2 text-sm ${
                activeTab ===
                "EXECUTIVE"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              Executive Summary
            </button>

            <button
              onClick={() =>
                setActiveTab(
                  "REPORT"
                )
              }
              className={`rounded-xl px-4 py-2 text-sm ${
                activeTab ===
                "REPORT"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              Fund Report
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {activeTab ===
          "EXECUTIVE" ? (
            <div className="space-y-6">

              <ReportTable
                title="Top 10 Profit Rankings"
                emptyMessage="No profitable positions for the current trading day."
                columns={[
                    "Ticker",
                    "Side",
                    "Quantity",
                    "Day P&L",
                ]}
                numericColumns={[2, 3]}
                rows={analytics.profitRankings.map(
                  (
                    position
                  ) => [
                    position
                      .security
                      ?.ticker,
                    position.side,
                    formatNumber(
                      position.shares
                    ),
                    <span className="font-semibold text-emerald-600">
                      {formatMoney(
                        position.calculatedDayPnl
                      )}
                    </span>,
                  ]
                )}
              />

              <ReportTable
                title="Top 10 Loss Rankings"
                emptyMessage="No losing positions for the current trading day."
                columns={[
                    "Ticker",
                    "Side",
                    "Quantity",
                    "Day P&L",
                ]}
                numericColumns={[2, 3]}
                rows={analytics.lossRankings.map(
                  (
                    position
                  ) => [
                    position
                      .security
                      ?.ticker,
                    position.side,
                    formatNumber(
                      position.shares
                    ),
                    <span className="font-semibold text-rose-600">
                      {formatMoney(
                        position.calculatedDayPnl
                      )}
                    </span>,
                  ]
                )}
              />

              <ReportTable
                title="Long Positions Day Change"
                emptyMessage="No long positions are currently held."
                columns={[
                    "Ticker",
                    "Quantity",
                    "Last Price",
                    "Market Value",
                    "Net ($)",
                    "Change %",
                ]}
                numericColumns={[1, 2, 3, 4, 5]}
                rows={analytics.longPositions.map(
                    (position) => [
                    position.security?.ticker,
                    formatNumber(position.shares),
                    formatPrice(
                        getDisplayCurrentPrice(position)
                    ),
                    formatMoney(
                        position.marketValue
                    ),
                    <span
                        className={getPerformanceClass(
                            position.calculatedDayPnl
                        )}
                        >
                        {formatMoney(
                            position.calculatedDayPnl
                        )}
                        </span>,
                        <span
                        className={getPerformanceClass(
                            getDisplayDayPctChange(position)
                        )}
                        >
                        {formatPercent(
                            getDisplayDayPctChange(position)
                        )}
                        </span>,
                    ]
                )}
                />

             <ReportTable
                title="Short Positions Day Change"
                emptyMessage="No short positions are currently held."
                columns={[
                    "Ticker",
                    "Quantity",
                    "Last Price",
                    "Market Value",
                    "Net ($)",
                    "Change %",
                ]}
                numericColumns={[1, 2, 3, 4, 5]}
                rows={analytics.shortPositions.map(
                    (position) => [
                    position.security?.ticker,
                    formatNumber(position.shares),
                    formatPrice(
                        getDisplayCurrentPrice(position)
                    ),
                    formatMoney(
                        position.marketValue
                    ),
                    <span
                        className={getPerformanceClass(
                            position.calculatedDayPnl
                        )}
                        >
                        {formatMoney(
                            position.calculatedDayPnl
                        )}
                        </span>,
                        <span
                        className={getPerformanceClass(
                            getDisplayDayPctChange(position)
                        )}
                        >
                        {formatPercent(
                            getDisplayDayPctChange(position)
                        )}
                        </span>,
                    ]
                )}
                />
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3">
                <div>
                  <h3 className="font-semibold text-slate-900">
                    Position Sizes By Category
                  </h3>

                  <p className="mt-1 text-xs text-slate-500">
                    Signed category market value as a percentage of Net Equity.
                  </p>
                </div>

                {fundEquitySnapshot ? (
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Net Equity
                    </p>

                    <p className="mt-1 text-sm font-semibold tabular-nums text-slate-900">
                      {formatMoney(
                        analytics.netEquity
                      )}
                    </p>

                    <p className="mt-1 text-[11px] text-slate-400">
                      As of{" "}
                      {new Date(
                        fundEquitySnapshot
                          .asOfDate
                      ).toLocaleDateString(
                        "en-US",
                        {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          timeZone: "UTC",
                        }
                      )}
                    </p>
                  </div>
                ) : null}
              </div>

              {analytics.netEquity != null ? (
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-300 bg-white">
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Category
                        </th>

                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Equity %
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {analytics.categoryEquityRows.map(
                        (category) => (
                          <tr
                            key={category.category}
                            className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50"
                          >
                            <td className="px-4 py-2.5 font-medium text-slate-800">
                              {category.category}
                            </td>

                            <td
                              className={`px-4 py-2.5 text-right font-semibold tabular-nums ${
                                category.equityPct < 0
                                  ? "text-rose-600"
                                  : "text-slate-900"
                              }`}
                            >
                              {formatEquityPercent(
                                category.equityPct
                              )}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>

                    <tfoot>
                      <tr className="border-t-2 border-slate-400 bg-slate-50">
                        <td className="px-4 py-3 font-bold text-slate-950">
                          Total
                        </td>

                        <td className="px-4 py-3 text-right font-bold tabular-nums text-slate-950">
                          {formatEquityPercent(
                            analytics.totalEquityPct
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="px-6 py-12 text-center">
                  <p className="text-sm font-semibold text-slate-700">
                    Net Equity is unavailable.
                  </p>

                  <p className="mt-2 text-sm text-slate-500">
                    Save a daily Net Equity value in Settings to calculate category Equity %.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}