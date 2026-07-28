const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const emailsToDelete = [
  "mcastellanos@sunwestbank.com",
  "jhennessey@hovdecapital.com",
];

async function main() {
  console.log("Deleting registration test users...");
  console.log(emailsToDelete.join(", "));

  const users = await prisma.user.findMany({
    where: {
      email: {
        in: emailsToDelete,
      },
    },
    select: {
      id: true,
      email: true,
    },
  });

  if (users.length === 0) {
    console.log("No matching users found.");
    return;
  }

  const userIds = users.map((user) => user.id);

  console.log("Found users:");
  for (const user of users) {
    console.log(`- ${user.email} (${user.id})`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.session.deleteMany({
      where: {
        userId: {
          in: userIds,
        },
      },
    });

    await tx.auditLog.deleteMany({
      where: {
        actorId: {
          in: userIds,
        },
      },
    });

    await tx.comment.deleteMany({
      where: {
        authorId: {
          in: userIds,
        },
      },
    });

    await tx.flag.deleteMany({
      where: {
        OR: [
          {
            createdById: {
              in: userIds,
            },
          },
          {
            resolvedById: {
              in: userIds,
            },
          },
        ],
      },
    });

    const deletedUsers = await tx.user.deleteMany({
      where: {
        id: {
          in: userIds,
        },
      },
    });

    console.log(`Deleted ${deletedUsers.count} user record(s).`);
  });

  console.log("Registration test users deleted successfully.");
}

main()
  .catch((error) => {
    console.error("Failed to delete registration test users.");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
