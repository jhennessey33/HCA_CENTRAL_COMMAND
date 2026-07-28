import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function normalizeAsOfDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return new Date(
    Date.UTC(
      parsedDate.getUTCFullYear(),
      parsedDate.getUTCMonth(),
      parsedDate.getUTCDate(),
    ),
  );
}

function getValidNetEquity(value: unknown): number | null {
  const netEquity = Number(value);

  if (!Number.isFinite(netEquity) || netEquity <= 0) {
    return null;
  }

  return netEquity;
}

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json(
        {
          error: "Authentication required.",
        },
        {
          status: 401,
        },
      );
    }

    const body = await request.json();

    const asOfDate = normalizeAsOfDate(body.asOfDate);

    const netEquity = getValidNetEquity(body.netEquity);

    if (!asOfDate) {
      return NextResponse.json(
        {
          error: "A valid Wells report date is required.",
        },
        {
          status: 400,
        },
      );
    }

    if (netEquity == null) {
      return NextResponse.json(
        {
          error: "Net Equity must be greater than zero.",
        },
        {
          status: 400,
        },
      );
    }

    const existingSnapshot = await prisma.fundEquitySnapshot.findUnique({
      where: {
        asOfDate,
      },
    });

    const snapshot = await prisma.$transaction(async (transaction) => {
      const savedSnapshot = await transaction.fundEquitySnapshot.upsert({
        where: {
          asOfDate,
        },
        create: {
          asOfDate,
          netEquity,
          source: "MANUAL_WELLS_UPLOAD",
          enteredById: currentUser.id,
        },
        update: {
          netEquity,
          source: "MANUAL_WELLS_UPLOAD",
          enteredById: currentUser.id,
        },
      });

      await transaction.auditLog.create({
        data: {
          actorId: currentUser.id,
          action: existingSnapshot ? "UPDATE" : "CREATE",
          entityType: "FundEquitySnapshot",
          entityId: savedSnapshot.id,
          previousValueJson: existingSnapshot
            ? JSON.stringify({
                asOfDate: existingSnapshot.asOfDate,
                netEquity: existingSnapshot.netEquity,
                source: existingSnapshot.source,
                enteredById: existingSnapshot.enteredById,
              })
            : null,
          newValueJson: JSON.stringify({
            asOfDate: savedSnapshot.asOfDate,
            netEquity: savedSnapshot.netEquity,
            source: savedSnapshot.source,
            enteredById: savedSnapshot.enteredById,
          }),
        },
      });

      return savedSnapshot;
    });

    return NextResponse.json({
      snapshot: {
        ...snapshot,
        asOfDate: snapshot.asOfDate.toISOString(),
      },
      created: !existingSnapshot,
    });
  } catch (error) {
    console.error("Failed to save Fund Equity snapshot.", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to save Fund Equity snapshot.",
      },
      {
        status: 500,
      },
    );
  }
}
