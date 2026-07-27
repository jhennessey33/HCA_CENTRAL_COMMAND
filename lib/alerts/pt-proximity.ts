export const PT_ALERT_FLAG_TYPE =
  "PT Proximity Alert";

export const PT_ALERT_TRIGGER_PERCENT = 2;

export type PtAlertContext =
  | "WATCHLIST"
  | "POSITION";

export type PtAlertTargetKind =
  | "ENTRY"
  | "EXIT";

export type PtAlertSide =
  | "LONG"
  | "SHORT";

export type PtAlertTargetLabel =
  | "Buy PT"
  | "Sell PT"
  | "Short PT"
  | "Cover PT";

export type EvaluatePtProximityInput = {
  context: PtAlertContext;
  contextId: string;
  securityId: string;
  ticker: string;
  side: PtAlertSide;
  targetKind: PtAlertTargetKind;
  targetPrice: number | null | undefined;
  currentPrice: number | null | undefined;
  marketDataSource?: string | null;
  marketDataAsOf?: string | Date | null;
  triggerPercent?: number;
};

export type PtProximityEvaluation = {
  isEligible: boolean;
  isWithinTriggerRange: boolean;
  alertKey: string | null;
  targetLabel: PtAlertTargetLabel;
  targetPrice: number | null;
  currentPrice: number | null;
  distancePercent: number | null;
  triggerPercent: number;
  reason:
    | "WITHIN_TRIGGER_RANGE"
    | "OUTSIDE_TRIGGER_RANGE"
    | "INVALID_TARGET_PRICE"
    | "INVALID_CURRENT_PRICE"
    | "INVALID_TRIGGER_PERCENT";
};

function toPositiveFiniteNumber(
  value: unknown
) {
  const numberValue =
    Number(value);

  if (
    !Number.isFinite(numberValue) ||
    numberValue <= 0
  ) {
    return null;
  }

  return numberValue;
}

function normalizeKeyPart(
  value: string
) {
  return value
    .trim()
    .toUpperCase()
    .replace(
      /[^A-Z0-9_-]+/g,
      "_"
    );
}

function normalizeTargetPriceForKey(
  targetPrice: number
) {
  return targetPrice.toFixed(6);
}

export function getPtAlertTargetLabel({
  side,
  targetKind,
}: {
  side: PtAlertSide;
  targetKind: PtAlertTargetKind;
}): PtAlertTargetLabel {
  if (side === "SHORT") {
    return targetKind === "ENTRY"
      ? "Short PT"
      : "Cover PT";
  }

  return targetKind === "ENTRY"
    ? "Buy PT"
    : "Sell PT";
}

export function buildPtAlertKey({
  context,
  contextId,
  targetKind,
  targetPrice,
}: {
  context: PtAlertContext;
  contextId: string;
  targetKind: PtAlertTargetKind;
  targetPrice: number;
}) {
  return [
    "PT",
    normalizeKeyPart(context),
    normalizeKeyPart(contextId),
    normalizeKeyPart(targetKind),
    normalizeTargetPriceForKey(
      targetPrice
    ),
  ].join(":");
}

export function evaluatePtProximity({
  context,
  contextId,
  securityId,
  ticker,
  side,
  targetKind,
  targetPrice,
  currentPrice,
  marketDataSource,
  marketDataAsOf,
  triggerPercent =
    PT_ALERT_TRIGGER_PERCENT,
}: EvaluatePtProximityInput): PtProximityEvaluation {
  void securityId;
  void ticker;
  void marketDataSource;
  void marketDataAsOf;

  const targetLabel =
    getPtAlertTargetLabel({
      side,
      targetKind,
    });

  const normalizedTargetPrice =
    toPositiveFiniteNumber(
      targetPrice
    );

  const normalizedCurrentPrice =
    toPositiveFiniteNumber(
      currentPrice
    );

  const normalizedTriggerPercent =
    toPositiveFiniteNumber(
      triggerPercent
    );

  if (
    normalizedTargetPrice == null
  ) {
    return {
      isEligible: false,
      isWithinTriggerRange: false,
      alertKey: null,
      targetLabel,
      targetPrice: null,
      currentPrice:
        normalizedCurrentPrice,
      distancePercent: null,
      triggerPercent:
        normalizedTriggerPercent ??
        PT_ALERT_TRIGGER_PERCENT,
      reason:
        "INVALID_TARGET_PRICE",
    };
  }

  if (
    normalizedCurrentPrice == null
  ) {
    return {
      isEligible: false,
      isWithinTriggerRange: false,
      alertKey: null,
      targetLabel,
      targetPrice:
        normalizedTargetPrice,
      currentPrice: null,
      distancePercent: null,
      triggerPercent:
        normalizedTriggerPercent ??
        PT_ALERT_TRIGGER_PERCENT,
      reason:
        "INVALID_CURRENT_PRICE",
    };
  }

  if (
    normalizedTriggerPercent == null
  ) {
    return {
      isEligible: false,
      isWithinTriggerRange: false,
      alertKey: null,
      targetLabel,
      targetPrice:
        normalizedTargetPrice,
      currentPrice:
        normalizedCurrentPrice,
      distancePercent: null,
      triggerPercent:
        PT_ALERT_TRIGGER_PERCENT,
      reason:
        "INVALID_TRIGGER_PERCENT",
    };
  }

  const distancePercent =
    (
      Math.abs(
        normalizedCurrentPrice -
          normalizedTargetPrice
      ) /
      normalizedTargetPrice
    ) *
    100;

  const isWithinTriggerRange =
    distancePercent <=
    normalizedTriggerPercent;

  return {
    isEligible: true,
    isWithinTriggerRange,
    alertKey:
      buildPtAlertKey({
        context,
        contextId,
        targetKind,
        targetPrice:
          normalizedTargetPrice,
      }),
    targetLabel,
    targetPrice:
      normalizedTargetPrice,
    currentPrice:
      normalizedCurrentPrice,
    distancePercent,
    triggerPercent:
      normalizedTriggerPercent,
    reason:
      isWithinTriggerRange
        ? "WITHIN_TRIGGER_RANGE"
        : "OUTSIDE_TRIGGER_RANGE",
  };
}