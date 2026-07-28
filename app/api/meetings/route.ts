import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

function canCreateMeetings(role?: string | null) {
  return ["ADMIN", "TRADER", "PM", "ANALYST"].includes(role || "");
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

    if (!canCreateMeetings(currentUser.role)) {
      return NextResponse.json(
        {
          error: "You do not have permission to create meetings.",
        },
        {
          status: 403,
        },
      );
    }

    const body = await request.json();

    const title = String(body.title || "").trim();

    const meetingDate = new Date(body.meetingDate);

    if (!title) {
      return NextResponse.json(
        {
          error: "Meeting title is required.",
        },
        {
          status: 400,
        },
      );
    }

    if (Number.isNaN(meetingDate.getTime())) {
      return NextResponse.json(
        {
          error: "Valid meeting date is required.",
        },
        {
          status: 400,
        },
      );
    }

    const meeting = await prisma.meeting.create({
      data: {
        title,
        meetingDate,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: currentUser.id,
        action: "MEETING_CREATED",
        entityType: "MEETING",
        entityId: meeting.id,
        newValueJson: JSON.stringify({
          title,
          meetingDate,
        }),
      },
    });

    return NextResponse.json(
      {
        meeting,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error("POST /api/meetings failed", error);

    return NextResponse.json(
      {
        error: "Failed to create meeting.",
      },
      {
        status: 500,
      },
    );
  }
}
