import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_ROLES = new Set([
  "ADMIN",
  "TRADER",
  "ANALYST",
  "PM",
  "VIEWER",
  "COMPLIANCE",
]);

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

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

export async function GET() {
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

    const approvals = await prisma.registrationApproval.findMany({
      include: approvalInclude,
      orderBy: {
        approvedAt: "desc",
      },
    });

    return NextResponse.json({ approvals });
  } catch (error) {
    console.error("GET /api/admin/registration-approvals failed", error);

    return NextResponse.json(
      { error: "Failed to load registration approvals." },
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

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 },
      );
    }

    const body = await request.json();

    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    const role = String(body.role || "")
      .trim()
      .toUpperCase();

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Enter a valid email address." },
        { status: 400 },
      );
    }

    if (!VALID_ROLES.has(role)) {
      return NextResponse.json(
        { error: "Select a valid role." },
        { status: 400 },
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
      },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          error: "A registered user already has this email address.",
        },
        { status: 409 },
      );
    }

    const existingApproval = await prisma.registrationApproval.findUnique({
      where: {
        email,
      },
    });

    if (existingApproval?.status === "PENDING") {
      return NextResponse.json(
        {
          error: "This email address already has a pending approval.",
        },
        { status: 409 },
      );
    }

    if (existingApproval?.status === "REGISTERED") {
      return NextResponse.json(
        {
          error: "This email address has already completed registration.",
        },
        { status: 409 },
      );
    }

    const approval = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const savedApproval = existingApproval
          ? await tx.registrationApproval.update({
              where: {
                id: existingApproval.id,
              },
              data: {
                role,
                status: "PENDING",
                approvedById: user.id,
                approvedAt: new Date(),
                registeredAt: null,
                revokedAt: null,
                registeredUserId: null,
              },
              include: approvalInclude,
            })
          : await tx.registrationApproval.create({
              data: {
                email,
                role,
                status: "PENDING",
                approvedById: user.id,
              },
              include: approvalInclude,
            });

        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: "USER_ACCESS_APPROVED",
            entityType: "REGISTRATION_APPROVAL",
            entityId: savedApproval.id,
            previousValueJson: existingApproval
              ? JSON.stringify({
                  email: existingApproval.email,
                  role: existingApproval.role,
                  status: existingApproval.status,
                })
              : null,
            newValueJson: JSON.stringify({
              approvalId: savedApproval.id,
              email: savedApproval.email,
              role: savedApproval.role,
              status: savedApproval.status,
            }),
          },
        });

        return savedApproval;
      },
    );

    return NextResponse.json({ approval }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/registration-approvals failed", error);

    return NextResponse.json(
      { error: "Failed to approve registration access." },
      { status: 500 },
    );
  }
}
