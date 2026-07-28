import crypto from "node:crypto";
import { parse as parseCsv } from "csv-parse/sync";

export type WellsTransactionActivityRow = {
  accountNumber: string;
  currency?: string;
  tradeDate?: string;
  postDate?: string;
  settlementDate?: string;
  securityName?: string;
  ticker?: string;
  securityId?: string;
  wfSecId?: string;
  activity?: string;
  tradeType?: string;
  status?: string;
  quantity?: number;
  price?: number;
  commission?: number;
  fees?: number;
  accruedInterest?: number;
  netAmount?: number;
  clientReferenceId?: string;
  transactionId?: string;
  cusip?: string;
  isin?: string;
  sedol?: string;
  sourceFileName?: string;
  sourceRowHash: string;
  sourceReportDate?: string;
};

export type WellsTransactionParseResult = {
  rows: WellsTransactionActivityRow[];
  failures: string[];
};

function parseFloatOrUndefined(value: string | undefined): number | undefined {
  if (value == null || value.trim() === "") return undefined;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function safeDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function hashRow(row: Record<string, string>): string {
  const normalized = Object.entries(row)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("|");
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

function normalizeTradeType(activity?: string): string {
  if (!activity) return "UNSUPPORTED";
  const normalized = activity.trim().toLowerCase();
  if (normalized === "buy") return "BUY";
  if (normalized === "sell") return "SELL";
  if (normalized === "sell short") return "SHORT";
  if (normalized === "cover short") return "COVER";
  if (normalized.includes("dividend")) return "DIVIDEND";
  if (normalized.includes("wfs credit interest")) return "INTEREST";
  if (normalized.includes("security lending revenue"))
    return "STOCK_LOAN_REBATE";
  return "UNSUPPORTED";
}

export function parseWellsTransactionActivityCsv(
  content: string,
  sourceFileName: string,
): WellsTransactionParseResult {
  const records = parseCsv(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
  const rows: WellsTransactionActivityRow[] = [];
  const failures: string[] = [];

  for (const rawRow of records) {
    const lower: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawRow)) {
      lower[k.trim().toLowerCase()] = String(v).trim();
    }

    const accountNumber = lower["accountnumber"] || "";
    const securityName =
      lower["securitydescription"] || lower["securityid"] || "";
    const securityId = lower["securityid"] || undefined;
    const securityIdType = lower["securityidtype"]?.toUpperCase();
    const ticker = securityIdType === "TS" ? securityId : undefined;
    const activity = lower["activity"];
    const tradeType = normalizeTradeType(activity);

    const quantity = parseFloatOrUndefined(lower["quantity"]);
    const price = parseFloatOrUndefined(lower["price"]);
    const commission = parseFloatOrUndefined(lower["commission"]);
    const fees = parseFloatOrUndefined(lower["fees"]);
    const accruedInterest = parseFloatOrUndefined(lower["accruedinterest"]);
    const netAmount = parseFloatOrUndefined(lower["netamount"]);

    const rowHash = hashRow(lower);
    const sourceRowHash = rowHash;

    if (!accountNumber) {
      failures.push(`Missing accountNumber for row: ${JSON.stringify(lower)}`);
      continue;
    }

    if (!securityName && !ticker) {
      failures.push(
        `Missing securityName/ticker for row: ${JSON.stringify(lower)}`,
      );
      continue;
    }

    if (quantity == null || Number.isNaN(quantity)) {
      failures.push(`Invalid quantity for row: ${JSON.stringify(lower)}`);
      continue;
    }

    const row: WellsTransactionActivityRow = {
      accountNumber,
      currency: lower["localcurrency"] || lower["reportingcurrency"],
      tradeDate: safeDate(lower["tradedate"] || lower["businessdate"]),
      postDate: safeDate(lower["postdate"]),
      settlementDate: safeDate(lower["settledate"]),
      securityName,
      ticker,
      securityId,
      wfSecId: lower["wfsecid"],
      activity,
      tradeType,
      status: lower["status"],
      quantity,
      price,
      commission,
      fees,
      accruedInterest,
      netAmount,
      clientReferenceId: lower["clientreferenceid"],
      transactionId: lower["wftransactionid"],
      cusip: lower["cusip"],
      isin: lower["isin"],
      sedol: lower["sedol"],
      sourceFileName,
      sourceRowHash,
      sourceReportDate: safeDate(lower["businessdate"]),
    };

    rows.push(row);
  }

  return { rows, failures };
}
