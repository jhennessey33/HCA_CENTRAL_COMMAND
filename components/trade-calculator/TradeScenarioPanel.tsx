"use client";

import { useEffect, useMemo, useState } from "react";
import Badge from "@/components/common/Badge";
import ManualTradeReviewModal from "@/components/trade-calculator/ManualTradeReviewModal";
import {
  calculateTradeScenario,
  type PositionSide,
  type TradeAction,
  type TradeBaselineMode,
  type TradeSizingMode,
} from "@/lib/trade-calculator/trade-calculator";

type FundEquitySnapshot = {
  id: string;
  asOfDate: string;
  netEquity: number;
  source: string;
};

type TradeScenarioPanelProps = {
  security: any;
  position: any;
  baselineMode: TradeBaselineMode;
  pendingManualDelta: number;
  pendingProjectionIsValid: boolean;
  currentPrice: number | null;
  wellsWap: number | null;
  grossPortfolioMarketValue: number;
  fundEquitySnapshots: FundEquitySnapshot[];
  canSubmitManualTrade: boolean;
  onTradeCreated: (trade: any) => void;
};

function toInputNumber(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function getLocalDateTimeInputValue(date = new Date()) {
  const timezoneOffsetMilliseconds = date.getTimezoneOffset() * 60 * 1000;

  return new Date(date.getTime() - timezoneOffsetMilliseconds)
    .toISOString()
    .slice(0, 16);
}

function getSnapshotDateKey(value: string | Date) {
  const date = new Date(value);

  const year = date.getUTCFullYear();

  const month = String(date.getUTCMonth() + 1).padStart(2, "0");

  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
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
    maximumFractionDigits: 0,
  });
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

function formatNumber(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }

  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
}

function formatWholeShares(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }

  return Math.round(value).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });
}

function formatSignedMoney(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }

  const formattedValue = Math.abs(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  if (Math.abs(value) < 0.000001) {
    return formattedValue;
  }

  return `${value > 0 ? "+" : "-"}${formattedValue}`;
}

function formatPercent(value: number | null | undefined, includeSign = false) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }

  const sign = includeSign && value > 0 ? "+" : "";

  return `${sign}${value.toFixed(2)}%`;
}

function valueClass(value: number | null | undefined) {
  if (value == null || Math.abs(value) < 0.000001) {
    return "text-slate-950";
  }

  return value > 0 ? "text-emerald-600" : "text-rose-600";
}

function getDefaultAction(side: string | null | undefined): TradeAction {
  return side === "SHORT" ? "SHORT" : "BUY";
}

function getSideLabel(side: PositionSide) {
  if (side === "LONG") {
    return "Long";
  }

  if (side === "SHORT") {
    return "Short";
  }

  return "Flat";
}

function ResultCard({
  label,
  value,
  detail,
  valueClassName = "text-slate-950",
}: {
  label: string;
  value: React.ReactNode;
  detail: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <div className={`mt-1 text-lg font-semibold ${valueClassName}`}>
        {value}
      </div>

      <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

export default function TradeScenarioPanel({
  security,
  position,
  baselineMode,
  pendingManualDelta,
  pendingProjectionIsValid,
  currentPrice,
  wellsWap,
  grossPortfolioMarketValue,
  fundEquitySnapshots,
  canSubmitManualTrade,
  onTradeCreated,
}: TradeScenarioPanelProps) {
  const [tradeAction, setTradeAction] = useState<TradeAction>(
    getDefaultAction(position?.side),
  );

  const [sizingMode, setSizingMode] =
    useState<TradeSizingMode>("AMOUNT_BPS");

  const [sharesInput, setSharesInput] = useState("");

  const [notionalInput, setNotionalInput] = useState("");

  const [basisPointsInput, setBasisPointsInput] = useState("");
  const [targetWeightPctInput, setTargetWeightPctInput] = useState("");

  const [estimatedPriceInput, setEstimatedPriceInput] = useState(
    currentPrice != null ? currentPrice.toFixed(2) : "",
  );

  const [stopPriceInput, setStopPriceInput] = useState("");

  const [targetPriceInput, setTargetPriceInput] = useState("");

  const [dateTraded, setDateTraded] = useState(getLocalDateTimeInputValue());

  const [comment, setComment] = useState("");

  const [shortLocateNumber, setShortLocateNumber] = useState("");

  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isQueueSubmitting, setIsQueueSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState("");
  const [queueSubmissionError, setQueueSubmissionError] = useState("");
  const [submissionMessage, setSubmissionMessage] = useState("");
  useEffect(() => {
    setTradeAction(getDefaultAction(position?.side));

    setSizingMode("AMOUNT_BPS");
    setSharesInput("");
    setNotionalInput("");
    setBasisPointsInput("");
    setTargetWeightPctInput("");

    setEstimatedPriceInput(currentPrice != null ? currentPrice.toFixed(2) : "");

    setStopPriceInput("");
    setTargetPriceInput("");

    setDateTraded(getLocalDateTimeInputValue());

    setComment("");
    setShortLocateNumber("");
    setIsReviewOpen(false);
    setIsSubmitting(false);
    setIsQueueSubmitting(false);
    setSubmissionError("");
    setQueueSubmissionError("");
    setSubmissionMessage("");
  }, [position?.id, currentPrice]);

  const serializedDateTraded = serializeLocalDateTime(dateTraded);

  const proposedTradeDateKey = dateTraded ? dateTraded.slice(0, 10) : null;

  const applicableFundEquity = proposedTradeDateKey
    ? (fundEquitySnapshots.find(
        (snapshot) =>
          getSnapshotDateKey(snapshot.asOfDate) <= proposedTradeDateKey,
      ) ?? null)
    : null;

  const netEquity = applicableFundEquity
    ? Number(applicableFundEquity.netEquity)
    : null;

  const validNetEquity =
    netEquity != null && Number.isFinite(netEquity) && netEquity > 0
      ? netEquity
      : null;

  const result = useMemo(
    () =>
      calculateTradeScenario({
        securityId: security.id,
        positionId: position.id,
        ticker: security.ticker,
        companyName: security.name,
        wellsSide: position.side === "SHORT" ? "SHORT" : "LONG",
        wellsShares: position.shares,
        wellsMarketValue: position.marketValue,
        wellsWap,
        pendingManualDelta,
        pendingProjectionIsValid,
        grossPortfolioMarketValue,
        netEquity: validNetEquity,
        baselineMode,
        tradeAction,
        sizingMode,
        sharesInput: toInputNumber(sharesInput),
        notionalInput: toInputNumber(notionalInput),
        basisPointsInput: toInputNumber(basisPointsInput),
        targetWeightPctInput: toInputNumber(targetWeightPctInput),
        estimatedPrice: toInputNumber(estimatedPriceInput),
        stopPrice: toInputNumber(stopPriceInput),
        targetPrice: toInputNumber(targetPriceInput),
        dateTraded: serializedDateTraded,
        comment,
        shortLocateNumber,
      }),
    [
      security,
      position,
      wellsWap,
      pendingManualDelta,
      pendingProjectionIsValid,
      grossPortfolioMarketValue,
      validNetEquity,
      baselineMode,
      tradeAction,
      sizingMode,
      sharesInput,
      notionalInput,
      basisPointsInput,
      targetWeightPctInput,
      estimatedPriceInput,
      stopPriceInput,
      targetPriceInput,
      serializedDateTraded,
      comment,
      shortLocateNumber,
    ],
  );
  const scenarioActionLabel =
    tradeAction === "BUY"
      ? "Buy"
      : tradeAction === "SELL"
        ? "Sell"
        : tradeAction === "SHORT"
          ? "Short"
          : "Cover";

  const scenarioSizingDescription = (() => {
    if (sizingMode === "AMOUNT_BPS") {
      const basisPoints = toInputNumber(basisPointsInput);

      return basisPoints != null
        ? `${formatNumber(basisPoints)} bps of ${security.ticker}`
        : `${security.ticker} using basis-point sizing`;
    }

    if (sizingMode === "SHARES") {
      const shares = toInputNumber(sharesInput);

      return shares != null
        ? `${formatNumber(shares)} shares of ${security.ticker}`
        : `${security.ticker} using share sizing`;
    }

    if (sizingMode === "NOTIONAL") {
      const notional = toInputNumber(notionalInput);

      return notional != null
        ? `${formatMoney(notional)} of ${security.ticker}`
        : `${security.ticker} using notional sizing`;
    }

    const targetWeight = toInputNumber(targetWeightPctInput);

    return targetWeight != null
      ? `${security.ticker} to a ${formatPercent(targetWeight)} target weight`
      : `${security.ticker} using target-weight sizing`;
  })();

  const scenarioExecutionPrice = toInputNumber(estimatedPriceInput);

  const scenarioSummary =
    scenarioExecutionPrice != null
      ? `${scenarioActionLabel} ${scenarioSizingDescription} at an estimated execution price of ${formatPrice(
          scenarioExecutionPrice,
        )}.`
      : `${scenarioActionLabel} ${scenarioSizingDescription}.`;

  function handleSizingModeChange(nextMode: TradeSizingMode) {
    setSizingMode(nextMode);

    if (nextMode !== "SHARES") {
      setSharesInput("");
    }

    if (nextMode !== "NOTIONAL") {
      setNotionalInput("");
    }
    if (nextMode !== "AMOUNT_BPS") {
      setBasisPointsInput("");
    }

    if (nextMode !== "TARGET_WEIGHT") {
      setTargetWeightPctInput("");
    }
  }

  function handleReset() {
    setTradeAction(getDefaultAction(position?.side));

    setSizingMode("AMOUNT_BPS");
    setSharesInput("");
    setNotionalInput("");
    setBasisPointsInput("");
    setTargetWeightPctInput("");

    setEstimatedPriceInput(currentPrice != null ? currentPrice.toFixed(2) : "");

    setStopPriceInput("");
    setTargetPriceInput("");

    setDateTraded(getLocalDateTimeInputValue());

    setComment("");
    setIsReviewOpen(false);
    setShortLocateNumber("");
    setSubmissionError("");
    setQueueSubmissionError("");
    setSubmissionMessage("");
  }

  async function handleSubmitTrade() {
    const draft = result.draft;

    if (!draft) {
      setSubmissionError("The trade scenario is not ready for submission.");
      return;
    }

    if (!canSubmitManualTrade) {
      setSubmissionError("You do not have permission to create manual trades.");
      return;
    }

    setSubmissionError("");
    setQueueSubmissionError("");
    setSubmissionMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/trades/manual", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          securityId: draft.securityId,
          positionId: draft.positionId,
          tradeType: draft.tradeType,
          dateTraded: draft.dateTraded,
          shares: draft.shares,
          avgPrice: draft.avgPrice,
          comment: draft.comment,
          shortLocateNumber: draft.shortLocateNumber,
          origin: "TRADE_CALCULATOR",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create manual trade.");
      }

      onTradeCreated(data.trade);

      setIsReviewOpen(false);
      setSubmissionError("");

      setSizingMode("AMOUNT_BPS");
      setSharesInput("");
      setNotionalInput("");
      setBasisPointsInput("");
      setTargetWeightPctInput("");

      setEstimatedPriceInput(
        currentPrice != null ? currentPrice.toFixed(2) : "",
      );

      setStopPriceInput("");
      setTargetPriceInput("");

      setDateTraded(getLocalDateTimeInputValue());

      setComment("");
      setShortLocateNumber("");

      setSubmissionMessage(
        `${draft.tradeType} ${draft.shares.toLocaleString("en-US")} shares of ${
          draft.ticker
        } was added as a Manual Pending trade.`,
      );
    } catch (error) {
      setSubmissionError(
        error instanceof Error
          ? error.message
          : "Failed to create manual trade.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }
  async function handleSubmitQueue() {
    const draft = result.draft;

    if (!draft) {
      setQueueSubmissionError(
        "The trade scenario is not ready to be added to the queue.",
      );
      return;
    }

    if (!canSubmitManualTrade) {
      setQueueSubmissionError(
        "You do not have permission to add trades to the queue.",
      );
      return;
    }

    setSubmissionError("");
    setQueueSubmissionError("");
    setSubmissionMessage("");
    setIsQueueSubmitting(true);

    try {
      const response = await fetch("/api/trade-queue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          securityId: draft.securityId,
          positionId: draft.positionId,
          tradeType: draft.tradeType,
          shares: draft.shares,
          executionPrice: draft.avgPrice,
          proposedTradeAt: draft.dateTraded,
          comment: draft.comment,
          shortLocateNumber: draft.shortLocateNumber,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to add the trade to the queue.");
      }

      setIsReviewOpen(false);
      setSubmissionError("");
      setQueueSubmissionError("");
      setSizingMode("AMOUNT_BPS");
      setSharesInput("");
      setNotionalInput("");
      setBasisPointsInput("");
      setTargetWeightPctInput("");
      setEstimatedPriceInput(
        currentPrice != null ? currentPrice.toFixed(2) : "",
      );
      setStopPriceInput("");
      setTargetPriceInput("");
      setDateTraded(getLocalDateTimeInputValue());
      setComment("");
      setShortLocateNumber("");
      setSubmissionMessage(
        `${draft.tradeType} ${draft.shares.toLocaleString(
          "en-US",
        )} shares of ${draft.ticker} was added to the Trade Queue at ${formatPrice(
          draft.avgPrice,
        )}.`,
      );
    } catch (error) {
      setQueueSubmissionError(
        error instanceof Error
          ? error.message
          : "Failed to add the trade to the queue.",
      );
    } finally {
      setIsQueueSubmitting(false);
    }
  }
  const sizingInputIsStarted =
    sizingMode === "SHARES"
      ? Boolean(sharesInput.trim())
      : sizingMode === "NOTIONAL"
        ? Boolean(notionalInput.trim())
        : sizingMode === "AMOUNT_BPS"
          ? Boolean(basisPointsInput.trim())
          : Boolean(targetWeightPctInput.trim());

  const showValidation =
    sizingInputIsStarted ||
    Boolean(stopPriceInput.trim()) ||
    Boolean(targetPriceInput.trim());

  return (
    <div className="space-y-4">
      <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Step 2
              </p>

              <h3 className="mt-1 text-lg font-semibold text-slate-950">
                Define the Proposed Trade
              </h3>
            </div>

            <Badge tone="blue">Scenario</Badge>
          </div>

          <div className="mt-4">
            <label className="text-sm font-medium text-slate-700">
              Trade Action
            </label>

            <div className="mt-2 grid grid-cols-2 gap-2">
              {(
                [
                  ["BUY", "Buy"],
                  ["SELL", "Sell"],
                  ["SHORT", "Short"],
                  ["COVER", "Cover"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTradeAction(value)}
                  className={`rounded-2xl px-3 py-3 text-sm font-medium ${
                    tradeAction === value
                      ? "bg-slate-900 text-white"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <label className="text-sm font-medium text-slate-700">
              Sizing Mode
            </label>

            <div className="mt-2 grid grid-cols-4 gap-2">
              {(
                [
                  ["AMOUNT_BPS", "Amount (BPS)"],
                  ["SHARES", "Shares"],
                  ["TARGET_WEIGHT", "Target Weight"],
                  ["NOTIONAL", "Notional"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleSizingModeChange(value)}
                  className={`rounded-2xl px-2 py-3 text-xs font-medium ${
                    sizingMode === value
                      ? "bg-violet-700 text-white"
                      : "border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {sizingMode === "TARGET_WEIGHT" ? (
            <div className="mt-4">
              <label className="text-sm font-medium text-slate-700">
                Target Portfolio Weight
              </label>

              <div className="relative mt-2">
                <input
                  value={targetWeightPctInput}
                  onChange={(event) =>
                    setTargetWeightPctInput(event.target.value)
                  }
                  inputMode="decimal"
                  placeholder="5.00"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 pr-10 text-sm outline-none focus:ring-2 focus:ring-slate-900"
                />

                <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-slate-400">
                  %
                </span>
              </div>
            </div>
          ) : null}

          {sizingMode === "SHARES" ? (
            <div className="mt-4">
              <label className="text-sm font-medium text-slate-700">
                Proposed Shares
              </label>

              <input
                value={sharesInput}
                onChange={(event) => setSharesInput(event.target.value)}
                inputMode="decimal"
                placeholder="10,000"
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          ) : null}

          {sizingMode === "NOTIONAL" ? (
            <div className="mt-4">
              <label className="text-sm font-medium text-slate-700">
                Proposed Notional
              </label>

              <div className="relative mt-2">
                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm text-slate-400">
                  $
                </span>

                <input
                  value={notionalInput}
                  onChange={(event) => setNotionalInput(event.target.value)}
                  inputMode="decimal"
                  placeholder="750000"
                  className="w-full rounded-2xl border border-slate-200 py-3 pl-8 pr-4 text-sm outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>
          ) : null}

          {sizingMode === "AMOUNT_BPS" ? (
            <div className="mt-4">
              <label className="text-sm font-medium text-slate-700">
                Amount (BPS)
              </label>

              <div className="relative mt-2">
                <input
                  value={basisPointsInput}
                  onChange={(event) => setBasisPointsInput(event.target.value)}
                  inputMode="decimal"
                  placeholder="50"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 pr-12 text-sm outline-none focus:ring-2 focus:ring-slate-900"
                />

                <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-slate-400">
                  bps
                </span>
              </div>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                {applicableFundEquity && validNetEquity != null
                  ? `Calculated using Net Equity of ${formatMoney(
                      validNetEquity,
                    )} as of ${new Date(
                      applicableFundEquity.asOfDate,
                    ).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      timeZone: "UTC",
                    })}.`
                  : "No Net Equity snapshot is available on or before the proposed trade date."}
              </p>
            </div>
          ) : null}

          {result.warnings.length > 0 ? (
            <section className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
              <ul className="space-y-1 text-xs leading-5 text-amber-800">
                {result.warnings.map((warning) => (
                  <li key={warning}>• {warning}</li>
                ))}
              </ul>
            </section>
          ) : null}
          {showValidation && result.errors.length > 0 ? (
            <section className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2">
              <ul className="space-y-1 text-xs leading-5 text-rose-700">
                {result.errors.map((error) => (
                  <li key={error}>• {error}</li>
                ))}
              </ul>
            </section>
          ) : null}
          <div className="mt-4">
            <label className="text-sm font-medium text-slate-700">
              Estimated Execution Price
            </label>

            <div className="relative mt-2">
              <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm text-slate-400">
                $
              </span>

              <input
                value={estimatedPriceInput}
                onChange={(event) => setEstimatedPriceInput(event.target.value)}
                inputMode="decimal"
                placeholder="0.00"
                className="w-full rounded-2xl border border-slate-200 py-3 pl-8 pr-4 text-sm outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <p className="mt-1 text-xs text-slate-500">
              Defaults to the current HCA display price when available.
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700">
                Limit
              </label>

              <input
                value={stopPriceInput}
                onChange={(event) => setStopPriceInput(event.target.value)}
                inputMode="decimal"
                placeholder="Optional"
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Target Price
              </label>

              <input
                value={targetPriceInput}
                onChange={(event) => setTargetPriceInput(event.target.value)}
                inputMode="decimal"
                placeholder="Optional"
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="text-sm font-medium text-slate-700">
              Proposed Trade Date and Time
            </label>

            <input
              type="datetime-local"
              value={dateTraded}
              onChange={(event) => setDateTraded(event.target.value)}
              step="60"
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
          {tradeAction === "SHORT" ? (
            <div className="mt-4">
              <label className="text-sm font-medium text-slate-700">
                Short Locate Number
                <span className="ml-1 text-rose-600">*</span>
              </label>

              <input
                value={shortLocateNumber}
                onChange={(event) => setShortLocateNumber(event.target.value)}
                required
                autoComplete="off"
                placeholder="Enter short locate number"
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
              />

              <p className="mt-1 text-xs text-slate-500">
                Required for short trades. The locate number will be appended to
                the saved trade note.
              </p>
            </div>
          ) : null}
          <div className="mt-4">
            <label className="text-sm font-medium text-slate-700">
              Trade Note
            </label>

            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Optional rationale or scenario note..."
              className="mt-2 h-20 w-full resize-none rounded-2xl border border-slate-200 p-4 text-sm outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="mt-5 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Reset Scenario
          </button>
        </section>

        <section className="min-w-0 space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Projected Trade Impact
                </p>

                <h3 className="mt-1 text-lg font-semibold text-slate-950">
                  {security.ticker} {tradeAction} Scenario
                </h3>

                <p className="mt-1 text-sm text-slate-500">{scenarioSummary}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge
                  tone={
                    result.projectedSide === "SHORT"
                      ? "red"
                      : result.projectedSide === "LONG"
                        ? "green"
                        : "slate"
                  }
                >
                  {getSideLabel(result.projectedSide)}
                </Badge>

                <Badge tone="blue">
                  {sizingMode.replace("_", " ").toLowerCase()}
                </Badge>
              </div>
            </div>
          </div>

          <div
            className={`overflow-hidden rounded-2xl border shadow-sm ${
              tradeAction === "SELL" || tradeAction === "SHORT"
                ? "border-rose-300 bg-rose-50"
                : "border-emerald-300 bg-emerald-50"
            }`}
          >
            <div
              className={`px-5 py-2 text-xs font-bold uppercase tracking-widest ${
                tradeAction === "SELL" || tradeAction === "SHORT"
                  ? "bg-rose-600 text-white"
                  : "bg-emerald-700 text-white"
              }`}
            >
              Proposed Shares
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-5">
              <div>
                <p
                  className={`text-3xl font-bold tabular-nums tracking-tight ${
                    tradeAction === "SELL" || tradeAction === "SHORT"
                      ? "text-rose-900"
                      : "text-emerald-900"
                  }`}
                >
                  {formatWholeShares(result.proposedShares)}
                </p>

                <p
                  className={`mt-1 text-sm font-semibold ${
                    tradeAction === "SELL" || tradeAction === "SHORT"
                      ? "text-rose-700"
                      : "text-emerald-700"
                  }`}
                >
                  {tradeAction} {security.ticker} shares
                </p>
              </div>

              <div className="text-left sm:text-right">
                <p
                  className={`text-xs font-semibold uppercase tracking-wide ${
                    tradeAction === "SELL" || tradeAction === "SHORT"
                      ? "text-rose-700"
                      : "text-emerald-700"
                  }`}
                >
                  Estimated Trade Notional
                </p>

                <p
                  className={`mt-1 text-xl font-bold tabular-nums ${
                    tradeAction === "SELL" || tradeAction === "SHORT"
                      ? "text-rose-900"
                      : "text-emerald-900"
                  }`}
                >
                  {formatMoney(result.proposedNotional)}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
            <ResultCard
              label="Trade Notional"
              value={formatMoney(result.proposedNotional)}
              detail="Shares × estimated price"
            />

            <ResultCard
              label="Projected Position"
              value={
                <span>
                  {formatWholeShares(result.projectedExposure)}{" "}
                  <span className="text-sm text-slate-500">
                    {getSideLabel(result.projectedSide)}
                  </span>
                </span>
              }
              detail="Position after proposed trade"
            />

            <ResultCard
              label="Position Change"
              value={result.exposureChangeLabel}
              detail="Change in absolute exposure"
              valueClassName={valueClass(result.exposureChangePct)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <ResultCard
              label="Projected Market Value"
              value={formatMoney(result.projectedMarketValue)}
              detail="Projected exposure × price"
            />

            <ResultCard
              label="Projected Weight"
              value={formatPercent(result.projectedPortfolioWeightPct)}
              detail="Projected market value ÷ Net Equity"
            />

            <ResultCard
              label="Weight Change"
              value={formatPercent(result.portfolioWeightChangePctPoints, true)}
              detail="Percentage-point change"
              valueClassName={valueClass(result.portfolioWeightChangePctPoints)}
            />

            <ResultCard
              label="Estimated Cash Flow"
              value={formatSignedMoney(result.estimatedCashFlow)}
              detail="Negative uses cash; positive adds cash"
              valueClassName={valueClass(result.estimatedCashFlow)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <ResultCard
              label="Estimated Blended WAP"
              value={formatPrice(result.estimatedBlendedWap)}
              detail={
                result.blendedWapIsAvailable
                  ? "Estimated after a same-side add"
                  : "Unavailable for this scenario"
              }
            />

            <ResultCard
              label="Current Wells Weight"
              value={formatPercent(result.currentPortfolioWeightPct)}
              detail="Wells market value ÷ Net Equity"
            />

            <ResultCard
              label="Baseline Exposure"
              value={
                <span>
                  {formatNumber(result.baselineExposure)}{" "}
                  <span className="text-sm text-slate-500">
                    {getSideLabel(result.baselineSide)}
                  </span>
                </span>
              }
              detail="Selected pre-trade baseline"
            />

            <ResultCard
              label="Execution Price"
              value={formatPrice(toInputNumber(estimatedPriceInput))}
              detail="Scenario assumption"
            />
          </div>
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Risk / Reward
            </p>

            <div className="mt-4 grid grid-cols-2 gap-4 xl:grid-cols-3">
              <ResultCard
                label="Risk Per Share"
                value={formatPrice(result.riskPerShare)}
                detail="Execution to stop"
              />

              <ResultCard
                label="Total Risk"
                value={formatMoney(result.totalRisk)}
                detail="Proposed shares × risk/share"
              />

              <ResultCard
                label="Portfolio Risk"
                value={formatPercent(result.portfolioRiskPct)}
                detail="Total risk ÷ Net Equity"
              />

              <ResultCard
                label="Potential Reward"
                value={formatMoney(result.totalReward)}
                detail="Proposed shares × reward/share"
              />

              <ResultCard
                label="Reward / Risk"
                value={
                  result.rewardRiskRatio != null
                    ? `${result.rewardRiskRatio.toFixed(2)}x`
                    : "—"
                }
                detail="Potential reward ÷ total risk"
              />

              <ResultCard
                label="Target Move"
                value={formatPercent(result.targetMovePct, true)}
                detail="Execution to target"
                valueClassName={valueClass(result.targetMovePct)}
              />
            </div>
          </section>
        </section>
      </div>

      {submissionMessage ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
          {submissionMessage}
        </section>
      ) : null}
      <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Calculation Only
            </p>

            <p className="mt-1 text-xs leading-5 text-slate-500">
              This scenario has not created a trade or changed
              Wells-authoritative records. Review the calculated trade before
              any Manual Pending record is created.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setSubmissionError("");
              setQueueSubmissionError("");
              setSubmissionMessage("");
              setIsReviewOpen(true);
            }}
            disabled={!result?.canCreateDraft}
            className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
          >
            Review &amp; Add Trade
          </button>
        </div>
      </section>

      <ManualTradeReviewModal
        open={isReviewOpen}
        draft={result.draft}
        result={result}
        baselineLabel={
          baselineMode === "WELLS"
            ? "Wells-only scenario basis"
            : "Wells plus pending manual trades"
        }
        canSubmit={canSubmitManualTrade}
        isSubmitting={isSubmitting}
        isQueueSubmitting={isQueueSubmitting}
        submissionError={submissionError}
        queueSubmissionError={queueSubmissionError}
        onClose={() => {
          if (isSubmitting || isQueueSubmitting) {
            return;
          }

          setSubmissionError("");
          setQueueSubmissionError("");
          setIsReviewOpen(false);
        }}
        onSubmit={handleSubmitTrade}
        onQueueSubmit={handleSubmitQueue}
      />
    </div>
  );
}
