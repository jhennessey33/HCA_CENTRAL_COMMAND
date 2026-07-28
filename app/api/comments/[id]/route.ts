import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

function canDeleteComment(user: any, comment: any) {
  if (!user) return false;

  if (user.id === comment.authorId) {
    return true;
  }

  return user.role === "ADMIN" || user.role === "COMPLIANCE";
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    const existingComment = await prisma.comment.findUnique({
      where: {
        id,
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
        security: {
          select: {
            id: true,
            ticker: true,
            name: true,
          },
        },
      },
    });

    if (!existingComment || existingComment.archivedAt) {
      return NextResponse.json(
        { error: "Comment not found." },
        { status: 404 },
      );
    }

    if (!canDeleteComment(user, existingComment)) {
      return NextResponse.json(
        { error: "You do not have permission to delete this comment." },
        { status: 403 },
      );
    }

    const deletedComment = await prisma.comment.update({
      where: {
        id,
      },
      data: {
        archivedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: "COMMENT_DELETED",
        entityType: "COMMENT",
        entityId: existingComment.id,
        previousValueJson: JSON.stringify({
          id: existingComment.id,
          securityId: existingComment.securityId,
          positionId: existingComment.positionId,
          watchlistEntryId: existingComment.watchlistEntryId,
          authorId: existingComment.authorId,
          tag: existingComment.tag,
          content: existingComment.content,
          createdAt: existingComment.createdAt,
        }),
        newValueJson: JSON.stringify({
          id: deletedComment.id,
          archivedAt: deletedComment.archivedAt,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      id,
    });
  } catch (error) {
    console.error("DELETE /api/comments/[id] failed", error);

    return NextResponse.json(
      {
        error: "Failed to delete comment.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
