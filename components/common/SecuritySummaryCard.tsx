import Badge from "@/components/common/Badge";

type Props = {
  ticker: string;
  name: string;
  side?: string | null;
  currentPrice: number | null;
  portfolioPct: number | null;
  marketValue: number | null;
  shares: number | null;
  asOfDate?: string | Date | null;
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

function formatPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }

  return `${value.toFixed(2)}%`;
}

function formatShares(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }

  return Math.round(value).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });
}

export default function SecuritySummaryCard({
  ticker,
  name,
  side,
  currentPrice,
  portfolioPct,
  marketValue,
  shares,
  asOfDate,
}: Props) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{ticker}</p>

          <p className="mt-0.5 truncate text-xs text-slate-500">{name}</p>
        </div>

        <Badge tone={side === "SHORT" ? "red" : "green"}>
          {side || "ACTIVE"}
        </Badge>
      </div>

        <div className="mt-3 grid [grid-template-columns:repeat(auto-fit,minmax(115px,1fr))] gap-3">
            <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Current Price
            </p>

            <p className="mt-1 font-semibold tabular-nums text-slate-950">
                {formatPrice(currentPrice)}
            </p>
        </div>

        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            % of Net Equity
          </p>

          <p className="mt-1 font-semibold tabular-nums text-slate-950">
            {formatPercent(portfolioPct)}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Shares
          </p>

          <p className="mt-1 font-semibold tabular-nums text-slate-950">
            {formatShares(shares)}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Market Value
          </p>

          <p className="mt-1 font-semibold tabular-nums text-slate-950">
            {formatMoney(marketValue)}
          </p>
        </div>
      </div>

      {asOfDate ? (
        <p className="mt-2 text-[11px] text-slate-400">
          Position percentage uses Net Equity as of{" "}
          {new Date(asOfDate).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            timeZone: "UTC",
          })}
          .
        </p>
      ) : null}
    </div>
  );
}
