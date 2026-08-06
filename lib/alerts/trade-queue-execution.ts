export const TRADE_QUEUE_EXECUTION_FLAG_TYPE = "Trade Queue Execution Alert";

export const TRADE_QUEUE_EXECUTION_ALERT_TYPE = "TRADE_QUEUE_EXECUTION";

export type TradeQueueAction = "BUY" | "SELL" | "SHORT" | "COVER";

export type TradeQueueTriggerDirection = "AT_OR_BELOW" | "AT_OR_ABOVE";

export type EvaluateTradeQueueExecutionInput = {
  tradeQueueItemId: string;
  tradeType: string;
  executionPrice: number | null | undefined;
  currentPrice: number | null | undefined;
};

export type TradeQueueExecutionEvaluation = {
  isEligible: boolean;
  isThresholdReached: boolean;
  alertKey: string | null;
  tradeType: TradeQueueAction | null;
  executionPrice: number | null;
  currentPrice: number | null;
  distancePercent: number | null;
  triggerDirection: TradeQueueTriggerDirection | null;
  reason:
    | "THRESHOLD_REACHED"
    | "THRESHOLD_NOT_REACHED"
    | "INVALID_QUEUE_ITEM_ID"
    | "INVALID_TRADE_TYPE"
    | "INVALID_EXECUTION_PRICE"
    | "INVALID_CURRENT_PRICE";
};

const VALID_TRADE_TYPES: TradeQueueAction[] = ["BUY", "SELL", "SHORT", "COVER"];

function toPositiveFiniteNumber(value: unknown) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return null;
  }

  return numericValue;
}

function parseTradeType(value: unknown): TradeQueueAction | null {
  const tradeType = String(value || "")
    .trim()
    .toUpperCase();

  if (!VALID_TRADE_TYPES.includes(tradeType as TradeQueueAction)) {
    return null;
  }

  return tradeType as TradeQueueAction;
}

function normalizeExecutionPriceForKey(executionPrice: number) {
  return executionPrice.toFixed(6);
}

export function buildTradeQueueExecutionAlertKey({
  tradeQueueItemId,
  executionPrice,
}: {
  tradeQueueItemId: string;
  executionPrice: number;
}) {
  return [
    "TRADE_QUEUE",
    "EXECUTION",
    tradeQueueItemId,
    normalizeExecutionPriceForKey(executionPrice),
  ].join(":");
}

export function getTradeQueueTriggerDirection(
  tradeType: TradeQueueAction,
): TradeQueueTriggerDirection {
  if (tradeType === "BUY" || tradeType === "COVER") {
    return "AT_OR_BELOW";
  }

  return "AT_OR_ABOVE";
}

export function evaluateTradeQueueExecution({
  tradeQueueItemId,
  tradeType,
  executionPrice,
  currentPrice,
}: EvaluateTradeQueueExecutionInput): TradeQueueExecutionEvaluation {
  const normalizedQueueItemId = String(tradeQueueItemId || "").trim();

  const normalizedTradeType = parseTradeType(tradeType);
  const normalizedExecutionPrice = toPositiveFiniteNumber(executionPrice);
  const normalizedCurrentPrice = toPositiveFiniteNumber(currentPrice);

  if (!normalizedQueueItemId) {
    return {
      isEligible: false,
      isThresholdReached: false,
      alertKey: null,
      tradeType: normalizedTradeType,
      executionPrice: normalizedExecutionPrice,
      currentPrice: normalizedCurrentPrice,
      distancePercent: null,
      triggerDirection: normalizedTradeType
        ? getTradeQueueTriggerDirection(normalizedTradeType)
        : null,
      reason: "INVALID_QUEUE_ITEM_ID",
    };
  }

  if (!normalizedTradeType) {
    return {
      isEligible: false,
      isThresholdReached: false,
      alertKey: null,
      tradeType: null,
      executionPrice: normalizedExecutionPrice,
      currentPrice: normalizedCurrentPrice,
      distancePercent: null,
      triggerDirection: null,
      reason: "INVALID_TRADE_TYPE",
    };
  }

  const triggerDirection = getTradeQueueTriggerDirection(normalizedTradeType);

  if (normalizedExecutionPrice == null) {
    return {
      isEligible: false,
      isThresholdReached: false,
      alertKey: null,
      tradeType: normalizedTradeType,
      executionPrice: null,
      currentPrice: normalizedCurrentPrice,
      distancePercent: null,
      triggerDirection,
      reason: "INVALID_EXECUTION_PRICE",
    };
  }

  if (normalizedCurrentPrice == null) {
    return {
      isEligible: false,
      isThresholdReached: false,
      alertKey: null,
      tradeType: normalizedTradeType,
      executionPrice: normalizedExecutionPrice,
      currentPrice: null,
      distancePercent: null,
      triggerDirection,
      reason: "INVALID_CURRENT_PRICE",
    };
  }

  const distancePercent =
    (Math.abs(normalizedCurrentPrice - normalizedExecutionPrice) /
      normalizedExecutionPrice) *
    100;

  const isThresholdReached =
    triggerDirection === "AT_OR_BELOW"
      ? normalizedCurrentPrice <= normalizedExecutionPrice
      : normalizedCurrentPrice >= normalizedExecutionPrice;

  return {
    isEligible: true,
    isThresholdReached,
    alertKey: buildTradeQueueExecutionAlertKey({
      tradeQueueItemId: normalizedQueueItemId,
      executionPrice: normalizedExecutionPrice,
    }),
    tradeType: normalizedTradeType,
    executionPrice: normalizedExecutionPrice,
    currentPrice: normalizedCurrentPrice,
    distancePercent,
    triggerDirection,
    reason: isThresholdReached ? "THRESHOLD_REACHED" : "THRESHOLD_NOT_REACHED",
  };
}
