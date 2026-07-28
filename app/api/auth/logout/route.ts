import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const token = request.headers
      .get("cookie")
      ?.split(";")
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith(`${SESSION_COOKIE_NAME}=`))
      ?.split("=")[1];

    if (token) {
      await prisma.session.deleteMany({
        where: {
          token,
        },
      });
    }

    const response = NextResponse.json({ ok: true });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: "",
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error("POST /api/auth/logout failed", error);

    return NextResponse.json({ error: "Failed to log out." }, { status: 500 });
  }
}
