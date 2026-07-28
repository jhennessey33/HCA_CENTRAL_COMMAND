type CompanyFacts = any;

function normalizeCik(cik: string) {
  const digits = String(cik).trim().replace(/\D/g, "");
  if (!digits || digits.length > 10) {
    throw new Error(`Invalid CIK value: ${cik}. Expected up to 10 digits.`);
  }
  return digits.padStart(10, "0");
}

function padCik(cik: string) {
  return normalizeCik(cik);
}

type SecTickerMapEntry = {
  cik_str: number | string;
  ticker: string;
  title: string;
};

let secTickerMapCache: SecTickerMapEntry[] | null = null;
const secTickerLookupCache = new Map<string, string>();

async function fetchSecTickerMap(): Promise<SecTickerMapEntry[]> {
  if (secTickerMapCache) return secTickerMapCache;

  const url = "https://www.sec.gov/files/company_tickers.json";
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": process.env.SEC_API_USER_AGENT ?? "hca-central-command/1.0",
  };

  const res = await fetch(url, {
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SEC ticker mapping request failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  const entries = Object.values(data) as Array<SecTickerMapEntry>;

  secTickerMapCache = entries.filter(
    (entry): entry is SecTickerMapEntry =>
      !!entry?.ticker && entry?.cik_str != null,
  );
  return secTickerMapCache;
}

export async function resolveSecCikForTicker(
  ticker: string,
): Promise<string | null> {
  const normalized = ticker.trim().toUpperCase();
  if (!normalized) return null;
  if (secTickerLookupCache.has(normalized))
    return secTickerLookupCache.get(normalized)!;

  const entries = await fetchSecTickerMap();
  const match = entries.find(
    (entry) => entry.ticker.toUpperCase() === normalized,
  );
  if (!match) return null;

  const cik = String(match.cik_str).replace(/^0+/, "");
  const resolved = cik || null;
  if (resolved) secTickerLookupCache.set(normalized, resolved);
  return resolved;
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function fetchCompanyFacts(
  cik: string,
  ticker?: string,
): Promise<CompanyFacts | null> {
  const apiAgent = process.env.SEC_API_USER_AGENT;
  if (!apiAgent)
    throw new Error("Missing SEC_API_USER_AGENT environment variable.");

  const normalized = normalizeCik(cik);
  const padded = `CIK${normalized}`;
  const url = `https://data.sec.gov/api/xbrl/companyfacts/${padded}.json`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": apiAgent,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(
      `SEC companyfacts request failed: ticker=${ticker ?? "unknown"} cik=${normalized} url=${url} status=${res.status} message=${txt}`,
    );
  }

  return res.json();
}

// Extract latest numeric value for a set of tag candidates
function getLatestFactValue(
  facts: CompanyFacts,
  candidates: string[],
): { value: number | null; asOf?: string } {
  if (!facts || !facts.facts) return { value: null };
  const usgaap = facts.facts["us-gaap"] || {};

  for (const tag of candidates) {
    const entry = usgaap[tag];
    if (!entry || !entry.units) continue;

    // iterate units and values to find the most recent (by end date)
    let best: { val: number; end?: string } | null = null;

    for (const unitKey of Object.keys(entry.units)) {
      const values = entry.units[unitKey] as Array<any>;
      for (const v of values) {
        const val = parseNumber(v.val);
        if (val === null) continue;
        const end = v.end || v.filed || v.filed;
        if (!best) best = { val, end };
        else if (end && best.end && new Date(end) > new Date(best.end))
          best = { val, end };
      }
    }

    if (best) return { value: best.val, asOf: best.end };
  }

  return { value: null };
}

// Get array of quarterly values (with end dates) for a tag
function getQuarterlyValues(
  facts: CompanyFacts,
  tag: string,
): Array<{ val: number; end?: string }> {
  const out: Array<{ val: number; end?: string }> = [];
  if (!facts || !facts.facts) return out;
  const usgaap = facts.facts["us-gaap"] || {};
  const entry = usgaap[tag];
  if (!entry || !entry.units) return out;

  for (const unitKey of Object.keys(entry.units)) {
    const values = entry.units[unitKey] as Array<any>;
    for (const v of values) {
      if (v.fp && v.fp !== "FY") {
        // prefer periodic (Q) entries
        const val = parseNumber(v.val);
        if (val !== null) out.push({ val, end: v.end });
      }
    }
  }

  // sort by end
  out.sort((a, b) =>
    a.end && b.end ? new Date(a.end).getTime() - new Date(b.end).getTime() : 0,
  );
  return out;
}

function sumLastN(items: Array<{ val: number; end?: string }>, n: number) {
  if (!items.length) return null;
  const last = items.slice(-n);
  if (last.length < n) return null;
  return last.reduce((s, x) => s + x.val, 0);
}

// Compute TTM value from quarterly facts. Fall back to most recent annual if quarterly insufficient.
function computeTTM(
  facts: CompanyFacts,
  tagCandidates: string[],
): { value: number | null; asOf?: string } {
  for (const candidate of tagCandidates) {
    const q = getQuarterlyValues(facts, candidate);
    const summed = sumLastN(q, 4);
    if (summed !== null)
      return {
        value: summed,
        asOf: q.length ? q[q.length - 1].end : undefined,
      };

    const latest = getLatestFactValue(facts, [candidate]);
    if (latest.value !== null) return latest;
  }

  return { value: null };
}

function formatQuarterlyValues(values: Array<{ val: number; end?: string }>) {
  return values
    .map((item) => `${item.end ?? "unknown"}:${item.val}`)
    .join(", ");
}

function computeEpsTtm(
  facts: CompanyFacts,
  tagCandidates: string[],
  ticker?: string,
): {
  value: number | null;
  asOf?: string;
  source: string;
  quarterlyValues: Array<{ val: number; end?: string }>;
  tag?: string;
} {
  const allQuarterly: Array<{
    tag: string;
    values: Array<{ val: number; end?: string }>;
  }> = [];

  for (const candidate of tagCandidates) {
    const q = getQuarterlyValues(facts, candidate);
    if (q.length) allQuarterly.push({ tag: candidate, values: q });

    const summed = sumLastN(q, 4);
    if (summed !== null) {
      const last4 = q.slice(-4);
      const asOf = last4[last4.length - 1].end;
      console.debug(
        `SEC EPS TTM for ${ticker ?? "unknown"} using quarterly ${candidate}: ${formatQuarterlyValues(last4)} -> ${summed}`,
      );
      return {
        value: summed,
        asOf,
        source: "quarterly",
        quarterlyValues: last4,
        tag: candidate,
      };
    }
  }

  for (const candidate of tagCandidates) {
    const latestAnnual = getLatestFactValue(facts, [candidate]);
    if (latestAnnual.value !== null) {
      console.debug(
        `SEC EPS TTM for ${ticker ?? "unknown"} falling back to annual ${candidate}: ${latestAnnual.value}`,
      );
      return {
        value: latestAnnual.value,
        asOf: latestAnnual.asOf,
        source: "annual",
        quarterlyValues: [],
        tag: candidate,
      };
    }
  }

  const latestFact = getLatestFactValue(facts, tagCandidates);
  console.debug(
    `SEC EPS TTM for ${ticker ?? "unknown"} falling back to latest EPS fact: ${latestFact.value}`,
  );
  return {
    value: latestFact.value,
    asOf: latestFact.asOf,
    source: "latest_fact",
    quarterlyValues: [],
    tag: tagCandidates[0],
  };
}

// Public mapping function that extracts many common fundamentals
export async function getSecFundamentals(cik: string, ticker?: string) {
  const facts = await fetchCompanyFacts(cik, ticker);

  // Helper candidates for common tags
  const revenueTags = [
    "Revenues",
    "SalesRevenueNet",
    "RevenueFromContractWithCustomerExcludingAssessedTax",
  ];
  const netIncomeTags = ["NetIncomeLoss", "ProfitLoss"];
  const epsTags = [
    "EarningsPerShareBasic",
    "EarningsPerShareDiluted",
    "EarningsPerShareBasicContinuousOperations",
  ];
  const shareholdersEquityTags = [
    "StockholdersEquity",
    "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
  ];
  const commonSharesTags = [
    "CommonStockSharesOutstanding",
    "EntityCommonStockSharesOutstanding",
  ];
  const intangibleTags = [
    "Goodwill",
    "IntangibleAssets",
    "IntangibleAssetsNet",
  ];
  const totalDebtTags = ["Debt", "LongTermDebt", "LiabilitiesNoncurrent"];
  const ebitdaTags = [
    "EarningsBeforeInterestTaxesDepreciationAndAmortization",
    "Ebitdar",
  ];

  const revenueTtm = computeTTM(facts, revenueTags);
  const netIncomeTtm = computeTTM(facts, netIncomeTags);

  const epsLatest = getLatestFactValue(facts, epsTags);
  const epsTtmResult = computeEpsTtm(facts, epsTags, ticker);
  const epsTtm = epsTtmResult.value;

  const shareholdersEquity = getLatestFactValue(facts, shareholdersEquityTags);
  const totalDebt = getLatestFactValue(facts, totalDebtTags);
  const cashAndEquivalents = getLatestFactValue(facts, [
    "CashAndCashEquivalentsAtCarryingValue",
    "CashAndCashEquivalentsPeriodEnd",
  ]);

  const commonShares = getLatestFactValue(facts, commonSharesTags);

  // book value per share
  const bookValue = shareholdersEquity.value;
  const bookValuePerShare =
    bookValue !== null && commonShares.value
      ? bookValue / commonShares.value
      : null;

  // tangible book value = shareholdersEquity - intangible assets
  const intangible = getLatestFactValue(facts, intangibleTags);
  const tangibleBookValue =
    bookValue !== null ? bookValue - (intangible.value ?? 0) : null;
  const tangibleBookValuePerShare =
    tangibleBookValue !== null && commonShares.value
      ? tangibleBookValue / commonShares.value
      : null;

  // ebitda
  const ebitdaVal = getLatestFactValue(facts, ebitdaTags);

  // revenue and net income pick values & asOf
  const revenueVal =
    revenueTtm.value !== null
      ? revenueTtm.value
      : getLatestFactValue(facts, revenueTags).value;
  const revenueAsOf =
    revenueTtm.asOf ?? getLatestFactValue(facts, revenueTags).asOf;

  const netIncomeVal =
    netIncomeTtm.value !== null
      ? netIncomeTtm.value
      : getLatestFactValue(facts, netIncomeTags).value;
  const netIncomeAsOf =
    netIncomeTtm.asOf ?? getLatestFactValue(facts, netIncomeTags).asOf;

  return {
    revenue: getLatestFactValue(facts, revenueTags).value,
    revenueTtm: revenueVal,
    revenueAsOf,
    grossProfit: getLatestFactValue(facts, ["GrossProfit"]).value,
    operatingIncome: getLatestFactValue(facts, ["OperatingIncomeLoss"]).value,
    netIncome: getLatestFactValue(facts, netIncomeTags).value,
    netIncomeTtm: netIncomeVal,
    netIncomeAsOf,
    eps: epsLatest.value,
    epsTtm,
    peNtm: null,
    peLtm: null,
    bookValue,
    bookValuePerShare,
    tangibleBookValue,
    tangibleBookValuePerShare,
    enterpriseValue: null,
    ebitda: ebitdaVal.value,
    totalDebt: totalDebt.value,
    cashAndEquivalents: cashAndEquivalents.value,
    totalAssets: getLatestFactValue(facts, ["Assets"]).value,
    totalLiabilities: getLatestFactValue(facts, ["Liabilities"]).value,
    shareholdersEquity: shareholdersEquity.value,
    filingDate: revenueAsOf || netIncomeAsOf || undefined,
    fiscalYear: undefined,
    fiscalPeriod: undefined,
    commonSharesOutstanding: commonShares.value,
    source: "SEC_EDGAR",
    rawFacts: facts,
  };
}

export { fetchCompanyFacts };
