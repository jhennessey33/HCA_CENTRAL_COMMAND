export type TradeHistorySource = {
  id: string;
  dateTraded: string | Date;
  shares: number;
  avgPrice: number;
  tradeType?: string | null;
  notional?: number | null;
  source?: string | null;
  reconciliationStatus?: string | null;
  comment?: string | null;
  createdAt?: string | Date | null;
};

export type TradeCalculationBasis =
  | "AUTHORITATIVE_HISTORY"
  | "PENDING_PROJECTION";

export type TradeHistoryRow = {
  trade: TradeHistorySource;
  tradeType: string;
  absoluteShares: number;
  notional: number | null;
  positionBefore: number | null;
  positionAfter: number | null;
  positionChangePct: number | null;
  positionChangeLabel: string;
  executionVsCurrentPct: number | null;
  daysSinceTrade: number | null;
  isEntry: boolean;
  isExit: boolean;
  isPendingManual: boolean;
  calculationBasis: TradeCalculationBasis;
  hasValidPositionHistory: boolean;
};

export type TradeHistoryAnalytics = {
  rows: TradeHistoryRow[];
  tradeCount: number;
  entryTradeCount: number;
  exitTradeCount: number;
  authoritativeTradeCount: number;
  pendingTradeCount: number;
  totalSharesTraded: number;
  grossTradeNotional: number;
  weightedEntryPrice: number | null;
  weightedExitPrice: number | null;
  firstTradeAt: string | Date | null;
  mostRecentTradeAt: string | Date | null;
  daysSinceLastTrade: number | null;
  largestAddPct: number | null;
  largestReductionPct: number | null;
  derivedStartingExposure: number | null;
  historyIsComplete: boolean;
  wellsExposure: number;
  pendingManualDelta: number;
  projectedExposure: number | null;
  pendingProjectionIsValid: boolean;
};

type BuildTradeHistoryAnalyticsInput = {
  positionSide: string;
  currentShares: number | null | undefined;
  currentPrice: number | null | undefined;
  trades: TradeHistorySource[];
};

type PositionCalculation = {
  positionBefore: number | null;
  positionAfter: number | null;
  positionChangePct: number | null;
  positionChangeLabel: string;
  isValid: boolean;
};

const POSITION_TOLERANCE = 0.000001;

function toFiniteNumber(value: unknown) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue)
    ? numberValue
    : null;
}

function normalizeTradeType(value: unknown) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function normalizeStatus(value: unknown) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function normalizeSource(value: unknown) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function isPendingManualTrade(
  trade: TradeHistorySource
) {
  const source =
    normalizeSource(
      trade.source
    );

  return (
    (
      source === "MANUAL" ||
      source === "SYSTEM"
    ) &&
    normalizeStatus(
      trade.reconciliationStatus
    ) === "MANUAL_PENDING"
  );
}

function isEntryTrade(
  positionSide: string,
  tradeType: string
) {
  if (positionSide === "SHORT") {
    return (
      tradeType === "SHORT" ||
      tradeType === "SELL"
    );
  }

  return tradeType === "BUY";
}

function isExitTrade(
  positionSide: string,
  tradeType: string
) {
  if (positionSide === "SHORT") {
    return (
      tradeType === "COVER" ||
      tradeType === "BUY"
    );
  }

  return tradeType === "SELL";
}

function getExposureDelta(
  positionSide: string,
  tradeType: string,
  storedShares: number
) {
  const absoluteShares = Math.abs(storedShares);

  if (isEntryTrade(positionSide, tradeType)) {
    return absoluteShares;
  }

  if (isExitTrade(positionSide, tradeType)) {
    return -absoluteShares;
  }

  if (positionSide === "SHORT") {
    return storedShares < 0
      ? absoluteShares
      : -absoluteShares;
  }

  return storedShares >= 0
    ? absoluteShares
    : -absoluteShares;
}

function calculateDaysSince(
  value: string | Date | null | undefined
) {
  if (!value) {
    return null;
  }

  const dateValue = new Date(value);

  if (Number.isNaN(dateValue.getTime())) {
    return null;
  }

  const millisecondsPerDay =
    24 * 60 * 60 * 1000;

  const elapsedMilliseconds =
    Date.now() - dateValue.getTime();

  return Math.max(
    0,
    Math.floor(
      elapsedMilliseconds / millisecondsPerDay
    )
  );
}

function calculateExecutionVsCurrent(
  positionSide: string,
  entryTrade: boolean,
  executionPrice: number | null,
  currentPrice: number | null
) {
  if (
    !entryTrade ||
    executionPrice == null ||
    currentPrice == null ||
    executionPrice === 0
  ) {
    return null;
  }

  if (positionSide === "SHORT") {
    return (
      ((executionPrice - currentPrice) /
        executionPrice) *
      100
    );
  }

  return (
    ((currentPrice - executionPrice) /
      executionPrice) *
    100
  );
}

function createPositionCalculation(
  positionBefore: number,
  exposureDelta: number
): PositionCalculation {
  const calculatedPositionAfter =
    positionBefore + exposureDelta;

  const isValid =
    positionBefore >= -POSITION_TOLERANCE &&
    calculatedPositionAfter >=
      -POSITION_TOLERANCE;

  const normalizedPositionBefore = isValid
    ? Math.max(0, positionBefore)
    : null;

  const normalizedPositionAfter = isValid
    ? Math.max(0, calculatedPositionAfter)
    : null;

  let positionChangePct: number | null = null;
  let positionChangeLabel = "—";

  if (
    normalizedPositionBefore === 0 &&
    exposureDelta > 0
  ) {
    positionChangeLabel = "New Position";
  } else if (
    normalizedPositionBefore != null &&
    normalizedPositionBefore > 0
  ) {
    positionChangePct =
      (exposureDelta /
        normalizedPositionBefore) *
      100;

    positionChangeLabel = `${
      positionChangePct >= 0 ? "+" : ""
    }${positionChangePct.toFixed(1)}%`;
  }

  return {
    positionBefore: normalizedPositionBefore,
    positionAfter: normalizedPositionAfter,
    positionChangePct,
    positionChangeLabel,
    isValid,
  };
}

function calculateWeightedTradePrice(
  rows: TradeHistoryRow[],
  tradeKind: "ENTRY" | "EXIT"
) {
  const pricedRows = rows.filter((row) => {
    const matchesKind =
      tradeKind === "ENTRY"
        ? row.isEntry
        : row.isExit;

    return (
      matchesKind &&
      toFiniteNumber(row.trade.avgPrice) !=
        null &&
      row.absoluteShares > 0
    );
  });

  const totalShares = pricedRows.reduce(
    (total, row) =>
      total + row.absoluteShares,
    0
  );

  if (totalShares === 0) {
    return null;
  }

  const weightedValue = pricedRows.reduce(
    (total, row) => {
      const price =
        toFiniteNumber(
          row.trade.avgPrice
        ) ?? 0;

      return (
        total +
        row.absoluteShares * price
      );
    },
    0
  );

  return weightedValue / totalShares;
}

function compareTradesNewestFirst(
  firstTrade: TradeHistorySource,
  secondTrade: TradeHistorySource
) {
  const dateDifference =
    new Date(
      secondTrade.dateTraded
    ).getTime() -
    new Date(
      firstTrade.dateTraded
    ).getTime();

  if (dateDifference !== 0) {
    return dateDifference;
  }

  const firstCreatedAt = firstTrade.createdAt
    ? new Date(
        firstTrade.createdAt
      ).getTime()
    : 0;

  const secondCreatedAt =
    secondTrade.createdAt
      ? new Date(
          secondTrade.createdAt
        ).getTime()
      : 0;

  return secondCreatedAt - firstCreatedAt;
}

function buildCommonRowValues(
  trade: TradeHistorySource,
  positionSide: string,
  currentPrice: number | null
) {
  const tradeType =
    normalizeTradeType(trade.tradeType);

  const storedShares =
    toFiniteNumber(trade.shares) ?? 0;

  const absoluteShares =
    Math.abs(storedShares);

  const entryTrade = isEntryTrade(
    positionSide,
    tradeType
  );

  const exitTrade = isExitTrade(
    positionSide,
    tradeType
  );

  const averagePrice =
    toFiniteNumber(trade.avgPrice);

  const storedNotional =
    toFiniteNumber(trade.notional);

  const notional =
    storedNotional != null
      ? Math.abs(storedNotional)
      : averagePrice != null
        ? absoluteShares * averagePrice
        : null;

  return {
    tradeType,
    storedShares,
    absoluteShares,
    entryTrade,
    exitTrade,
    averagePrice,
    notional,
    executionVsCurrentPct:
      calculateExecutionVsCurrent(
        positionSide,
        entryTrade,
        averagePrice,
        currentPrice
      ),
  };
}

export function buildTradeHistoryAnalytics({
  positionSide,
  currentShares,
  currentPrice,
  trades,
}: BuildTradeHistoryAnalyticsInput): TradeHistoryAnalytics {
  const normalizedPositionSide =
    positionSide === "SHORT"
      ? "SHORT"
      : "LONG";

  const normalizedCurrentShares =
    toFiniteNumber(currentShares);

  const wellsExposure =
    normalizedCurrentShares == null
      ? 0
      : Math.abs(normalizedCurrentShares);

  const normalizedCurrentPrice =
    toFiniteNumber(currentPrice);

  const newestFirstTrades = [...trades].sort(
    compareTradesNewestFirst
  );

  const pendingTrades =
    newestFirstTrades.filter(
      isPendingManualTrade
    );

  const authoritativeTrades =
    newestFirstTrades.filter(
      (trade) =>
        !isPendingManualTrade(trade)
    );

  const pendingCalculations =
    new Map<string, PositionCalculation>();

  let runningProjectedExposure =
    wellsExposure;

  let pendingManualDelta = 0;
  let pendingProjectionIsValid = true;

  const oldestFirstPendingTrades = [
    ...pendingTrades,
  ].reverse();

  oldestFirstPendingTrades.forEach(
    (trade) => {
      const commonValues =
        buildCommonRowValues(
          trade,
          normalizedPositionSide,
          normalizedCurrentPrice
        );

      const exposureDelta =
        getExposureDelta(
          normalizedPositionSide,
          commonValues.tradeType,
          commonValues.storedShares
        );

      const calculation =
        createPositionCalculation(
          runningProjectedExposure,
          exposureDelta
        );

      pendingCalculations.set(
        trade.id,
        calculation
      );

      pendingManualDelta += exposureDelta;

      if (!calculation.isValid) {
        pendingProjectionIsValid = false;
      }

      runningProjectedExposure =
        runningProjectedExposure +
        exposureDelta;
    }
  );

  const projectedExposure =
    pendingProjectionIsValid
      ? Math.max(
          0,
          runningProjectedExposure
        )
      : null;

  const authoritativeCalculations =
    new Map<string, PositionCalculation>();

  let runningHistoricalPositionAfter =
    wellsExposure;

  let historyIsComplete = true;

  authoritativeTrades.forEach((trade) => {
    const commonValues =
      buildCommonRowValues(
        trade,
        normalizedPositionSide,
        normalizedCurrentPrice
      );

    const exposureDelta =
      getExposureDelta(
        normalizedPositionSide,
        commonValues.tradeType,
        commonValues.storedShares
      );

    const calculatedPositionBefore =
      runningHistoricalPositionAfter -
      exposureDelta;

    const calculation =
      createPositionCalculation(
        calculatedPositionBefore,
        exposureDelta
      );

    authoritativeCalculations.set(
      trade.id,
      calculation
    );

    if (!calculation.isValid) {
      historyIsComplete = false;
    }

    runningHistoricalPositionAfter =
      calculatedPositionBefore;
  });

  const derivedStartingExposure =
    runningHistoricalPositionAfter >=
    -POSITION_TOLERANCE
      ? Math.max(
          0,
          runningHistoricalPositionAfter
        )
      : null;

  if (
    derivedStartingExposure == null ||
    derivedStartingExposure >
      POSITION_TOLERANCE
  ) {
    historyIsComplete = false;
  }

  const rows: TradeHistoryRow[] =
    newestFirstTrades.map((trade) => {
      const commonValues =
        buildCommonRowValues(
          trade,
          normalizedPositionSide,
          normalizedCurrentPrice
        );

      const pendingManual =
        isPendingManualTrade(trade);

      const calculation = pendingManual
        ? pendingCalculations.get(trade.id)
        : authoritativeCalculations.get(
            trade.id
          );

      return {
        trade,
        tradeType:
          commonValues.tradeType ||
          "UNKNOWN",
        absoluteShares:
          commonValues.absoluteShares,
        notional: commonValues.notional,
        positionBefore:
          calculation?.positionBefore ??
          null,
        positionAfter:
          calculation?.positionAfter ??
          null,
        positionChangePct:
          calculation?.positionChangePct ??
          null,
        positionChangeLabel:
          calculation?.positionChangeLabel ??
          "—",
        executionVsCurrentPct:
          commonValues.executionVsCurrentPct,
        daysSinceTrade:
          calculateDaysSince(
            trade.dateTraded
          ),
        isEntry:
          commonValues.entryTrade,
        isExit:
          commonValues.exitTrade,
        isPendingManual: pendingManual,
        calculationBasis: pendingManual
          ? "PENDING_PROJECTION"
          : "AUTHORITATIVE_HISTORY",
        hasValidPositionHistory:
          calculation?.isValid ?? false,
      };
    });

  const totalSharesTraded = rows.reduce(
    (total, row) =>
      total + row.absoluteShares,
    0
  );

  const grossTradeNotional = rows.reduce(
    (total, row) =>
      total + (row.notional ?? 0),
    0
  );

  const validDateRows = rows.filter(
    (row) =>
      !Number.isNaN(
        new Date(
          row.trade.dateTraded
        ).getTime()
      )
  );

  const mostRecentTradeAt =
    validDateRows[0]?.trade.dateTraded ??
    null;

  const firstTradeAt =
    validDateRows.length > 0
      ? validDateRows[
          validDateRows.length - 1
        ].trade.dateTraded
      : null;

  const addPercentages = rows
    .map(
      (row) =>
        row.positionChangePct
    )
    .filter(
      (value): value is number =>
        value != null && value > 0
    );

  const reductionPercentages = rows
    .map(
      (row) =>
        row.positionChangePct
    )
    .filter(
      (value): value is number =>
        value != null && value < 0
    );

  return {
    rows,
    tradeCount: rows.length,
    entryTradeCount: rows.filter(
      (row) => row.isEntry
    ).length,
    exitTradeCount: rows.filter(
      (row) => row.isExit
    ).length,
    authoritativeTradeCount:
      authoritativeTrades.length,
    pendingTradeCount:
      pendingTrades.length,
    totalSharesTraded,
    grossTradeNotional,
    weightedEntryPrice:
      calculateWeightedTradePrice(
        rows,
        "ENTRY"
      ),
    weightedExitPrice:
      calculateWeightedTradePrice(
        rows,
        "EXIT"
      ),
    firstTradeAt,
    mostRecentTradeAt,
    daysSinceLastTrade:
      calculateDaysSince(
        mostRecentTradeAt
      ),
    largestAddPct:
      addPercentages.length > 0
        ? Math.max(...addPercentages)
        : null,
    largestReductionPct:
      reductionPercentages.length > 0
        ? Math.min(
            ...reductionPercentages
          )
        : null,
    derivedStartingExposure,
    historyIsComplete,
    wellsExposure,
    pendingManualDelta,
    projectedExposure,
    pendingProjectionIsValid,
  };
}