import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { players, users } from "@/db/schema";
import { SESSION_COOKIE, createSession, hashPassword, sessionCookieOptions } from "@/lib/auth";
import { ApiError, jsonError, rateLimit } from "@/lib/api";

function randomName() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let suffix = "";
  for (let i = 0; i < 6; i += 1) suffix += Math.floor(Math.random() * 10).toString();
  return `Initiate_${letters[Math.floor(Math.random() * letters.length)]}${suffix}`;
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    rateLimit(`guest:${ip}`, 6, 60 * 60_000);

    const email = `guest+${randomBytes(8).toString("hex")}@obsidia.local`;
    let username = randomName();
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const rows = await db.select({ id: players.id }).from(players).where(eq(players.username, username)).limit(1);
      if (!rows.length) break;
      username = randomName();
    }
    const totalUsers = await db.select({ value: count() }).from(users);
    const role = Number(totalUsers[0]?.value ?? 0) === 0 ? "owner" : "player";
    const created = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(users)
        .values({ email, passwordHash: hashPassword(randomBytes(24).toString("hex")), role })
        .returning();
      const user = inserted[0];
      if (!user) throw new ApiError("Could not create guest account.", 500, "guest_failed");
      await tx.insert(players).values({ userId: user.id, username, avatarColor: "ember" });
      return user;
    });
    const token = await createSession(created.id, request.headers.get("user-agent"));
    const response = NextResponse.json({ ok: true, redirect: "/play", guest: true, username });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  } catch (error) {
    return jsonError(error);
  }
}

export const dynamic = "force-dynamic";
