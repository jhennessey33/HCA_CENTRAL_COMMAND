"use client";

import Link from "next/link";
import AppSidebar from "@/components/common/AppSidebar";
import { useEffect, useMemo, useState } from "react";
import CurrentUserPill from "@/components/auth/CurrentUserPill";
import { canCreateComments } from "@/lib/client-permissions";
import HcaLogo from "@/components/common/HcaLogo";
type PastPositionsClientProps = {
  initialPositions: any[];
};

function getVisibleTrades(position: any) {
  const positionTrades = position.trades ?? [];
  const securityTrades = position.security?.trades ?? [];

  const byId = new Map<string, any>();

  [...positionTrades, ...securityTrades].forEach((trade) => {
    if (!trade?.id) return;
    if (trade.isHidden) return;
    byId.set(trade.id, trade);
  });

  return Array.from(byId.values()).sort((a, b) => {
    return new Date(a.dateTraded).getTime() - new Date(b.dateTraded).getTime();
  });
}

function isBuyTrade(trade: any) {
  const type = String(trade.tradeType ?? "").toUpperCase();
  return type.includes("BUY") || type.includes("COVER");
}

function isSellTrade(trade: any) {
  const type = String(trade.tradeType ?? "").toUpperCase();
  return type.includes("SELL") || type.includes("SHORT");
}

function getEntryTrade(position: any) {
  const trades = getVisibleTrades(position);

  if (position.side === "SHORT") {
    return trades.find((trade) => isSellTrade(trade)) ?? trades[0] ?? null;
  }

  return trades.find((trade) => isBuyTrade(trade)) ?? trades[0] ?? null;
}

function getExitTrade(position: any) {
  const trades = getVisibleTrades(position);

  if (position.side === "SHORT") {
    return (
      [...trades].reverse().find((trade) => isBuyTrade(trade)) ??
      trades.at(-1) ??
      null
    );
  }

  return (
    [...trades].reverse().find((trade) => isSellTrade(trade)) ??
    trades.at(-1) ??
    null
  );
}

function getEntryPrice(position: any) {
  const entryTrade = getEntryTrade(position);
  return entryTrade?.avgPrice ?? position.wap ?? null;
}

function getExitPrice(position: any) {
  const exitTrade = getExitTrade(position);

  if (exitTrade?.avgPrice != null) {
    return exitTrade.avgPrice;
  }

  return null;
}

function getTotalPctChange(position: any) {
  if (position.totalPctChange != null) {
    return position.totalPctChange;
  }

  const entryPrice = getEntryPrice(position);
  const exitPrice = getExitPrice(position);

  if (!entryPrice || !exitPrice) return null;

  if (position.side === "SHORT") {
    return ((entryPrice - exitPrice) / entryPrice) * 100;
  }

  return ((exitPrice - entryPrice) / entryPrice) * 100;
}

function getRealizedPnl(position: any) {
  const existingPnl = Number(position.unrealizedPnl);

  if (Number.isFinite(existingPnl)) {
    return existingPnl;
  }

  const shares = Math.abs(Number(position.shares ?? 0));
  const entryPrice = Number(getEntryPrice(position));
  const exitPrice = Number(getExitPrice(position));

  if (!shares || !Number.isFinite(entryPrice) || !Number.isFinite(exitPrice)) {
    return 0;
  }

  if (position.side === "SHORT") {
    return (entryPrice - exitPrice) * shares;
  }

  return (exitPrice - entryPrice) * shares;
}

function isClosedYearToDate(position: any) {
  if (!position.closedAt) return false;

  const closedAt = new Date(position.closedAt);
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  return closedAt >= startOfYear && closedAt <= now;
}

function isClosedWithinLast365Days(position: any) {
  if (!position.closedAt) return false;

  const closedAt = new Date(position.closedAt);
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 365);

  return closedAt >= cutoff && closedAt <= now;
}

function formatPercent(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return "—";

  return `${Number(value) >= 0 ? "+" : ""}${Number(value).toFixed(1)}%`;
}

function formatNumber(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return "—";

  return value.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getDaysHeld(position: any) {
  if (!position.openedAt || !position.closedAt) return null;

  const opened = new Date(position.openedAt).getTime();
  const closed = new Date(position.closedAt).getTime();

  if (Number.isNaN(opened) || Number.isNaN(closed)) return null;

  return Math.max(0, Math.round((closed - opened) / 86_400_000));
}

function getLatestComment(position: any) {
  return position.comments?.[0]?.content ?? position.exitRationale ?? null;
}

function getOpenFlagCount(position: any) {
  return (
    position.flags?.filter((flag: any) => flag.status === "OPEN").length ?? 0
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

function pnlClass(value: number | null | undefined) {
  if (value == null) return "text-slate-500";
  return value >= 0 ? "text-emerald-600" : "text-rose-600";
}

function SectionBar() {
  return (
    <div className="rounded-t-2xl bg-yellow-300 px-4 py-2 text-center text-xs font-bold uppercase tracking-widest text-slate-950">
      Past Positions
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
  const [tag, setTag] = useState("EXIT");
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
      setTag("EXIT");
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
          {latestComment?.content ||
            position.exitRationale ||
            "No comment yet."}
        </div>

        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Write an exit rationale, trade note, risk update, thesis change, or post-position review..."
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

function PastPositionsGrid({
  positions,
  onComment,
  canComment,
}: {
  positions: any[];
  onComment: (position: any) => void;
  canComment: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <SectionBar />

      <div className="grid grid-cols-12 border-b bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        <div>Ticker</div>
        <div className="col-span-2">Company</div>
        <div>Side</div>
        <div>Opened</div>
        <div>Closed</div>
        <div>Days</div>
        <div>Entry</div>
        <div>Exit</div>
        <div>Total %</div>
        <div>P&L</div>
        <div>Review</div>
      </div>

      {positions.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-slate-500">
          No closed positions found. Past positions appear when a Wells position
          is marked CLOSED during position ingestion.
        </div>
      ) : null}
      {positions.map((position) => {
        const entryPrice = getEntryPrice(position);
        const exitPrice = getExitPrice(position);
        const totalPctChange = getTotalPctChange(position);

        const entryLabel =
          position.side === "SHORT"
            ? `${formatMoney(entryPrice)} Sold Short`
            : `${formatMoney(entryPrice)} Bought`;

        const exitLabel =
          position.side === "SHORT"
            ? `${formatMoney(exitPrice)} Covered`
            : `${formatMoney(exitPrice)} Sold`;

        return (
          <div
            key={position.id}
            className="border-b border-slate-100 px-4 py-3 text-xs hover:bg-slate-50"
          >
            <div className="grid grid-cols-12 items-center gap-2">
              <div className="font-semibold text-slate-950">
                {position.security.ticker}
              </div>

              <div className="col-span-2 truncate text-slate-600">
                {position.security.name}
              </div>

              <div>
                <span
                  className={
                    position.side === "SHORT"
                      ? "rounded-full bg-rose-50 px-2 py-1 font-semibold text-rose-700 ring-1 ring-rose-200"
                      : "rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700 ring-1 ring-emerald-200"
                  }
                >
                  {position.side}
                </span>
              </div>

              <div className="text-slate-600">
                {formatDate(position.openedAt)}
              </div>

              <div className="text-slate-600">
                {formatDate(position.closedAt)}
              </div>

              <div className="text-slate-600">
                {getDaysHeld(position) != null
                  ? `${getDaysHeld(position)}d`
                  : "—"}
              </div>

              <div className="font-medium text-slate-900">
                {formatMoney(entryPrice)}
              </div>

              <div className="font-medium text-slate-900">
                {formatMoney(exitPrice)}
              </div>

              <div className={`font-semibold ${pnlClass(totalPctChange)}`}>
                {formatPercent(totalPctChange)}
              </div>

              <div
                className={`font-semibold ${pnlClass(getRealizedPnl(position))}`}
              >
                {formatMoney(getRealizedPnl(position))}
              </div>
              <div className="flex items-center gap-2">
                {getOpenFlagCount(position) > 0 ? (
                  <span className="rounded-full bg-amber-50 px-2 py-1 font-medium text-amber-700 ring-1 ring-amber-200">
                    {getOpenFlagCount(position)} flag
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-100 px-2 py-1 font-medium text-slate-500">
                    No flags
                  </span>
                )}

                {canComment ? (
                  <button
                    onClick={() => onComment(position)}
                    className="rounded-xl bg-blue-50 px-2 py-1 font-medium text-blue-700 hover:bg-blue-100"
                  >
                    Comment
                  </button>
                ) : (
                  <span className="rounded-xl bg-slate-100 px-2 py-1 font-medium text-slate-400">
                    Read Only
                  </span>
                )}
              </div>
            </div>

            <div className="mt-2 grid grid-cols-12 gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
              <div className="col-span-3">
                <span className="font-semibold text-slate-700">
                  Final shares:
                </span>{" "}
                {formatNumber(position.shares)}
              </div>

              <div className="col-span-3">
                <span className="font-semibold text-slate-700">
                  Cost basis:
                </span>{" "}
                {formatMoney(position.costBasis)}
              </div>

              <div className="col-span-3">
                <span className="font-semibold text-slate-700">Trades:</span>{" "}
                {(position.trades?.length ?? 0) +
                  (position.security?.trades?.length ?? 0)}
              </div>

              <div className="col-span-3">
                <span className="font-semibold text-slate-700">Comments:</span>{" "}
                {position.comments?.length ?? 0}
              </div>

              <div className="col-span-12 pt-1">
                <span className="font-semibold text-slate-700">
                  Exit rationale:
                </span>{" "}
                {getLatestComment(position) ?? "No exit rationale recorded."}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function PastPositionsClient({
  initialPositions,
}: PastPositionsClientProps) {
  const [positions, setPositions] = useState<any[]>(initialPositions);
  const [commentPosition, setCommentPosition] = useState<any | null>(null);
  const [query, setQuery] = useState("");
  const [currentUser, setCurrentUser] = useState<any | null>(null);

  useEffect(() => {
    async function loadCurrentUser() {
      const response = await fetch("/api/auth/me");

      if (!response.ok) return;

      const data = await response.json();
      setCurrentUser(data.user);
    }

    loadCurrentUser();
  }, []);

  const closedPositions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return positions
      .filter((position) => position.status === "CLOSED")
      .filter((position) => {
        if (!normalizedQuery) return true;

        const latestComment = position.comments?.[0]?.content || "";

        const searchable = [
          position.security?.ticker,
          position.security?.name,
          position.security?.sector,
          position.side,
          position.exitRationale,
          latestComment,
          position.totalPctChange,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchable.includes(normalizedQuery);
      });
  }, [positions, query]);

  const yearToDateRealizedPnl = closedPositions
    .filter((position) => isClosedYearToDate(position))
    .reduce((sum, position) => sum + getRealizedPnl(position), 0);

  const last365DaysRealizedPnl = closedPositions
    .filter((position) => isClosedWithinLast365Days(position))
    .reduce((sum, position) => sum + getRealizedPnl(position), 0);

  const userCanCreateComments = canCreateComments(currentUser?.role);

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

    setPositions((currentPositions) =>
      currentPositions.map((position) => {
        if (position.id !== payload.positionId) return position;

        return {
          ...position,
          comments: [newComment, ...(position.comments || [])],
        };
      }),
    );
  }

  return (
    <main className="h-screen overflow-hidden bg-slate-100 text-slate-900">
      <div className="flex h-full">
        <AppSidebar activePage="/past-positions" />

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-20 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
            <div>
              <p className="text-sm font-medium text-slate-900">
                Past Positions
              </p>
              <p className="text-xs text-slate-500">
                Closed positions and exit rationale
              </p>
            </div>

            <div className="ml-4 flex items-center gap-3">
              <CurrentUserPill />
            </div>
          </header>

          <div className="min-w-0 flex-1 overflow-auto p-6">
            <div className="space-y-5">
              <div>
                <h2 className="text-3xl font-semibold tracking-tight">
                  Past Positions
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Closed positions with bought/sold or sold/covered prices, exit
                  rationale, and comment section.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Closed Positions
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    {closedPositions.length}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Closed Wells-sourced positions
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Year to Date Realized P&L
                  </p>
                  <p
                    className={`mt-2 text-2xl font-semibold ${pnlClass(yearToDateRealizedPnl)}`}
                  >
                    {formatMoney(yearToDateRealizedPnl)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Closed positions since Jan 1
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Last 365 Days Realized P&L
                  </p>
                  <p
                    className={`mt-2 text-2xl font-semibold ${pnlClass(last365DaysRealizedPnl)}`}
                  >
                    {formatMoney(last365DaysRealizedPnl)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Closed positions over trailing year
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search ticker, company, side, sector, exit rationale, comments..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <PastPositionsGrid
                positions={closedPositions}
                onComment={setCommentPosition}
                canComment={userCanCreateComments}
              />
            </div>
          </div>
        </section>
      </div>

      <CommentModal
        position={commentPosition}
        onClose={() => setCommentPosition(null)}
        onSave={handleSaveComment}
      />
    </main>
  );
}
