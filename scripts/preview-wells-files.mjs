import fs from "node:fs";
import path from "node:path";

const extractedDir = path.join(process.cwd(), "docs", "wells-extracted");
const docsDir = fs.existsSync(extractedDir)
  ? extractedDir
  : path.join(process.cwd(), "docs");

function toNumber(value) {
  if (value === null || value === undefined) return null;
  const cleaned = String(value)
    .trim()
    .replace(/,/g, "")
    .replace(/^\((.*)\)$/, "-$1");
  if (cleaned.length === 0) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function firstNonEmptyLines(content, count = 5) {
  return content
    .split(/\r?\n/)
    .map(function (line) {
      return line.trim();
    })
    .filter(Boolean)
    .slice(0, count);
}

function detectReportType(content) {
  const text = content.toLowerCase();

  if (
    text.includes("tax lot position and p&l") ||
    text.includes("investment total:")
  ) {
    return "TAX_LOT_POSITION_PNL";
  }

  if (text.includes("transaction activity")) {
    return "TRANSACTION_ACTIVITY";
  }

  if (text.includes("wf trans id") && text.includes("net amount")) {
    return "TRANSACTION_ACTIVITY";
  }

  if (
    text.includes("change in equity") ||
    text.includes("gross rate of return") ||
    text.includes("equity values")
  ) {
    return "CHANGE_IN_EQUITY_PERFORMANCE";
  }

  if (
    text.includes("portfolio risk exposure detail") ||
    text.includes("delta adjusted exposure") ||
    text.includes("beta adjusted exposure")
  ) {
    return "PORTFOLIO_RISK_EXPOSURE";
  }

  return "UNKNOWN";
}

function previewTaxLotInvestmentTotals(content) {
  const lines = content
    .split(/\r?\n/)
    .map(function (line) {
      return line.trim();
    })
    .filter(Boolean);

  const previews = [];
  let currentSecurityName = null;
  let currentTicker = null;
  let currentProductType = null;

  const productTypes = new Set([
    "Common Stocks",
    "Equity Options",
    "Exchange Traded Funds",
    "Limited Partnerships",
    "Money Market Mutual Fund",
    "Real Estate Investment Trusts",
    "Warrants",
  ]);

  for (const line of lines) {
    if (productTypes.has(line)) {
      currentProductType = line;
      continue;
    }

    const looksLikeTaxLotRow = /^\d{2}\/\d{2}\/\d{4}/.test(line);
    const securityHeader = line.match(/^(.+?)\s+\(([^)]+)\)$/);

    if (
      securityHeader &&
      !looksLikeTaxLotRow &&
      !line.includes("Investment Total") &&
      !line.includes("Total") &&
      !line.includes("Custodian")
    ) {
      currentSecurityName = securityHeader[1].trim();
      currentTicker = securityHeader[2].trim();
      continue;
    }

    if (!line.includes("Investment Total:")) continue;

    const totalMatch = line.match(/Investment Total:\s+\(([^)]+)\)\s+(.+)$/);
    if (!totalMatch) {
      previews.push({
        parsed: false,
        productType: currentProductType,
        securityName: currentSecurityName,
        ticker: currentTicker,
        rawLine: line,
      });
      continue;
    }

    const ticker = totalMatch[1].trim();
    const tokens = totalMatch[2].trim().split(/\s+/);

    const shares = toNumber(tokens[0]);
    const costBasis = toNumber(tokens[1]);
    const marketValue = toNumber(tokens[2]);
    const unrealizedPrice = toNumber(tokens[5]);
    const unrealizedFx = toNumber(tokens[6]) || 0;
    const unrealizedPnl =
      unrealizedPrice === null ? null : unrealizedPrice + unrealizedFx;

    previews.push({
      parsed: true,
      productType: currentProductType,
      securityName: currentSecurityName,
      ticker: ticker,
      shares: shares,
      side: shares !== null && shares < 0 ? "SHORT" : "LONG",
      costBasis: costBasis,
      marketValue: marketValue,
      unrealizedPnl: unrealizedPnl,
      rawLine: line.slice(0, 260),
    });

    if (previews.length >= 15) break;
  }

  return previews;
}

function previewTransactionActivity(content) {
  const lines = content
    .split(/\r?\n/)
    .map(function (line) {
      return line.trimEnd();
    })
    .filter(Boolean);

  const activityWords = [
    " Buy ",
    " Sell ",
    " Sell Short ",
    " Cover Short ",
    " Dividend ",
    " Dividend Paid ",
    " WFS Credit Interest ",
    " WFS Security Lending Revenue ",
  ];

  const candidates = lines.filter(function (line) {
    return activityWords.some(function (word) {
      return line.includes(word);
    });
  });

  return candidates.slice(0, 12).map(function (line) {
    return { rawLine: line };
  });
}

function previewChangeInEquity(content) {
  const lines = content
    .split(/\r?\n/)
    .map(function (line) {
      return line.trim();
    })
    .filter(Boolean);

  const keyMetrics = [
    "Gross Rate of Return",
    "Net Rate of Return",
    "Cash and Equivalents",
    "Long Market Value",
    "Short Market Value",
    "Net Assets",
    "Net Equity",
    "Opening Equity",
    "Closing Equity",
    "Net Profit/(Loss)",
  ];

  return lines
    .filter(function (line) {
      return keyMetrics.some(function (metric) {
        return line.includes(metric);
      });
    })
    .slice(0, 30)
    .map(function (line) {
      return { rawLine: line };
    });
}

function previewRiskExposure(content) {
  const lines = content
    .split(/\r?\n/)
    .map(function (line) {
      return line.trim();
    })
    .filter(Boolean);

  return lines
    .filter(function (line) {
      return (
        line.includes("Long Positions") ||
        line.includes("Short Positions") ||
        line.includes("Net Investments") ||
        line.includes("Total Long Positions") ||
        line.includes("Total Short Positions") ||
        line.includes("Portfolio Holdings")
      );
    })
    .slice(0, 20)
    .map(function (line) {
      return { rawLine: line };
    });
}

function getWellsFiles() {
  return fs
    .readdirSync(docsDir)
    .filter(function (file) {
      return /\.(txt|pdf|csv)$/i.test(file);
    })
    .map(function (file) {
      return path.join(docsDir, file);
    });
}

const files = getWellsFiles();

console.log("Reading Wells files from: " + docsDir);
console.log("Found " + files.length + " files.\n");

for (const filePath of files) {
  const content = fs.readFileSync(filePath, "utf8");
  const reportType = detectReportType(content);

  console.log("=".repeat(120));
  console.log("File: " + filePath);
  console.log("Detected: " + reportType);
  console.log("First lines:");
  console.log(firstNonEmptyLines(content, 8).join("\n"));
  console.log("-".repeat(120));

  if (reportType === "TAX_LOT_POSITION_PNL") {
    console.log("Tax Lot Investment Total preview:");
    console.dir(previewTaxLotInvestmentTotals(content), { depth: null });
  } else if (reportType === "TRANSACTION_ACTIVITY") {
    console.log("Transaction Activity raw-line preview:");
    console.dir(previewTransactionActivity(content), { depth: null });
  } else if (reportType === "CHANGE_IN_EQUITY_PERFORMANCE") {
    console.log("Change In Equity metric preview:");
    console.dir(previewChangeInEquity(content), { depth: null });
  } else if (reportType === "PORTFOLIO_RISK_EXPOSURE") {
    console.log("Risk Exposure summary preview:");
    console.dir(previewRiskExposure(content), { depth: null });
  } else {
    console.log("No parser preview available.");
  }

  console.log("\n");
}
