import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    return NextResponse.json({
      status: "ok",
      service: "obsidia",
      database: "connected",
      latencyMs: Date.now() - started,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[health] database check failed", error);
    return NextResponse.json(
      {
        status: "degraded",
        service: "obsidia",
        database: "unavailable",
        latencyMs: Date.now() - started,
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
