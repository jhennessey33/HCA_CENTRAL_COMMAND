"use client";

import Badge from "@/components/common/Badge";
import LocalDateTime from "@/components/common/LocalDateTime";
import type {
  ManualTradeDraft,
  TradeCalculatorResult,
} from "@/lib/trade-calculator/trade-calculator";

type ManualTradeReviewModalProps = {
  open: boolean;
  draft: ManualTradeDraft | null;
  result: TradeCalculatorResult;
  baselineLabel: string;
  canSubmit: boolean;
  isSubmitting: boolean;
  submissionError: string;
  onClose: () => void;
  onSubmit: () => Promise<void>;
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
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
}

function formatWholeShares(
  value: number | null | undefined
) {
  if (
    value == null ||
    !Number.isFinite(value)
  ) {
    return "—";
  }

  return Math.round(value).toLocaleString(
    "en-US",
    {
      maximumFractionDigits: 0,
    }
  );
}

function formatPercent(
  value: number | null | undefined,
  includeSign = false
) {
  if (
    value == null ||
    !Number.isFinite(value)
  ) {
    return "—";
  }

  const sign =
    includeSign && value > 0
      ? "+"
      : "";

  return `${sign}${value.toFixed(2)}%`;
}

function formatSide(
  side: "LONG" | "SHORT" | "FLAT"
) {
  if (side === "LONG") {
    return "Long";
  }

  if (side === "SHORT") {
    return "Short";
  }

  return "Flat";
}

function ReviewValue({
  label,
  value,
  detail,
}: {
  label: string;
  value: React.ReactNode;
  detail?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <div className="mt-2 font-semibold text-slate-950">
        {value}
      </div>

      {detail ? (
        <p className="mt-1 text-xs leading-5 text-slate-500">
          {detail}
        </p>
      ) : null}
    </div>
  );
}

export default function ManualTradeReviewModal({
  open,
  draft,
  result,
  baselineLabel,
  canSubmit,
  isSubmitting,
  submissionError,
  onClose,
  onSubmit,
}: ManualTradeReviewModalProps) {
  if (!open || !draft) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 p-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold text-slate-950">
                Review Manual Trade
              </h2>

              <Badge
                tone={
                  draft.tradeType === "SELL" ||
                  draft.tradeType === "SHORT"
                    ? "red"
                    : "green"
                }
              >
                {draft.tradeType}
              </Badge>

              <Badge tone="amber">
                Manual Pending
              </Badge>
            </div>

            <p className="mt-1 text-sm text-slate-500">
              {draft.ticker} â€¢{" "}
              {draft.companyName}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            âœ•
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-auto p-6">
          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Proposed Trade
            </p>

            <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-3">
              <ReviewValue
                label="Security"
                value={draft.ticker}
                detail={draft.companyName}
              />

              <ReviewValue
                label="Action"
                value={draft.tradeType}
                detail="Manual trade classification"
              />

              <ReviewValue
                label="Shares"
                value={formatWholeShares(
                  draft.shares
                )}
                detail="Positive submitted quantity"
              />

              <ReviewValue
                label="Estimated Price"
                value={formatPrice(
                  draft.avgPrice
                )}
                detail="Scenario execution price"
              />

              <ReviewValue
                label="Estimated Notional"
                value={formatMoney(
                  result.proposedNotional
                )}
                detail="Shares Ã— estimated price"
              />

              <ReviewValue
                label="Trade Date and Time"
                value={
                  <LocalDateTime
                    value={draft.dateTraded}
                  />
                }
                detail="Stored as an exact timestamp"
              />
              {draft.tradeType === "SHORT" ? (
                <ReviewValue
                  label="Short Locate Number"
                  value={
                    draft.shortLocateNumber ||
                    "—"
                  }
                  detail="Required locate reference"
                />
              ) : null}

            </div>
          </section>

          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Position Impact
            </p>

            <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4">
              <ReviewValue
                label="Wells Position"
                value={
                  <span>
                    {formatNumber(
                      result.wellsExposure
                    )}{" "}
                    <span className="text-sm text-slate-500">
                      {formatSide(
                        result.wellsSide
                      )}
                    </span>
                  </span>
                }
                detail="Authoritative current exposure"
              />

              <ReviewValue
                label="Selected Baseline"
                value={
                  <span>
                    {formatNumber(
                      result.baselineExposure
                    )}{" "}
                    <span className="text-sm text-slate-500">
                      {formatSide(
                        result.baselineSide
                      )}
                    </span>
                  </span>
                }
                detail={baselineLabel}
              />

              <ReviewValue
                label="Projected Position"
                value={
                  <span>
                    {formatNumber(
                      result.projectedExposure
                    )}{" "}
                    <span className="text-sm text-slate-500">
                      {formatSide(
                        result.projectedSide
                      )}
                    </span>
                  </span>
                }
                detail="After the proposed trade"
              />

              <ReviewValue
                label="Position Change"
                value={
                  result.exposureChangeLabel
                }
                detail="Change in absolute exposure"
              />

              <ReviewValue
                label="Current Wells Weight"
                value={formatPercent(
                  result.currentPortfolioWeightPct
                )}
                detail="Wells market value ÷ Net Equity"
              />

              <ReviewValue
                label="Projected Weight"
                value={formatPercent(
                  result.projectedPortfolioWeightPct
                )}
                detail="Projected market value ÷ Net Equity"
              />

              <ReviewValue
                label="Weight Change"
                value={formatPercent(
                  result.portfolioWeightChangePctPoints,
                  true
                )}
                detail="Percentage-point change"
              />

              <ReviewValue
                label="Estimated Cash Flow"
                value={formatMoney(
                  result.estimatedCashFlow
                )}
                detail={
                  result.estimatedCashFlow != null &&
                  result.estimatedCashFlow < 0
                    ? "Estimated cash use"
                    : "Estimated cash proceeds"
                }
              />
            </div>
          </section>

          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Scenario Risk and Reward
            </p>

            <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-5">
              <ReviewValue
                label="Risk Per Share"
                value={formatPrice(
                  result.riskPerShare
                )}
                detail="Execution to stop"
              />

              <ReviewValue
                label="Total Risk"
                value={formatMoney(
                  result.totalRisk
                )}
                detail="Scenario estimate"
              />

              <ReviewValue
                label="Portfolio Risk"
                value={formatPercent(
                  result.portfolioRiskPct
                )}
                detail="Risk Ã· projected gross portfolio"
              />

              <ReviewValue
                label="Potential Reward"
                value={formatMoney(
                  result.totalReward
                )}
                detail="Scenario estimate"
              />

              <ReviewValue
                label="Reward / Risk"
                value={
                  result.rewardRiskRatio !=
                  null
                    ? `${result.rewardRiskRatio.toFixed(
                        2
                      )}x`
                    : "—"
                }
                detail="Reward divided by risk"
              />
            </div>
          </section>

          {draft.comment ? (
            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Trade Note
              </p>

              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {draft.comment}
              </p>
            </section>
          ) : null}

          {result.warnings.length > 0 ? (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">
                Scenario Notes
              </p>

              <ul className="mt-2 space-y-1 text-sm leading-6 text-amber-800">
                {result.warnings.map(
                  (warning) => (
                    <li key={warning}>
                      â€¢ {warning}
                    </li>
                  )
                )}
              </ul>
            </section>
          ) : null}

          <section className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm leading-6 text-violet-800">
            <p className="font-semibold">
              Manual trade boundary
            </p>

            <p className="mt-1">
              Adding this trade will create a
              Manual Pending record for later Wells
              reconciliation. This action does not
              place a broker order and does not
              modify the Wells-authoritative
              position, WAP, market value, portfolio
              weight, tax lots, or P&amp;L.
            </p>
            {!canSubmit ? (
                <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                <p className="font-semibold text-slate-900">
                    Calculation Only
                </p>

                <p className="mt-1">
                    Your current role may calculate and
                    review trade scenarios but cannot
                    create Manual Pending trades.
                </p>
                </section>
            ) : null}

          {submissionError ? (
            <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">
              {submissionError}
            </section>
          ) : null}
            <p className="mt-2">
              Stop and target prices are scenario
              assumptions only and will not be saved
              with the trade.
            </p>
          </section>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">
            {canSubmit
              ? "Submission creates a Manual Pending trade for Wells reconciliation."
              : "Your current role has calculation-only access."}
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Back to Calculator
            </button>

            <button
              type="button"
              onClick={onSubmit}
              disabled={
                !canSubmit ||
                isSubmitting
              }
              className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
            >
              {isSubmitting
                ? "Adding Trade..."
                : canSubmit
                  ? "Add Manual Trade"
                  : "Calculation Only"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
