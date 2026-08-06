export type TradeAction = "BUY" | "SELL" | "SHORT" | "COVER";

export type TradeSizingMode =
  "SHARES" | "NOTIONAL" | "TARGET_WEIGHT" | "AMOUNT_BPS";

export type TradeBaselineMode = "WELLS" | "WELLS_PLUS_PENDING";

export type PositionSide = "LONG" | "SHORT" | "FLAT";

export type ManualTradeDraft = {
  securityId: string;
  positionId: string;
  ticker: string;
  companyName: string;
  tradeType: TradeAction;
  shares: number;
  avgPrice: number;
  dateTraded: string;
  comment: string;
  shortLocateNumber: string;
};
export type TradeCalculatorInput = {
  securityId: string;
  positionId: string | null;
  ticker: string;
  companyName: string;
  wellsSide: "LONG" | "SHORT" | null;
  wellsShares: number | null | undefined;
  wellsMarketValue: number | null | undefined;
  wellsWap: number | null | undefined;
  pendingManualDelta: number;
  pendingProjectionIsValid: boolean;
  grossPortfolioMarketValue: number;
  netEquity: number | null;
  baselineMode: TradeBaselineMode;
  tradeAction: TradeAction;
  sizingMode: TradeSizingMode;
  sharesInput?: number | null;
  notionalInput?: number | null;
  basisPointsInput?: number | null;
  targetWeightPctInput?: number | null;
  estimatedPrice?: number | null;
  stopPrice?: number | null;
  targetPrice?: number | null;
  dateTraded?: string | null;
  comment?: string | null;
  shortLocateNumber?: string | null;
};

export type TradeCalculatorResult = {
  isValid: boolean;
  canCreateDraft: boolean;
  errors: string[];
  warnings: string[];

  wellsSide: PositionSide;
  wellsExposure: number;
  wellsSignedShares: number;

  selectedBaselineMode: TradeBaselineMode;
  baselineSide: PositionSide;
  baselineExposure: number;
  baselineSignedShares: number;

  proposedShares: number | null;
  proposedSignedShareChange: number | null;
  proposedNotional: number | null;
  estimatedCashFlow: number | null;

  projectedSide: PositionSide;
  projectedExposure: number | null;
  projectedSignedShares: number | null;
  projectedMarketValue: number | null;

  currentPortfolioWeightPct: number | null;
  projectedPortfolioWeightPct: number | null;
  portfolioWeightChangePctPoints: number | null;
  projectedGrossPortfolioMarketValue: number | null;

  exposureChangePct: number | null;
  exposureChangeLabel: string;

  estimatedBlendedWap: number | null;
  blendedWapIsAvailable: boolean;

  crossesZero: boolean;
  closesPosition: boolean;
  opensPosition: boolean;
  actionMatchesScenario: boolean;

  riskPerShare: number | null;
  totalRisk: number | null;
  portfolioRiskPct: number | null;
  rewardPerShare: number | null;
  totalReward: number | null;
  rewardRiskRatio: number | null;
  stopMovePct: number | null;
  targetMovePct: number | null;

  draft: ManualTradeDraft | null;
};

const NUMBER_TOLERANCE = 0.000001;

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function roundShares(value: number) {
  return Math.max(0, Math.round(value));
}

function getPositionSide(signedShares: number): PositionSide {
  if (signedShares > NUMBER_TOLERANCE) {
    return "LONG";
  }

  if (signedShares < -NUMBER_TOLERANCE) {
    return "SHORT";
  }

  return "FLAT";
}

function getSignedShares(side: "LONG" | "SHORT" | null, shares: number) {
  if (side === "SHORT") {
    return -Math.abs(shares);
  }

  if (side === "LONG") {
    return Math.abs(shares);
  }

  return 0;
}

function getActionDirection(action: TradeAction) {
  if (action === "SELL" || action === "SHORT") {
    return -1;
  }

  return 1;
}

function actionMatchesDirection(
  action: TradeAction,
  signedShareChange: number,
) {
  if (Math.abs(signedShareChange) <= NUMBER_TOLERANCE) {
    return true;
  }

  return getActionDirection(action) === Math.sign(signedShareChange);
}

function getTargetSignedShares(
  baselineSignedShares: number,
  action: TradeAction,
  targetAbsoluteShares: number,
) {
  const baselineSide = getPositionSide(baselineSignedShares);

  if (baselineSide === "LONG") {
    return targetAbsoluteShares;
  }

  if (baselineSide === "SHORT") {
    return -targetAbsoluteShares;
  }

  return getActionDirection(action) * targetAbsoluteShares;
}

function calculateCurrentWeight(
  wellsMarketValue: number | null,
  netEquity: number,
) {
  if (wellsMarketValue == null || netEquity <= 0) {
    return null;
  }

  return (Math.abs(wellsMarketValue) / netEquity) * 100;
}

function calculateTargetMarketValue(
  targetWeightPct: number,
  netEquity: number,
) {
  const targetWeight = targetWeightPct / 100;

  if (targetWeight <= 0 || targetWeight >= 1 || netEquity <= 0) {
    return null;
  }

  return netEquity * targetWeight;
}

function calculateRiskAndReward({
  projectedSide,
  proposedShares,
  estimatedPrice,
  stopPrice,
  targetPrice,
  netEquity,
}: {
  projectedSide: PositionSide;
  proposedShares: number | null;
  estimatedPrice: number | null;
  stopPrice: number | null;
  targetPrice: number | null;
  netEquity: number;
}) {
  let riskPerShare: number | null = null;
  let rewardPerShare: number | null = null;
  let stopMovePct: number | null = null;
  let targetMovePct: number | null = null;

  if (
    proposedShares == null ||
    estimatedPrice == null ||
    estimatedPrice <= 0 ||
    projectedSide === "FLAT"
  ) {
    return {
      riskPerShare,
      totalRisk: null,
      portfolioRiskPct: null,
      rewardPerShare,
      totalReward: null,
      rewardRiskRatio: null,
      stopMovePct,
      targetMovePct,
    };
  }

  if (stopPrice != null && stopPrice > 0) {
    if (projectedSide === "LONG") {
      riskPerShare = estimatedPrice - stopPrice;
    } else {
      riskPerShare = stopPrice - estimatedPrice;
    }

    stopMovePct = ((stopPrice - estimatedPrice) / estimatedPrice) * 100;

    if (riskPerShare <= 0) {
      riskPerShare = null;
    }
  }

  if (targetPrice != null && targetPrice > 0) {
    if (projectedSide === "LONG") {
      rewardPerShare = targetPrice - estimatedPrice;
    } else {
      rewardPerShare = estimatedPrice - targetPrice;
    }

    targetMovePct = ((targetPrice - estimatedPrice) / estimatedPrice) * 100;

    if (rewardPerShare <= 0) {
      rewardPerShare = null;
    }
  }

  const totalRisk = riskPerShare != null ? riskPerShare * proposedShares : null;

  const totalReward =
    rewardPerShare != null ? rewardPerShare * proposedShares : null;

  const portfolioRiskPct =
    totalRisk != null && netEquity > 0 ? (totalRisk / netEquity) * 100 : null;

  const rewardRiskRatio =
    totalReward != null && totalRisk != null && totalRisk > 0
      ? totalReward / totalRisk
      : null;

  return {
    riskPerShare,
    totalRisk,
    portfolioRiskPct,
    rewardPerShare,
    totalReward,
    rewardRiskRatio,
    stopMovePct,
    targetMovePct,
  };
}

export function calculateTradeScenario(
  input: TradeCalculatorInput,
): TradeCalculatorResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const shortLocateNumber = String(input.shortLocateNumber || "").trim();

  if (input.tradeAction === "SHORT" && !shortLocateNumber) {
    errors.push("Short Locate Number is required for a short trade.");
  }

  const wellsExposure = Math.abs(toFiniteNumber(input.wellsShares) ?? 0);

  const wellsSignedShares = getSignedShares(input.wellsSide, wellsExposure);

  const pendingManualDelta = toFiniteNumber(input.pendingManualDelta) ?? 0;

  let baselineSignedShares = wellsSignedShares;

  if (input.baselineMode === "WELLS_PLUS_PENDING") {
    if (!input.pendingProjectionIsValid) {
      errors.push(
        "Pending manual trades do not produce a valid operational baseline.",
      );
    } else if (input.wellsSide === "SHORT") {
      baselineSignedShares = wellsSignedShares - pendingManualDelta;
    } else {
      baselineSignedShares = wellsSignedShares + pendingManualDelta;
    }
  }

  const baselineSide = getPositionSide(baselineSignedShares);

  const baselineExposure = Math.abs(baselineSignedShares);

  const estimatedPrice = toFiniteNumber(input.estimatedPrice);

  if (estimatedPrice == null || estimatedPrice <= 0) {
    errors.push("Estimated execution price must be greater than zero.");
  }

  const grossPortfolioMarketValue = Math.abs(
    toFiniteNumber(input.grossPortfolioMarketValue) ?? 0,
  );

  const netEquity = Math.abs(toFiniteNumber(input.netEquity) ?? 0);

  const wellsMarketValue = toFiniteNumber(input.wellsMarketValue);

  const currentAbsoluteMarketValue = Math.abs(wellsMarketValue ?? 0);

  const currentPortfolioWeightPct = calculateCurrentWeight(
    wellsMarketValue,
    netEquity,
  );

  let proposedShares: number | null = null;
  let proposedSignedShareChange: number | null = null;

  if (input.sizingMode === "SHARES") {
    const sharesInput = toFiniteNumber(input.sharesInput);

    if (sharesInput == null || sharesInput <= 0) {
      errors.push("Proposed shares must be greater than zero.");
    } else {
      proposedShares = roundShares(sharesInput);

      proposedSignedShareChange =
        getActionDirection(input.tradeAction) * proposedShares;
    }
  }

  if (input.sizingMode === "NOTIONAL") {
    const notionalInput = toFiniteNumber(input.notionalInput);

    if (notionalInput == null || notionalInput <= 0) {
      errors.push("Proposed notional must be greater than zero.");
    } else if (estimatedPrice != null && estimatedPrice > 0) {
      proposedShares = roundShares(notionalInput / estimatedPrice);

      if (proposedShares === 0) {
        errors.push(
          "The proposed notional is too small to purchase one share.",
        );
      }

      proposedSignedShareChange =
        getActionDirection(input.tradeAction) * proposedShares;
    }
  }
  if (input.sizingMode === "AMOUNT_BPS") {
    const basisPointsInput = toFiniteNumber(input.basisPointsInput);

    if (basisPointsInput == null || basisPointsInput <= 0) {
      errors.push("Amount (BPS) must be greater than zero.");
    } else if (netEquity <= 0) {
      errors.push("Net Equity is required for Amount (BPS) sizing.");
    } else if (estimatedPrice != null && estimatedPrice > 0) {
      const notionalAmount = netEquity * (basisPointsInput / 10_000);

      proposedShares = roundShares(notionalAmount / estimatedPrice);

      if (proposedShares === 0) {
        errors.push(
          "The Amount (BPS) value is too small to purchase one share.",
        );
      }

      proposedSignedShareChange =
        getActionDirection(input.tradeAction) * proposedShares;
    }
  }
  if (input.sizingMode === "TARGET_WEIGHT") {
    const targetWeightPct = toFiniteNumber(input.targetWeightPctInput);

    if (
      targetWeightPct == null ||
      targetWeightPct <= 0 ||
      targetWeightPct >= 100
    ) {
      errors.push(
        "Target portfolio weight must be greater than zero and less than 100%.",
      );
    } else if (netEquity <= 0) {
      errors.push("Net Equity is required for target-weight sizing.");
    } else if (estimatedPrice != null && estimatedPrice > 0) {
      const targetMarketValue = calculateTargetMarketValue(
        targetWeightPct,
        netEquity,
      );

      if (targetMarketValue == null) {
        errors.push("Target portfolio weight could not be calculated.");
      } else {
        const targetAbsoluteShares = roundShares(
          targetMarketValue / estimatedPrice,
        );

        const targetSignedShares = getTargetSignedShares(
          baselineSignedShares,
          input.tradeAction,
          targetAbsoluteShares,
        );

        proposedSignedShareChange = targetSignedShares - baselineSignedShares;

        proposedShares = Math.abs(proposedSignedShareChange);

        if (proposedShares <= NUMBER_TOLERANCE) {
          warnings.push(
            "The selected position is already approximately at the target portfolio weight.",
          );
        }

        if (
          !actionMatchesDirection(input.tradeAction, proposedSignedShareChange)
        ) {
          errors.push(
            "The selected trade action moves the position away from the requested target weight.",
          );
        }
      }
    }
  }

  const actionMatchesScenario =
    proposedSignedShareChange == null
      ? true
      : actionMatchesDirection(input.tradeAction, proposedSignedShareChange);

  let projectedSignedShares: number | null = null;

  let projectedExposure: number | null = null;

  let projectedSide: PositionSide = baselineSide;

  let crossesZero = false;
  let closesPosition = false;
  let opensPosition = false;

  if (proposedSignedShareChange != null) {
    projectedSignedShares = baselineSignedShares + proposedSignedShareChange;

    if (Math.abs(projectedSignedShares) <= NUMBER_TOLERANCE) {
      projectedSignedShares = 0;
    }

    projectedExposure = Math.abs(projectedSignedShares);

    projectedSide = getPositionSide(projectedSignedShares);

    crossesZero =
      baselineSide !== "FLAT" &&
      projectedSide !== "FLAT" &&
      baselineSide !== projectedSide;

    closesPosition = baselineSide !== "FLAT" && projectedSide === "FLAT";

    opensPosition = baselineSide === "FLAT" && projectedSide !== "FLAT";
  }

  if (crossesZero) {
    warnings.push(
      `This scenario crosses from ${baselineSide} to ${projectedSide}. Submit the close and opening activity as separate manual trades.`,
    );
  }

  if (closesPosition) {
    warnings.push("This scenario fully closes the selected position.");
  }

  if (opensPosition) {
    warnings.push("This scenario opens a new position.");
  }

  if (
    input.baselineMode === "WELLS_PLUS_PENDING" &&
    Math.abs(pendingManualDelta) > NUMBER_TOLERANCE
  ) {
    warnings.push("The selected baseline includes unreconciled manual trades.");
  }

  const proposedNotional =
    proposedShares != null && estimatedPrice != null && estimatedPrice > 0
      ? proposedShares * estimatedPrice
      : null;

  const estimatedCashFlow =
    proposedNotional != null
      ? input.tradeAction === "BUY" || input.tradeAction === "COVER"
        ? -proposedNotional
        : proposedNotional
      : null;

  const projectedMarketValue =
    projectedExposure != null && estimatedPrice != null && estimatedPrice > 0
      ? projectedExposure * estimatedPrice
      : null;

  const projectedGrossPortfolioMarketValue =
    projectedMarketValue != null
      ? Math.max(
          0,
          grossPortfolioMarketValue -
            currentAbsoluteMarketValue +
            Math.abs(projectedMarketValue),
        )
      : null;

  const projectedPortfolioWeightPct =
    projectedMarketValue != null && netEquity > 0
      ? (Math.abs(projectedMarketValue) / netEquity) * 100
      : null;

  const portfolioWeightChangePctPoints =
    projectedPortfolioWeightPct != null && currentPortfolioWeightPct != null
      ? projectedPortfolioWeightPct - currentPortfolioWeightPct
      : null;

  let exposureChangePct: number | null = null;

  let exposureChangeLabel = "—";

  if (
    projectedExposure != null &&
    baselineExposure === 0 &&
    projectedExposure > 0
  ) {
    exposureChangeLabel = "New Position";
  } else if (projectedExposure != null && baselineExposure > 0) {
    exposureChangePct =
      ((projectedExposure - baselineExposure) / baselineExposure) * 100;

    exposureChangeLabel = `${
      exposureChangePct >= 0 ? "+" : ""
    }${exposureChangePct.toFixed(1)}%`;
  }

  const wellsWap = toFiniteNumber(input.wellsWap);

  let estimatedBlendedWap: number | null = null;

  let blendedWapIsAvailable = false;

  const sameSideAdd =
    !crossesZero &&
    projectedSide === baselineSide &&
    ((baselineSide === "LONG" && input.tradeAction === "BUY") ||
      (baselineSide === "SHORT" && input.tradeAction === "SHORT"));

  const wellsOnlyAdd =
    input.baselineMode === "WELLS" ||
    Math.abs(pendingManualDelta) <= NUMBER_TOLERANCE;

  if (
    sameSideAdd &&
    wellsOnlyAdd &&
    wellsWap != null &&
    estimatedPrice != null &&
    proposedShares != null &&
    projectedExposure != null &&
    projectedExposure > 0
  ) {
    estimatedBlendedWap =
      (wellsExposure * wellsWap + proposedShares * estimatedPrice) /
      projectedExposure;

    blendedWapIsAvailable = true;
  }

  const stopPrice = toFiniteNumber(input.stopPrice);

  const targetPrice = toFiniteNumber(input.targetPrice);

  if (stopPrice != null && stopPrice <= 0) {
    errors.push("Stop price must be greater than zero.");
  }

  if (targetPrice != null && targetPrice <= 0) {
    errors.push("Target price must be greater than zero.");
  }

  if (
    estimatedPrice != null &&
    estimatedPrice > 0 &&
    projectedSide === "LONG"
  ) {
    if (stopPrice != null && stopPrice >= estimatedPrice) {
      errors.push(
        "A Long stop price must be below the estimated execution price.",
      );
    }

    if (targetPrice != null && targetPrice <= estimatedPrice) {
      errors.push(
        "A Long target price must be above the estimated execution price.",
      );
    }
  }

  if (
    estimatedPrice != null &&
    estimatedPrice > 0 &&
    projectedSide === "SHORT"
  ) {
    if (stopPrice != null && stopPrice <= estimatedPrice) {
      errors.push(
        "A Short stop price must be above the estimated execution price.",
      );
    }

    if (targetPrice != null && targetPrice >= estimatedPrice) {
      errors.push(
        "A Short target price must be below the estimated execution price.",
      );
    }
  }

  const riskAndReward = calculateRiskAndReward({
    projectedSide,
    proposedShares,
    estimatedPrice,
    stopPrice,
    targetPrice,
    netEquity,
  });

  const hasActivePosition = Boolean(input.positionId);

  if (!hasActivePosition) {
    warnings.push(
      "This Security does not have an active HCA position. The scenario may be calculated, but manual-trade submission is unavailable.",
    );
  }

  const isValid = errors.length === 0;

  const canCreateDraft =
    isValid &&
    hasActivePosition &&
    !crossesZero &&
    proposedShares != null &&
    proposedShares > 0 &&
    estimatedPrice != null &&
    estimatedPrice > 0 &&
    Boolean(input.dateTraded);

  const draft: ManualTradeDraft | null =
    canCreateDraft &&
    input.positionId &&
    proposedShares != null &&
    estimatedPrice != null &&
    input.dateTraded
      ? {
          securityId: input.securityId,
          positionId: input.positionId,
          ticker: input.ticker,
          companyName: input.companyName,
          tradeType: input.tradeAction,
          shares: proposedShares,
          avgPrice: estimatedPrice,
          dateTraded: input.dateTraded,
          comment: String(input.comment || "").trim(),
          shortLocateNumber,
        }
      : null;

  return {
    isValid,
    canCreateDraft,
    errors,
    warnings,

    wellsSide: getPositionSide(wellsSignedShares),
    wellsExposure,
    wellsSignedShares,

    selectedBaselineMode: input.baselineMode,
    baselineSide,
    baselineExposure,
    baselineSignedShares,

    proposedShares,
    proposedSignedShareChange,
    proposedNotional,
    estimatedCashFlow,

    projectedSide,
    projectedExposure,
    projectedSignedShares,
    projectedMarketValue,

    currentPortfolioWeightPct,
    projectedPortfolioWeightPct,
    portfolioWeightChangePctPoints,
    projectedGrossPortfolioMarketValue,

    exposureChangePct,
    exposureChangeLabel,

    estimatedBlendedWap,
    blendedWapIsAvailable,

    crossesZero,
    closesPosition,
    opensPosition,
    actionMatchesScenario,

    ...riskAndReward,

    draft,
  };
}
