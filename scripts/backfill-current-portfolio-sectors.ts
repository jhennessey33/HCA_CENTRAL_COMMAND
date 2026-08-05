import { prisma } from "@/lib/prisma";

/**
 * Backfill current Wells Fargo portfolio security sectors from
 * "Copy of Fund Categories.xlsx".
 *
 * Safe defaults:
 *   npx tsx scripts/backfill-current-portfolio-sectors.ts
 *
 * Apply updates:
 *   npx tsx scripts/backfill-current-portfolio-sectors.ts --apply
 *
 * Apply only to blank sectors (optional conservative mode):
 *   npx tsx scripts/backfill-current-portfolio-sectors.ts --apply --only-blank
 */

const SECTOR_BY_SECURITY_ID: Record<string, string> = {
  "94975H296": "Cash",
  "AEM": "Commodities",
  "AFRM": "Consumer Credit",
  "AGI": "Commodities",
  "AL": "Specialty Finance",
  "ALLY": "Banks",
  "ALRS": "Banks",
  "AMC": "Consumer Discretionary",
  "AMZN": "Technology",
  "AMZN 230915P00150000": "Technology",
  "APLD": "Technology",
  "AR": "Oil & Gas",
  "ARI": "BDC/Mortgage REIT",
  "ASLE": "Consumer Discretionary",
  "AX": "Banks",
  "AZEK": "Industrials",
  "BCML": "Banks",
  "BE": "Energy",
  "BJRI": "Consumer Discretionary",
  "BLBD": "Industrials",
  "BNCC": "Banks",
  "BOH": "Banks",
  "BPOP": "Banks",
  "BTU": "Commodities",
  "BZH": "Homebuilders",
  "CACC": "Consumer Credit",
  "CAD": "Cash",
  "CBK": "Banks",
  "CFFN": "Banks",
  "CIO": "REITs",
  "CLSK": "Cryptocurrency",
  "CMA": "Banks",
  "COF": "Banks",
  "COIN": "Cryptocurrency",
  "COLD": "REITs",
  "COMP": "Real Estate Other",
  "COP": "Oil & Gas",
  "CPA": "Consumer Discretionary",
  "CRM": "Information Technologies",
  "CRWV": "Technology",
  "CRWV 260320P00080000": "Put Option",
  "CRWV 260918P00080000": "Put Option",
  "CSGP": "Information Technologies",
  "CSR": "REITs",
  "CTRN": "Consumer Discretionary",
  "CUBI": "Banks",
  "CUBI 240517C00055000": "Banks",
  "CUBI 240816C00055000": "Banks",
  "CVNA": "Consumer Discretionary",
  "CVNA 260417P00250000": "Put Option",
  "CVNA 260618P00050000": "Put Option",
  "CVNA 260618P00250000": "Put Option",
  "DHI": "Homebuilders",
  "DRAM": "Tech. ETF",
  "DVN": "Oil & Gas",
  "EBMT": "Banks",
  "ENVA": "Consumer Credit",
  "ET": "Oil & Gas",
  "EUR": "Cash",
  "FANG": "Oil & Gas",
  "FBIZ": "Banks",
  "FCNCA": "Banks",
  "FCPT": "REITs",
  "FDS": "Information Technologies",
  "FFIN": "Banks",
  "FFWM": "Banks",
  "FHB": "Banks",
  "FIGR": "Consumer Discretionary",
  "FND": "Consumer Discretionary",
  "FPI": "REITs",
  "FRCB": "Banks",
  "FSLY": "Technology",
  "FSP": "REITs",
  "GBCI": "Banks",
  "GLPI": "REITs",
  "GME": "Consumer Discretionary",
  "HEAR": "Consumer Discretionary",
  "HGV": "Consumer Discretionary",
  "HHC": "Real Estate Other",
  "HHH": "Real Estate Other",
  "HIFS": "Banks",
  "HTGC": "BDC",
  "JBGS": "REITs",
  "LCID": "Electric Vehicles",
  "LGIH": "Homebuilders",
  "LMND": "Insurance",
  "LMND 260320P00080000": "Put Option",
  "LNG": "Oil & Gas",
  "LOB": "Banks",
  "MAIN": "BDC",
  "MARA": "Cryptocurrency",
  "MHO": "Homebuilders",
  "MMI": "Capital Markets",
  "MOS": "Commodities",
  "MS": "Capital Markets",
  "NEWT": "Banks",
  "NKLA": "Technology",
  "NODB": "Banks",
  "NUE": "Industrials",
  "NVDA 260618P00125000": "Put Option",
  "NVDA 260918P00120000": "Put Option",
  "NWFL": "Banks",
  "NYCB": "Banks",
  "OKLO 260320P00100000": "Put Option",
  "OPEN": "Real Estate Other",
  "OPENL": "Warrant",
  "OPENW": "Warrant",
  "OPENZ": "Warrant",
  "OPFI": "Consumer Credit",
  "PKBK": "Banks",
  "PLTR 260918P00110000": "Put Option",
  "PLUS": "Technology",
  "QBTS": "Information Technologies",
  "RC": "BDC/Mortgage REIT",
  "RDFN": "Real Estate Other",
  "RILY": "Investment Banking",
  "RIVN": "Electric Vehicles",
  "RM": "Consumer Credit",
  "SAFE": "REITs",
  "SBNY": "Banks",
  "SFBS": "Banks",
  "SIVBQ": "Banks",
  "SKYW": "Consumer Discretionary",
  "SM": "Oil & Gas",
  "SNFCA": "Insurance",
  "SOFI": "Consumer Credit",
  "SPFI": "Banks",
  "TBBK": "Banks",
  "TFC": "Banks",
  "TFIN": "Banks",
  "TMC": "Commodities",
  "TOWN": "Banks",
  "TRIN": "BDC",
  "TSLA": "Electric Vehicles",
  "UPST": "Consumer Credit",
  "USD": "Cash",
  "W": "Consumer Discretionary",
  "WCP": "Oil & Gas",
  "WD": "Capital Markets",
  "WE": "Real Estate Other",
  "WING": "Consumer Discretionary",
  "WLFC": "Specialty Finance",
  "WRLD": "Consumer Credit",
  "WSBC": "Banks",
  "WTBA": "Banks",
  "X": "Commodities",
  "XOM": "Oil & Gas",
  "Z": "Real Estate ‐ Housing",
  "CRWV 260918P00060000": "Put Option"
};

function normalizeSecurityId(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

async function main() {
  const apply = process.argv.includes("--apply");
  const onlyBlank = process.argv.includes("--only-blank");

  const securities = await prisma.security.findMany({
    where: {
      positions: {
        some: {
          status: "ACTIVE",
          source: "WELLS_FARGO",
        },
      },
    },
    select: {
      id: true,
      ticker: true,
      name: true,
      sector: true,
      wellsSecurityId: true,
    },
    orderBy: { ticker: "asc" },
  });

  const planned: Array<{
    id: string;
    ticker: string;
    name: string;
    previousSector: string | null;
    nextSector: string;
    matchedBy: "ticker" | "wellsSecurityId";
  }> = [];
  const unchanged: string[] = [];
  const preserved: string[] = [];
  const unmatched: string[] = [];

  for (const security of securities) {
    const tickerKey = normalizeSecurityId(security.ticker);
    const wellsKey = normalizeSecurityId(security.wellsSecurityId);

    const tickerSector = SECTOR_BY_SECURITY_ID[tickerKey];
    const wellsSector = wellsKey ? SECTOR_BY_SECURITY_ID[wellsKey] : undefined;
    const nextSector = tickerSector ?? wellsSector;
    const matchedBy = tickerSector ? "ticker" : wellsSector ? "wellsSecurityId" : null;

    if (!nextSector || !matchedBy) {
      unmatched.push(`${security.ticker} - ${security.name}`);
      continue;
    }

    if (security.sector === nextSector) {
      unchanged.push(`${security.ticker} -> ${nextSector}`);
      continue;
    }

    if (security.sector?.trim() && onlyBlank) {
      preserved.push(
        `${security.ticker} kept "${security.sector}"; map says "${nextSector}"`,
      );
      continue;
    }

    planned.push({
      id: security.id,
      ticker: security.ticker,
      name: security.name,
      previousSector: security.sector,
      nextSector,
      matchedBy,
    });
  }

  console.log(`Mode: ${apply ? "APPLY" : "DRY RUN"}`);
  console.log(`Active Wells securities: ${securities.length}`);
  console.log(`Planned updates: ${planned.length}`);
  console.log(`Already correct: ${unchanged.length}`);
  console.log(`Existing sectors preserved: ${preserved.length}`);
  console.log(`Unmatched: ${unmatched.length}`);

  if (planned.length) {
    console.log("\nPlanned sector updates:");
    for (const item of planned) {
      console.log(
        `  ${item.ticker}: ${item.previousSector ?? "(blank)"} -> ${item.nextSector} [${item.matchedBy}]`,
      );
    }
  }

  if (preserved.length) {
    console.log("\nPreserved existing sectors because --only-blank was used:");
    for (const item of preserved) console.log(`  ${item}`);
  }

  if (unmatched.length) {
    console.log("\nNo mapping found:");
    for (const item of unmatched) console.log(`  ${item}`);
  }

  if (!apply) {
    console.log("\nDry run only. Re-run with --apply to write changes.");
    return;
  }

  if (!planned.length) {
    console.log("\nNothing to update.");
    return;
  }

  await prisma.$transaction(
    planned.map((item) =>
      prisma.security.update({
        where: { id: item.id },
        data: { sector: item.nextSector },
      }),
    ),
  );

  console.log(`\nUpdated ${planned.length} security sector(s).`);
}

main()
  .catch((error) => {
    console.error("Sector backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
