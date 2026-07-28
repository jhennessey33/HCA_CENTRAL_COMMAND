import crypto from "node:crypto";
import { parse as parseCsv } from "csv-parse/sync";

export type WellsTaxLotPosition = {
  accountNumber: string;
  ticker: string;
  securityName: string;
  productType?: string;
  shares: number;
  marketValue: number;
  costBasis: number;
  unrealizedPnl: number;
  wap: number;
  side: "LONG" | "SHORT";
  openedAt?: string;
  status: "ACTIVE";
  source: "WELLS_FARGO";
  sourceReportDate?: string;
  sourceFileName?: string;
  sourceRowHash: string;
  ingestionRunId?: string;
};

export type WellsTaxLot = {
  accountNumber: string;
  ticker: string;
  securityName: string;
  productType?: string;
  taxLotId?: string;
  taxLotDate?: string;
  quantity: number;
  unitCost?: number;
  marketPrice?: number;
  costBasis: number;
  marketValue: number;
  unrealizedPnl: number;
  roi?: number;
  holdingPeriod?: string;
  daysToLongTerm?: string;
  sourceReportDate?: string;
  sourceFileName?: string;
  sourceRowHash: string;
};

export type WellsTaxLotParseResult = {
  rows: WellsTaxLotPosition[];
  positions: WellsTaxLotPosition[];
  taxLots: WellsTaxLot[];
  failures: string[];
};

type NormalizedCsvRow = Record<string, string>;

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeRow(rawRow: Record<string, unknown>): NormalizedCsvRow {
  const row: NormalizedCsvRow = {};

  for (const [key, value] of Object.entries(rawRow)) {
    row[normalizeKey(key)] = value == null ? "" : String(value).trim();
  }

  return row;
}

function getValue(row: NormalizedCsvRow, ...keys: string[]) {
  for (const key of keys) {
    const value = row[normalizeKey(key)];

    if (value != null && value !== "") {
      return value;
    }
  }

  return "";
}

function parseNumber(value: string | undefined | null): number | undefined {
  if (value == null) return undefined;

  const cleaned = String(value)
    .trim()
    .replace(/,/g, "")
    .replace(/^\((.*)\)$/, "-$1");

  if (!cleaned) return undefined;

  const parsed = Number(cleaned);

  return Number.isFinite(parsed) ? parsed : undefined;
}

function safeDate(value: string | undefined | null): string | undefined {
  if (!value) return undefined;

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function hashString(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function hashRow(row: NormalizedCsvRow): string {
  const normalized = Object.entries(row)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("|");

  return hashString(normalized);
}

export function parseWellsTaxLotCsv(
  content: string,
  sourceFileName: string,
): WellsTaxLotParseResult {
  const records = parseCsv(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as Record<string, unknown>[];

  const rows: WellsTaxLotPosition[] = [];
  const failures: string[] = [];
  const taxLots: WellsTaxLot[] = [];
  const grouped = new Map<
    string,
    {
      accountNumber: string;
      ticker: string;
      securityName: string;
      productType?: string;
      shares: number;
      marketValue: number;
      costBasis: number;
      unrealizedPnl: number;
      sourceReportDate?: string;
      sourceFileName: string;
      openedAt?: string;
      rowHashes: string[];
    }
  >();

  for (const rawRow of records) {
    const row = normalizeRow(rawRow);
    const rowHash = hashRow(row);

    const accountNumber = getValue(row, "AccountNumber");
    const ticker = getValue(row, "SecurityID");
    const securityName =
      getValue(row, "SecurityDescription") || ticker || "Unknown Security";
    const productType = getValue(row, "LSProductType") || undefined;

    const sourceReportDate = safeDate(getValue(row, "BusinessDate"));
    const openedAt = safeDate(getValue(row, "TaxLotDate"));

    const shares = parseNumber(getValue(row, "Quantity"));
    const marketValue = parseNumber(getValue(row, "ReportingMarketValue"));
    const costBasis = parseNumber(getValue(row, "ReportingCost"));
    const unrealizedPriceGainLoss = parseNumber(
      getValue(row, "ReportingUnrealizedPriceGainLoss"),
    );
    const unrealizedFxGainLoss =
      parseNumber(getValue(row, "ReportingUnrealizedFXGainLoss")) ?? 0;

    if (!accountNumber) {
      failures.push(`Missing AccountNumber for row: ${JSON.stringify(row)}`);
      continue;
    }

    if (!ticker) {
      failures.push(`Missing SecurityID for row: ${JSON.stringify(row)}`);
      continue;
    }

    if (
      shares == null ||
      marketValue == null ||
      costBasis == null ||
      unrealizedPriceGainLoss == null
    ) {
      failures.push(`Invalid numeric values for row: ${JSON.stringify(row)}`);
      continue;
    }

    const validShares: number = shares;
    const validMarketValue: number = marketValue;
    const validCostBasis: number = costBasis;
    const validUnrealizedPriceGainLoss: number = unrealizedPriceGainLoss;

    const unrealizedPnl = validUnrealizedPriceGainLoss + unrealizedFxGainLoss;
    const wap = validShares !== 0 ? Math.abs(validCostBasis / validShares) : 0;

    const taxLotId = getValue(row, "TaxLotID") || undefined;
    const unitCost =
      parseNumber(getValue(row, "LocalUnitCost")) ??
      parseNumber(getValue(row, "ReportingUnitCost"));
    const marketPrice = parseNumber(getValue(row, "LocalMarketPrice"));
    const roi = parseNumber(getValue(row, "ROI"));
    const holdingPeriod = getValue(row, "HoldingPeriod") || undefined;
    const daysToLongTerm =
      getValue(row, "DaysToLongTermLT", "DaysToLongTerm(LT)") || undefined;

    taxLots.push({
      accountNumber,
      ticker,
      securityName,
      productType,
      taxLotId,
      taxLotDate: openedAt,
      quantity: validShares,
      unitCost,
      marketPrice,
      costBasis: validCostBasis,
      marketValue: validMarketValue,
      unrealizedPnl,
      roi,
      holdingPeriod,
      daysToLongTerm,
      sourceReportDate,
      sourceFileName,
      sourceRowHash: rowHash,
    });

    const taxLotPosition: WellsTaxLotPosition = {
      accountNumber,
      ticker,
      securityName,
      productType,
      shares: validShares,
      marketValue: validMarketValue,
      costBasis: validCostBasis,
      unrealizedPnl,
      wap,
      side: validShares < 0 ? "SHORT" : "LONG",
      openedAt,
      status: "ACTIVE",
      source: "WELLS_FARGO",
      sourceReportDate,
      sourceFileName,
      sourceRowHash: rowHash,
    };

    rows.push(taxLotPosition);

    const groupKey = [
      accountNumber,
      ticker,
      securityName,
      productType ?? "",
    ].join("|");

    const existing = grouped.get(groupKey);

    if (existing) {
      existing.shares += validShares;
      existing.marketValue += validMarketValue;
      existing.costBasis += validCostBasis;
      existing.unrealizedPnl += unrealizedPnl;
      existing.rowHashes.push(rowHash);

      if (openedAt) {
        if (
          !existing.openedAt ||
          new Date(openedAt) < new Date(existing.openedAt)
        ) {
          existing.openedAt = openedAt;
        }
      }

      grouped.set(groupKey, existing);
    } else {
      grouped.set(groupKey, {
        accountNumber,
        ticker,
        securityName,
        productType,
        shares: validShares,
        marketValue: validMarketValue,
        costBasis: validCostBasis,
        unrealizedPnl,
        sourceReportDate,
        sourceFileName,
        openedAt,
        rowHashes: [rowHash],
      });
    }
  }

  const positions: WellsTaxLotPosition[] = Array.from(grouped.values()).map(
    (position) => ({
      accountNumber: position.accountNumber,
      ticker: position.ticker,
      securityName: position.securityName,
      productType: position.productType,
      shares: position.shares,
      marketValue: position.marketValue,
      costBasis: position.costBasis,
      unrealizedPnl: position.unrealizedPnl,
      wap:
        position.shares !== 0
          ? Math.abs(position.costBasis / position.shares)
          : 0,
      side: position.shares < 0 ? "SHORT" : "LONG",
      openedAt: position.openedAt,
      status: "ACTIVE",
      source: "WELLS_FARGO",
      sourceReportDate: position.sourceReportDate,
      sourceFileName: position.sourceFileName,
      sourceRowHash: hashString(
        `${sourceFileName}|${position.rowHashes.sort().join("|")}`,
      ),
    }),
  );

  return {
    rows,
    positions,
    taxLots,
    failures,
  };
}
