import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
    request: NextRequest,
) {
    const game =
        request.nextUrl.searchParams.get(
            "game",
        );

    if (!game) {
        return NextResponse.json(
            {
                error:
                    "Game parameter is required",
            },
            {
                status: 400,
            },
        );
    }

    const record =
        await prisma.arcadeScore.findUnique({
            where: {
                game,
            },
        });

    return NextResponse.json({
        score:
            record?.bestScore ?? 0,
        holderName:
            record?.holderName ??
            "Nobody",
    });
}

export async function POST(
    request: NextRequest,
) {
    const user =
        await getCurrentUser();

    if (!user) {
        return NextResponse.json(
            {
                error: "Unauthorized",
            },
            {
                status: 401,
            },
        );
    }

    const body =
        await request.json();

    const game =
        body.game as string;

    const score =
        body.score as number;

    if (
        !game ||
        typeof score !== "number"
    ) {
        return NextResponse.json(
            {
                error:
                    "Invalid payload",
            },
            {
                status: 400,
            },
        );
    }

    const existing =
        await prisma.arcadeScore.findUnique({
            where: {
                game,
            },
        });

    if (
        !existing ||
        score > existing.bestScore
    ) {
        const updated =
            await prisma.arcadeScore.upsert({
                where: {
                    game,
                },

                update: {
                    bestScore: score,
                    holderName:
                        user.name ??
                        user.email,
                },

                create: {
                    game,
                    bestScore: score,
                    holderName:
                        user.name ??
                        user.email,
                },
            });

        return NextResponse.json({
            newRecord: true,
            score:
                updated.bestScore,
            holderName:
                updated.holderName,
        });
    }

    return NextResponse.json({
        newRecord: false,
        score:
            existing.bestScore,
        holderName:
            existing.holderName,
    });
}