import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { canEditWatchlist } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

function parseTargetPrice(value: unknown, label: string) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    throw new Error(`${label} must be a valid number.`);
  }

  if (parsedValue < 0) {
    throw new Error(`${label} cannot be negative.`);
  }

  return parsedValue;
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

function formatPriceForComment(value: number | null) {
  if (value == null) return "—";

  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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
        { error: "You do not have permission to edit the watchlist." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const securityId = String(body.securityId || "").trim();
    const meetingId = String(body.meetingId || "").trim();
    const requestedEntryId =
      body.watchlistEntryId == null
        ? null
        : String(body.watchlistEntryId).trim() || null;
    const side = String(body.side || "")
      .trim()
      .toUpperCase();
    const ptChangeComment = String(body.ptChangeComment || "").trim();

    if (!securityId) {
      return NextResponse.json(
        { error: "Security is required." },
        { status: 400 },
      );
    }

    if (!meetingId) {
      return NextResponse.json(
        { error: "Meeting is required." },
        { status: 400 },
      );
    }

    if (side !== "LONG" && side !== "SHORT") {
      return NextResponse.json(
        { error: "Side must be LONG or SHORT." },
        { status: 400 },
      );
    }

    if (!ptChangeComment) {
      return NextResponse.json(
        { error: "Changing a price target requires a PT change comment." },
        { status: 400 },
      );
    }

    let entryTargetPrice: number | null;
    let exitTargetPrice: number | null;

    try {
      entryTargetPrice = parseTargetPrice(
        body.entryTargetPrice,
        side === "SHORT" ? "Sell PT" : "Buy PT",
      );
      exitTargetPrice = parseTargetPrice(
        body.exitTargetPrice,
        side === "SHORT" ? "Cover PT" : "Sell PT",
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

    const [security, meeting] = await Promise.all([
      prisma.security.findUnique({
        where: { id: securityId },
        select: { id: true, ticker: true },
      }),
      prisma.meeting.findUnique({
        where: { id: meetingId },
        select: { id: true },
      }),
    ]);

    if (!security) {
      return NextResponse.json(
        { error: "The selected security could not be found." },
        { status: 404 },
      );
    }

    if (!meeting) {
      return NextResponse.json(
        { error: "The selected meeting could not be found." },
        { status: 404 },
      );
    }

    if (requestedEntryId) {
      const requestedEntry = await prisma.watchlistEntry.findUnique({
        where: { id: requestedEntryId },
        select: { securityId: true, archivedAt: true },
      });

      if (
        !requestedEntry ||
        requestedEntry.securityId !== securityId ||
        requestedEntry.archivedAt != null
      ) {
        return NextResponse.json(
          {
            error:
              "The selected watchlist entry is no longer active for this security.",
          },
          { status: 409 },
        );
      }
    }

    const transactionResult = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        let existingEntry = requestedEntryId
          ? await tx.watchlistEntry.findUnique({
              where: { id: requestedEntryId },
            })
          : null;

        if (!existingEntry) {
          existingEntry = await tx.watchlistEntry.findFirst({
            where: {
              securityId,
              archivedAt: null,
            },
            orderBy: {
              createdAt: "asc",
            },
          });
        }

        const created = !existingEntry;
        const previousEntryTargetPrice = existingEntry
          ? existingEntry.entryTargetPrice ?? existingEntry.targetPrice
          : null;
        const previousExitTargetPrice = existingEntry?.exitTargetPrice ?? null;
        const previousSide = existingEntry?.side ?? null;

        const didEntryTargetChange = targetPriceChanged(
          previousEntryTargetPrice,
          entryTargetPrice,
        );
        const didExitTargetChange = targetPriceChanged(
          previousExitTargetPrice,
          exitTargetPrice,
        );
        const didSideChange = previousSide !== side;

        if (
          !created &&
          !didEntryTargetChange &&
          !didExitTargetChange &&
          !didSideChange
        ) {
          throw new Error("NO_CHANGES");
        }

        if (created && entryTargetPrice == null && exitTargetPrice == null) {
          throw new Error("TARGET_REQUIRED");
        }

        const watchlistEntry = existingEntry
          ? await tx.watchlistEntry.update({
              where: { id: existingEntry.id },
              data: {
                side,
                entryTargetPrice,
                exitTargetPrice,
                targetPrice: entryTargetPrice,
              },
            })
          : await tx.watchlistEntry.create({
              data: {
                securityId,
                side,
                entryTargetPrice,
                exitTargetPrice,
                targetPrice: entryTargetPrice,
              },
            });

        const generatedPtCommentIds: string[] = [];

        if (didEntryTargetChange) {
          const comment = await tx.comment.create({
            data: {
              securityId,
              watchlistEntryId: watchlistEntry.id,
              meetingId,
              authorId: author.id,
              tag: "PT",
              content: buildTargetChangeComment({
                label: getEntryTargetLabel(side),
                previousValue: previousEntryTargetPrice,
                nextValue: entryTargetPrice,
                reason: ptChangeComment,
              }),
            },
            select: { id: true },
          });

          generatedPtCommentIds.push(comment.id);
        }

        if (didExitTargetChange) {
          const comment = await tx.comment.create({
            data: {
              securityId,
              watchlistEntryId: watchlistEntry.id,
              meetingId,
              authorId: author.id,
              tag: "PT",
              content: buildTargetChangeComment({
                label: getExitTargetLabel(side),
                previousValue: previousExitTargetPrice,
                nextValue: exitTargetPrice,
                reason: ptChangeComment,
              }),
            },
            select: { id: true },
          });

          generatedPtCommentIds.push(comment.id);
        }

        await tx.auditLog.create({
          data: {
            actorId: author.id,
            action: created
              ? "WATCHLIST_ENTRY_CREATED"
              : "WATCHLIST_ENTRY_UPDATED",
            entityType: "WATCHLIST_ENTRY",
            entityId: watchlistEntry.id,
            previousValueJson: created
              ? null
              : JSON.stringify({
                  ticker: security.ticker,
                  side: previousSide,
                  entryTargetPrice: previousEntryTargetPrice,
                  exitTargetPrice: previousExitTargetPrice,
                  notes: existingEntry?.notes ?? null,
                }),
            newValueJson: JSON.stringify({
              ticker: security.ticker,
              side,
              entryTargetPrice,
              exitTargetPrice,
              sideChanged: didSideChange,
              targetChangeReason: ptChangeComment,
              meetingId,
              updateMethod: "MEETING_PT_CHANGE",
            }),
          },
        });

        return {
          watchlistEntryId: watchlistEntry.id,
          generatedPtCommentIds,
          created,
        };
      },
    );

    const [watchlistEntry, generatedPtComments] = await Promise.all([
      prisma.watchlistEntry.findUniqueOrThrow({
        where: { id: transactionResult.watchlistEntryId },
        include: {
          security: true,
        },
      }),
      transactionResult.generatedPtCommentIds.length > 0
        ? prisma.comment.findMany({
            where: {
              id: { in: transactionResult.generatedPtCommentIds },
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
                },
              },
            },
            orderBy: { createdAt: "asc" },
          })
        : Promise.resolve([]),
    ]);

    return NextResponse.json(
      {
        watchlistEntry,
        generatedPtComments,
        created: transactionResult.created,
      },
      { status: transactionResult.created ? 201 : 200 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "NO_CHANGES") {
      return NextResponse.json(
        { error: "Change at least one price target or the portfolio side." },
        { status: 400 },
      );
    }

    if (error instanceof Error && error.message === "TARGET_REQUIRED") {
      return NextResponse.json(
        { error: "Enter at least one price target." },
        { status: 400 },
      );
    }

    console.error("POST /api/watchlist/pt-change failed", error);

    return NextResponse.json(
      {
        error: "Failed to save price targets.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
