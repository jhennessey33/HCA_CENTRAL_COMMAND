import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const securities = await prisma.security.findMany({
    where: {
      sector: {
        not: null,
      },
    },
    select: {
      sector: true,
    },
  });

  const counts = new Map<string, number>();

  for (const security of securities) {
    if (!security.sector) continue;

    counts.set(security.sector, (counts.get(security.sector) ?? 0) + 1);
  }

  const sectors = Array.from(counts.entries())
    .map(([name, count]) => ({
      name,
      count,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({
    sectors,
  });
}
