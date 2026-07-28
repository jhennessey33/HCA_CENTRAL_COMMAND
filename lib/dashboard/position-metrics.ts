export type MarketData = {
  currentPrice?: number | string | null;
  dayChange?: number | string | null;
  dayPctChange?: number | string | null;
  marketDataSource?: string | null;
};

export type DashboardMetricPosition = {
  source?: string | null;
  shares?: number | string | null;
  marketValue?: number | string | null;
  costBasis?: number | string | null;
  unrealizedPnl?: number | string | null;
  comments?: unknown[] | null;
  security?: {
    marketData?: MarketData[] | null;
  } | null;
};

function getNumber(value: unknown): number | null {
  if (value == null) {
    return null;
  }

  const num = Number(value);

  return Number.isFinite(num) ? num : null;
}

function getMarketData(position: DashboardMetricPosition): MarketData | null {
  return position.security?.marketData?.[0] ?? null;
}

function isRealQuoteSource(source: string | null | undefined): boolean {
  return source === "FINNHUB";
}

function safeDivide(
  numerator: number | null,
  denominator: number | null,
): number | null {
  if (numerator == null || denominator == null || denominator === 0) {
    return null;
  }

  return numerator / denominator;
}

export function getDisplayCostBasis(
  position: DashboardMetricPosition,
): number | null {
  if (position.source !== "WELLS_FARGO") {
    return null;
  }

  return getNumber(position.costBasis);
}

export function getDisplayMarketValue(
  position: DashboardMetricPosition,
): number | null {
  if (position.source !== "WELLS_FARGO") {
    return null;
  }

  return getNumber(position.marketValue);
}

export function getWellsUnrealizedPnl(
  position: DashboardMetricPosition,
): number | null {
  return getNumber(position.unrealizedPnl);
}

export function getDisplayUnrealizedPnl(
  position: DashboardMetricPosition,
): number | null {
  if (position.source !== "WELLS_FARGO") {
    return null;
  }

  return getWellsUnrealizedPnl(position);
}

export function getWellsImpliedPrice(
  position: DashboardMetricPosition,
): number | null {
  const shares = getNumber(position.shares);
  const marketValue = getNumber(position.marketValue);

  const price = safeDivide(marketValue, shares);

  return price == null ? null : Math.abs(price);
}

export function getWellsWap(position: DashboardMetricPosition): number | null {
  const shares = getNumber(position.shares);
  const costBasis = getNumber(position.costBasis);

  const wap = safeDivide(costBasis, shares);

  return wap == null ? null : Math.abs(wap);
}

export function getWellsTotalPctChange(
  position: DashboardMetricPosition,
): number | null {
  const unrealizedPnl = getNumber(position.unrealizedPnl);
  const costBasis = getNumber(position.costBasis);

  if (unrealizedPnl == null || costBasis == null || costBasis === 0) {
    return null;
  }

  return (unrealizedPnl / Math.abs(costBasis)) * 100;
}

export function getDisplayWap(
  position: DashboardMetricPosition,
): number | null {
  return position.source === "WELLS_FARGO" ? getWellsWap(position) : null;
}

export function getDisplayTotalPctChange(
  position: DashboardMetricPosition,
): number | null {
  return position.source === "WELLS_FARGO"
    ? getWellsTotalPctChange(position)
    : null;
}

export function getDisplayCurrentPrice(
  position: DashboardMetricPosition,
): number | null {
  const marketData = getMarketData(position);

  const quotePrice = getNumber(marketData?.currentPrice);

  if (isRealQuoteSource(marketData?.marketDataSource) && quotePrice != null) {
    return quotePrice;
  }

  // Only fall back to Wells implied price for Wells positions
  if (position.source === "WELLS_FARGO") {
    return getWellsImpliedPrice(position);
  }

  return null;
}

export function getDisplayDayPctChange(
  position: DashboardMetricPosition,
): number | null {
  const marketData = getMarketData(position);

  if (!isRealQuoteSource(marketData?.marketDataSource)) {
    return null;
  }

  return getNumber(marketData?.dayPctChange);
}

export function getDisplayDayPnl(
  position: DashboardMetricPosition,
): number | null {
  const marketData = getMarketData(position);

  if (!isRealQuoteSource(marketData?.marketDataSource)) {
    return null;
  }

  const shares = getNumber(position.shares);
  const dayChange = getNumber(marketData?.dayChange);

  // preferred calculation
  if (shares != null && dayChange != null) {
    return shares * dayChange;
  }

  // fallback approximation
  const marketValue = getNumber(position.marketValue);
  const dayPctChange = getNumber(marketData?.dayPctChange);

  if (marketValue != null && dayPctChange != null) {
    return marketValue * (dayPctChange / 100);
  }

  return null;
}

export function getDisplayPortfolioPct(
  position: DashboardMetricPosition,
  netEquity: number | null | undefined,
): number | null {
  const positionMarketValue = getNumber(position.marketValue);

  const validNetEquity = getNumber(netEquity);

  if (
    positionMarketValue == null ||
    validNetEquity == null ||
    validNetEquity <= 0
  ) {
    return null;
  }

  return (Math.abs(positionMarketValue) / validNetEquity) * 100;
}

export function getDashboardStats(positions: any[]) {
  const totalMarketValue = positions.reduce(
    (sum, position) => sum + Math.abs(getNumber(position.marketValue) ?? 0),
    0,
  );

  const netMarketValue = positions.reduce(
    (sum, position) => sum + (getNumber(position.marketValue) ?? 0),
    0,
  );

  const totalUnrealizedPnl = positions.reduce(
    (sum, position) => sum + (getWellsUnrealizedPnl(position) ?? 0),
    0,
  );

  const dayPnl = positions.reduce(
    (sum, position) => sum + (getDisplayDayPnl(position) ?? 0),
    0,
  );

  return {
    totalMarketValue,
    netMarketValue,
    totalUnrealizedPnl,
    dayPnl,
  };
}
