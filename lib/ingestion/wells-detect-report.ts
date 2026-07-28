export type WellsReportType =
  | "TAX_LOT_POSITION_PNL"
  | "TRANSACTION_ACTIVITY"
  | "CHANGE_IN_EQUITY_PERFORMANCE"
  | "PORTFOLIO_RISK_EXPOSURE"
  | "UNKNOWN";

function parseHeaderColumns(content: string): string[] {
  const firstLine = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!firstLine) {
    return [];
  }

  const columns: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < firstLine.length; i += 1) {
    const char = firstLine[i];

    if (inQuotes) {
      if (char === '"') {
        if (firstLine[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      columns.push(current.trim().toLowerCase());
      current = "";
      continue;
    }

    current += char;
  }

  if (current.length > 0) {
    columns.push(current.trim().toLowerCase());
  }

  return columns.map((column) => column.replace(/^"+|"+$/g, "").trim());
}

export function detectWellsReportType(content: string): WellsReportType {
  const columns = parseHeaderColumns(content);

  const hasColumn = (value: string) =>
    columns.some((column) => column === value || column.startsWith(value));
  const hasAnyColumn = (...values: string[]) => values.some(hasColumn);
  const text = content.toLowerCase();

  if (
    hasColumn("equityvalues") ||
    hasAnyColumn("gross rate of return", "net rate of return")
  ) {
    return "CHANGE_IN_EQUITY_PERFORMANCE";
  }

  if (
    hasAnyColumn(
      "unrealizedpricegainloss",
      "unrealizedfxgainloss",
      "costbasis",
      "unitcost",
      "holdingperiod",
      "daystolongterm",
      "roi",
      "taxlotid",
      "taxlotdate",
    )
  ) {
    return "TAX_LOT_POSITION_PNL";
  }

  if (
    hasColumn("activity") &&
    hasAnyColumn("securityid", "securitydescription") &&
    hasColumn("quantity") &&
    hasColumn("netamount") &&
    hasAnyColumn("postdate", "settledate", "tradedate", "wftransactionid")
  ) {
    return "TRANSACTION_ACTIVITY";
  }

  if (
    hasColumn("risk exposure") ||
    hasColumn("risk") ||
    text.includes("rskexp")
  ) {
    return "PORTFOLIO_RISK_EXPOSURE";
  }

  if (
    text.includes("change in equity") ||
    text.includes("equityvalues") ||
    text.includes("chgeqprf")
  ) {
    return "CHANGE_IN_EQUITY_PERFORMANCE";
  }

  if (text.includes("risk exposure") || text.includes("rskexp")) {
    return "PORTFOLIO_RISK_EXPOSURE";
  }

  if (text.includes("tax lot") || text.includes("taxlot")) {
    return "TAX_LOT_POSITION_PNL";
  }

  if (
    text.includes("activity") &&
    text.includes("securityid") &&
    text.includes("netamount")
  ) {
    return "TRANSACTION_ACTIVITY";
  }

  return "UNKNOWN";
}

export async function readUploadedFileContent(
  file: File | Blob,
): Promise<string> {
  return await file.text();
}
