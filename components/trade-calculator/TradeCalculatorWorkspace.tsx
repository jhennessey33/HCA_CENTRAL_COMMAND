"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import SecuritySummaryCard from "@/components/common/SecuritySummaryCard";
import TradeScenarioPanel from "@/components/trade-calculator/TradeScenarioPanel";
import { canLogManualTrade } from "@/lib/client-permissions";
import { buildTradeHistoryAnalytics } from "@/lib/dashboard/trade-history-analytics";

import type { TradeBaselineMode } from "@/lib/trade-calculator/trade-calculator";

type FundEquitySnapshot = {
  id: string;
  asOfDate: string;
  netEquity: number;
  source: string;
};

type TradeCalculatorWorkspaceProps = {
  securities: any[];
  grossPortfolioMarketValue: number;
  fundEquitySnapshots: FundEquitySnapshot[];
};

type FinnhubSecurityOption = {
  id: string;
  ticker: string;
  name: string;
  sector: null;
  industry: string | null;
  marketData: Array<{
    currentPrice: number;
    marketDataSource: "FINNHUB";
    snapshotAsOf: string;
    updatedAt: string;
  }>;
  positions: [];
  isExternalLookup: true;
};

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) ? parsedValue : null;
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

function formatNumber(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }

  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
}

function formatSignedNumber(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value) || Math.abs(value) < 0.000001) {
    return "—";
  }

  const formattedValue = Math.abs(value).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });

  return `${value > 0 ? "+" : "-"}${formattedValue}`;
}

function formatPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }

  return `${value.toFixed(2)}%`;
}

function signedValueClass(value: number | null | undefined) {
  if (value == null || Math.abs(value) < 0.000001) {
    return "text-slate-500";
  }

  return value > 0 ? "text-emerald-600" : "text-rose-600";
}

function getWellsImpliedPrice(position: any) {
  const shares = toFiniteNumber(position?.shares);

  const marketValue = toFiniteNumber(position?.marketValue);

  if (shares == null || marketValue == null || shares === 0) {
    return null;
  }

  return Math.abs(marketValue / shares);
}

function getCurrentPrice(security: any, position: any) {
  const marketData = security?.marketData?.[0];

  const quotePrice = toFiniteNumber(marketData?.currentPrice);

  if (marketData?.marketDataSource === "FINNHUB" && quotePrice != null) {
    return quotePrice;
  }

  return getWellsImpliedPrice(position);
}

function getWellsWap(position: any) {
  const shares = toFiniteNumber(position?.shares);

  const costBasis = toFiniteNumber(position?.costBasis);

  if (shares == null || costBasis == null || shares === 0) {
    return null;
  }

  return Math.abs(costBasis / shares);
}

function getWellsPortfolioWeight(position: any, netEquity: number | null) {
  const marketValue = toFiniteNumber(position?.marketValue);

  if (marketValue == null || netEquity == null || netEquity <= 0) {
    return null;
  }

  return (Math.abs(marketValue) / netEquity) * 100;
}

export default function TradeCalculatorWorkspace({
  securities,
  grossPortfolioMarketValue,
  fundEquitySnapshots,
}: TradeCalculatorWorkspaceProps) {
  const [localSecurities, setLocalSecurities] = useState<any[]>(securities);

  const [currentUser, setCurrentUser] = useState<any | null>(null);

  const [securityQuery, setSecurityQuery] = useState("");

  const [isSecurityDropdownOpen, setIsSecurityDropdownOpen] = useState(false);

  const [highlightedSecurityIndex, setHighlightedSecurityIndex] = useState(0);

  const [remoteSecurities, setRemoteSecurities] = useState<
    FinnhubSecurityOption[]
  >([]);

  const [isSecuritySearchLoading, setIsSecuritySearchLoading] = useState(false);

  const [securitySearchError, setSecuritySearchError] = useState("");

  const [isSecurityQuoteLoading, setIsSecurityQuoteLoading] = useState(false);

  const [securityQuoteError, setSecurityQuoteError] = useState("");

  const securityComboboxRef = useRef<HTMLDivElement | null>(null);

  const securityQuoteRequestRef = useRef(0);

  const [selectedSecurityId, setSelectedSecurityId] = useState("");

  const [selectedPositionId, setSelectedPositionId] = useState("");

  const [baselineMode, setBaselineMode] =
    useState<TradeBaselineMode>("WELLS_PLUS_PENDING");
  useEffect(() => {
    let isCancelled = false;

    async function loadCurrentUser() {
      const response = await fetch("/api/auth/me", {
        credentials: "include",
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();

      if (!isCancelled) {
        setCurrentUser(data.user);
      }
    }

    loadCurrentUser();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;

      if (
        securityComboboxRef.current &&
        !securityComboboxRef.current.contains(target)
      ) {
        setIsSecurityDropdownOpen(false);

        if (selectedSecurityId) {
          const selectedSecurity = localSecurities.find(
            (security) => security.id === selectedSecurityId,
          );

          if (selectedSecurity) {
            setSecurityQuery(
              `${selectedSecurity.ticker} — ${selectedSecurity.name}`,
            );
          }
        }
      }
    }

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  const normalizedQuery = securityQuery.trim().toLowerCase();

  useEffect(() => {
    setHighlightedSecurityIndex(0);
  }, [normalizedQuery]);

  useEffect(() => {
    if (!normalizedQuery || selectedSecurityId) {
      return;
    }

    const controller = new AbortController();
    const query = securityQuery.trim();

    const timeoutId = window.setTimeout(async () => {
      setIsSecuritySearchLoading(true);
      setSecuritySearchError("");

      try {
        const response = await fetch(
          `/api/trade-calculator/security-search?q=${encodeURIComponent(query)}`,
          {
            credentials: "include",
            signal: controller.signal,
          },
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Unable to search securities.");
        }

        const results = Array.isArray(data.results) ? data.results : [];

        setRemoteSecurities(
          results.map(
            (result: {
              ticker: string;
              name: string;
              type: string | null;
            }) => ({
              id: `finnhub:${result.ticker}`,
              ticker: result.ticker,
              name: result.name,
              sector: null,
              industry: result.type,
              marketData: [],
              positions: [],
              isExternalLookup: true,
            }),
          ),
        );
      } catch (error) {
        if (!controller.signal.aborted) {
          setRemoteSecurities([]);
          setSecuritySearchError(
            error instanceof Error
              ? error.message
              : "Unable to search securities.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSecuritySearchLoading(false);
        }
      }
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [normalizedQuery, securityQuery, selectedSecurityId]);

  const filteredSecurities = useMemo(() => {
    const localMatches = localSecurities
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

    if (!normalizedQuery) {
      return localMatches;
    }

    const localTickers = new Set(
      localSecurities.map((security) => String(security.ticker).toUpperCase()),
    );

    const externalMatches = remoteSecurities.filter(
      (security) => !localTickers.has(security.ticker.toUpperCase()),
    );

    return [...localMatches, ...externalMatches].slice(0, 50);
  }, [localSecurities, normalizedQuery, remoteSecurities]);

  const selectedSecurity =
    localSecurities.find((security) => security.id === selectedSecurityId) ??
    null;

  const selectedSecurityPositions = Array.isArray(selectedSecurity?.positions)
    ? selectedSecurity.positions
    : [];

  const selectedPosition =
    selectedSecurityPositions.find(
      (position: any) => position.id === selectedPositionId,
    ) ?? null;

  useEffect(() => {
    if (selectedSecurityPositions.length === 1) {
      setSelectedPositionId(selectedSecurityPositions[0].id);

      return;
    }

    setSelectedPositionId("");
  }, [selectedSecurityId, selectedSecurityPositions.length]);

  useEffect(() => {
    setBaselineMode("WELLS_PLUS_PENDING");
  }, [selectedPositionId]);

  const currentPrice = selectedSecurity
    ? getCurrentPrice(selectedSecurity, selectedPosition)
    : null;

  const analytics = useMemo(
    () =>
      selectedPosition
        ? buildTradeHistoryAnalytics({
            positionSide: selectedPosition.side,
            currentShares: selectedPosition.shares,
            currentPrice,
            trades: Array.isArray(selectedPosition.trades)
              ? selectedPosition.trades
              : [],
          })
        : null,
    [selectedPosition, currentPrice],
  );

  const selectedBaselineExposure =
    baselineMode === "WELLS_PLUS_PENDING"
      ? (analytics?.projectedExposure ?? null)
      : (analytics?.wellsExposure ?? null);

  const selectedBaselineSide =
    selectedPosition?.side === "SHORT"
      ? "Short"
      : selectedPosition
        ? "Long"
        : "—";

  const wellsWap = selectedPosition ? getWellsWap(selectedPosition) : null;

  const latestFundEquitySnapshot = fundEquitySnapshots[0] ?? null;

  const latestNetEquity = latestFundEquitySnapshot
    ? toFiniteNumber(latestFundEquitySnapshot.netEquity)
    : null;

  const wellsPortfolioWeight = selectedPosition
    ? getWellsPortfolioWeight(selectedPosition, latestNetEquity)
    : null;

  const selectedPositionShares = selectedPosition
    ? toFiniteNumber(selectedPosition.shares)
    : null;

  const selectedPositionMarketValue = selectedPosition
    ? toFiniteNumber(selectedPosition.marketValue)
    : null;

  function handleTradeCreated(trade: any) {
    setLocalSecurities((currentSecurities) =>
      currentSecurities.map((security) => {
        if (security.id !== trade.securityId) {
          return security;
        }

        return {
          ...security,
          positions: (security.positions || []).map((position: any) => {
            if (position.id !== trade.positionId) {
              return position;
            }

            return {
              ...position,
              trades: [trade, ...(position.trades || [])],
            };
          }),
        };
      }),
    );
  }
  async function handleSecurityChange(securityId: string) {
    const securityOption =
      filteredSecurities.find((security) => security.id === securityId) ??
      localSecurities.find((security) => security.id === securityId);

    if (!securityOption) {
      return;
    }

    const quoteRequestId = securityQuoteRequestRef.current + 1;
    securityQuoteRequestRef.current = quoteRequestId;

    if (!localSecurities.some((security) => security.id === securityId)) {
      setLocalSecurities((currentSecurities) => [
        ...currentSecurities,
        securityOption,
      ]);
    }

    setSelectedSecurityId(securityId);

    setSelectedPositionId("");

    const selectedSecurity = securityOption;

    setSecurityQuery(
      selectedSecurity
        ? `${selectedSecurity.ticker} — ${selectedSecurity.name}`
        : "",
    );

    setIsSecurityDropdownOpen(false);

    setHighlightedSecurityIndex(0);

    setSecuritySearchError("");
    setSecurityQuoteError("");

    if (
      Array.isArray(securityOption.positions) &&
      securityOption.positions.length > 0
    ) {
      setIsSecurityQuoteLoading(false);
      return;
    }

    setIsSecurityQuoteLoading(true);

    try {
      const response = await fetch(
        `/api/trade-calculator/security-quote/${encodeURIComponent(
          securityOption.ticker,
        )}`,
        { credentials: "include" },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load the current price.");
      }

      const currentPrice = toFiniteNumber(data.currentPrice);

      if (currentPrice == null || currentPrice <= 0) {
        throw new Error("Finnhub did not return a valid current price.");
      }

      if (securityQuoteRequestRef.current !== quoteRequestId) {
        return;
      }

      const quoteAsOf = String(data.asOf || new Date().toISOString());

      setLocalSecurities((currentSecurities) =>
        currentSecurities.map((security) =>
          security.id === securityId
            ? {
                ...security,
                marketData: [
                  {
                    currentPrice,
                    marketDataSource: "FINNHUB",
                    snapshotAsOf: quoteAsOf,
                    updatedAt: quoteAsOf,
                  },
                ],
              }
            : security,
        ),
      );
    } catch (error) {
      if (securityQuoteRequestRef.current === quoteRequestId) {
        setSecurityQuoteError(
          error instanceof Error
            ? error.message
            : "Unable to load the current price.",
        );
      }
    } finally {
      if (securityQuoteRequestRef.current === quoteRequestId) {
        setIsSecurityQuoteLoading(false);
      }
    }
  }

  function handleClearSecurity() {
    securityQuoteRequestRef.current += 1;
    setSelectedSecurityId("");
    setSelectedPositionId("");
    setSecurityQuery("");
    setRemoteSecurities([]);
    setIsSecuritySearchLoading(false);
    setSecuritySearchError("");
    setIsSecurityQuoteLoading(false);
    setSecurityQuoteError("");
    setIsSecurityDropdownOpen(true);
    setHighlightedSecurityIndex(0);
  }

  function handleSecurityKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setIsSecurityDropdownOpen(false);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();

      setIsSecurityDropdownOpen(true);

      setHighlightedSecurityIndex((currentIndex) =>
        Math.min(currentIndex + 1, Math.max(filteredSecurities.length - 1, 0)),
      );

      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();

      setHighlightedSecurityIndex((currentIndex) =>
        Math.max(currentIndex - 1, 0),
      );

      return;
    }

    if (event.key === "Enter" && isSecurityDropdownOpen) {
      event.preventDefault();

      const highlightedSecurity = filteredSecurities[highlightedSecurityIndex];

      if (highlightedSecurity) {
        handleSecurityChange(highlightedSecurity.id);
      }
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Step 1
          </p>

          <h3 className="mt-1 text-lg font-semibold text-slate-950">
            Select a Security
          </h3>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            Search the portfolio or Finnhub. Existing positions use their Wells
            baseline; new positions begin flat.
          </p>
        </div>

        <div ref={securityComboboxRef} className="relative mt-5">
          <label className="text-sm font-medium text-slate-700">Security</label>

          <div className="relative mt-2">
            <input
              value={securityQuery}
              onFocus={() => {
                if (selectedSecurityId) {
                  setSecurityQuery("");
                }

                setIsSecurityDropdownOpen(true);
              }}
              onChange={(event) => {
                setSecurityQuery(event.target.value);
                setRemoteSecurities([]);
                setIsSecuritySearchLoading(false);
                setSecuritySearchError("");

                if (selectedSecurityId) {
                  securityQuoteRequestRef.current += 1;
                  setSelectedSecurityId("");
                  setSelectedPositionId("");
                  setIsSecurityQuoteLoading(false);
                  setSecurityQuoteError("");
                }

                setIsSecurityDropdownOpen(true);
              }}
              onKeyDown={handleSecurityKeyDown}
              placeholder="Search portfolio or enter a ticker..."
              autoComplete="off"
              role="combobox"
              aria-expanded={isSecurityDropdownOpen}
              aria-controls="trade-calculator-security-options"
              className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-4 pr-20 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            />

            <div className="absolute inset-y-0 right-3 flex items-center gap-1">
              {selectedSecurityId || securityQuery ? (
                <button
                  type="button"
                  onClick={handleClearSecurity}
                  aria-label="Clear selected security"
                  className="rounded-lg px-2 py-1 text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  ✕
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => setIsSecurityDropdownOpen((current) => !current)}
                aria-label="Toggle security options"
                className="rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ▼
              </button>
            </div>
          </div>

          {isSecurityDropdownOpen ? (
            <div
              id="trade-calculator-security-options"
              role="listbox"
              className="absolute z-40 mt-2 max-h-80 w-full overflow-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl"
            >
              {filteredSecurities.length ? (
                filteredSecurities.map((security, index) => {
                  const isHighlighted = highlightedSecurityIndex === index;

                  const isSelected = selectedSecurityId === security.id;

                  return (
                    <button
                      key={security.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setHighlightedSecurityIndex(index)}
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
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-950">
                            {security.ticker}
                          </span>

                          {security.isExternalLookup ? (
                            <span className="rounded-lg bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                              Finnhub
                            </span>
                          ) : security.sector ? (
                            <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                              {security.sector}
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
                <div className="px-4 py-8 text-center">
                  <p className="text-sm font-medium text-slate-700">
                    {isSecuritySearchLoading
                      ? "Searching Finnhub..."
                      : securitySearchError
                        ? "Security search unavailable"
                        : "No securities matched"}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {securitySearchError ||
                      "Try a ticker or company name from outside the portfolio."}
                  </p>
                </div>
              )}

              {filteredSecurities.length > 0 && isSecuritySearchLoading ? (
                <p className="px-3 py-2 text-xs text-slate-400">
                  Searching Finnhub for more matches...
                </p>
              ) : null}

              {filteredSecurities.length > 0 && securitySearchError ? (
                <p className="px-3 py-2 text-xs text-amber-700">
                  {securitySearchError}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        {selectedSecurity ? (
          <div className="mt-4">
            <SecuritySummaryCard
              ticker={selectedSecurity.ticker}
              name={selectedSecurity.name}
              side={selectedPosition?.side ?? "NEW"}
              currentPrice={currentPrice}
              portfolioPct={wellsPortfolioWeight}
              marketValue={selectedPositionMarketValue}
              shares={
                selectedPositionShares != null
                  ? Math.abs(selectedPositionShares)
                  : null
              }
              asOfDate={
                selectedPosition
                  ? (latestFundEquitySnapshot?.asOfDate ?? null)
                  : null
              }
            />
          </div>
        ) : null}

        {selectedSecurity && isSecurityQuoteLoading ? (
          <div className="mt-3 rounded-2xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
            Loading the current Finnhub price for {selectedSecurity.ticker}...
          </div>
        ) : null}

        {selectedSecurity && securityQuoteError ? (
          <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {securityQuoteError} You can still enter an estimated execution
            price manually.
          </div>
        ) : null}

        {selectedSecurity && selectedSecurityPositions.length > 1 ? (
          <div className="mt-4">
            <label className="text-sm font-medium text-slate-700">
              Active Wells Position
            </label>

            <select
              value={selectedPositionId}
              onChange={(event) => setSelectedPositionId(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value="">Select a position</option>

              {selectedSecurityPositions.map((position: any) => (
                <option key={position.id} value={position.id}>
                  {position.side} • {position.accountNumber || "No account"} •{" "}
                  {formatNumber(Math.abs(Number(position.shares) || 0))} shares
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {selectedSecurity && selectedSecurityPositions.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
            This Security does not currently have an active Wells position, so
            the scenario starts from a flat baseline. Calculation is available,
            but trade submission remains unavailable until an active position
            exists.
          </div>
        ) : null}

        {selectedPosition ? (
          <div className="mt-5">
            <label className="text-sm font-medium text-slate-700">
              Scenario Baseline
            </label>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setBaselineMode("WELLS")}
                className={`rounded-2xl px-3 py-3 text-sm font-medium ${
                  baselineMode === "WELLS"
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                Wells Position
              </button>

              <button
                type="button"
                onClick={() => setBaselineMode("WELLS_PLUS_PENDING")}
                className={`rounded-2xl px-3 py-3 text-sm font-medium ${
                  baselineMode === "WELLS_PLUS_PENDING"
                    ? "bg-violet-700 text-white"
                    : "border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100"
                }`}
              >
                Wells + Pending
              </button>
            </div>

            <p className="mt-2 text-xs leading-5 text-slate-500">
              Wells + Pending applies visible MANUAL_PENDING trades forward from
              the authoritative Wells position.
            </p>
          </div>
        ) : null}
      </section>

      <section className="min-w-0">
        {!selectedSecurity ? (
          <div className="flex min-h-[430px] items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <div>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-xl font-semibold text-slate-500">
                1
              </div>

              <h3 className="mt-4 text-lg font-semibold text-slate-950">
                Select a Security to begin
              </h3>

              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
                HCA will use the Wells position when one exists, or start a new
                position from zero. Finnhub supplies current prices for external
                ticker lookups.
              </p>
            </div>
          </div>
        ) : selectedSecurityPositions.length > 1 && !selectedPosition ? (
          <div className="flex min-h-[430px] items-center justify-center rounded-3xl border border-dashed border-amber-300 bg-amber-50 p-8 text-center">
            <div>
              <h3 className="text-lg font-semibold text-amber-900">
                Select an active position
              </h3>

              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-amber-800">
                This Security has multiple active Wells positions. Choose the
                position that should form the scenario baseline.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {analytics && !analytics.pendingProjectionIsValid ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-800">
                The pending manual trades do not produce a valid operational
                baseline. Review the pending trade history before modeling
                another trade.
              </div>
            ) : null}

            {baselineMode === "WELLS_PLUS_PENDING" &&
            analytics &&
            analytics.pendingTradeCount > 0 ? (
              <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm leading-6 text-violet-800">
                This scenario baseline includes{" "}
                <span className="font-semibold">
                  {analytics.pendingTradeCount}
                </span>{" "}
                unreconciled manual{" "}
                {analytics.pendingTradeCount === 1 ? "trade" : "trades"}. Wells
                remains authoritative until reconciliation.
              </div>
            ) : null}

            <TradeScenarioPanel
              security={selectedSecurity}
              position={selectedPosition}
              baselineMode={baselineMode}
              pendingManualDelta={analytics?.pendingManualDelta ?? 0}
              pendingProjectionIsValid={
                analytics?.pendingProjectionIsValid ?? true
              }
              currentPrice={currentPrice}
              wellsWap={wellsWap}
              grossPortfolioMarketValue={grossPortfolioMarketValue}
              fundEquitySnapshots={fundEquitySnapshots}
              canSubmitManualTrade={canLogManualTrade(currentUser?.role)}
              onTradeCreated={handleTradeCreated}
            />
          </div>
        )}
      </section>
    </div>
  );
}
