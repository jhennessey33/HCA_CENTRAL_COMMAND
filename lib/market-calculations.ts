export function safeDivide(
  numerator: number | null | undefined,
  denominator: number | null | undefined,
) {
  if (numerator === null || numerator === undefined) return null;
  if (denominator === null || denominator === undefined) return null;
  if (denominator === 0) return null;

  const result = numerator / denominator;
  return Number.isFinite(result) ? result : null;
}

export function calculatePeLtm(
  currentPrice: number | null | undefined,
  epsTtm: number | null | undefined,
) {
  return safeDivide(currentPrice, epsTtm);
}

export function calculatePriceToBook(
  currentPrice: number | null | undefined,
  bookValuePerShare: number | null | undefined,
) {
  return safeDivide(currentPrice, bookValuePerShare);
}

export function calculatePriceToTangBook(
  currentPrice: number | null | undefined,
  tangibleBookValuePerShare: number | null | undefined,
) {
  return safeDivide(currentPrice, tangibleBookValuePerShare);
}

export function calculateDebtToEbitda(
  totalDebt: number | null | undefined,
  ebitda: number | null | undefined,
) {
  return safeDivide(totalDebt, ebitda);
}

export function calculateEnterpriseValue(
  marketCap: number | null | undefined,
  totalDebt: number | null | undefined,
  cashAndEquivalents: number | null | undefined,
) {
  if (marketCap === null || marketCap === undefined) return null;
  if (totalDebt === null && cashAndEquivalents === null) return null;

  const debt = totalDebt ?? 0;
  const cash = cashAndEquivalents ?? 0;
  const result = marketCap + debt - cash;
  return Number.isFinite(result) ? result : null;
}

export function calculateValuationMetrics(input: {
  currentPrice?: number | null;
  marketCap?: number | null;
  epsTtm?: number | null;
  bookValuePerShare?: number | null;
  tangibleBookValuePerShare?: number | null;
  totalDebt?: number | null;
  cashAndEquivalents?: number | null;
  ebitda?: number | null;
}) {
  return {
    peLtm: calculatePeLtm(input.currentPrice ?? null, input.epsTtm ?? null),
    priceToBook: calculatePriceToBook(
      input.currentPrice ?? null,
      input.bookValuePerShare ?? null,
    ),
    priceToTangBook: calculatePriceToTangBook(
      input.currentPrice ?? null,
      input.tangibleBookValuePerShare ?? null,
    ),
    debtToEbitda: calculateDebtToEbitda(
      input.totalDebt ?? null,
      input.ebitda ?? null,
    ),
    enterpriseValue: calculateEnterpriseValue(
      input.marketCap ?? null,
      input.totalDebt ?? null,
      input.cashAndEquivalents ?? null,
    ),
  };
}
