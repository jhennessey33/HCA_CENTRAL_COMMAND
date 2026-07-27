import TradeCalculatorClient from "@/components/trade-calculator/TradeCalculatorClient";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function TradeCalculatorPage() {
  const [
    securities,
    activePositionValues,
    fundEquitySnapshots,
  ] = await Promise.all([
      prisma.security.findMany({
        select: {
          id: true,
          ticker: true,
          name: true,
          sector: true,
          industry: true,

          marketData: {
            take: 1,
            orderBy: {
              updatedAt: "desc",
            },
            select: {
              currentPrice: true,
              marketDataSource: true,
              snapshotAsOf: true,
              updatedAt: true,
            },
          },

          positions: {
            where: {
              status: "ACTIVE",
              source: "WELLS_FARGO",
            },
            orderBy: {
              updatedAt: "desc",
            },
            select: {
              id: true,
              securityId: true,
              accountNumber: true,
              custodian: true,
              source: true,
              side: true,
              status: true,
              shares: true,
              marketValue: true,
              costBasis: true,
              unrealizedPnl: true,
              sourceReportDate: true,
              updatedAt: true,

              trades: {
                where: {
                  source: {
                    in: [
                      "MANUAL",
                      "SYSTEM",
                    ],
                  },
                  reconciliationStatus:
                    "MANUAL_PENDING",
                  isHidden: false,
                },
                select: {
                  id: true,
                  securityId: true,
                  positionId: true,
                  dateTraded: true,
                  shares: true,
                  avgPrice: true,
                  tradeType: true,
                  notional: true,
                  source: true,
                  reconciliationStatus: true,
                  comment: true,
                  createdAt: true,
                },
              },
            },
          },
        },
        orderBy: {
          ticker: "asc",
        },
      }),

      

      prisma.position.findMany({
        where: {
          status: "ACTIVE",
          source: "WELLS_FARGO",
        },
        select: {
          marketValue: true,
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
    ]);
    
  const grossPortfolioMarketValue =
    activePositionValues.reduce(
      (total, position) =>
        total +
        Math.abs(
          Number(position.marketValue) || 0
        ),
      0
    );

  const serializedSecurities = JSON.parse(
    JSON.stringify(securities)
  );

  const serializedFundEquitySnapshots =
  JSON.parse(
    JSON.stringify(
      fundEquitySnapshots
    )
  );

  return (
  <TradeCalculatorClient
    initialSecurities={
      serializedSecurities
    }
    grossPortfolioMarketValue={
      grossPortfolioMarketValue
    }
    fundEquitySnapshots={
      serializedFundEquitySnapshots
    }
  />
  );
}