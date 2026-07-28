import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canCreateFlags } from "@/lib/permissions";
import { acceptWellsTradeForFlag } from "@/lib/reconciliation/trade-reconciliation-service";

export async function POST(
  request: Request,
  context: { params: Promise<{ flagId: string }> },
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    if (!canCreateFlags(user.role)) {
      return NextResponse.json(
        { error: "You do not have permission to resolve trade reviews." },
        { status: 403 },
      );
    }

    const { flagId } = await context.params;

    const result = await acceptWellsTradeForFlag({
      flagId,
      userId: user.id,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("accept-wells failed", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to accept Wells trade.",
      },
      { status: 500 },
    );
  }
}
