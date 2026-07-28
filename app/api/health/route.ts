import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    await prisma.user.count();

    return NextResponse.json({
      ok: true,
      app: "HCA Central Command",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("GET /api/health failed", error);

    return NextResponse.json(
      {
        ok: false,
        app: "HCA Central Command",
        database: "error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
