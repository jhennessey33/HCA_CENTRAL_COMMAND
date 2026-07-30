"use client";

import AppSidebar from "@/components/common/AppSidebar";

import LocalDateTime from "@/components/common/LocalDateTime";
import Badge from "@/components/common/Badge";
import { useEffect, useMemo, useRef, useState } from "react";
import { canCreateComments, canEditWatchlist } from "@/lib/client-permissions";
import CurrentUserPill from "@/components/auth/CurrentUserPill";

type SecurityOption = {
  id: string;
  ticker: string;
  name: string;
  sector?: string | null;
  industry?: string | null;
};

type WatchlistClientProps = {
  initialEntries: WatchlistEntry[];
  portfolioSecurities: PortfolioSecurity[];
  securities: SecurityOption[];
  mode?: "WATCHLIST" | "PORTFOLIO";
};
type WatchlistAuthor = {
  id?: string;
  name?: string | null;
  email?: string | null;
};

type WatchlistComment = {
  id: string;
  tag: string;
  content: string;
  createdAt: string;
  author?: WatchlistAuthor | null;
};

type WatchlistFlag = {
  id: string;
  flagType: string;
};

type WatchlistMarketData = {
  currentPrice?: number | null;
  marketDataSource?: string | null;
  fundamentalsSource?: string | null;
  dataQuality?: string | null;

  vwap?: number | null;
  high52w?: number | null;
  low52w?: number | null;
  beta?: number | null;
  avgVolume?: number | null;
  shortFloat?: number | null;
  marketCap?: number | null;

  peLtm?: number | null;
  priceToTangBook?: number | null;
  peNtm?: number | null;
  priceToBook?: number | null;
  debtToEbitda?: number | null;
  eps?: number | null;

  lastMarketDataRefreshAt?: string | Date | null;
  lastFundamentalsRefreshAt?: string | Date | null;
};

type PortfolioSecurity = {
  id: string;
  ticker: string;
  name: string;
};

type WatchlistEntry = {
  id: string;

  securityId: string;

  side: "LONG" | "SHORT";

  targetPrice?: number | null;
  entryTargetPrice?: number | null;
  exitTargetPrice?: number | null;

  notes?: string | null;

  comments?: WatchlistComment[];
  flags?: WatchlistFlag[];

  security: {
    ticker: string;
    name: string;
    sector?: string | null;

    comments?: WatchlistComment[];

    marketData?: WatchlistMarketData[];
  };
};

function SectionBar({ title, tone }: { title: string; tone: "green" | "red" }) {
  const toneClass =
    tone === "green" ? "bg-emerald-700 text-white" : "bg-red-600 text-white";

  return (
    <div
      className={`rounded-t-2xl px-4 py-2 text-center text-xs font-bold uppercase tracking-widest ${toneClass}`}
    >
      {title}
    </div>
  );
}

function formatMoney(value: number | null | undefined) {
  if (value == null) return "—";

  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function getCapitalIqUrl(ticker: string) {
  const normalizedTicker = ticker.trim().toLowerCase();

  return `https://www.capitaliq.spglobal.com/apisv3/spg-webplatform-core/search/searchResults?vertical=&q=${encodeURIComponent(
    normalizedTicker,
  )}`;
}

function openCapitalIq(ticker: string) {
  window.open(getCapitalIqUrl(ticker), "_blank");
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
function pctClass(value: number | null | undefined) {
  if (value == null) return "text-slate-500";
  return value >= 0 ? "text-emerald-600" : "text-rose-600";
}

function getWatchlistCurrentPrice(entry: WatchlistEntry) {
  const marketData = entry.security?.marketData?.[0];

  if (marketData?.marketDataSource !== "FINNHUB") {
    return null;
  }

  const currentPrice = Number(marketData.currentPrice);

  if (!Number.isFinite(currentPrice)) {
    return null;
  }

  return currentPrice;
}

function calculateFromTarget(
  currentPrice?: number | null,
  targetPrice?: number | null,
) {
  if (currentPrice == null || targetPrice == null || currentPrice === 0) {
    return null;
  }

  return ((targetPrice - currentPrice) / currentPrice) * 100;
}
function getEntryTargetPrice(entry: WatchlistEntry) {
  return entry.entryTargetPrice ?? entry.targetPrice ?? null;
}

function getExitTargetPrice(entry: WatchlistEntry) {
  return entry.exitTargetPrice ?? null;
}

function getEntryTargetLabel(side: string) {
  return side === "SHORT" ? "Sell PT" : "Buy PT";
}

function getExitTargetLabel(side: string) {
  return side === "SHORT" ? "Cover PT" : "Sell PT";
}
function formatPercent(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";

  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function getWatchlistComments(entry: WatchlistEntry) {
  const byId = new Map<string, any>();

  const securityComments = entry.security?.comments ?? [];
  const watchlistComments = entry.comments ?? [];

  [...securityComments, ...watchlistComments].forEach((comment) => {
    if (!comment?.id) return;

    byId.set(comment.id, comment);
  });

  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

function WatchlistGrid({
  title,
  tone,
  entries,
  onSelect,
  onMarketData,
  onComment,
  onEdit,
  onRemove,
  canComment,
  canEdit,
  confirmRemoveEntryId,
  setConfirmRemoveEntryId,
}: {
  title: string;
  tone: "green" | "red";
  entries: any[];
  onSelect: (entry: WatchlistEntry) => void;
  onMarketData: (entry: WatchlistEntry) => void;
  onComment: (entry: WatchlistEntry) => void;
  onEdit: (entry: WatchlistEntry) => void;
  onRemove: (entry: WatchlistEntry) => void;
  canComment: boolean;
  canEdit: boolean;
  confirmRemoveEntryId: string | null;
  setConfirmRemoveEntryId: (id: string | null) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <SectionBar title={title} tone={tone} />

      <div className="overflow-x-auto">
        <div className="grid min-w-[1320px] grid-cols-10 border-b bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <div className="col-span-2">Ticker # / Name</div>
          <div>Current Price</div>
          <div>{tone === "green" ? "Buy PT" : "Sell PT"}</div>
          <div>{tone === "green" ? "% From Buy" : "% From Sell"}</div>
          <div>{tone === "green" ? "Sell PT" : "Cover PT"}</div>
          <div>{tone === "green" ? "% From Sell" : "% From Cover"}</div>
          <div>Market Data</div>
          <div>Comment Section</div>
          <div>Actions</div>
        </div>

        {entries.map((entry) => {
          const currentPrice = getWatchlistCurrentPrice(entry);

          const entryTargetPrice = getEntryTargetPrice(entry);

          const exitTargetPrice = getExitTargetPrice(entry);

          const fromEntryTarget = calculateFromTarget(
            currentPrice,
            entryTargetPrice,
          );

          const fromExitTarget = calculateFromTarget(
            currentPrice,
            exitTargetPrice,
          );

          const openFlag = entry.flags?.[0];
          const latestComment = getWatchlistComments(entry).find(
            (comment: any) => comment.tag !== "PT",
          );

          return (
            <div
              key={entry.id}
              className="grid min-w-[1320px] grid-cols-10 items-center border-b border-slate-100 px-4 py-3 text-xs transition hover:bg-slate-50"
            >
              <button
                onClick={() => onSelect(entry)}
                className="col-span-2 flex items-center gap-1 text-left font-semibold text-slate-950 hover:underline"
              >
                {entry.security.ticker}
                {openFlag ? (
                  <span className="text-amber-500" title={openFlag.flagType}>
                    ⚑
                  </span>
                ) : null}
                <span className="ml-1 truncate font-normal text-slate-500">
                  {entry.security.name}
                </span>
              </button>

              <div>{formatMoney(currentPrice)}</div>

              <div className="font-semibold text-slate-900">
                {formatMoney(entryTargetPrice)}
              </div>

              <div className={`font-semibold ${pctClass(fromEntryTarget)}`}>
                {formatPercent(fromEntryTarget)}
              </div>

              <div className="font-semibold text-slate-900">
                {formatMoney(exitTargetPrice)}
              </div>

              <div className={`font-semibold ${pctClass(fromExitTarget)}`}>
                {formatPercent(fromExitTarget)}
              </div>

              <div>
                <button
                  onClick={() => openCapitalIq(entry.security.ticker)}
                  className="rounded-xl bg-slate-100 px-2 py-1 font-medium text-slate-700 hover:bg-slate-200"
                >
                  Capital IQ
                </button>
              </div>

              <div>
                {canComment ? (
                  <button
                    onClick={() => onComment(entry)}
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

              <div className="flex gap-2">
                {canEdit ? (
                  <>
                    <button
                      onClick={() => onEdit(entry)}
                      className="rounded-xl bg-slate-100 px-2 py-1 font-medium text-slate-700 hover:bg-slate-200"
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => {
                        if (confirmRemoveEntryId === entry.id) {
                          onRemove(entry);
                          return;
                        }

                        setConfirmRemoveEntryId(entry.id);
                      }}
                      className={`rounded-xl px-2 py-1 font-medium ${confirmRemoveEntryId === entry.id
                        ? "bg-rose-600 text-white hover:bg-rose-700"
                        : "bg-rose-50 text-rose-700 hover:bg-rose-100"
                        }`}
                    >
                      {confirmRemoveEntryId === entry.id
                        ? "Confirm Remove"
                        : "Remove"}
                    </button>
                  </>
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

function MarketDataModal({
  entry,
  onClose,
}: {
  entry: WatchlistEntry | null;
  onClose: () => void;
}) {
  if (!entry) return null;

  const security = entry.security;
  const marketData = security.marketData?.[0];

  const rows = [
    [
      "VWAP",
      marketData?.vwap != null ? `$${marketData.vwap.toFixed(2)}` : "N/A",
    ],
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
    [
      "P/LTM EPS",
      marketData?.peLtm != null ? `${marketData.peLtm.toFixed(1)}x` : "N/A",
    ],
    [
      "Price/Tang Book",
      marketData?.priceToTangBook != null
        ? `${marketData.priceToTangBook.toFixed(1)}x`
        : "N/A",
    ],
    [
      "P/NTM EPS",
      marketData?.peNtm != null ? `${marketData.peNtm.toFixed(1)}x` : "N/A",
    ],
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
              className={`grid grid-cols-2 px-4 py-3 text-sm ${index % 2 === 0 ? "bg-slate-50" : "bg-white"
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
            <span className="font-medium text-slate-700">
              Market Data Source
            </span>
            <span className="text-right font-semibold text-slate-950">
              {marketData?.marketDataSource ?? "N/A"}
            </span>
            <span className="font-medium text-slate-700">
              Fundamentals Source
            </span>
            <span className="text-right font-semibold text-slate-950">
              {marketData?.fundamentalsSource ?? "N/A"}
            </span>
            <span className="font-medium text-slate-700">Data Quality</span>
            <span className="text-right font-semibold text-slate-950">
              {marketData?.dataQuality ?? "N/A"}
            </span>
            <span className="font-medium text-slate-700">
              Last Market Refresh
            </span>
            <span className="text-right font-semibold text-slate-950">
              {marketData?.lastMarketDataRefreshAt
                ? formatDateTime(marketData.lastMarketDataRefreshAt)
                : "N/A"}
            </span>
            <span className="font-medium text-slate-700">
              Last Fundamentals Refresh
            </span>
            <span className="text-right font-semibold text-slate-950">
              {marketData?.lastFundamentalsRefreshAt
                ? formatDateTime(marketData.lastFundamentalsRefreshAt)
                : "N/A"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
function WatchlistDetailPanel({
  entry,
  onClose,
  onEdit,
  onRemove,
  canEdit,
  confirmRemoveEntryId,
  setConfirmRemoveEntryId,
}: {
  entry: WatchlistEntry | null;
  onClose: () => void;
  onEdit: (entry: WatchlistEntry) => void;
  onRemove: (entry: WatchlistEntry) => void;
  canEdit: boolean;
  confirmRemoveEntryId: string | null;
  setConfirmRemoveEntryId: (id: string | null) => void;
}) {
  const [showAllComments, setShowAllComments] = useState(false);
  const [showAllPtHistory, setShowAllPtHistory] = useState(false);

  useEffect(() => {
    setShowAllComments(false);
    setShowAllPtHistory(false);
  }, [entry?.id]);

  if (!entry) return null;

  const security = entry.security;
  const marketData = security.marketData?.[0];

  const currentPrice = getWatchlistCurrentPrice(entry);

  const entryTargetPrice = getEntryTargetPrice(entry);

  const exitTargetPrice = getExitTargetPrice(entry);

  const fromEntryTarget = calculateFromTarget(currentPrice, entryTargetPrice);

  const fromExitTarget = calculateFromTarget(currentPrice, exitTargetPrice);

  const entryTargetLabel = getEntryTargetLabel(entry.side);

  const exitTargetLabel = getExitTargetLabel(entry.side);

  const allComments = getWatchlistComments(entry);

  const comments = allComments.filter((comment: any) => comment.tag !== "PT");

  const ptComments = allComments.filter((comment: any) => comment.tag === "PT");

  const visibleComments = showAllComments ? comments : comments.slice(0, 5);
  const visiblePtComments = showAllPtHistory
    ? ptComments
    : ptComments.slice(0, 5);

  const hiddenCommentCount = Math.max(0, comments.length - 5);
  const hiddenPtCommentCount = Math.max(0, ptComments.length - 5);

  return (
    <aside className="flex h-full w-[460px] shrink-0 flex-col border-l border-slate-200 bg-white shadow-xl">
      <div className="border-b border-slate-200 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold text-slate-950">
                {security.ticker}
              </h2>

              <Badge tone={entry.side === "SHORT" ? "red" : "green"}>
                {entry.side}
              </Badge>
            </div>

            <p className="mt-1 text-sm text-slate-500">{security.name}</p>
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
              {formatMoney(currentPrice)}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Market Data Source</p>

            <p className="mt-1 font-semibold text-slate-950">
              {marketData?.marketDataSource ?? "N/A"}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">{entryTargetLabel}</p>

            <p className="mt-1 font-semibold text-slate-950">
              {formatMoney(entryTargetPrice)}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">% From {entryTargetLabel}</p>

            <p className={`mt-1 font-semibold ${pctClass(fromEntryTarget)}`}>
              {formatPercent(fromEntryTarget)}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">{exitTargetLabel}</p>

            <p className="mt-1 font-semibold text-slate-950">
              {formatMoney(exitTargetPrice)}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">% From {exitTargetLabel}</p>

            <p className={`mt-1 font-semibold ${pctClass(fromExitTarget)}`}>
              {formatPercent(fromExitTarget)}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {canEdit ? (
            <>
              <button
                onClick={() => onEdit(entry)}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Edit
              </button>

              <button
                onClick={() => {
                  if (confirmRemoveEntryId === entry.id) {
                    onRemove(entry);
                    return;
                  }

                  setConfirmRemoveEntryId(entry.id);
                }}
                className={`rounded-2xl px-4 py-2 text-sm font-medium ${confirmRemoveEntryId === entry.id
                  ? "bg-rose-600 text-white hover:bg-rose-700"
                  : "border border-rose-100 bg-rose-50 text-rose-700 hover:bg-rose-100"
                  }`}
              >
                {confirmRemoveEntryId === entry.id
                  ? "Confirm Remove"
                  : "Remove"}
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-5">
        <section className="mt-5">
          <h3 className="mb-3 font-semibold text-slate-950">
            Comment Timeline
          </h3>

          <div className="space-y-3">
            {comments.length ? (
              visibleComments.map((comment: any) => (
                <div
                  key={comment.id}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <div className="flex items-center justify-between">
                    <Badge tone="blue">{comment.tag}</Badge>
                    <LocalDateTime
                      value={comment.createdAt}
                      className="text-xs text-slate-400"
                    />
                  </div>

                  <p className="mt-3 text-sm text-slate-700">
                    {comment.content}
                  </p>

                  <p className="mt-2 text-xs text-slate-400">
                    by{" "}
                    {comment.author?.name || comment.author?.email || "Unknown"}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-500">
                No comments yet.
              </div>
            )}
            {comments.length > 5 ? (
              <button
                type="button"
                onClick={() => setShowAllComments((current) => !current)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                {showAllComments
                  ? "Show less"
                  : `Show ${hiddenCommentCount} more comment${hiddenCommentCount === 1 ? "" : "s"}`}
              </button>
            ) : null}
          </div>
        </section>

        <section className="mt-5">
          <h3 className="mb-3 font-semibold text-slate-950">PT History</h3>

          <div className="space-y-3">
            {ptComments.length ? (
              visiblePtComments.map((comment: any) => (
                <div
                  key={comment.id}
                  className="rounded-2xl border border-blue-100 bg-blue-50 p-4"
                >
                  <div className="flex items-center justify-between">
                    <Badge tone="blue">PT</Badge>
                    <LocalDateTime
                      value={comment.createdAt}
                      className="text-xs text-slate-400"
                    />
                  </div>

                  <p className="mt-3 text-sm text-slate-700">
                    {comment.content}
                  </p>

                  <p className="mt-2 text-xs text-slate-400">
                    by{" "}
                    {comment.author?.name || comment.author?.email || "Unknown"}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-500">
                No PT history yet.
              </div>
            )}
            {ptComments.length > 5 ? (
              <button
                type="button"
                onClick={() => setShowAllPtHistory((current) => !current)}
                className="w-full rounded-2xl border border-blue-100 bg-white px-4 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"
              >
                {showAllPtHistory
                  ? "Show less"
                  : `Show ${hiddenPtCommentCount} more PT change${hiddenPtCommentCount === 1 ? "" : "s"}`}
              </button>
            ) : null}
          </div>
        </section>

        <section className="mt-5">
          <h3 className="mb-3 font-semibold text-slate-950">Refresh Info</h3>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
            <div className="flex justify-between gap-4">
              <span>Last Market Refresh</span>
              <span className="font-semibold text-slate-800">
                {marketData?.lastMarketDataRefreshAt
                  ? formatDateTime(marketData.lastMarketDataRefreshAt)
                  : "N/A"}
              </span>
            </div>
          </div>
        </section>
      </div>
    </aside>
  );
}

function AddStockModal({
  open,
  onClose,
  onAdd,
  portfolioSecurities,
  securities,
  mode,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (payload: {
    ticker: string;
    side: string;
    targetType: string;
    targetPrice: string;
    comment: string;
  }) => Promise<void>;
  portfolioSecurities: PortfolioSecurity[];
  securities: SecurityOption[];
  mode: "WATCHLIST" | "PORTFOLIO";
}) {
  const [selectedSecurityId, setSelectedSecurityId] = useState("");
  const [securitySearchQuery, setSecuritySearchQuery] = useState("");
  const [isSecurityDropdownOpen, setIsSecurityDropdownOpen] = useState(false);
  const [highlightedSecurityIndex, setHighlightedSecurityIndex] = useState(0);

  const [side, setSide] = useState("LONG");
  const [targetType, setTargetType] = useState("BUY");
  const [targetPrice, setTargetPrice] = useState("");
  const [comment, setComment] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const securityComboboxRef = useRef<HTMLDivElement | null>(null);

  const selectedSecurity =
    securities.find((security) => security.id === selectedSecurityId) ?? null;

  const filteredSecurities = useMemo(() => {
    const normalizedQuery = securitySearchQuery.trim().toLowerCase();

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
  }, [securities, securitySearchQuery]);

  const activePortfolioSecurityIds = useMemo(
    () => new Set(portfolioSecurities.map((security) => security.id)),
    [portfolioSecurities],
  );

  const isActivePortfolioSecurity = selectedSecurity
    ? activePortfolioSecurityIds.has(selectedSecurity.id)
    : false;

  useEffect(() => {
    setHighlightedSecurityIndex(0);
  }, [securitySearchQuery]);

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
        setSecuritySearchQuery(
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

  if (!open) return null;

  function resetForm() {
    setSelectedSecurityId("");
    setSecuritySearchQuery("");
    setIsSecurityDropdownOpen(false);
    setHighlightedSecurityIndex(0);
    setSide("LONG");
    setTargetType("BUY");
    setTargetPrice("");
    setComment("");
    setError("");
  }

  function handleClose() {
    if (isSaving) {
      return;
    }

    resetForm();
    onClose();
  }

  function handleSecurityChange(securityId: string) {
    const security =
      securities.find((option) => option.id === securityId) ?? null;

    setSelectedSecurityId(securityId);
    setSecuritySearchQuery(
      security ? `${security.ticker} — ${security.name}` : "",
    );
    setIsSecurityDropdownOpen(false);
    setHighlightedSecurityIndex(0);
    setError("");
  }

  function handleClearSecurity() {
    setSelectedSecurityId("");
    setSecuritySearchQuery("");
    setIsSecurityDropdownOpen(true);
    setHighlightedSecurityIndex(0);
    setError("");
  }

  function handleSecurityKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
  ) {
    const optionCount = filteredSecurities.length;

    if (event.key === "Escape") {
      setIsSecurityDropdownOpen(false);
      setSecuritySearchQuery(
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

      const highlightedSecurity =
        filteredSecurities[highlightedSecurityIndex];

      if (highlightedSecurity) {
        handleSecurityChange(highlightedSecurity.id);
      }
    }
  }

  async function handleSubmit() {
    setError("");

    if (!selectedSecurity) {
      setError("Select a security from the search results.");
      return;
    }

    if (mode === "WATCHLIST" && isActivePortfolioSecurity) {
      setError(
        "This security is already an active portfolio position. Use the Portfolio view instead.",
      );
      return;
    }

    setIsSaving(true);

    try {
      await onAdd({
        ticker: selectedSecurity.ticker,
        side,
        targetType,
        targetPrice,
        comment,
      });

      resetForm();
      onClose();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to add stock. Please try again.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">
              Add Watchlist Stock
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Add to the long or short watchlist.
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

        <div className="mt-5 space-y-3">
          <div ref={securityComboboxRef} className="relative">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Security
            </label>

            <div className="relative mt-2">
              <input
                value={securitySearchQuery}
                onFocus={() => {
                  if (selectedSecurityId) {
                    setSecuritySearchQuery("");
                  }

                  setIsSecurityDropdownOpen(true);
                }}
                onChange={(event) => {
                  setSecuritySearchQuery(event.target.value);

                  if (selectedSecurityId) {
                    setSelectedSecurityId("");
                  }

                  setIsSecurityDropdownOpen(true);
                  setError("");
                }}
                onKeyDown={handleSecurityKeyDown}
                placeholder="Search ticker, company, sector, or industry..."
                autoComplete="off"
                role="combobox"
                aria-expanded={isSecurityDropdownOpen}
                aria-controls="watchlist-security-options"
                aria-autocomplete="list"
                disabled={isSaving}
                className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-4 pr-20 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50"
              />

              <div className="absolute inset-y-0 right-3 flex items-center gap-1">
                {selectedSecurityId || securitySearchQuery ? (
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
                id="watchlist-security-options"
                role="listbox"
                className="absolute z-40 mt-2 max-h-80 w-full overflow-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl"
              >
                {filteredSecurities.length ? (
                  filteredSecurities.map((security, index) => {
                    const isHighlighted = highlightedSecurityIndex === index;
                    const isSelected = selectedSecurityId === security.id;
                    const isPortfolioSecurity =
                      activePortfolioSecurityIds.has(security.id);

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

                            {isPortfolioSecurity ? (
                              <span className="rounded-lg bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                                Portfolio
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

          {mode === "WATCHLIST" && isActivePortfolioSecurity ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              This security is currently an active portfolio position and will
              appear in the Portfolio view instead of the Watchlist.
            </div>
          ) : null}

          {selectedSecurity ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-950">
                    {selectedSecurity.ticker}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-600">
                    {selectedSecurity.name}
                  </p>
                </div>

                {selectedSecurity.sector ? (
                  <span className="rounded-lg bg-white px-2 py-1 text-[10px] font-medium text-slate-500 ring-1 ring-slate-200">
                    {selectedSecurity.sector}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}

          {mode === "PORTFOLIO" && portfolioSecurities.length ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Current Portfolio
              </p>

              <div className="flex max-h-32 flex-wrap gap-2 overflow-auto">
                {portfolioSecurities.map((security) => (
                  <button
                    key={security.id}
                    type="button"
                    onClick={() => handleSecurityChange(security.id)}
                    disabled={isSaving}
                    className="rounded-xl bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                    title={security.name}
                  >
                    {security.ticker}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Watchlist Side
            </label>

            <select
              value={side}
              onChange={(event) => {
                const nextSide = event.target.value;
                setSide(nextSide);
                setTargetType(nextSide === "SHORT" ? "SELL" : "BUY");
              }}
              disabled={isSaving}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50"
            >
              <option value="LONG">Long Watchlist</option>
              <option value="SHORT">Short Watchlist</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Target Type
            </label>

            <select
              value={targetType}
              onChange={(event) => setTargetType(event.target.value)}
              disabled={isSaving}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50"
            >
              {side === "LONG" ? (
                <>
                  <option value="BUY">Buy PT</option>
                  <option value="SELL">Sell PT</option>
                </>
              ) : (
                <>
                  <option value="SELL">Sell PT</option>
                  <option value="COVER">Cover PT</option>
                </>
              )}
            </select>

            <p className="mt-1 text-xs text-slate-500">
              {side === "LONG"
                ? targetType === "BUY"
                  ? "Price where the long position may be initiated or added."
                  : "Price where the long position may be sold or exited."
                : targetType === "SELL"
                  ? "Price where the short position may be initiated or added."
                  : "Price where the short position may be covered."}
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {targetType === "BUY"
                ? "Buy PT"
                : targetType === "COVER"
                  ? "Cover PT"
                  : "Sell PT"}
            </label>

            <input
              value={targetPrice}
              onChange={(event) => setTargetPrice(event.target.value)}
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              disabled={isSaving}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50"
              placeholder={`Enter ${
                targetType === "BUY"
                  ? "buy"
                  : targetType === "COVER"
                    ? "cover"
                    : "sell"
              } price target`}
            />
          </div>

          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            disabled={isSaving}
            className="h-28 w-full resize-none rounded-2xl border border-slate-200 p-4 text-sm outline-none focus:ring-2 focus:ring-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50"
            placeholder="Comment section..."
          />
        </div>

        {error ? (
          <p className="mt-3 text-sm font-medium text-rose-600">{error}</p>
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
            onClick={handleSubmit}
            disabled={
              isSaving ||
              !selectedSecurity ||
              (mode === "WATCHLIST" && isActivePortfolioSecurity)
            }
            className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Adding..." : "Add Stock"}
          </button>
        </div>
      </div>
    </div>
  );
}


function EditWatchlistModal({
  entry,
  mode,
  onClose,
  onSave,
}: {
  entry: any | null;
  mode: "WATCHLIST" | "PORTFOLIO";
  onClose: () => void;
  onSave: (
    entry: any,
    payload: {
      side: string;
      entryTargetPrice: string;
      exitTargetPrice: string;
      notes: string;
      ptChangeComment: string;
    },
  ) => Promise<void>;
}) {
  const [side, setSide] = useState("LONG");
  const [entryTargetPrice, setEntryTargetPrice] = useState("");
  const [exitTargetPrice, setExitTargetPrice] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [ptChangeComment, setPtChangeComment] = useState("");

  const originalEntryTargetPrice =
    entry?.entryTargetPrice != null
      ? String(entry.entryTargetPrice)
      : entry?.targetPrice != null
        ? String(entry.targetPrice)
        : "";

  const originalExitTargetPrice =
    entry?.exitTargetPrice != null ? String(entry.exitTargetPrice) : "";

  const entryTargetChanged =
    String(entryTargetPrice || "") !== originalEntryTargetPrice;

  const exitTargetChanged =
    String(exitTargetPrice || "") !== originalExitTargetPrice;

  const targetPriceChanged = entryTargetChanged || exitTargetChanged;

  const entryTargetLabel = side === "SHORT" ? "Sell PT" : "Buy PT";

  const exitTargetLabel = side === "SHORT" ? "Cover PT" : "Sell PT";

  useEffect(() => {
    if (!entry) return;

    setSide(entry.side || "LONG");

    setEntryTargetPrice(
      entry.entryTargetPrice != null
        ? String(entry.entryTargetPrice)
        : entry.targetPrice != null
          ? String(entry.targetPrice)
          : "",
    );

    setExitTargetPrice(
      entry.exitTargetPrice != null ? String(entry.exitTargetPrice) : "",
    );

    setPtChangeComment("");
    setError("");
  }, [entry]);

  if (!entry) return null;

  async function handleSave() {
    setError("");

    if (targetPriceChanged && !ptChangeComment.trim()) {
      setError("Please enter a reason for changing the price targets.");
      return;
    }

    setIsSaving(true);

    try {
      await onSave(entry, {
        side,
        entryTargetPrice,
        exitTargetPrice,
        notes: entry.notes || "",
        ptChangeComment,
      });

      onClose();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to update watchlist item.",
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
              {mode === "PORTFOLIO"
                ? "Edit Portfolio Targets"
                : "Edit Watchlist Item"}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {entry.security.ticker} • {entry.security.name}
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

        <div className="mt-5 space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {mode === "PORTFOLIO" ? "Portfolio Side" : "Watchlist Side"}
            </label>

            <select
              value={side}
              onChange={(event) => setSide(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value="LONG">
                {mode === "PORTFOLIO" ? "Long Portfolio" : "Long Watchlist"}
              </option>

              <option value="SHORT">
                {mode === "PORTFOLIO" ? "Short Portfolio" : "Short Watchlist"}
              </option>
            </select>

            <p className="mt-1 text-xs text-slate-500">
              Changing sides relabels the entry and exit targets but preserves
              their values.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {entryTargetLabel}
              </label>

              <input
                value={entryTargetPrice}
                onChange={(event) => setEntryTargetPrice(event.target.value)}
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
                placeholder={`Enter ${entryTargetLabel.toLowerCase()}`}
              />

              <p className="mt-1 text-xs text-slate-500">
                {side === "SHORT"
                  ? "Price where the short may be initiated or added."
                  : "Price where the long may be initiated or added."}
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {exitTargetLabel}
              </label>

              <input
                value={exitTargetPrice}
                onChange={(event) => setExitTargetPrice(event.target.value)}
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
                placeholder={`Enter ${exitTargetLabel.toLowerCase()}`}
              />

              <p className="mt-1 text-xs text-slate-500">
                {side === "SHORT"
                  ? "Price where the short may be covered."
                  : "Price where the long may be sold or exited."}
              </p>
            </div>
          </div>

          {targetPriceChanged ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
              <label className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                Reason for PT Change Required
              </label>

              <textarea
                value={ptChangeComment}
                onChange={(event) => setPtChangeComment(event.target.value)}
                className="mt-2 h-24 w-full resize-none rounded-2xl border border-amber-200 bg-white p-4 text-sm outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="Explain why one or both price targets are changing..."
              />
            </div>
          ) : null}
        </div>

        {error ? (
          <p className="mt-3 text-sm font-medium text-rose-600">{error}</p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
function CommentModal({
  entry,
  onClose,
  onSave,
}: {
  entry: any | null;
  onClose: () => void;
  onSave: (payload: {
    securityId: string;
    watchlistEntryId: string;
    tag: string;
    content: string;
  }) => Promise<void>;
}) {
  const [tag, setTag] = useState("COMMENT");
  const [content, setContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  if (!entry) return null;

  const latestComment = getWatchlistComments(entry)[0];

  async function handleSave() {
    setError("");

    if (!content.trim()) {
      setError("Please enter a comment.");
      return;
    }

    setIsSaving(true);

    try {
      await onSave({
        securityId: entry.securityId,
        watchlistEntryId: entry.id,
        tag,
        content,
      });

      setContent("");
      setTag("COMMENT");
      onClose();
    } catch {
      setError("Failed to save comment. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  const categories = [
    ["COMMENT", "Comment"],
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
              {entry.security.ticker} • timestamp and author are captured
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
              className={`rounded-2xl px-3 py-2 text-sm ${tag === value
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
          {latestComment?.content || entry.notes || "No comment yet."}
        </div>

        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Write a watchlist note, thesis, risk, catalyst, or trade setup..."
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
export default function WatchlistClient({
  initialEntries,
  portfolioSecurities,
  securities,
  mode = "WATCHLIST",
}: WatchlistClientProps) {
  const [entries, setEntries] = useState<any[]>(initialEntries);
  const [isPinkThemeActive, setIsPinkThemeActive] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [marketDataEntry, setMarketDataEntry] = useState<any | null>(null);
  const [query, setQuery] = useState("");
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const userCanEditWatchlist = canEditWatchlist(currentUser?.role);
  const userCanCreateComments = canCreateComments(currentUser?.role);
  const [commentEntry, setCommentEntry] = useState<any | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<any | null>(null);
  const [editingEntry, setEditingEntry] = useState<any | null>(null);
  const [confirmRemoveEntryId, setConfirmRemoveEntryId] = useState<
    string | null
  >(null);
  const activeSecurityIds = useMemo(
    () => new Set(portfolioSecurities.map((security) => security.id)),
    [portfolioSecurities],
  );

  useEffect(() => {
    const rootElement = document.documentElement;

    function syncPinkThemeState() {
      setIsPinkThemeActive(
        rootElement.classList.contains("hca-pink-theme"),
      );
    }

    syncPinkThemeState();

    const observer = new MutationObserver(syncPinkThemeState);

    observer.observe(rootElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!confirmRemoveEntryId) {
      return;
    }

    const timeout = setTimeout(() => {
      setConfirmRemoveEntryId(null);
    }, 5000);

    return () => clearTimeout(timeout);
  }, [confirmRemoveEntryId]);

  useEffect(() => {
    async function loadCurrentUser() {
      const response = await fetch("/api/auth/me");

      if (!response.ok) return;

      const data = await response.json();
      setCurrentUser(data.user);
    }

    loadCurrentUser();
  }, []);
  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const modeFilteredEntries =
      mode === "PORTFOLIO"
        ? entries.filter((entry) => activeSecurityIds.has(entry.securityId))
        : entries.filter((entry) => !activeSecurityIds.has(entry.securityId));
    if (!normalizedQuery) {
      return modeFilteredEntries;
    }

    return modeFilteredEntries.filter((entry) => {
      const commentText =
        entry.comments?.map((comment: any) => comment.content).join(" ") || "";
      const flagText =
        entry.flags?.map((flag: any) => flag.flagType).join(" ") || "";

      const searchable = [
        entry.security?.ticker,
        entry.security?.name,
        entry.security?.sector,
        entry.side,
        getEntryTargetLabel(entry.side),
        getExitTargetLabel(entry.side),
        getEntryTargetPrice(entry),
        getExitTargetPrice(entry),
        entry.notes,
        commentText,
        flagText,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(normalizedQuery);
    });
  }, [entries, query, mode, activeSecurityIds]);

  const longEntries = useMemo(
    () => filteredEntries.filter((entry) => entry.side === "LONG"),
    [filteredEntries],
  );

  const shortEntries = useMemo(
    () => filteredEntries.filter((entry) => entry.side === "SHORT"),
    [filteredEntries],
  );

  async function handleAddEntry(payload: {
    ticker: string;
    side: string;
    targetType: string;
    targetPrice: string;
    comment: string;
  }) {
    const response = await fetch("/api/watchlist", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to add watchlist entry.");
    }

    setEntries((currentEntries) => {
      const entryAlreadyExists = currentEntries.some(
        (entry) => entry.id === data.entry.id,
      );

      if (entryAlreadyExists) {
        return currentEntries.map((entry) =>
          entry.id === data.entry.id ? data.entry : entry,
        );
      }

      return [data.entry, ...currentEntries];
    });

    setSelectedEntry((currentEntry: any | null) =>
      currentEntry?.id === data.entry.id ? data.entry : currentEntry,
    );
  }

  async function handleSaveComment(payload: {
    securityId: string;
    watchlistEntryId: string;
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

    setEntries((currentEntries: any[]) =>
      currentEntries.map((entry) => {
        if (entry.id !== payload.watchlistEntryId) return entry;

        return {
          ...entry,
          security: {
            ...entry.security,
            comments: [newComment, ...(entry.security?.comments || [])],
          },
        };
      }),
    );

    setSelectedEntry((currentEntry: any | null) => {
      if (!currentEntry || currentEntry.id !== payload.watchlistEntryId) {
        return currentEntry;
      }

      return {
        ...currentEntry,
        comments: [newComment, ...(currentEntry.comments || [])],
      };
    });
  }

  async function handleSaveEdit(
    entry: any,
    payload: {
      side: string;
      entryTargetPrice: string;
      exitTargetPrice: string;
      notes: string;
      ptChangeComment: string;
    },
  ) {
    const response = await fetch(`/api/watchlist/${entry.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || data.detail || "Failed to update watchlist item.",
      );
    }

    const updatedEntry = data.watchlistEntry;

    setEntries((currentEntries: any[]) =>
      currentEntries.map((currentEntry: any) =>
        currentEntry.id === updatedEntry.id ? updatedEntry : currentEntry,
      ),
    );

    setSelectedEntry((currentEntry: any | null) =>
      currentEntry?.id === updatedEntry.id ? updatedEntry : currentEntry,
    );
  }

  async function handleRemoveEntry(entry: any) {
    const response = await fetch(`/api/watchlist/${entry.id}`, {
      method: "DELETE",
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || data.detail || "Failed to remove watchlist item.",
      );
    }

    setEntries((currentEntries: any[]) =>
      currentEntries.filter(
        (currentEntry: any) => currentEntry.id !== entry.id,
      ),
    );

    setSelectedEntry((currentEntry: any | null) =>
      currentEntry?.id === entry.id ? null : currentEntry,
    );

    setEditingEntry((currentEntry: any | null) =>
      currentEntry?.id === entry.id ? null : currentEntry,
    );
    setConfirmRemoveEntryId(null);
  }
  return (
    <main className="relative h-screen overflow-hidden bg-slate-100 text-slate-900">
      {isPinkThemeActive ? (
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-30 motion-reduce:hidden"
        >
          <source src="/assets/john2.mp4"></source>
        </video>
      ) : null}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-slate-100/60"
      />

      <div className="relative z-10 flex h-full">
        <AppSidebar
          activePage={mode === "PORTFOLIO" ? "/portfolio" : "/watchlist"}
        />

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-20 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
            <div>
              <p className="text-sm font-medium text-slate-900">
                {mode === "PORTFOLIO" ? "Portfolio" : "Watchlist"}
              </p>

              <p className="text-xs text-slate-500">
                Long and short idea pipeline
              </p>
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
                      {mode === "PORTFOLIO" ? "Portfolio" : "Watchlist"}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {mode === "PORTFOLIO"
                        ? "Active portfolio positions with targets, comments, flags, and market intelligence."
                        : "Long and short idea pipeline with entry and exit targets, comments, and market data."}
                    </p>
                  </div>

                  {userCanEditWatchlist ? (
                    <button
                      onClick={() => setAddModalOpen(true)}
                      className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                    >
                      Add Stock
                    </button>
                  ) : (
                    <button
                      disabled
                      className="cursor-not-allowed rounded-2xl bg-slate-200 px-4 py-2 text-sm font-medium text-slate-500"
                    >
                      Read Only
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Long Watchlist
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">
                      {longEntries.length}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Potential long ideas
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Short Watchlist
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">
                      {shortEntries.length}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Potential short ideas
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Commented Names
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">
                      {
                        entries.filter((entry) => entry.comments?.length > 0)
                          .length
                      }
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      With comment history
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search ticker, company, sector, side, buy, sell, cover, target prices, notes, comments, flags..."
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <WatchlistGrid
                  title="Long Watchlist"
                  tone="green"
                  entries={longEntries}
                  onSelect={setSelectedEntry}
                  onMarketData={setMarketDataEntry}
                  onComment={setCommentEntry}
                  onEdit={setEditingEntry}
                  onRemove={handleRemoveEntry}
                  canComment={userCanCreateComments}
                  canEdit={userCanEditWatchlist}
                  confirmRemoveEntryId={confirmRemoveEntryId}
                  setConfirmRemoveEntryId={setConfirmRemoveEntryId}
                />
                <WatchlistGrid
                  title="Short Watchlist"
                  tone="red"
                  entries={shortEntries}
                  onSelect={setSelectedEntry}
                  onMarketData={setMarketDataEntry}
                  onComment={setCommentEntry}
                  onEdit={setEditingEntry}
                  onRemove={handleRemoveEntry}
                  canComment={userCanCreateComments}
                  canEdit={userCanEditWatchlist}
                  confirmRemoveEntryId={confirmRemoveEntryId}
                  setConfirmRemoveEntryId={setConfirmRemoveEntryId}
                />
              </div>
            </div>

            <WatchlistDetailPanel
              entry={selectedEntry}
              onClose={() => setSelectedEntry(null)}
              onEdit={setEditingEntry}
              onRemove={handleRemoveEntry}
              canEdit={userCanEditWatchlist}
              confirmRemoveEntryId={confirmRemoveEntryId}
              setConfirmRemoveEntryId={setConfirmRemoveEntryId}
            />
          </div>
        </section>
      </div>

      <AddStockModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onAdd={handleAddEntry}
        portfolioSecurities={portfolioSecurities}
        securities={securities}
        mode={mode}
      />

      <EditWatchlistModal
        entry={editingEntry}
        mode={mode}
        onClose={() => setEditingEntry(null)}
        onSave={handleSaveEdit}
      />
      <MarketDataModal
        entry={marketDataEntry}
        onClose={() => setMarketDataEntry(null)}
      />

      <CommentModal
        entry={commentEntry}
        onClose={() => setCommentEntry(null)}
        onSave={handleSaveComment}
      />
    </main>
  );
}
