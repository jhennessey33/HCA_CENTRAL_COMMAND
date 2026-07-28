import bcrypt from "bcrypt";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const name = String(body.name || "").trim();
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    const password = String(body.password || "");
    const confirmPassword = String(body.confirmPassword || "");

    if (!name || !email || !password || !confirmPassword) {
      return NextResponse.json(
        {
          error:
            "Full name, email, password, and password confirmation are required.",
        },
        { status: 400 },
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Enter a valid email address." },
        { status: 400 },
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: "Passwords do not match." },
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
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
          error: "An account already exists for this email address.",
        },
        { status: 409 },
      );
    }

    const approval = await prisma.registrationApproval.findUnique({
      where: {
        email,
      },
    });

    if (!approval || approval.status !== "PENDING") {
      return NextResponse.json(
        {
          error: "Registration is not authorized for this email address.",
        },
        { status: 403 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const currentApproval = await tx.registrationApproval.findUnique({
          where: {
            id: approval.id,
          },
        });

        if (!currentApproval || currentApproval.status !== "PENDING") {
          throw new Error("REGISTRATION_APPROVAL_UNAVAILABLE");
        }

        const transactionExistingUser = await tx.user.findUnique({
          where: {
            email,
          },
          select: {
            id: true,
          },
        });

        if (transactionExistingUser) {
          throw new Error("USER_ALREADY_EXISTS");
        }

        const createdUser = await tx.user.create({
          data: {
            email,
            name,
            passwordHash,
            role: currentApproval.role,
          },
        });

        await tx.registrationApproval.update({
          where: {
            id: currentApproval.id,
          },
          data: {
            status: "REGISTERED",
            registeredAt: new Date(),
            revokedAt: null,
            registeredUserId: createdUser.id,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: createdUser.id,
            action: "USER_REGISTERED",
            entityType: "USER",
            entityId: createdUser.id,
            newValueJson: JSON.stringify({
              approvalId: currentApproval.id,
              email: createdUser.email,
              name: createdUser.name,
              role: createdUser.role,
              registrationMethod: "DATABASE_APPROVED_EMAIL_SELF_REGISTRATION",
            }),
          },
        });

        return createdUser;
      },
    );

    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "REGISTRATION_APPROVAL_UNAVAILABLE"
    ) {
      return NextResponse.json(
        {
          error: "This registration approval is no longer available.",
        },
        { status: 409 },
      );
    }

    if (error instanceof Error && error.message === "USER_ALREADY_EXISTS") {
      return NextResponse.json(
        {
          error: "An account already exists for this email address.",
        },
        { status: 409 },
      );
    }

    console.error("POST /api/auth/register failed", error);

    return NextResponse.json(
      { error: "Failed to register account." },
      { status: 500 },
    );
  }
}
