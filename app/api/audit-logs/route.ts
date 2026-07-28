import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canViewAuditLogs } from "@/lib/permissions";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    if (!canViewAuditLogs(user.role)) {
      return NextResponse.json(
        { error: "You do not have permission to view audit logs." },
        { status: 403 },
      );
    }

    const logs = await prisma.auditLog.findMany({
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 500,
    });

    return NextResponse.json({ logs });
  } catch (error) {
    console.error("GET /api/audit-logs failed", error);

    return NextResponse.json(
      { error: "Failed to load audit logs." },
      { status: 500 },
    );
  }
}
