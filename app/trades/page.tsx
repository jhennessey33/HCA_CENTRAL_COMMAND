import { prisma } from "@/lib/prisma";
import TradesClient from "@/components/trades/TradesClient";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [wellsActivePositionCount, fundEquitySnapshots, activeTradeQueueItems] =
    await Promise.all([
      prisma.position.count({
        where: {
          status: "ACTIVE",
          source: "WELLS_FARGO",
        },
      }),
      prisma.fundEquitySnapshot.findMany({
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
      prisma.tradeQueueItem.findMany({
        where: {
          status: {
            in: ["QUEUED", "TRIGGERED"],
          },
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
            },
          },
          position: {
            select: {
              id: true,
              securityId: true,
              side: true,
              status: true,
              shares: true,
              marketValue: true,
              source: true,
              accountNumber: true,
            },
          },
          createdBy: {
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
            status: "desc",
          },
          {
            createdAt: "asc",
          },
        ],
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

  const serializedFundEquitySnapshots = JSON.parse(
    JSON.stringify(fundEquitySnapshots),
  );

  const serializedTradeQueueItems = JSON.parse(
    JSON.stringify(activeTradeQueueItems),
  );

  return (
    <TradesClient
      positions={serializedPositions}
      fundEquitySnapshots={serializedFundEquitySnapshots}
      initialQueuedTrades={serializedTradeQueueItems}
    />
  );
}
