import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canEditWatchlist } from "@/lib/permissions";

function parseTargetPrice(value: unknown, label: string) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    throw new Error(`${label} must be a valid number.`);
  }

  if (numberValue < 0) {
    throw new Error(`${label} cannot be negative.`);
  }

  return numberValue;
}

function parseNotes(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  const textValue = String(value).trim();

  return textValue.length > 0 ? textValue : null;
}

function formatPriceForComment(value: number | null) {
  if (value == null) return "—";

  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function targetPriceChanged(oldValue: number | null, newValue: number | null) {
  if (oldValue == null && newValue == null) {
    return false;
  }

  if (oldValue == null || newValue == null) {
    return true;
  }

  return Math.abs(oldValue - newValue) > 0.000001;
}

function capitalize(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function getEntryTargetLabel(side: string) {
  return side === "SHORT" ? "sell" : "buy";
}

function getExitTargetLabel(side: string) {
  return side === "SHORT" ? "cover" : "sell";
}

function buildTargetChangeComment({
  label,
  previousValue,
  nextValue,
  reason,
}: {
  label: string;
  previousValue: number | null;
  nextValue: number | null;
  reason: string;
}) {
  const capitalizedLabel = capitalize(label);

  if (previousValue == null && nextValue != null) {
    return `${capitalizedLabel} price target set to ${formatPriceForComment(
      nextValue,
    )}. Reason: ${reason}`;
  }

  if (previousValue != null && nextValue == null) {
    return `${capitalizedLabel} price target removed. Previous value was ${formatPriceForComment(
      previousValue,
    )}. Reason: ${reason}`;
  }

  return `${capitalizedLabel} price target changed from ${formatPriceForComment(
    previousValue,
  )} to ${formatPriceForComment(nextValue)}. Reason: ${reason}`;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const meetingId =
      body.meetingId == null ? null : String(body.meetingId).trim() || null;

    const author = await getCurrentUser();

    if (!author) {
      return NextResponse.json(
        {
          error: "Authentication required.",
        },
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

    const existingEntry = await prisma.watchlistEntry.findUnique({
      where: {
        id,
      },
      include: {
        security: true,
      },
    });

    if (!existingEntry) {
      return NextResponse.json(
        {
          error: "Watchlist item not found.",
        },
        { status: 404 },
      );
    }

    if (meetingId) {
      const meetingExists = await prisma.meeting.findUnique({
        where: {
          id: meetingId,
        },
        select: {
          id: true,
        },
      });

      if (!meetingExists) {
        return NextResponse.json(
          {
            error: "The selected meeting could not be found.",
          },
          { status: 404 },
        );
      }
    }

    const side = String(body.side || "")
      .trim()
      .toUpperCase();

    if (side !== "LONG" && side !== "SHORT") {
      return NextResponse.json(
        {
          error: "Side must be LONG or SHORT.",
        },
        { status: 400 },
      );
    }

    let entryTargetPrice: number | null;
    let exitTargetPrice: number | null;
    let discussionTargetPrice: number | null;
    try {
      entryTargetPrice = parseTargetPrice(
        body.entryTargetPrice,
        side === "SHORT" ? "Sell PT" : "Buy PT",
      );

      exitTargetPrice = parseTargetPrice(
        body.exitTargetPrice,
        side === "SHORT" ? "Cover PT" : "Sell PT",
      );

      discussionTargetPrice = parseTargetPrice(
        body.discussionTargetPrice,
        "Discussion PT",
      );
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Invalid target price.",
        },
        { status: 400 },
      );
    }

    const notes = parseNotes(body.notes);
    const ptChangeComment = parseNotes(body.ptChangeComment);

    const existingEntryTargetPrice =
      existingEntry.entryTargetPrice ?? existingEntry.targetPrice;

    const existingExitTargetPrice = existingEntry.exitTargetPrice;
    const existingDiscussionTargetPrice =
      existingEntry.discussionTargetPrice;

    const didEntryTargetChange = targetPriceChanged(
      existingEntryTargetPrice,
      entryTargetPrice,
    );

    const didExitTargetChange = targetPriceChanged(
      existingExitTargetPrice,
      exitTargetPrice,
    );

    const didDiscussionTargetChange = targetPriceChanged(
      existingDiscussionTargetPrice,
      discussionTargetPrice,
    );

    const didSideChange = existingEntry.side !== side;

    if (
      (didEntryTargetChange ||
        didExitTargetChange ||
        didDiscussionTargetChange) &&
      !ptChangeComment
    ) {
      return NextResponse.json(
        {
          error: "Changing a price target requires a PT change comment.",
        },
        { status: 400 },
      );
    }

    const conflictingEntry = await prisma.watchlistEntry.findFirst({
      where: {
        id: {
          not: id,
        },
        securityId: existingEntry.securityId,
        side,
        archivedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (conflictingEntry) {
      return NextResponse.json(
        {
          error:
            "This security already has an active watchlist entry on the selected side.",
        },
        { status: 409 },
      );
    }

    const generatedPtCommentIds = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const commentIds: string[] = [];

        await tx.watchlistEntry.update({
          where: {
            id,
          },
          data: {
            side,
            entryTargetPrice,
            exitTargetPrice,
            discussionTargetPrice,

            // Keep the legacy target synchronized with the entry
            // target until targetPrice is removed in a later migration.
            targetPrice: entryTargetPrice,

            notes,
          },
        });

        if (didEntryTargetChange && ptChangeComment) {
          const comment = await tx.comment.create({
            data: {
              securityId: existingEntry.securityId,
              watchlistEntryId: existingEntry.id,
              meetingId,
              authorId: author.id,
              tag: "PT",
              content: buildTargetChangeComment({
                label: getEntryTargetLabel(side),
                previousValue: existingEntryTargetPrice,
                nextValue: entryTargetPrice,
                reason: ptChangeComment,
              }),
            },
            select: {
              id: true,
            },
          });

          commentIds.push(comment.id);
        }

        if (didExitTargetChange && ptChangeComment) {
          const comment = await tx.comment.create({
            data: {
              securityId: existingEntry.securityId,
              watchlistEntryId: existingEntry.id,
              meetingId,
              authorId: author.id,
              tag: "PT",
              content: buildTargetChangeComment({
                label: getExitTargetLabel(side),
                previousValue: existingExitTargetPrice,
                nextValue: exitTargetPrice,
                reason: ptChangeComment,
              }),
            },
            select: {
              id: true,
            },
          });

          commentIds.push(comment.id);
        }

        if (didDiscussionTargetChange && ptChangeComment) {
          const comment = await tx.comment.create({
            data: {
              securityId: existingEntry.securityId,
              watchlistEntryId: existingEntry.id,
              meetingId,
              authorId: author.id,
              tag: "PT",
              content: buildTargetChangeComment({
                label: "discussion",
                previousValue: existingDiscussionTargetPrice,
                nextValue: discussionTargetPrice,
                reason: ptChangeComment,
              }),
            },
            select: {
              id: true,
            },
          });

          commentIds.push(comment.id);
        }

        await tx.auditLog.create({
          data: {
            actorId: author.id,
            action: "WATCHLIST_ENTRY_UPDATED",
            entityType: "WATCHLIST_ENTRY",
            entityId: existingEntry.id,
            previousValueJson: JSON.stringify({
              ticker: existingEntry.security.ticker,
              side: existingEntry.side,
              entryTargetPrice: existingEntryTargetPrice,
              exitTargetPrice: existingExitTargetPrice,
              discussionTargetPrice: existingDiscussionTargetPrice,
              notes: existingEntry.notes,
            }),
            newValueJson: JSON.stringify({
              ticker: existingEntry.security.ticker,
              side,
              entryTargetPrice,
              exitTargetPrice,
              discussionTargetPrice,
              notes,
              sideChanged: didSideChange,
              targetChangeReason:
                didEntryTargetChange ||
                  didExitTargetChange ||
                  didDiscussionTargetChange
                  ? ptChangeComment
                  : null,
            }),
          },
        });
        return commentIds;
      },
    );

    const generatedPtComments =
      generatedPtCommentIds.length > 0
        ? await prisma.comment.findMany({
          where: {
            id: {
              in: generatedPtCommentIds,
            },
          },
          include: {
            security: true,
            author: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
            watchlistEntry: {
              select: {
                id: true,
                side: true,
                entryTargetPrice: true,
                exitTargetPrice: true,
                discussionTargetPrice: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        })
        : [];

    const updatedEntry = await prisma.watchlistEntry.findUniqueOrThrow({
      where: {
        id,
      },
      include: {
        security: {
          include: {
            marketData: {
              orderBy: {
                updatedAt: "desc",
              },
              take: 1,
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
          take: 5,
        },
      },
    });

    return NextResponse.json({
      watchlistEntry: updatedEntry,
      generatedPtComments,
    });
  } catch (error) {
    console.error("Failed to update watchlist item:", error);

    return NextResponse.json(
      {
        error: "Failed to update watchlist item.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const author = await getCurrentUser();

    if (!author) {
      return NextResponse.json(
        {
          error: "Authentication required.",
        },
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

    const existingEntry = await prisma.watchlistEntry.findUnique({
      where: {
        id,
      },
    });

    if (!existingEntry) {
      return NextResponse.json(
        {
          error: "Watchlist item not found.",
        },
        { status: 404 },
      );
    }

    await prisma.$transaction([
      prisma.comment.updateMany({
        where: {
          watchlistEntryId: id,
          archivedAt: null,
        },
        data: {
          archivedAt: new Date(),
        },
      }),

      prisma.flag.updateMany({
        where: {
          watchlistEntryId: id,
          status: "OPEN",
        },
        data: {
          status: "ARCHIVED",
        },
      }),

      prisma.watchlistEntry.update({
        where: {
          id,
        },
        data: {
          archivedAt: new Date(),
        },
      }),
    ]);

    await prisma.auditLog.create({
      data: {
        actorId: author.id,
        action: "WATCHLIST_ENTRY_DELETED",
        entityType: "WATCHLIST_ENTRY",
        entityId: id,
        newValueJson: JSON.stringify({
          id,
          archivedAt: new Date(),
        }),
      },
    });

    return NextResponse.json({
      success: true,
      id,
    });
  } catch (error) {
    console.error("Failed to remove watchlist item:", error);

    return NextResponse.json(
      {
        error: "Failed to remove watchlist item.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
