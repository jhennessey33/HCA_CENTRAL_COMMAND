import { prisma } from "@/lib/prisma";
import WatchlistClient from "@/components/watchlist/WatchlistClient";

export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  const entries = await prisma.watchlistEntry.findMany({
    where: {
      archivedAt: null,
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
        createdAt: "desc",
      },
    ],
  });

  const portfolioSecurities = await prisma.security.findMany({
    where: {
      positions: {
        some: {
          status: "ACTIVE",
          source: "WELLS_FARGO",
        },
      },
    },
    orderBy: {
      ticker: "asc",
    },
    select: {
      id: true,
      ticker: true,
      name: true,
      sector: true,
    },
  });

  const serializedEntries = JSON.parse(JSON.stringify(entries));
  const serializedPortfolioSecurities = JSON.parse(
    JSON.stringify(portfolioSecurities),
  );

  return (
    <WatchlistClient
      initialEntries={serializedEntries}
      portfolioSecurities={serializedPortfolioSecurities}
      mode="WATCHLIST"
    />
  );
}
