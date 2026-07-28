import { prisma } from "@/lib/prisma";

const SECTOR_MAP: Record<string, string> = {
  AX: "Banks",
  BNCC: "Banks",
  CBK: "Banks",
  CUBI: "Banks",
  EBMT: "Banks",
  FBIZ: "Banks",
  FCNCA: "Banks",
  NODB: "Banks",
  SPFI: "Banks",
  TOWN: "Banks",
  WSBC: "Banks",

  HTGC: "BDC",
  MAIN: "BDC",
  TRIN: "BDC",

  AFRM: "Consumer Credit",
  ENVA: "Consumer Credit",
  OPFI: "Consumer Credit",
  WRLD: "Consumer Credit",

  COIN: "Cryptocurrency",

  TSLA: "Electric Vehicles",

  BZH: "Homebuilders",
  DHI: "Homebuilders",

  LMND: "Insurance",

  ASLE: "Technology",
  PLUS: "Technology",
  WLFC: "Technology",
  CSGP: "Technology",

  APLD: "Information Technologies",
  CRWV: "Information Technologies",

  RILY: "Investment Banking",

  TFIN: "Specialty Finance",

  COP: "Oil & Gas",
  FANG: "Oil & Gas",
  ET: "Oil & Gas",

  AEM: "Commodities",
  AGI: "Commodities",
  BTU: "Commodities",

  COLD: "REITs",
  CSR: "REITs",

  COMP: "Real Estate",
  OPEN: "Real Estate",
  JBGS: "Real Estate",

  DRAM: "Tech ETF",
};

async function main() {
  const securities = await prisma.security.findMany();

  let updated = 0;

  for (const security of securities) {
    const sector = SECTOR_MAP[security.ticker];

    if (!sector) continue;

    await prisma.security.update({
      where: { id: security.id },
      data: { sector },
    });

    updated += 1;
  }

  console.log(`Updated ${updated} securities`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
