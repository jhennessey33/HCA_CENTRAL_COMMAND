const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function getArg(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));

  return arg ? arg.slice(prefix.length).trim() : "";
}

async function main() {
  const email = getArg("email").toLowerCase();

  if (!email) {
    throw new Error(
      'Missing --email. Example: node scripts/delete-unused-user.js --email="viewer@example.com"',
    );
  }

  const user = await prisma.user.findUnique({
    where: {
      email,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    },
  });

  if (!user) {
    console.log(`No user found for ${email}.`);
    return;
  }

  const [
    auditLogs,
    comments,
    flagsCreated,
    flagsResolved,
    approvalsCreated,
    resultingApproval,
  ] = await Promise.all([
    prisma.auditLog.count({
      where: {
        actorId: user.id,
      },
    }),

    prisma.comment.count({
      where: {
        authorId: user.id,
      },
    }),

    prisma.flag.count({
      where: {
        createdById: user.id,
      },
    }),

    prisma.flag.count({
      where: {
        resolvedById: user.id,
      },
    }),

    prisma.registrationApproval.count({
      where: {
        approvedById: user.id,
      },
    }),

    prisma.registrationApproval.count({
      where: {
        registeredUserId: user.id,
      },
    }),
  ]);

  const blockers = {
    auditLogs,
    comments,
    flagsCreated,
    flagsResolved,
    approvalsCreated,
    resultingApproval,
  };

  const blockerCount = Object.values(blockers).reduce(
    (total, value) => total + value,
    0,
  );

  if (blockerCount > 0) {
    console.error("");
    console.error(
      "Deletion refused because this user has related operational or audit records:",
    );
    console.table([blockers]);
    console.error("Keep this account until account disabling is implemented.");

    process.exitCode = 2;
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.session.deleteMany({
      where: {
        userId: user.id,
      },
    });

    await tx.user.delete({
      where: {
        id: user.id,
      },
    });
  });

  console.log("");
  console.log("Unused user deleted successfully:");
  console.table([user]);
}

main()
  .catch((error) => {
    console.error("Deletion failed:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
