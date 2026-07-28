const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding clean HCA Central Command database...");

  // Delete operational data
  await prisma.registrationApproval.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.ingestionRun.deleteMany();
  await prisma.marketDataCache.deleteMany();
  await prisma.flag.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.watchlistEntry.deleteMany();
  await prisma.trade.deleteMany();
  await prisma.taxLot.deleteMany();
  await prisma.position.deleteMany();
  await prisma.security.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();

  console.log("Users after delete:", await prisma.user.count());
  console.log("Securities after delete:", await prisma.security.count());
  console.log("Positions after delete:", await prisma.position.count());
  console.log("Trades after delete:", await prisma.trade.count());

  const adminEmail = process.env.SEED_ADMIN_EMAIL;

  const adminPassword = process.env.SEED_ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    throw new Error(
      "SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be defined.",
    );
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.create({
    data: {
      email: adminEmail,
      name: "Joseph Moore",
      passwordHash,
      role: "ADMIN",
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: "SEED_COMPLETED",
      entityType: "SYSTEM",
      entityId: "clean-seed",
      newValueJson: JSON.stringify({
        users: 1,
        securities: 0,
        positions: 0,
        trades: 0,
        taxLots: 0,
        watchlistEntries: 0,
        comments: 0,
        flags: 0,
        marketDataCacheRows: 0,
      }),
    },
  });

  console.log("Login user:");
  console.log(adminEmail);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
