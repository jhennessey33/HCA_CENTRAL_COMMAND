import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canCreateComments } from "@/lib/permissions";

const VALID_TAGS = [
  "COMMENT",
  "NOTE",
  "THESIS",
  "RISK",
  "CATALYST",
  "TRADE",
  "EXIT",
  "PT",
];

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      securityId,
      positionId,
      watchlistEntryId,
      tag,
      meetingId,
      content,
    } = body;

    if (!content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json(
        { error: "Comment content is required." },
        { status: 400 },
      );
    }

    if (!tag || !VALID_TAGS.includes(tag)) {
      return NextResponse.json(
        { error: "Valid comment tag is required." },
        { status: 400 },
      );
    }

    const author = await getCurrentUser();
    if (!author) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    if (!canCreateComments(author.role)) {
      return NextResponse.json(
        { error: "You do not have permission to create comments." },
        { status: 403 },
      );
    }

    const comment = await prisma.comment.create({
      data: {
        securityId: securityId || null,
        positionId: positionId || null,
        watchlistEntryId: watchlistEntryId || null,
        meetingId: meetingId || null,
        authorId: author.id,
        tag,
        content: content.trim(),
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
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: author.id,
        action: "COMMENT_CREATED",
        entityType: "COMMENT",
        entityId: comment.id,
        newValueJson: JSON.stringify({
          securityId: securityId || null,
          positionId: positionId || null,
          watchlistEntryId: watchlistEntryId || null,
          meetingId: meetingId || null,
          tag,
          content: content.trim(),
        }),
      },
    });
    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    console.error("POST /api/comments failed", error);

    return NextResponse.json(
      { error: "Failed to create comment." },
      { status: 500 },
    );
  }
}
