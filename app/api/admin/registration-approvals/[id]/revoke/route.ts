import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const approvalInclude = {
  approvedBy: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
  registeredUser: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
} satisfies Prisma.RegistrationApprovalInclude;

export async function POST(_request: Request, context: RouteContext) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 },
      );
    }

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: "Registration approval ID is required." },
        { status: 400 },
      );
    }

    const approval = await prisma.registrationApproval.findUnique({
      where: {
        id,
      },
    });

    if (!approval) {
      return NextResponse.json(
        { error: "Registration approval not found." },
        { status: 404 },
      );
    }

    if (approval.status !== "PENDING") {
      return NextResponse.json(
        { error: "Only pending approvals can be revoked." },
        { status: 409 },
      );
    }

    const revokedApproval = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const currentApproval = await tx.registrationApproval.findUnique({
          where: {
            id,
          },
        });

        if (!currentApproval || currentApproval.status !== "PENDING") {
          throw new Error("APPROVAL_NOT_PENDING");
        }

        const updatedApproval = await tx.registrationApproval.update({
          where: {
            id,
          },
          data: {
            status: "REVOKED",
            revokedAt: new Date(),
          },
          include: approvalInclude,
        });

        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: "USER_INVITATION_REVOKED",
            entityType: "REGISTRATION_APPROVAL",
            entityId: updatedApproval.id,
            previousValueJson: JSON.stringify({
              approvalId: currentApproval.id,
              email: currentApproval.email,
              role: currentApproval.role,
              status: currentApproval.status,
            }),
            newValueJson: JSON.stringify({
              approvalId: updatedApproval.id,
              email: updatedApproval.email,
              role: updatedApproval.role,
              status: updatedApproval.status,
            }),
          },
        });

        return updatedApproval;
      },
    );

    return NextResponse.json({
      approval: revokedApproval,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "APPROVAL_NOT_PENDING") {
      return NextResponse.json(
        { error: "Only pending approvals can be revoked." },
        { status: 409 },
      );
    }

    console.error(
      "POST /api/admin/registration-approvals/[id]/revoke failed",
      error,
    );

    return NextResponse.json(
      { error: "Failed to revoke registration approval." },
      { status: 500 },
    );
  }
}
