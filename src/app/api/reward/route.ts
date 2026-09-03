import { NextResponse } from "next/server";

import { prisma } from "@/shared/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user");

    if (!userId) {
      return NextResponse.json({ success: false, error: "Missing user" }, { status: 400 });
    }

    const telegramId = BigInt(userId);

    await prisma.user.updateMany({
      where: { telegramId },
      data: {
        adBalance: {
          increment: 1,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api/reward] Failed to process reward", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
