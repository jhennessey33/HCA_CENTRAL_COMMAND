export type TradeMatchResult =
  | {
      status: "EXACT";
      trade: any;
      reason: string;
    }
  | {
      status: "PARTIAL";
      trade: any;
      reason: string;
      completedShares: number;
      remainingShares: number;
      differences: Record<
        string,
        unknown
      >;
    }
  | {
      status: "SIMILAR";
      trade: any;
      reason: string;
      differences: Record<
        string,
        unknown
      >;
    }
  | {
      status: "NONE";
    };

function sameUtcDate(a: Date, b: Date) {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

function absDiff(a: number, b: number) {
  return Math.abs(a - b);
}
function haveSameDirection(
  firstShares: number,
  secondShares: number
) {
  if (
    Math.abs(firstShares) <= 0.001 ||
    Math.abs(secondShares) <= 0.001
  ) {
    return false;
  }

  return (
    Math.sign(firstShares) ===
    Math.sign(secondShares)
  );
}
export function matchManualTrade(params: {
  manualTrades: any[];
  wellsTrade: {
    tradeType?: string | null;
    dateTraded: Date;
    shares: number;
    avgPrice: number;
  };
}): TradeMatchResult {
  const { manualTrades, wellsTrade } = params;

  const sameTypeAndDate = manualTrades.filter((manualTrade) => {
    if (!manualTrade.dateTraded) return false;

    return (
      manualTrade.tradeType === wellsTrade.tradeType &&
      sameUtcDate(new Date(manualTrade.dateTraded), wellsTrade.dateTraded)
    );
  });

  if (!sameTypeAndDate.length) {
    return { status: "NONE" };
  }

  const exact = sameTypeAndDate.find((manualTrade) => {
    return (
      absDiff(Number(manualTrade.shares), wellsTrade.shares) <= 0.001 &&
      absDiff(Number(manualTrade.avgPrice), wellsTrade.avgPrice) <= 0.02
    );
  });

  if (exact) {
    return {
      status: "EXACT",
      trade: exact,
      reason: "Manual trade matched Wells transaction by ticker, type, date, shares, and price.",
    };
  }
  const partialCandidates =
    sameTypeAndDate.filter(
      (manualTrade) => {
        const manualShares = Number(
          manualTrade.shares
        );

        const wellsShares = Number(
          wellsTrade.shares
        );

        const manualPrice = Number(
          manualTrade.avgPrice
        );

        const wellsPrice = Number(
          wellsTrade.avgPrice
        );

        if (
          !Number.isFinite(
            manualShares
          ) ||
          !Number.isFinite(
            wellsShares
          ) ||
          !Number.isFinite(
            manualPrice
          ) ||
          !Number.isFinite(
            wellsPrice
          )
        ) {
          return false;
        }

        const manualAbsoluteShares =
          Math.abs(manualShares);

        const wellsAbsoluteShares =
          Math.abs(wellsShares);

        return (
          haveSameDirection(
            manualShares,
            wellsShares
          ) &&
          absDiff(
            manualPrice,
            wellsPrice
          ) <= 0.02 &&
          wellsAbsoluteShares <
            manualAbsoluteShares -
              0.001
        );
      }
    );

  if (
    partialCandidates.length === 1
  ) {
    const partialTrade =
      partialCandidates[0];

    const manualShares = Number(
      partialTrade.shares
    );

    const completedShares =
      Number(wellsTrade.shares);

    const remainingShares =
      manualShares -
      completedShares;

    return {
      status: "PARTIAL",
      trade: partialTrade,
      reason:
        "Wells transaction partially completed a matching manual trade at the same price.",
      completedShares,
      remainingShares,
      differences: {
        originalManualShares:
          manualShares,
        wellsCompletedShares:
          completedShares,
        remainingShares,
        manualAvgPrice:
          partialTrade.avgPrice,
        wellsAvgPrice:
          wellsTrade.avgPrice,
      },
    };
  }

  if (
    partialCandidates.length > 1
  ) {
    const firstCandidate =
      partialCandidates[0];

    return {
      status: "SIMILAR",
      trade: firstCandidate,
      reason:
        "Multiple manual trades qualify as possible partial completions. Review is required.",
      differences: {
        partialCandidateCount:
          partialCandidates.length,
        candidateTradeIds:
          partialCandidates.map(
            (candidate) =>
              candidate.id
          ),
        wellsShares:
          wellsTrade.shares,
        wellsAvgPrice:
          wellsTrade.avgPrice,
      },
    };
  }


  const similar = sameTypeAndDate.find((manualTrade) => {
    return (
      absDiff(Number(manualTrade.shares), wellsTrade.shares) <=
        Math.max(10, Math.abs(wellsTrade.shares) * 0.02) ||
      absDiff(Number(manualTrade.avgPrice), wellsTrade.avgPrice) <= 0.25
    );
  });

  if (similar) {
    return {
      status: "SIMILAR",
      trade: similar,
      reason: "Manual trade is similar to Wells transaction but differs in shares or price.",
      differences: {
        manualShares: similar.shares,
        wellsShares: wellsTrade.shares,
        manualAvgPrice: similar.avgPrice,
        wellsAvgPrice: wellsTrade.avgPrice,
      },
    };
  }

  return { status: "NONE" };
}