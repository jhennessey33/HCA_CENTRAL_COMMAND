import { prisma } from "@/lib/prisma";
import DashboardClient from "@/components/dashboard/DashboardClient";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [wellsActivePositionCount, latestFundEquitySnapshot] =
    await Promise.all([
      prisma.position.count({
        where: {
          status: "ACTIVE",
          source: "WELLS_FARGO",
        },
      }),

      prisma.fundEquitySnapshot.findFirst({
        orderBy: {
          asOfDate: "desc",
        },
        select: {
          id: true,
          asOfDate: true,
          netEquity: true,
          source: true,
        },
      }),
    ]);

  const positions = await prisma.position.findMany({
    where: {
      status: "ACTIVE",
      ...(wellsActivePositionCount > 0
        ? {
            source: "WELLS_FARGO",
          }
        : {}),
    },
    include: {
      security: {
        include: {
          marketData: {
            take: 1,
            orderBy: {
              updatedAt: "desc",
            },
          },
          comments: {
            where: {
              archivedAt: null,
              OR: [
                {
                  watchlistEntryId: null,
                },
                {
                  watchlistEntry: {
                    archivedAt: null,
                  },
                },
              ],
            },
            include: {
              author: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                },
              },
              position: {
                select: {
                  id: true,
                  status: true,
                },
              },
              watchlistEntry: {
                select: {
                  id: true,
                  side: true,
                  archivedAt: true,
                },
              },
            },
            orderBy: {
              createdAt: "desc",
            },
          },
        },
      },
      taxLots: {
        orderBy: {
          taxLotDate: "asc",
        },
      },
      trades: {
        where: {
          isHidden: false,
        },
        orderBy: {
          dateTraded: "desc",
        },
      },
      comments: {
        where: {
          archivedAt: null,
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      },
      flags: {
        where: {
          status: "OPEN",
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
    orderBy: [
      {
        side: "asc",
      },
      {
        marketValue: "desc",
      },
    ],
  });

  const serializedPositions = JSON.parse(JSON.stringify(positions));

  const serializedFundEquitySnapshot = latestFundEquitySnapshot
    ? JSON.parse(JSON.stringify(latestFundEquitySnapshot))
    : null;

  return (
    <DashboardClient
      positions={serializedPositions}
      fundEquitySnapshot={serializedFundEquitySnapshot}
    />
  );
}
