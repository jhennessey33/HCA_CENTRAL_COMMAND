import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canCreateFlags } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const resolvedFlagInclude = {
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

export async function POST(_request: Request, context: RouteContext) {
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
          error: "You do not have permission to resolve flags.",
        },
        { status: 403 },
      );
    }

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: "Flag ID is required." },
        { status: 400 },
      );
    }

    const existingFlag = await prisma.flag.findUnique({
      where: {
        id,
      },
      include: {
        security: {
          select: {
            id: true,
            ticker: true,
          },
        },
      },
    });

    if (!existingFlag) {
      return NextResponse.json({ error: "Flag not found." }, { status: 404 });
    }

    if (existingFlag.status === "RESOLVED") {
      return NextResponse.json(
        { error: "Flag is already resolved." },
        { status: 409 },
      );
    }

    if (existingFlag.status !== "OPEN") {
      return NextResponse.json(
        {
          error: `Only OPEN flags can be resolved. Current status: ${existingFlag.status}.`,
        },
        { status: 409 },
      );
    }

    const resolvedAt = new Date();

    const resolvedFlag = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const currentFlag = await tx.flag.findUnique({
          where: {
            id,
          },
          include: {
            security: {
              select: {
                id: true,
                ticker: true,
              },
            },
          },
        });

        if (!currentFlag) {
          throw new Error("FLAG_NOT_FOUND");
        }

        if (currentFlag.status !== "OPEN") {
          throw new Error("FLAG_NOT_OPEN");
        }

        const updatedFlag = await tx.flag.update({
          where: {
            id,
          },
          data: {
            status: "RESOLVED",
            resolvedById: user.id,
            resolvedAt,
          },
          include: resolvedFlagInclude,
        });

        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: "FLAG_RESOLVED",
            entityType: "FLAG",
            entityId: updatedFlag.id,
            previousValueJson: JSON.stringify({
              status: currentFlag.status,
              resolvedById: currentFlag.resolvedById,
              resolvedAt: currentFlag.resolvedAt,
              flagType: currentFlag.flagType,
              priority: currentFlag.priority,
              reminderAt: currentFlag.reminderAt,
              securityId: currentFlag.securityId,
              securityContext: currentFlag.security?.ticker || "General",
              positionId: currentFlag.positionId,
              watchlistEntryId: currentFlag.watchlistEntryId,
            }),
            newValueJson: JSON.stringify({
              status: updatedFlag.status,
              resolvedById: updatedFlag.resolvedById,
              resolvedAt: updatedFlag.resolvedAt,
              flagType: updatedFlag.flagType,
              priority: updatedFlag.priority,
              reminderAt: updatedFlag.reminderAt,
              securityId: updatedFlag.securityId,
              securityContext: updatedFlag.security?.ticker || "General",
              positionId: updatedFlag.positionId,
              watchlistEntryId: updatedFlag.watchlistEntryId,
            }),
          },
        });

        return updatedFlag;
      },
    );

    return NextResponse.json({
      flag: resolvedFlag,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "FLAG_NOT_FOUND") {
      return NextResponse.json({ error: "Flag not found." }, { status: 404 });
    }

    if (error instanceof Error && error.message === "FLAG_NOT_OPEN") {
      return NextResponse.json(
        {
          error: "The flag is no longer open and cannot be resolved.",
        },
        { status: 409 },
      );
    }

    console.error("POST /api/flags/[id]/resolve failed", error);

    return NextResponse.json(
      { error: "Failed to resolve flag." },
      { status: 500 },
    );
  }
}
