import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const positions = await prisma.position.findMany({
      where: {
        status: "ACTIVE",
      },
      include: {
        security: true,
        trades: {
          orderBy: {
            dateTraded: "desc",
          },
        },
        comments: {
          where: {
            archivedAt: null,
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
          },
          orderBy: {
            createdAt: "desc",
          },
        },
        flags: {
          where: {
            status: "OPEN",
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
      orderBy: [
        {
          side: "asc",
        },
        {
          marketValue: "desc",
        },
      ],
    });

    return NextResponse.json({
      positions,
    });
  } catch (error) {
    console.error("GET /api/positions failed", error);

    return NextResponse.json(
      {
        error: "Failed to load positions.",
      },
      {
        status: 500,
      },
    );
  }
}
