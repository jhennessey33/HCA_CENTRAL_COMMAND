"use client";
import LocalDateTime from "@/components/common/LocalDateTime";
import Badge from "@/components/common/Badge";
import { useEffect, useMemo, useState } from "react";
import CurrentUserPill from "@/components/auth/CurrentUserPill";
import AppSidebar from "@/components/common/AppSidebar";
import ExpandedTradeHistoryModal from "@/components/dashboard/ExpandedTradeHistoryModal";
import SummaryModal from "@/components/dashboard/SummaryModal";
import {
  canCreateComments,
  canCreateFlags,
  canEditSectors,
} from "@/lib/client-permissions";

import {
  getDashboardStats,
  getDisplayCostBasis,
  getDisplayCurrentPrice,
  getDisplayMarketValue,
  getDisplayPortfolioPct,
  getDisplayTotalPctChange,
  getDisplayUnrealizedPnl,
  getDisplayWap,
  getDisplayDayPctChange,
} from "@/lib/dashboard/position-metrics";

type FundEquitySnapshot = {
  id: string;
  asOfDate: string;
  netEquity: number;
  source: string;
};

type DashboardClientProps = {
  positions: any[];
  fundEquitySnapshot:
    | FundEquitySnapshot
    | null;
};




function formatMoney(value: number | null | undefined) {
  if (value == null) return "—";

  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function getCapitalIqUrl(ticker: string) {
  const normalizedTicker = ticker.trim().toLowerCase();

  return `https://www.capitaliq.spglobal.com/apisv3/spg-webplatform-core/search/searchResults?vertical=&q=${encodeURIComponent(
    normalizedTicker
  )}`;
}


function openCapitalIq(ticker: string) {
  window.open(getCapitalIqUrl(ticker), "_blank");
}

function getLocalDateTimeInputValue(
  date = new Date()
) {
  const timezoneOffsetMilliseconds =
    date.getTimezoneOffset() * 60 * 1000;

  return new Date(
    date.getTime() -
      timezoneOffsetMilliseconds
  )
    .toISOString()
    .slice(0, 16);
}

function formatNumber(value: number | null | undefined) {
  if (value == null) return "—";

  return value.toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });
}

function formatPrice(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";

  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPercent(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";

  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}







function pnlClass(value: number | null | undefined) {
  if (value == null) return "text-slate-500";
  return value >= 0 ? "text-emerald-600" : "text-rose-600";
}


function DateDisplay({
  value,
  className,
}: {
  value: string | Date | null | undefined;
  className?: string;
}) {
  if (!value) return <span className={className}>—</span>;

  return <LocalDateTime value={value} className={className} />;
}

function getCommentContextLabel(comment: any) {
  if (comment.watchlistEntryId) return "WATCHLIST";
  if (comment.positionId) return "POSITION";
  if (comment.securityId) return "SECURITY";
  return "GENERAL";
}

function getDashboardComments(position: any) {
  const byId = new Map<string, any>();

  const securityComments = position.security?.comments ?? [];
  const positionComments = position.comments ?? [];

  [...securityComments, ...positionComments].forEach((comment) => {
    if (!comment?.id) return;
    byId.set(comment.id, comment);
  });

  return Array.from(byId.values()).sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

function SectionBar({
  title,
  tone,
}: {
  title: string;
  tone: "green" | "red";
}) {
  const toneClass =
    tone === "green"
      ? "bg-emerald-700 text-white"
      : "bg-red-600 text-white";

  return (
    <div
      className={`rounded-t-2xl px-4 py-2 text-center text-xs font-bold uppercase tracking-widest ${toneClass}`}
    >
      {title}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
    </div>
  );
}

function PositionGrid({
  title,
  tone,
  positions,
  portfolioPositions,
  selectedId,
  onSelect,
  onMarketData,
  onComment,
  canComment,
}: {
  title: string;
  tone: "green" | "red";
  positions: any[];
  portfolioPositions: any[];
  selectedId?: string;
  onSelect: (position: any) => void;
  onMarketData: (position: any) => void;
  onComment: (position: any) => void;
  canComment: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <SectionBar title={title} tone={tone} />

      <div className="overflow-x-auto">
        <div className="grid min-w-[1300px] grid-cols-13 justify-items-center border-b bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <div>Ticker</div>
          <div className="col-span-2">Company Name</div>
          <div>Current Price</div>
          <div>% Change In Trading Day</div>
          <div>% Of Portfolio</div>
          <div>Total # Of Shares</div>
          <div>WAP</div>
          <div>Mrkt Value Of Position</div>
          <div>Total % Change</div>
          <div>Sector</div>
          <div>Market Data</div>
          <div>Comment Section</div>
        </div>

        {positions.map((position) => {

          const latestComment = getDashboardComments(position).find(
            (comment: any) => comment.tag !== "PT"
          );
          const openFlag = position.flags?.[0];
          const currentPrice = getDisplayCurrentPrice(position);
          const wap = getDisplayWap(position);
          const totalPctChange = getDisplayTotalPctChange(position);
          const portfolioPct = getDisplayPortfolioPct(position, portfolioPositions);
          const dayPctChange = getDisplayDayPctChange(position);
          

          return (
            <div
              key={position.id}
              className={`grid min-w-[1300px] grid-cols-13 justify-items-center items-center border-b border-slate-100 px-4 py-3 text-xs transition hover:bg-slate-50 ${
                selectedId === position.id ? "bg-slate-100" : "bg-white"
              }`}
            >
            
              <button
                onClick={() => onSelect(position)}
                className="flex items-center justify-center gap-1 font-semibold text-slate-950 hover:underline"
              >
                {position.security.ticker}
                {openFlag ? (
                  <span className="text-amber-500" title={openFlag.flagType}>
                    ⚑
                  </span>
                ) : null}
              </button>

              <div className="col-span-2 text-slate-600 text-center truncate">
                {position.security.name}
              </div>

              <div className="font-medium">
                {formatPrice(currentPrice)}
              </div>

              <div className={`font-semibold ${pnlClass(dayPctChange)}`}>
                {formatPercent(dayPctChange)}
              </div>

              <div>
                {portfolioPct != null ? `${portfolioPct.toFixed(2)}%` : "—"}
              </div>

              <div>{formatNumber(position.shares)}</div>

              <div>{formatPrice(wap)}</div>

              <div>{formatMoney(position.marketValue)}</div>

              <div className={`font-semibold ${pnlClass(totalPctChange)}`}>

                {formatPercent(totalPctChange)}
              </div>
              
              <div>{position.security.sector || "—"}</div>

              <div className="flex justify-center">            
                <button
                  onClick={() => openCapitalIq(position.security.ticker)}
                  className="rounded-xl bg-slate-100 px-2 py-1 font-medium text-slate-700 hover:bg-slate-200"
                >
                  Capital IQ
                </button>
              </div>

              <div className="flex justify-center">
                {canComment ? (
                  <button
                    onClick={() => onComment(position)}
                    className="rounded-xl bg-blue-50 px-2 py-1 font-medium text-blue-700 hover:bg-blue-100"
                  >
                    {latestComment ? "Comment" : "Add Comment"}
                  </button>
                ) : (
                  <span className="rounded-xl bg-slate-100 px-2 py-1 font-medium text-slate-400">
                    Read Only
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TickerDetailPanel({
  position,
  onClose,
  onComment,
  onMarketData,
  onFlag,
  onLots,
  onAddTrade,
  onExpandHistory,
  canComment,
  canFlag,
  canEditSectors,
  availableSectors,
  onSector,
}: {
  position: any | null;
  onClose: () => void;
  onComment: (position: any) => void;
  onMarketData: (position: any) => void;
  onFlag: (position: any) => void;
  onLots: (position: any) => void;
  onAddTrade: (position: any) => void;
  onExpandHistory: (position: any) => void;
  canComment: boolean;
  canFlag: boolean;
  canEditSectors: boolean;
  availableSectors: string[];
  onSector: (position: any) => void;
}) {
  const [selectedSector, setSelectedSector] =
  useState("");

  const [isSavingSector, setIsSavingSector] =
    useState(false);
  const [showAllTrades, setShowAllTrades] = useState(false);

  useEffect(() => {
    setSelectedSector(
      position?.security?.sector || ""
      );
  }, [position]);

  useEffect(() => {
    setShowAllTrades(false);
  }, [position?.id]);

  async function handleSaveSector() {
    if (!position?.security?.id) return;

    setIsSavingSector(true);

    try {
      const response = await fetch(
        `/api/securities/${position.security.id}/sector`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sector: selectedSector,
          }),
        }
      );

      if (!response.ok) {
        throw new Error();
      }

      window.alert(
        "Sector updated successfully."
      );
    } catch {
      window.alert(
        "Failed to update sector."
      );
    } finally {
      setIsSavingSector(false);
    }
  }

  if (!position) return null;

  const security = position.security;
  const openFlag = position.flags?.[0];

  const dashboardComments = getDashboardComments(position);

  const currentPrice = getDisplayCurrentPrice(position);
  const wap = getDisplayWap(position);
  const totalPctChange = getDisplayTotalPctChange(position);
 

  const visibleTrades = showAllTrades
    ? position.trades || []
    : (position.trades || []).slice(0, 5);

  const hiddenTradeCount = Math.max((position.trades?.length || 0) - 5, 0);


  return (
    <aside className="flex h-full w-[560px] shrink-0 flex-col border-l border-slate-200 bg-white shadow-xl">
      <div className="border-b border-slate-200 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold text-slate-950">
                {security.ticker}
              </h2>

              <Badge tone={position.side === "SHORT" ? "red" : "green"}>
                {position.side}
              </Badge>

              {security.sector ? (
                <Badge tone="blue">
                  {security.sector}
                </Badge>
              ) : null}

              {openFlag ? <Badge tone="amber">{openFlag.flagType}</Badge> : null}
            </div>

            <p className="mt-1 text-sm text-slate-500">
              {security.name} • Clicked ticker detail
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Current Price</p>
            
            <p className="mt-1 font-semibold text-slate-950">
              {formatPrice(currentPrice)}
            </p>

          </div>

          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">WAP / Point</p>                      
            <p className="mt-1 font-semibold text-slate-950">
              {formatPrice(wap)}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Shares</p>
            <p className="mt-1 font-semibold text-slate-950">
              {formatNumber(position.shares)}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Total % Change</p>           
            <p className={`mt-1 font-semibold ${pnlClass(totalPctChange)}`}>
              {formatPercent(totalPctChange)}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {canComment ? (
            <button
              onClick={() => onComment(position)}
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Comment
            </button>
          ) : (
            <button
              disabled
              className="cursor-not-allowed rounded-2xl bg-slate-200 px-4 py-2 text-sm font-medium text-slate-500"
            >
              Read Only
            </button>
          )}
          {canFlag ? (
            <button
              onClick={() => onFlag(position)}
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Flag
            </button>
          ) : (
            <button
              disabled
              className="cursor-not-allowed rounded-2xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-400"
            >
              Flag
            </button>
          )}     
          
          <button
            onClick={() => openCapitalIq(position.security.ticker)}
            className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Capital IQ
          </button>

          
          <button
            onClick={() => onLots(position)}
            className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Lots
          </button>

          <button
            onClick={() => onAddTrade(position)}
            className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Add Trade
          </button>

          {canEditSectors ? (
            <button
              onClick={() => onSector(position)}
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Sector
            </button>
          ) : null}
        </div>
      </div>
      
      <div className="flex-1 overflow-auto p-5">
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="font-semibold text-slate-950">
              Trade History From Ticker Click
            </h3>

            <div className="flex shrink-0 items-center gap-2">
              <span className="text-xs text-slate-400">
                {visibleTrades.length} of{" "}
                {position.trades?.length || 0} trades
              </span>

              <button
                type="button"
                onClick={() => onExpandHistory(position)}
                className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Expand History
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 text-xs">
            <div className="grid grid-cols-6 gap-2 bg-slate-50 px-3 py-3 font-semibold uppercase tracking-wide text-slate-500">
              <span>Date Traded</span>
              <span>Type</span>
              <span>Shares</span>
              <span>Avg Price</span>
              <span>Source</span>
              <span>Note</span>
            </div>

            
            {visibleTrades.length ? (
              visibleTrades.map((trade: any) => (

                <div
                  key={trade.id}
                  className="grid grid-cols-6 items-center gap-2 border-b border-slate-100 px-3 py-3 last:border-b-0"
                >
                  <DateDisplay value={trade.dateTraded} />

                  <span>{trade.tradeType || "—"}</span>

                  <span>{formatNumber(trade.shares)}</span>

                  <span>{formatPrice(trade.avgPrice)}</span>

                  <span className="flex flex-col items-start gap-1">
                    {trade.source === "MANUAL" ? (
                      <Badge tone="amber">Manual</Badge>
                    ) : trade.source === "WELLS_FARGO" ? (
                      <Badge tone="green">Wells</Badge>
                    ) : (
                      <Badge tone="slate">{trade.source || "Unknown"}</Badge>
                    )}

                    {trade.reconciliationStatus === "REVIEW_REQUIRED" ? (
                      <Badge tone="red">Review</Badge>
                    ) : trade.reconciliationStatus === "MANUAL_PENDING" ? (
                      <Badge tone="amber">Pending</Badge>
                    ) : trade.reconciliationStatus === "MATCHED" ? (
                      <Badge tone="blue">Matched</Badge>
                    ) : null}
                  </span>

                  <span
                    title={trade.comment || ""}
                    className="truncate text-slate-500"
                  >
                    {trade.comment || "—"}
                  </span>
                </div>
              ))
            ) : (
              <div className="px-3 py-4 text-slate-500">
                No trade history yet.
              </div>
            )}
            {hiddenTradeCount > 0 ? (
              <button
                onClick={() => setShowAllTrades((current) => !current)}
                className="w-full border-t border-slate-100 px-3 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                {showAllTrades
                  ? "Show fewer trades"
                  : `Show all trades (${hiddenTradeCount} more)`}
              </button>
            ) : null}
          </div>
        </section>

        

        <section className="mt-5">
          <h3 className="mb-3 font-semibold text-slate-950">Comment Timeline</h3>

          <div className="space-y-3">
            {dashboardComments.length ? (
              dashboardComments.map((comment: any) => (
                <div
                  key={comment.id}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="blue">{comment.tag}</Badge>
                      <Badge>{getCommentContextLabel(comment)}</Badge>
                    </div>

                    <LocalDateTime
                      value={comment.createdAt}
                      className="text-xs text-slate-400"
                    />
                  </div>

                  <p className="mt-3 text-sm text-slate-700">
                    {comment.content}
                  </p>

                  <p className="mt-2 text-xs text-slate-400">
                    by {comment.author?.name || comment.author?.email || "Unknown"}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-500">
                No comments yet.
              </div>
            )}
          </div>
        </section>
      </div>
    </aside>
  );
}

function TaxLotsModal({
  position,
  onClose,
}: {
  position: any | null;
  onClose: () => void;
}) {
  if (!position) return null;

  const security = position.security;
  const lots = position.taxLots || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-6xl flex-col rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 p-6">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">
              Tax Lot Breakdown
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {security.ticker} • {security.name}
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        <div className="overflow-auto p-6">
          <div className="overflow-hidden rounded-2xl border border-slate-200 text-xs">
            <div className="grid min-w-[1050px] grid-cols-10 gap-2 bg-slate-50 px-3 py-3 font-semibold uppercase tracking-wide text-slate-500">
              <span>Lot Date</span>
              <span>Tax Lot ID</span>
              <span>Qty</span>
              <span>Unit Cost</span>
              <span>Mkt Price</span>
              <span>Cost</span>
              <span>Mkt Value</span>
              <span>U/P&L</span>
              <span>ROI</span>
              <span>Days to LT</span>
            </div>

            {lots.length ? (
              lots.map((lot: any) => (
                <div
                  key={lot.id}
                  className="grid min-w-[1050px] grid-cols-10 gap-2 border-b border-slate-100 px-3 py-3 last:border-b-0"
                >
                  <DateDisplay value={lot.taxLotDate} />
                  <span className="truncate text-slate-500">
                    {lot.taxLotId || "—"}
                  </span>
                  <span>{formatNumber(lot.quantity)}</span>
                  <span>{formatPrice(lot.unitCost)}</span>
                  <span>{formatPrice(lot.marketPrice)}</span>
                  <span>{formatMoney(lot.costBasis)}</span>
                  <span>{formatMoney(lot.marketValue)}</span>
                  <span className={pnlClass(lot.unrealizedPnl)}>
                    {formatMoney(lot.unrealizedPnl)}
                  </span>
                  <span className={pnlClass(lot.roi)}>
                    {lot.roi != null ? `${lot.roi.toFixed(1)}%` : "—"}
                  </span>
                  <span>{lot.daysToLongTerm || "—"}</span>
                </div>
              ))
            ) : (
              <div className="px-3 py-4 text-slate-500">
                No tax lot breakdown yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MarketDataModal({
  position,
  onClose,
}: {
  position: any | null;
  onClose: () => void;
}) {

  if (!position) return null;

  const security = position.security;
  const marketData = security.marketData?.[0];
 


  const rows = [

    ["VWAP", marketData?.vwap != null ? `$${marketData.vwap.toFixed(2)}` : "N/A"],
    [
      "52 Week High",
      marketData?.high52w != null ? `$${marketData.high52w.toFixed(2)}` : "N/A",
    ],
    [
      "52 Week Low",
      marketData?.low52w != null ? `$${marketData.low52w.toFixed(2)}` : "N/A",
    ],
    ["Beta", marketData?.beta != null ? marketData.beta.toFixed(2) : "N/A"],
    [
      "Avg Volume",
      marketData?.avgVolume != null
        ? marketData.avgVolume.toLocaleString("en-US", {
            maximumFractionDigits: 0,
          })
        : "N/A",
    ],
    [
      "Short Float",
      marketData?.shortFloat != null ? `${marketData.shortFloat}%` : "N/A",
    ],
    [
      "Market Cap",
      marketData?.marketCap != null ? formatMoney(marketData.marketCap) : "N/A",
    ],
    ["P/LTM EPS", marketData?.peLtm != null ? `${marketData.peLtm.toFixed(1)}x` : "N/A"],
    [
      "Price/Tang Book",
      marketData?.priceToTangBook != null
        ? `${marketData.priceToTangBook.toFixed(1)}x`
        : "N/A",
    ],
    ["P/NTM EPS", marketData?.peNtm != null ? `${marketData.peNtm.toFixed(1)}x` : "N/A"],
    [
      "Price/Book",
      marketData?.priceToBook != null
        ? `${marketData.priceToBook.toFixed(1)}x`
        : "N/A",
    ],
    [
      "Total Debt/EBITDA",
      marketData?.debtToEbitda != null
        ? `${marketData.debtToEbitda.toFixed(1)}x`
        : "N/A",
    ],
    ["EPS", marketData?.eps != null ? `$${marketData.eps.toFixed(2)}` : "N/A"],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">
              Market Data
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {security.ticker} • {security.name}
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
          {rows.map(([label, value], index) => (
            <div
              key={label}
              className={`grid grid-cols-2 px-4 py-3 text-sm ${
                index % 2 === 0 ? "bg-slate-50" : "bg-white"
              }`}
            >
              <span className="font-medium text-slate-700">{label}</span>
              <span className="text-right font-semibold text-slate-950">
                {value}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-slate-500">
            <span className="font-medium text-slate-700">Market Data Source</span>
            <span className="text-right font-semibold text-slate-950">
              {marketData?.marketDataSource ?? "N/A"}
            </span>
            <span className="font-medium text-slate-700">Fundamentals Source</span>
            <span className="text-right font-semibold text-slate-950">
              {marketData?.fundamentalsSource ?? "N/A"}
            </span>
            <span className="font-medium text-slate-700">Data Quality</span>
            <span className="text-right font-semibold text-slate-950">
              {marketData?.dataQuality ?? "N/A"}
            </span>           
            <span className="font-medium text-slate-700">Last Market Refresh</span>
            <span className="text-right font-semibold text-slate-950">
              {marketData?.lastMarketDataRefreshAt ? (
                <LocalDateTime value={marketData.lastMarketDataRefreshAt} />
              ) : (
                "N/A"
              )}
            </span>
            <span className="font-medium text-slate-700">Last Fundamentals Refresh</span>
            <span className="text-right font-semibold text-slate-950">
              {marketData?.lastFundamentalsRefreshAt ? (
                <LocalDateTime value={marketData.lastFundamentalsRefreshAt} />
              ) : (
                "N/A"
              )}
            </span>

          </div>
        </div>
      </div>
    </div>
  );
}

function AddTradeModal({
  position,
  onClose,
  onSave,
}: {
  position: any | null;
  onClose: () => void;
  onSave: (payload: {
    securityId: string;
    positionId: string;
    tradeType: string;
    dateTraded: string;
    shares: string;
    avgPrice: string;
    comment: string;
  }) => Promise<void>;
}) {
  const [tradeType, setTradeType] = useState("BUY");
  const [dateTraded, setDateTraded] = useState("");
  const [shares, setShares] = useState("");
  const [avgPrice, setAvgPrice] = useState("");
  const [comment, setComment] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmingSave, setConfirmingSave] =
  useState(false);
  useEffect(() => {
  if (!confirmingSave) {
    return;
  }

  const timeout = setTimeout(() => {
    setConfirmingSave(false);
  }, 5000);

  return () => clearTimeout(timeout);
}, [confirmingSave]);


    useEffect(() => {
    if (!position) return;

    setDateTraded(
      getLocalDateTimeInputValue()
    );

    setTradeType(
      position.side === "SHORT"
        ? "SHORT"
        : "BUY"
    );

    setShares("");
    setAvgPrice("");
    setComment("");
    setError("");
  }, [position]);

  if (!position) return null;

  const estimatedNotional =
    Number.isFinite(Number(shares)) && Number.isFinite(Number(avgPrice))
      ? Number(shares) * Number(avgPrice)
      : null;

  async function handleSave() {
    setError("");

    if (!shares.trim()) {
      setError("Shares are required.");
      return;
    }

        if (!avgPrice.trim()) {
      setError("Average price is required.");
      return;
    }

    if (!dateTraded) {
      setError(
        "Trade date and time are required."
      );
      return;
    }

    const parsedDateTraded =
      new Date(dateTraded);

    if (
      Number.isNaN(
        parsedDateTraded.getTime()
      )
    ) {
      setError(
        "Enter a valid trade date and time."
      );
      return;
    }

    const serializedDateTraded =
      parsedDateTraded.toISOString();

    setIsSaving(true);

    try {
        await onSave({
        securityId: position.securityId,
        positionId: position.id,
        tradeType,
        dateTraded:
          serializedDateTraded,
        shares,
        avgPrice,
        comment,
      });

      onClose();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to add manual trade."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">
              Add Manual Trade
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {position.security.ticker} • {position.security.name}
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        <div className="mt-5 space-y-3">
          <select
            value={tradeType}
            onChange={(event) => setTradeType(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
          >
            <option value="BUY">Buy</option>
            <option value="SELL">Sell</option>
            <option value="SHORT">Sell Short</option>
            <option value="COVER">Cover Short</option>
          </select>

            <div>
            <label className="text-sm font-medium text-slate-700">
              Trade Date and Time
            </label>

            <input
              type="datetime-local"
              value={dateTraded}
              onChange={(event) =>
                setDateTraded(
                  event.target.value
                )
              }
              step="60"
              required
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
            />

            <p className="mt-1 text-xs text-slate-500">
              Defaults to the current local date
              and time. An earlier trade timestamp
              may be selected.
            </p>
          </div>

          <input
            value={shares}
            onChange={(event) => setShares(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
            placeholder="Shares"
          />

          <input
            value={avgPrice}
            onChange={(event) => setAvgPrice(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
            placeholder="Average price"
          />

          <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">
            Estimated notional:{" "}
            <span className="font-semibold text-slate-950">
              {estimatedNotional != null ? formatMoney(estimatedNotional) : "—"}
            </span>
          </div>

          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            className="h-28 w-full resize-none rounded-2xl border border-slate-200 p-4 text-sm outline-none focus:ring-2 focus:ring-slate-900"
            placeholder="Optional trade note..."
          />
        </div>

        {error ? (
          <p className="mt-3 text-sm font-medium text-rose-600">{error}</p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>

          <button
            onClick={() => {
              if (confirmingSave) {
                handleSave();
                return;
              }

              setConfirmingSave(true);
            }}
            disabled={isSaving}
            className={`rounded-2xl px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 ${
              confirmingSave
                ? "bg-amber-600 hover:bg-emerald-700"
                : "bg-slate-900 hover:bg-slate-800"
            }`}
          >
            {isSaving
              ? "Saving..."
              : confirmingSave
                ? "Confirm Trade"
                : "Add Trade"}
          </button>
        </div>
      </div>
    </div>
  );
}
function CommentModal({
  position,
  onClose,
  onSave,
}: {
  position: any | null;
  onClose: () => void;
  onSave: (payload: {
    securityId: string;
    positionId: string;
    tag: string;
    content: string;
  }) => Promise<void>;
}) {
  const [tag, setTag] = useState("COMMENT");
  const [content, setContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  if (!position) return null;

  const latestComment = position.comments?.[0];

  async function handleSave() {
    setError("");

    if (!content.trim()) {
      setError("Please enter a comment.");
      return;
    }

    setIsSaving(true);

    try {
      await onSave({
        securityId: position.securityId,
        positionId: position.id,
        tag,
        content,
      });

      setContent("");
      setTag("COMMENT");
      onClose();
    } catch (error) {
      setError("Failed to save comment. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  const categories = [
    ["COMMENT", "Comment"],
    ["PT", "PT"],
    ["THESIS", "Thesis"],
    ["RISK", "Risk"],
    ["CATALYST", "Catalyst"],
    ["TRADE", "Trade"],
    ["EXIT", "Exit"],
    
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">
              Comment Section
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {position.security.ticker} • timestamp and author are captured
              automatically
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        <div className="mt-5 grid grid-cols-6 gap-2">
          {categories.map(([value, label]) => (
            <button
              key={value}
              onClick={() => setTag(value)}
              className={`rounded-2xl px-3 py-2 text-sm ${
                tag === value
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <span className="font-medium text-slate-800">Existing comment:</span>{" "}
          {latestComment?.content || "No comment yet."}
        </div>

        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Write a comment, position note, trade rationale, market data observation, catalyst update, or exit rationale..."
          className="mt-4 h-36 w-full resize-none rounded-2xl border border-slate-200 p-4 text-sm outline-none focus:ring-2 focus:ring-slate-900"
        />

        {error ? (
          <p className="mt-3 text-sm font-medium text-rose-600">{error}</p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save Comment"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FlagModal({
  position,
  onClose,
  onSave,
}: {
  position: any | null;
  onClose: () => void;
    onSave: (payload: {
    securityId: string;
    positionId: string;
    flagType: string;
    priority: string;
    description: string;
    reminderAt: string | null;
  }) => Promise<void>;
}) {
    const [flagType, setFlagType] = useState("Risk Review");
  const [priority, setPriority] = useState("MEDIUM");
  const [description, setDescription] = useState("");
  const [reminderAt, setReminderAt] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  if (!position) return null;

  const flagTypes = [
    "REMINDER",
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

  const isReminder =
    flagType.trim().toUpperCase() === "REMINDER";

  async function handleSave() {
    setError("");

    if (!flagType.trim()) {
      setError("Please select a flag type.");
      return;
    }

    if (isReminder && !description.trim()) {
      setError(
        "A description is required for reminders."
      );
      return;
    }

    if (isReminder && !reminderAt) {
      setError(
        "A reminder date and time are required."
      );
      return;
    }

    let serializedReminderAt: string | null = null;

    if (reminderAt) {
      const parsedReminderAt = new Date(reminderAt);

      if (Number.isNaN(parsedReminderAt.getTime())) {
        setError(
          "Enter a valid reminder date and time."
        );
        return;
      }

      serializedReminderAt =
        parsedReminderAt.toISOString();
    }

    setIsSaving(true);

    try {
      await onSave({
        securityId: position.securityId,
        positionId: position.id,
        flagType,
        priority,
        description,
        reminderAt: serializedReminderAt,
      });

      setFlagType("Risk Review");
      setPriority("MEDIUM");
      setDescription("");
      setReminderAt("");
      setError("");

      onClose();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to create flag. Please try again."
      );
    } finally {
      setIsSaving(false);
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">
              Flag Ticker
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {position.security.ticker} • {position.security.name}
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">
              Flag Type
            </label>
            <select
              value={flagType}
              onChange={(event) => setFlagType(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
            >
              {flagTypes.map((type) => (
                <option key={type} value={type}>
                  {type === "REMINDER"
                    ? "Reminder"
                    : type}
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
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
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
                <span className="text-rose-600">
                  *
                </span>
              ) : (
                <span className="font-normal text-slate-400">
                  — Optional
                </span>
              )}
            </label>

            <input
              value={reminderAt}
              onChange={(event) =>
                setReminderAt(event.target.value)
              }
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
              {isReminder ? (
                <span className="text-rose-600">
                  *
                </span>
              ) : null}
            </label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={
                isReminder
                  ? "Describe what needs to be remembered..."
                  : "Describe why this ticker needs attention..."
              }

              className="mt-2 h-28 w-full resize-none rounded-2xl border border-slate-200 p-4 text-sm outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
        </div>

        {error ? (
          <p className="mt-3 text-sm font-medium text-rose-600">{error}</p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving
              ? "Saving..."
              : isReminder
                ? "Create Reminder"
                : "Save Flag"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SectorModal({
  position,
  availableSectors,
  onClose,
  onSectorUpdated,
}: {
  position: any | null;
  availableSectors: string[];
  onClose: () => void;
  onSectorUpdated: (
  securityId: string,
  sector: string
) => void;
}) {
  const [sector, setSector] = useState("");

  const [isSaving, setIsSaving] =
    useState(false);

  useEffect(() => {
    setSector(
      position?.security?.sector || ""
    );
  }, [position]);

  if (!position) return null;

  async function handleSave() {
    setIsSaving(true);

    try {
      const response = await fetch(
        `/api/securities/${position.security.id}/sector`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sector,
          }),
        }
      );

      if (!response.ok) {
        throw new Error();
      }

      onSectorUpdated(
        position.security.id,
        sector
      );

      onClose();
            
    } catch {
      window.alert(
        "Failed to update sector."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">
              Edit Sector
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {position.security.ticker} • {position.security.name}
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        <div className="mt-5">
          <label className="text-sm font-medium text-slate-700">
            Sector
          </label>

          <select
            value={sector}
            onChange={(event) =>
              setSector(event.target.value)
            }
            className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
          >
            {availableSectors.map((value) => (
              <option
                key={value}
                value={value}
              >
                {value}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            {isSaving
              ? "Saving..."
              : "Save Sector"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardClient({
  positions,
  fundEquitySnapshot,
}: DashboardClientProps) {
  const [localPositions, setLocalPositions] = useState<any[]>(positions);
 

  const [selectedPosition, setSelectedPosition] = useState<any | null>(null);

  const [marketDataPosition, setMarketDataPosition] = useState<any | null>(null);
  const [commentPosition, setCommentPosition] = useState<any | null>(null);
  const [flagPosition, setFlagPosition] = useState<any | null>(null);
  const [availableSectors, setAvailableSectors] =
  useState<string[]>([]);
  const [sectorPosition, setSectorPosition] =
  useState<any | null>(null);
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [taxLotsPosition, setTaxLotsPosition] = useState<any | null>(null);
  const [manualTradePosition, setManualTradePosition] = useState<any | null>(null);
  const [
    expandedTradeHistoryPosition,
    setExpandedTradeHistoryPosition,
  ] = useState<any | null>(null);
  const [showSummaryModal, setShowSummaryModal] =
  useState(false);

  const userCanCreateComments = canCreateComments(currentUser?.role);
  const userCanCreateFlags = canCreateFlags(currentUser?.role);
  const userCanEditSectors =
  canEditSectors(currentUser?.role);


  useEffect(() => {
    async function loadCurrentUser() {
      const response = await fetch("/api/auth/me");

      if (!response.ok) return;

      const data = await response.json();
      setCurrentUser(data.user);
    }

    loadCurrentUser();
  }, []);

  useEffect(() => {
  async function loadSectors() {
    try {
      const response = await fetch("/api/sectors");

      if (!response.ok) {
        return;
      }

      const data = await response.json();

      setAvailableSectors(
        (data.sectors || []).map(
          (sector: any) => sector.name ?? sector
        )
      );
    } catch (error) {
      console.error(
        "Failed to load sectors.",
        error
      );
    }
  }

  loadSectors();
}, []);

useEffect(() => {
  const konamiCode = [
    "ArrowUp",
    "ArrowUp",
    "ArrowDown",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "ArrowLeft",
    "ArrowRight",
    "b",
    "a",
  ];

  const themeStorageKey = "hca-dashboard-theme";
  let currentIndex = 0;

  // Restore the saved dashboard theme when the page loads.
  const savedTheme = window.localStorage.getItem(themeStorageKey);

  document.documentElement.classList.toggle(
    "hca-pink-theme",
    savedTheme === "pink"
  );

  function handleKeyDown(event: KeyboardEvent) {
    const key =
      event.key.length === 1
        ? event.key.toLowerCase()
        : event.key;

    if (key === konamiCode[currentIndex]) {
      currentIndex += 1;

      if (currentIndex === konamiCode.length) {
        const currentTheme =
          window.localStorage.getItem(themeStorageKey);

        const shouldEnablePinkTheme = currentTheme !== "pink";

        window.localStorage.setItem(
          themeStorageKey,
          shouldEnablePinkTheme ? "pink" : "default"
        );

        document.documentElement.classList.toggle(
          "hca-pink-theme",
          shouldEnablePinkTheme
        );

        currentIndex = 0;
      }

      return;
    }

    // Restart at 1 if this key could be the first key
    // of a new Konami sequence.
    currentIndex = key === konamiCode[0] ? 1 : 0;
  }

  window.addEventListener("keydown", handleKeyDown);

  return () => {
    window.removeEventListener("keydown", handleKeyDown);
  };
}, []);

  const filteredPositions = useMemo(() => {
  const normalizedQuery = query.trim().toLowerCase();

  return localPositions
    .filter((position) => {
      

          
      const flagText = position.flags?.map((flag: any) => flag.flagType).join(" ") || "";

      const searchable = [
        position.security?.ticker,
        position.security?.name,
        position.security?.sector,
        position.side,
        
        flagText,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery);

      const matchesFilter =
        activeFilter === "All" ||
        (activeFilter === "Long" && position.side === "LONG") ||
        (activeFilter === "Short" && position.side === "SHORT") ||
        (activeFilter === "Winners" &&
          (getDisplayTotalPctChange(position) ?? 0) >= 0) ||
        (activeFilter === "Losers" &&
          (getDisplayTotalPctChange(position) ?? 0) < 0) ||
        (activeFilter === "Flagged" && position.flags?.length > 0) ||
        position.security?.sector?.toLowerCase().includes(activeFilter.toLowerCase());

      return matchesQuery && matchesFilter;
    })
    
    .sort((a, b) => {
      const aTotalPctChange = getDisplayTotalPctChange(a);
      const bTotalPctChange = getDisplayTotalPctChange(b);

      if (activeFilter === "Winners") {
        return (bTotalPctChange ?? 0) - (aTotalPctChange ?? 0);
      }

      if (activeFilter === "Losers") {
        return (aTotalPctChange ?? 0) - (bTotalPctChange ?? 0);
      }

      return (
        (getDisplayPortfolioPct(b, localPositions) ?? 0) -
        (getDisplayPortfolioPct(a, localPositions) ?? 0)
      );
    });

}, [localPositions, query, activeFilter]);

const longPositions = useMemo(
  () => filteredPositions.filter((position) => position.side === "LONG"),
  [filteredPositions]
);

const shortPositions = useMemo(
  () => filteredPositions.filter((position) => position.side === "SHORT"),
  [filteredPositions]
);

const {
  totalMarketValue,
  netMarketValue,
  totalUnrealizedPnl,
  dayPnl,
} = getDashboardStats(localPositions);

  async function handleSaveManualTrade(payload: {
    securityId: string;
    positionId: string;
    tradeType: string;
    dateTraded: string;
    shares: string;
    avgPrice: string;
    comment: string;
  }) {
    const response = await fetch("/api/trades/manual", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to add manual trade.");
    }

    const newTrade = data.trade;

    setLocalPositions((currentPositions) =>
      currentPositions.map((position) => {
        if (position.id !== payload.positionId) return position;

        return {
          ...position,
          trades: [newTrade, ...(position.trades || [])],
        };
      })
    );

    setSelectedPosition((currentPosition: any | null) => {
      if (!currentPosition || currentPosition.id !== payload.positionId) {
        return currentPosition;
      }

      return {
        ...currentPosition,
        trades: [newTrade, ...(currentPosition.trades || [])],
      };
    });
  }

  async function handleSaveComment(payload: {
  securityId: string;
  positionId: string;
  tag: string;
  content: string;
}) {
  const response = await fetch("/api/comments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Failed to save comment.");
  }

  const data = await response.json();
  const newComment = data.comment;

  setLocalPositions((currentPositions) =>
  currentPositions.map((position) => {
    if (position.securityId !== payload.securityId) return position;

    const updatedSecurity = {
      ...position.security,
      comments: [newComment, ...(position.security?.comments || [])],
    };

    if (position.id !== payload.positionId) {
      return {
        ...position,
        security: updatedSecurity,
      };
    }

    return {
      ...position,
      security: updatedSecurity,
      comments: [newComment, ...(position.comments || [])],
    };
  })
);

setSelectedPosition((currentPosition: any | null) => {
  if (!currentPosition || currentPosition.securityId !== payload.securityId) {
    return currentPosition;
  }

  const updatedSecurity = {
    ...currentPosition.security,
    comments: [newComment, ...(currentPosition.security?.comments || [])],
  };

  if (currentPosition.id !== payload.positionId) {
    return {
      ...currentPosition,
      security: updatedSecurity,
    };
  }

  return {
    ...currentPosition,
    security: updatedSecurity,
    comments: [newComment, ...(currentPosition.comments || [])],
  };
});
}

function handleTradeDeleted(
  positionId: string,
  tradeId: string
) {
  setLocalPositions((currentPositions) =>
    currentPositions.map((position) => {
      if (position.id !== positionId) {
        return position;
      }

      return {
        ...position,
        trades: (position.trades || []).filter(
          (trade: any) =>
            trade.id !== tradeId
        ),
      };
    })
  );

  setSelectedPosition(
    (currentPosition: any) => {
      if (
        !currentPosition ||
        currentPosition.id !==
          positionId
      ) {
        return currentPosition;
      }

      return {
        ...currentPosition,
        trades: (
          currentPosition.trades || []
        ).filter(
          (trade: any) =>
            trade.id !== tradeId
        ),
      };
    }
  );

  setExpandedTradeHistoryPosition(
    (currentPosition: any) => {
      if (
        !currentPosition ||
        currentPosition.id !==
          positionId
      ) {
        return currentPosition;
      }

      return {
        ...currentPosition,
        trades: (
          currentPosition.trades || []
        ).filter(
          (trade: any) =>
            trade.id !== tradeId
        ),
      };
    }
  );
}

function handleTradeNoteUpdated(
  positionId: string,
  tradeId: string,
  comment: string | null
) {
  function updateTrade(
    position: any
  ) {
    return {
      ...position,
      trades: (
        position.trades || []
      ).map((trade: any) =>
        trade.id === tradeId
          ? {
              ...trade,
              comment,
            }
          : trade
      ),
    };
  }

  setLocalPositions((currentPositions) =>
    currentPositions.map((position) =>
      position.id === positionId
        ? updateTrade(position)
        : position
    )
  );

  setSelectedPosition(
    (currentPosition: any) => {
      if (
        !currentPosition ||
        currentPosition.id !==
          positionId
      ) {
        return currentPosition;
      }

      return updateTrade(
        currentPosition
      );
    }
  );

  setExpandedTradeHistoryPosition(
    (currentPosition: any) => {
      if (
        !currentPosition ||
        currentPosition.id !==
          positionId
      ) {
        return currentPosition;
      }

      return updateTrade(
        currentPosition
      );
    }
  );
}

function handleSectorUpdated(
  securityId: string,
  sector: string
) {
  setLocalPositions((currentPositions) =>
    currentPositions.map((position) => {
      if (position.security.id !== securityId) {
        return position;
      }

      return {
        ...position,
        security: {
          ...position.security,
          sector,
        },
      };
    })
  );

  setSelectedPosition((currentPosition: any) => {
    if (
      !currentPosition ||
      currentPosition.security.id !== securityId
    ) {
      return currentPosition;
    }

    return {
      ...currentPosition,
      security: {
        ...currentPosition.security,
        sector,
      },
    };
  });
}


function handleOpenComment(position: any) {
  setSelectedPosition(position);
  setCommentPosition(position);
}

async function handleSaveFlag(payload: {
  securityId: string;
  positionId: string;
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
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error || "Failed to create flag."
    );
  }

  const newFlag = data.flag;

  setLocalPositions((currentPositions) =>
    currentPositions.map((position) => {
      if (position.id !== payload.positionId) return position;

      return {
        ...position,
        flags: [newFlag, ...(position.flags || [])],
      };
    })
  );

  setSelectedPosition((currentPosition: any | null) => {
    if (!currentPosition || currentPosition.id !== payload.positionId) {
      return currentPosition;
    }

    return {
      ...currentPosition,
      flags: [newFlag, ...(currentPosition.flags || [])],
    };
  });
}
  return (
    <main className="h-screen overflow-hidden bg-slate-100 text-slate-900">
      <div className="flex h-full">
        <AppSidebar activePage="/" />

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-20 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
            <div>
              <p className="text-sm font-medium text-slate-900">Home / Positions</p>
              <p className="text-xs text-slate-500">Active portfolio dashboard</p>
            </div>

            <div className="ml-4 flex items-center gap-3">
              
              <CurrentUserPill />
            </div>
          </header>

          <div className="flex min-h-0 flex-1">
            <div className="min-w-0 flex-1 overflow-auto p-6">
              <div className="space-y-5">
                <div className="flex items-end justify-between">
                  <div>
                    <h2 className="text-3xl font-semibold tracking-tight">
                      Home Page / Position Display
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Long and short positions with prices, daily move, market
                      value, portfolio %, shares, WAP, total change, market data,
                      flags, and comments.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setShowSummaryModal(true)
                    }
                    className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                  >
                    Summaries
                  </button>
                 
                </div>

                <div className="grid grid-cols-4 gap-4">
                  
                  <StatCard
                    label="Gross Investments"
                    value={formatMoney(totalMarketValue)}
                    sub={`${localPositions.length} active positions from Wells`}
                  />
 
                   <StatCard
                      label="Net Investments"
                      value={formatMoney(netMarketValue)}
                      sub="Long exposure less short exposure"
                    />

                  
                  <StatCard
                    label="Unrealized P&L"
                    value={formatMoney(totalUnrealizedPnl)}
                    sub="From Wells tax lot data"
                  />

                 <StatCard
                    label="Day P&L"
                    value={formatMoney(dayPnl)}
                    sub="Estimated from Finnhub day change"
                  />
                
                  

                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search ticker, company, side, sector, flags..."
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3">
                  {[
                    "All",
                    "Long",
                    "Short",
                    "Flagged",
                    ...Array.from(
                      new Set(
                        localPositions
                          .map(
                            (position) =>
                              position.security?.sector
                          )
                          .filter(Boolean)
                      )
                    ).sort(),
                  ].map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setActiveFilter(filter)}
                      className={`rounded-xl px-3 py-2 text-sm ${
                        activeFilter === filter
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {filter}
                    </button>
                  ))}

                <div className="ml-auto flex items-center gap-3">
                  <span className="text-sm text-slate-500">
                    Showing {filteredPositions.length} of {localPositions.length}
                  </span>

                  
                </div>
                </div>

                <PositionGrid
                  title="Long Positions"
                  tone="green"
                  positions={longPositions}
                  selectedId={selectedPosition?.id}
                  onSelect={setSelectedPosition}
                  onMarketData={setMarketDataPosition}
                  onComment={handleOpenComment}
                  canComment={userCanCreateComments}
                  portfolioPositions={localPositions}
                />

                
                <PositionGrid
                  title="Short Positions"
                  tone="red"
                  positions={shortPositions}
                  selectedId={selectedPosition?.id}
                  onSelect={setSelectedPosition}
                  onMarketData={setMarketDataPosition}
                  onComment={handleOpenComment}
                  canComment={userCanCreateComments}
                  portfolioPositions={localPositions}
                />
              </div>
            </div>

            
           
            
            <TickerDetailPanel
              position={selectedPosition}
              onClose={() => setSelectedPosition(null)}
              onComment={handleOpenComment}
              onMarketData={setMarketDataPosition}
              onFlag={setFlagPosition}
              onLots={setTaxLotsPosition}
              onAddTrade={setManualTradePosition}
              onExpandHistory={setExpandedTradeHistoryPosition}
              canComment={userCanCreateComments}
              canFlag={userCanCreateFlags}
              canEditSectors={userCanEditSectors}
              availableSectors={availableSectors}
              onSector={setSectorPosition}
            />

                          
            <AddTradeModal
              position={manualTradePosition}
              onClose={() => setManualTradePosition(null)}
              onSave={handleSaveManualTrade}
            />

                  
            <MarketDataModal
              position={marketDataPosition}
              onClose={() => setMarketDataPosition(null)}
            />


            <CommentModal
              position={commentPosition}
              onClose={() => setCommentPosition(null)}
              onSave={handleSaveComment}
            />
            <TaxLotsModal
              position={taxLotsPosition}
              onClose={() => setTaxLotsPosition(null)}
            />

            <ExpandedTradeHistoryModal
              position={expandedTradeHistoryPosition}
              onClose={() =>
                setExpandedTradeHistoryPosition(null)
              }
              onTradeDeleted={
                handleTradeDeleted
              }
              onTradeNoteUpdated={
                handleTradeNoteUpdated
              }
            />
            <SummaryModal
              open={showSummaryModal}
              onClose={() =>
                setShowSummaryModal(false)
              }
              positions={localPositions}
              fundEquitySnapshot={
                fundEquitySnapshot
              }
            />
            <FlagModal
              position={flagPosition}
              onClose={() => setFlagPosition(null)}
              onSave={handleSaveFlag}
            />

            <SectorModal
              position={sectorPosition}
              availableSectors={availableSectors}
              onClose={() =>
                setSectorPosition(null)
              }
              onSectorUpdated={
                handleSectorUpdated
              }
            />
          </div>
        </section>
      </div>
    </main>
  );
}