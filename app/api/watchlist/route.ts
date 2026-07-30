import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canEditWatchlist } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

function formatPriceForComment(value: number | null) {
  if (value == null) return "—";

  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseTargetPrice(value: unknown) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    throw new Error("Target price must be numeric.");
  }

  if (parsedValue < 0) {
    throw new Error("Target price cannot be negative.");
  }

  return parsedValue;
}

function getAllowedTargetTypes(side: string) {
  return side === "LONG"
    ? ["BUY", "SELL", "DISCUSSION"]
    : ["SELL", "COVER", "DISCUSSION"];
}

function getTargetField(
  side: string,
  targetType: string,
):
  | "entryTargetPrice"
  | "exitTargetPrice"
  | "discussionTargetPrice" {
  if (targetType === "DISCUSSION") {
    return "discussionTargetPrice";
  }

  if (side === "LONG") {
    return targetType === "BUY"
      ? "entryTargetPrice"
      : "exitTargetPrice";
  }

  return targetType === "SELL"
    ? "entryTargetPrice"
    : "exitTargetPrice";
}

function getTargetLabel(side: string, targetType: string) {
  if (targetType === "DISCUSSION") {
    return "discussion";
  }

  if (side === "LONG") {
    return targetType === "BUY" ? "buy" : "sell";
  }

  return targetType === "SELL" ? "sell" : "cover";
}
const watchlistEntryInclude = {
  security: {
    include: {
      marketData: {
        take: 1,
        orderBy: {
          updatedAt: "desc" as const,
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
          createdAt: "desc" as const,
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
      createdAt: "desc" as const,
    },
  },
  flags: {
    where: {
      status: "OPEN",
    },
    orderBy: {
      createdAt: "desc" as const,
    },
  },
} satisfies Prisma.WatchlistEntryInclude;

export async function GET() {
  try {
    const entries = await prisma.watchlistEntry.findMany({
      where: {
        archivedAt: null,
      },
      include: watchlistEntryInclude,
      orderBy: [
        {
          side: "asc",
        },
        {
          createdAt: "desc",
        },
      ],
    });

    return NextResponse.json({ entries });
  } catch (error) {
    console.error("GET /api/watchlist failed", error);

    return NextResponse.json(
      { error: "Failed to load watchlist." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const author = await getCurrentUser();

    if (!author) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    if (!canEditWatchlist(author.role)) {
      return NextResponse.json(
        {
          error: "You do not have permission to edit the watchlist.",
        },
        { status: 403 },
      );
    }

    const body = await request.json();

    const ticker = String(body.ticker || "")
      .trim()
      .toUpperCase();

    const side = String(body.side || "")
      .trim()
      .toUpperCase();

    const targetType = String(body.targetType || "")
      .trim()
      .toUpperCase();

    const comment = String(body.comment || "").trim();

    if (!ticker) {
      return NextResponse.json(
        { error: "Ticker is required." },
        { status: 400 },
      );
    }

    if (!["LONG", "SHORT"].includes(side)) {
      return NextResponse.json(
        { error: "Side must be LONG or SHORT." },
        { status: 400 },
      );
    }

    const allowedTargetTypes = getAllowedTargetTypes(side);

    if (!allowedTargetTypes.includes(targetType)) {
      return NextResponse.json(
        {
          error:
            side === "LONG"
              ? "Long target type must be BUY, SELL, or DISCUSSION."
              : "Short target type must be SELL, COVER, or DISCUSSION.",
        },
        { status: 400 },
      );
    }


    let parsedTargetPrice: number | null;

    try {
      parsedTargetPrice = parseTargetPrice(body.targetPrice);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Invalid target price.",
        },
        { status: 400 },
      );
    }

    const targetField = getTargetField(side, targetType);
    const targetLabel = getTargetLabel(side, targetType);

    const result = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const security = await tx.security.upsert({
          where: {
            ticker,
          },
          update: {},
          create: {
            ticker,
            name: ticker,
            sector: "Uncategorized",
          },
        });

        const existingEntry = await tx.watchlistEntry.findFirst({
          where: {
            securityId: security.id,
            side,
            archivedAt: null,
          },
          orderBy: {
            createdAt: "asc",
          },
        });

        if (existingEntry) {
          const existingEntryTarget =
            existingEntry.entryTargetPrice ?? existingEntry.targetPrice;

          const previousTargetPrice =
            targetField === "entryTargetPrice"
              ? existingEntryTarget
              : targetField === "exitTargetPrice"
                ? existingEntry.exitTargetPrice
                : existingEntry.discussionTargetPrice;

          const updateData: Prisma.WatchlistEntryUpdateInput = {};

          if (parsedTargetPrice != null) {
            if (targetField === "entryTargetPrice") {
              updateData.entryTargetPrice = parsedTargetPrice;

              // Keep the temporary legacy field synchronized until it is
              // removed in a later migration.
              updateData.targetPrice = parsedTargetPrice;
            } else if (targetField === "exitTargetPrice") {
              updateData.exitTargetPrice = parsedTargetPrice;
            } else {
              updateData.discussionTargetPrice = parsedTargetPrice;
            }
          }

          const updatedEntry = await tx.watchlistEntry.update({
            where: {
              id: existingEntry.id,
            },
            data: updateData,
          });

          if (parsedTargetPrice != null) {
            const commentPrefix =
              previousTargetPrice == null
                ? `${targetLabel[0].toUpperCase()}${targetLabel.slice(
                  1,
                )} price target set to`
                : `${targetLabel[0].toUpperCase()}${targetLabel.slice(
                  1,
                )} price target changed from ${formatPriceForComment(
                  previousTargetPrice,
                )} to`;

            await tx.comment.create({
              data: {
                securityId: security.id,
                watchlistEntryId: updatedEntry.id,
                authorId: author.id,
                tag: "PT",
                content: `${commentPrefix} ${formatPriceForComment(
                  parsedTargetPrice,
                )}.`,
              },
            });
          }

          if (comment) {
            await tx.comment.create({
              data: {
                securityId: security.id,
                watchlistEntryId: updatedEntry.id,
                authorId: author.id,
                tag: "COMMENT",
                content: comment,
              },
            });
          }

          await tx.auditLog.create({
            data: {
              actorId: author.id,
              action: "WATCHLIST_ENTRY_UPDATED",
              entityType: "WATCHLIST_ENTRY",
              entityId: updatedEntry.id,
              previousValueJson: JSON.stringify({
                ticker,
                side: existingEntry.side,
                entryTargetPrice: existingEntryTarget,
                exitTargetPrice: existingEntry.exitTargetPrice,
                discussionTargetPrice: existingEntry.discussionTargetPrice,
              }),
              newValueJson: JSON.stringify({
                ticker,
                side: updatedEntry.side,
                targetType,
                entryTargetPrice:
                  updatedEntry.entryTargetPrice ?? updatedEntry.targetPrice,
                exitTargetPrice: updatedEntry.exitTargetPrice,
                discussionTargetPrice: updatedEntry.discussionTargetPrice,
                comment: comment || null,
                updateMethod: "ADD_MODAL_EXISTING_ENTRY",
              }),
            },
          });

          return {
            id: updatedEntry.id,
            created: false,
          };
        }

        const entryTargetPrice =
          targetField === "entryTargetPrice" ? parsedTargetPrice : null;

        const exitTargetPrice =
          targetField === "exitTargetPrice" ? parsedTargetPrice : null;

        const discussionTargetPrice =
          targetField === "discussionTargetPrice"
            ? parsedTargetPrice
            : null;

        const createdEntry = await tx.watchlistEntry.create({
          data: {
            securityId: security.id,
            side,
            targetPrice: entryTargetPrice,
            entryTargetPrice,
            exitTargetPrice,
            discussionTargetPrice,
            notes: comment || null,
          },
        });

        if (parsedTargetPrice != null) {
          await tx.comment.create({
            data: {
              securityId: security.id,
              watchlistEntryId: createdEntry.id,
              authorId: author.id,
              tag: "PT",
              content: `Original ${targetLabel} price target set to ${formatPriceForComment(
                parsedTargetPrice,
              )}.`,
            },
          });
        }

        if (comment) {
          await tx.comment.create({
            data: {
              securityId: security.id,
              watchlistEntryId: createdEntry.id,
              authorId: author.id,
              tag: "COMMENT",
              content: comment,
            },
          });
        }

        await tx.auditLog.create({
          data: {
            actorId: author.id,
            action: "WATCHLIST_ENTRY_CREATED",
            entityType: "WATCHLIST_ENTRY",
            entityId: createdEntry.id,
            nnewValueJson: JSON.stringify({
              ticker,
              side,
              targetType,
              entryTargetPrice,
              exitTargetPrice,
              discussionTargetPrice,
              comment: comment || null,
            }),
          },
        });

        return {
          id: createdEntry.id,
          created: true,
        };
      },
    );

    const entry = await prisma.watchlistEntry.findUniqueOrThrow({
      where: {
        id: result.id,
      },
      include: watchlistEntryInclude,
    });

    return NextResponse.json(
      {
        entry,
        created: result.created,
      },
      {
        status: result.created ? 201 : 200,
      },
    );
  } catch (error) {
    console.error("POST /api/watchlist failed", error);

    return NextResponse.json(
      { error: "Failed to create or update watchlist entry." },
      { status: 500 },
    );
  }
}
