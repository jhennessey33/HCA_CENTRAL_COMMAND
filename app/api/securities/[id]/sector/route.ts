import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  const { id } = await context.params;

  const body = await request.json();

  if (!body.sector?.trim()) {
    return NextResponse.json(
      {
        error: "Sector is required.",
      },
      {
        status: 400,
      },
    );
  }

  const security = await prisma.security.update({
    where: {
      id,
    },
    data: {
      sector: body.sector.trim(),
    },
  });

  return NextResponse.json({
    security,
  });
}
