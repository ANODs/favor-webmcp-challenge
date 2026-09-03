import { NextResponse } from "next/server";

import { processDealDeadlines } from "@/app/_server/process-deal-deadlines";
import { prisma } from "@/shared/lib/prisma";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const processed = await processDealDeadlines({ database: prisma });
    return NextResponse.json({ success: true, processed });
  } catch (error) {
    console.error("[deal-deadlines] API processing cycle failed", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
