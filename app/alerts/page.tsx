import { prisma } from "@/lib/prisma";
import AlertsClient from "@/components/alerts/AlertsClient";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const [flags, securities] = await Promise.all([
    prisma.flag.findMany({
      where: {
        status: "OPEN",
      },
      include: {
        security: true,
        position: true,
        watchlistEntry: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        resolvedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: [
        {
          reminderAt: "asc",
        },
        {
          createdAt: "desc",
        },
      ],
    }),

    prisma.security.findMany({
      select: {
        id: true,
        ticker: true,
        name: true,
        sector: true,
      },
      orderBy: {
        ticker: "asc",
      },
    }),
  ]);

  const serializedFlags = JSON.parse(JSON.stringify(flags));

  const serializedSecurities = JSON.parse(JSON.stringify(securities));

  return (
    <AlertsClient
      initialFlags={serializedFlags}
      securities={serializedSecurities}
    />
  );
}
