import { randomBytes } from "crypto";
import bcrypt from "bcrypt";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    const password = String(body.password || "");

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 },
      );
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 },
      );
    }

    const token = randomBytes(32).toString("hex");

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.session.create({
      data: {
        token,
        userId: user.id,
        expiresAt,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: "USER_LOGIN",
        entityType: "USER",
        entityId: user.id,
        newValueJson: JSON.stringify({
          email: user.email,
          role: user.role,
        }),
      },
    });

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    console.error("POST /api/auth/login failed", error);

    return NextResponse.json({ error: "Failed to log in." }, { status: 500 });
  }
}
