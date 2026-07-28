import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canCreateFlags } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const VALID_PRIORITIES = new Set(["LOW", "MEDIUM", "HIGH"]);

function parseOptionalReminderAt(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsedDate = new Date(String(value));

  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error("Reminder date and time are invalid.");
  }

  return parsedDate;
}

const flagInclude = {
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
} satisfies Prisma.FlagInclude;

export async function GET() {
  try {
    const flags = await prisma.flag.findMany({
      include: flagInclude,
      orderBy: [
        {
          status: "asc",
        },
        {
          createdAt: "desc",
        },
      ],
    });

    return NextResponse.json({ flags });
  } catch (error) {
    console.error("GET /api/flags failed", error);

    return NextResponse.json(
      { error: "Failed to load flags." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    if (!canCreateFlags(user.role)) {
      return NextResponse.json(
        {
          error: "You do not have permission to create flags.",
        },
        { status: 403 },
      );
    }

    const body = await request.json();

    const requestedSecurityId = body.securityId
      ? String(body.securityId).trim()
      : null;

    const positionId = body.positionId ? String(body.positionId).trim() : null;

    const watchlistEntryId = body.watchlistEntryId
      ? String(body.watchlistEntryId).trim()
      : null;

    const flagType = String(body.flagType || "").trim();

    const normalizedFlagType =
      flagType.toUpperCase() === "REMINDER" ? "REMINDER" : flagType;

    const priority = String(body.priority || "")
      .trim()
      .toUpperCase();

    const description = String(body.description || "").trim();

    if (!flagType) {
      return NextResponse.json(
        { error: "Flag type is required." },
        { status: 400 },
      );
    }

    if (!VALID_PRIORITIES.has(priority)) {
      return NextResponse.json(
        {
          error: "Priority must be LOW, MEDIUM, or HIGH.",
        },
        { status: 400 },
      );
    }

    if (positionId && watchlistEntryId) {
      return NextResponse.json(
        {
          error:
            "A flag cannot be associated with both a position and a watchlist entry.",
        },
        { status: 400 },
      );
    }

    let reminderAt: Date | null;

    try {
      reminderAt = parseOptionalReminderAt(body.reminderAt);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Reminder date and time are invalid.",
        },
        { status: 400 },
      );
    }

    if (normalizedFlagType === "REMINDER" && !reminderAt) {
      return NextResponse.json(
        {
          error: "A reminder date and time are required for reminders.",
        },
        { status: 400 },
      );
    }

    if (normalizedFlagType === "REMINDER" && !description) {
      return NextResponse.json(
        {
          error: "A description is required for reminders.",
        },
        { status: 400 },
      );
    }

    let securityId = requestedSecurityId;
    let securityTicker: string | null = null;

    if (positionId) {
      const position = await prisma.position.findUnique({
        where: {
          id: positionId,
        },
        select: {
          id: true,
          securityId: true,
          security: {
            select: {
              ticker: true,
            },
          },
        },
      });

      if (!position) {
        return NextResponse.json(
          { error: "Position not found." },
          { status: 404 },
        );
      }

      if (securityId && securityId !== position.securityId) {
        return NextResponse.json(
          {
            error:
              "The selected Security does not match the selected position.",
          },
          { status: 400 },
        );
      }

      securityId = position.securityId;
      securityTicker = position.security.ticker;
    }

    if (watchlistEntryId) {
      const watchlistEntry = await prisma.watchlistEntry.findUnique({
        where: {
          id: watchlistEntryId,
        },
        select: {
          id: true,
          securityId: true,
          security: {
            select: {
              ticker: true,
            },
          },
        },
      });

      if (!watchlistEntry) {
        return NextResponse.json(
          { error: "Watchlist entry not found." },
          { status: 404 },
        );
      }

      if (securityId && securityId !== watchlistEntry.securityId) {
        return NextResponse.json(
          {
            error:
              "The selected Security does not match the selected watchlist entry.",
          },
          { status: 400 },
        );
      }

      securityId = watchlistEntry.securityId;
      securityTicker = watchlistEntry.security.ticker;
    }

    if (securityId && !positionId && !watchlistEntryId) {
      const security = await prisma.security.findUnique({
        where: {
          id: securityId,
        },
        select: {
          id: true,
          ticker: true,
        },
      });

      if (!security) {
        return NextResponse.json(
          { error: "Security not found." },
          { status: 404 },
        );
      }

      securityTicker = security.ticker;
    }

    const flag = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const createdFlag = await tx.flag.create({
          data: {
            securityId,
            positionId,
            watchlistEntryId,
            flagType: normalizedFlagType,
            priority,
            description: description || null,
            reminderAt,
            status: "OPEN",
            createdById: user.id,
          },
          include: flagInclude,
        });

        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: "FLAG_CREATED",
            entityType: "FLAG",
            entityId: createdFlag.id,
            newValueJson: JSON.stringify({
              securityId: createdFlag.securityId,
              securityContext: securityTicker || "General",
              positionId: createdFlag.positionId,
              watchlistEntryId: createdFlag.watchlistEntryId,
              flagType: createdFlag.flagType,
              priority: createdFlag.priority,
              description: createdFlag.description,
              reminderAt: createdFlag.reminderAt,
              status: createdFlag.status,
            }),
          },
        });

        return createdFlag;
      },
    );

    return NextResponse.json({ flag }, { status: 201 });
  } catch (error) {
    console.error("POST /api/flags failed", error);

    return NextResponse.json(
      { error: "Failed to create flag." },
      { status: 500 },
    );
  }
}
