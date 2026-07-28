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
      'Missing --email. Example: node scripts/inspect-user.js --email="viewer@example.com"',
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
    sessions,
    auditLogs,
    comments,
    flagsCreated,
    flagsResolved,
    approvalsCreated,
    resultingApproval,
  ] = await Promise.all([
    prisma.session.count({
      where: {
        userId: user.id,
      },
    }),

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

  console.log("");
  console.log("User:");
  console.table([user]);

  console.log("Related records:");
  console.table([
    {
      sessions,
      auditLogs,
      comments,
      flagsCreated,
      flagsResolved,
      approvalsCreated,
      resultingApproval,
    },
  ]);

  const durableReferences =
    auditLogs +
    comments +
    flagsCreated +
    flagsResolved +
    approvalsCreated +
    resultingApproval;

  if (durableReferences > 0) {
    console.log("");
    console.log(
      "DO NOT hard-delete this user. The account has operational or audit history.",
    );
  } else {
    console.log("");
    console.log(
      "This user has no durable operational references and can be safely deleted.",
    );
  }
}

main()
  .catch((error) => {
    console.error("Inspection failed:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
