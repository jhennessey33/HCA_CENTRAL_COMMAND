import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAXIMUM_WINDOW_DAYS = 9;

function parseThroughDate(request: Request) {
  const requestUrl = new URL(request.url);
  const throughValue = requestUrl.searchParams.get("through");

  if (!throughValue) {
    throw new Error("THROUGH_REQUIRED");
  }

  const throughDate = new Date(throughValue);

  if (Number.isNaN(throughDate.getTime())) {
    throw new Error("THROUGH_INVALID");
  }

  const now = new Date();

  const maximumAllowedDate = new Date(
    now.getTime() + MAXIMUM_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );

  if (throughDate <= now) {
    throw new Error("THROUGH_INVALID");
  }

  if (throughDate > maximumAllowedDate) {
    throw new Error("THROUGH_TOO_FAR");
  }

  return throughDate;
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "Authentication required.",
        },
        {
          status: 401,
        },
      );
    }

    let throughDate: Date;

    try {
      throughDate = parseThroughDate(request);
    } catch (error) {
      if (error instanceof Error && error.message === "THROUGH_REQUIRED") {
        return NextResponse.json(
          {
            error: "The reminder-summary window is required.",
          },
          {
            status: 400,
          },
        );
      }

      if (error instanceof Error && error.message === "THROUGH_TOO_FAR") {
        return NextResponse.json(
          {
            error: "The reminder-summary window cannot exceed nine days.",
          },
          {
            status: 400,
          },
        );
      }

      return NextResponse.json(
        {
          error: "The reminder-summary window is invalid.",
        },
        {
          status: 400,
        },
      );
    }

    const reminders = await prisma.flag.findMany({
      where: {
        status: "OPEN",
        OR: [
          {
            reminderAt: {
              not: null,
              lte: throughDate,
            },
          },
          {
            flagType: "Agenda",
          },
          {
            flagType: "PT Proximity Alert",
          },
                    {
            flagType: "Trade Queue Execution Alert",
          },
        ],
      },
      select: {
        id: true,
        flagType: true,
        description: true,
        priority: true,
        status: true,
        reminderAt: true,
        metadataJson: true,
        createdAt: true,
        securityId: true,
        positionId: true,
        watchlistEntryId: true,
        tradeQueueItemId: true,
        security: {
          select: {
            id: true,
            ticker: true,
            name: true,
          },
        },
      },
      orderBy: [
        {
          reminderAt: "asc",
        },
        {
          createdAt: "asc",
        },
      ],
    });
    const now = new Date();

    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

    const wellsUploadToday = await prisma.ingestionRun.findFirst({
      where: {
        source: "WELLS_FARGO",
        startedAt: {
          gte: startOfToday,
        },
        status: "COMPLETED",
      },
      orderBy: {
        startedAt: "desc",
      },
    });
    const allReminders = [...reminders];

    if (!wellsUploadToday) {
      allReminders.unshift({
        id: "UPLOAD_WELLS_FILES",
        flagType: "Operations",
        description:
          "Upload today's Wells Fargo files. Portfolio data will not refresh until a Wells file has been successfully ingested.",
        priority: "HIGH",
        status: "OPEN",
        reminderAt: startOfToday,
        securityId: null,
        positionId: null,
        watchlistEntryId: null,
        tradeQueueItemId: null,
        security: null,
        metadataJson: null,
        createdAt: startOfToday,
      });
    }

    return NextResponse.json({
      reminders: allReminders,
      through: throughDate.toISOString(),
    });
  } catch (error) {
    console.error("GET /api/reminders/summary failed", error);

    return NextResponse.json(
      {
        error: "Failed to load reminder summary.",
      },
      {
        status: 500,
      },
    );
  }
}
