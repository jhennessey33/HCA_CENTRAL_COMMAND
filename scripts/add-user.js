const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

const VALID_ROLES = new Set([
  "ADMIN",
  "TRADER",
  "ANALYST",
  "PM",
  "VIEWER",
  "COMPLIANCE",
]);

function getArg(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length).trim() : "";
}

async function main() {
  const email = getArg("email").toLowerCase();
  const name = getArg("name");
  const role = getArg("role").toUpperCase() || "ADMIN";
  const password = getArg("password") || "password123";

  if (!email) {
    throw new Error(
      'Missing required --email argument. Example: node scripts/add-user.js --email=test@example.com --name="Test User" --role=ADMIN',
    );
  }

  if (!VALID_ROLES.has(role)) {
    throw new Error(
      `Invalid role "${role}". Valid roles: ${Array.from(VALID_ROLES).join(", ")}`,
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: {
      email,
    },
    update: {
      name: name || null,
      role,
      passwordHash,
    },
    create: {
      email,
      name: name || null,
      role,
      passwordHash,
    },
  });

  console.log("User created/updated successfully:");
  console.log(`Email: ${user.email}`);
  console.log(`Name: ${user.name || "N/A"}`);
  console.log(`Role: ${user.role}`);
  console.log(`Password: ${password}`);
}

main()
  .catch((error) => {
    console.error("Failed to add/update user:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
