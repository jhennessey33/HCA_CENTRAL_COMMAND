import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

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

function canManageComment(user: any, comment: any) {
  if (!user) return false;

  if (user.id === comment.authorId) {
    return true;
  }

  return user.role === "ADMIN" || user.role === "COMPLIANCE";
}

const commentInclude = {
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
};

export async function PATCH(
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
      where: { id },
      include: commentInclude,
    });

    if (!existingComment || existingComment.archivedAt) {
      return NextResponse.json(
        { error: "Comment not found." },
        { status: 404 },
      );
    }

    if (!canManageComment(user, existingComment)) {
      return NextResponse.json(
        { error: "You do not have permission to edit this comment." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { content, tag, securityId } = body;

    if (typeof content !== "string" || !content.trim()) {
      return NextResponse.json(
        { error: "Comment content is required." },
        { status: 400 },
      );
    }

    if (typeof tag !== "string" || !VALID_TAGS.includes(tag)) {
      return NextResponse.json(
        { error: "Valid comment tag is required." },
        { status: 400 },
      );
    }

    if (
      securityId !== null &&
      securityId !== undefined &&
      typeof securityId !== "string"
    ) {
      return NextResponse.json(
        { error: "Security ID must be a string or null." },
        { status: 400 },
      );
    }

    const normalizedSecurityId =
      typeof securityId === "string" && securityId.trim()
        ? securityId.trim()
        : null;

    if (normalizedSecurityId) {
      const securityExists = await prisma.security.findUnique({
        where: { id: normalizedSecurityId },
        select: { id: true },
      });

      if (!securityExists) {
        return NextResponse.json(
          { error: "Selected security was not found." },
          { status: 400 },
        );
      }
    }

    const normalizedContent = content.trim();

    const hasChanges =
      normalizedContent !== existingComment.content ||
      tag !== existingComment.tag ||
      normalizedSecurityId !== existingComment.securityId;

    if (!hasChanges) {
      return NextResponse.json(
        { error: "No changes were made to the comment." },
        { status: 400 },
      );
    }

    const updatedComment = await prisma.$transaction(async (transaction) => {
      const comment = await transaction.comment.update({
        where: { id },
        data: {
          content: normalizedContent,
          tag,
          securityId: normalizedSecurityId,
        },
        include: commentInclude,
      });

      await transaction.auditLog.create({
        data: {
          actorId: user.id,
          action: "COMMENT_UPDATED",
          entityType: "COMMENT",
          entityId: existingComment.id,
          previousValueJson: JSON.stringify({
            id: existingComment.id,
            securityId: existingComment.securityId,
            positionId: existingComment.positionId,
            watchlistEntryId: existingComment.watchlistEntryId,
            meetingId: existingComment.meetingId,
            authorId: existingComment.authorId,
            tag: existingComment.tag,
            content: existingComment.content,
            createdAt: existingComment.createdAt,
            updatedAt: existingComment.updatedAt,
          }),
          newValueJson: JSON.stringify({
            id: comment.id,
            securityId: comment.securityId,
            positionId: comment.positionId,
            watchlistEntryId: comment.watchlistEntryId,
            meetingId: comment.meetingId,
            authorId: comment.authorId,
            tag: comment.tag,
            content: comment.content,
            createdAt: comment.createdAt,
            updatedAt: comment.updatedAt,
          }),
        },
      });

      return comment;
    });

    return NextResponse.json({ comment: updatedComment });
  } catch (error) {
    console.error("PATCH /api/comments/[id] failed", error);

    return NextResponse.json(
      {
        error: "Failed to update comment.",
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
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    const existingComment = await prisma.comment.findUnique({
      where: { id },
      include: commentInclude,
    });

    if (!existingComment || existingComment.archivedAt) {
      return NextResponse.json(
        { error: "Comment not found." },
        { status: 404 },
      );
    }

    if (!canManageComment(user, existingComment)) {
      return NextResponse.json(
        { error: "You do not have permission to delete this comment." },
        { status: 403 },
      );
    }

    const deletedComment = await prisma.$transaction(async (transaction) => {
      const comment = await transaction.comment.update({
        where: { id },
        data: {
          archivedAt: new Date(),
        },
      });

      await transaction.auditLog.create({
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
            meetingId: existingComment.meetingId,
            authorId: existingComment.authorId,
            tag: existingComment.tag,
            content: existingComment.content,
            createdAt: existingComment.createdAt,
            updatedAt: existingComment.updatedAt,
            archivedAt: existingComment.archivedAt,
          }),
          newValueJson: JSON.stringify({
            id: comment.id,
            archivedAt: comment.archivedAt,
          }),
        },
      });

      return comment;
    });

    return NextResponse.json({
      success: true,
      id: deletedComment.id,
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
