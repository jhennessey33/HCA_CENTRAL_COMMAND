const { PrismaClient } = require("@prisma/client");
const {
  placeholderCleanupWhere,
  placeholderNullData,
} = require("@/lib/market-data-cleanup.js");

const prisma = new PrismaClient();

async function main() {
  console.log("Running MarketDataCache placeholder cleanup...");

  const result = await prisma.marketDataCache.updateMany({
    where: placeholderCleanupWhere,
    data: placeholderNullData,
  });

  console.log(`Updated ${result.count} MarketDataCache rows.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
