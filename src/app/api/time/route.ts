import { NextResponse } from "next/server";

export async function GET() {
  const serverTimeMs = Date.now();

  return NextResponse.json({
    serverTime: Math.floor(serverTimeMs / 1000),
    serverTimeMs,
  });
}
