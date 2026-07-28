"use client";

import CurrentUserPill from "@/components/auth/CurrentUserPill";

import TradeCalculatorWorkspace from "@/components/trade-calculator/TradeCalculatorWorkspace";
import AppSidebar from "@/components/common/AppSidebar";

type FundEquitySnapshot = {
  id: string;
  asOfDate: string;
  netEquity: number;
  source: string;
};

type TradeCalculatorClientProps = {
  initialSecurities: any[];
  grossPortfolioMarketValue: number;
  fundEquitySnapshots: FundEquitySnapshot[];
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

export default function TradeCalculatorClient({
  initialSecurities,
  grossPortfolioMarketValue,
  fundEquitySnapshots,
}: TradeCalculatorClientProps) {
  const activePositionCount = initialSecurities.reduce(
    (total, security) =>
      total +
      (Array.isArray(security.positions) ? security.positions.length : 0),
    0,
  );

  const securitiesWithPositions = initialSecurities.filter(
    (security) =>
      Array.isArray(security.positions) && security.positions.length > 0,
  ).length;

  const pendingManualTradeCount = initialSecurities.reduce(
    (securityTotal, security) => {
      const positions = Array.isArray(security.positions)
        ? security.positions
        : [];

      return (
        securityTotal +
        positions.reduce(
          (positionTotal: number, position: any) =>
            positionTotal +
            (Array.isArray(position.trades) ? position.trades.length : 0),
          0,
        )
      );
    },
    0,
  );

  return (
    <main className="h-screen overflow-hidden bg-slate-100 text-slate-900">
      <div className="flex h-full">
        <AppSidebar activePage="/trade-calculator" />

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-20 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
            <div>
              <p className="text-sm font-medium text-slate-900">
                Trade Calculator
              </p>

              <p className="text-xs text-slate-500">Potential trade analysis</p>
            </div>

            <div className="ml-4 flex items-center gap-3">
              <CurrentUserPill />
            </div>
          </header>

          <div className="min-w-0 flex-1 overflow-auto p-6">
            <div className="space-y-5">
              <div>
                <h2 className="text-3xl font-semibold tracking-tight">
                  Potential Trade Calculator
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Model position sizing, portfolio impact, and risk without
                  changing HCA records.
                </p>
              </div>

              <div className="grid grid-cols-4 gap-4"></div>

              <TradeCalculatorWorkspace
                securities={initialSecurities}
                grossPortfolioMarketValue={grossPortfolioMarketValue}
                fundEquitySnapshots={fundEquitySnapshots}
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
