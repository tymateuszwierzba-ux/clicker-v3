import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { SESSION_COOKIE, createSession, isBanActive, sessionCookieOptions, verifyPassword } from "@/lib/auth";
import { ApiError, jsonError, parseBody, rateLimit } from "@/lib/api";

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(160),
  password: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    rateLimit(`login:${ip}`, 12, 60_000);
    const body = await parseBody(request, schema);
    const rows = await db.select().from(users).where(eq(users.email, body.email)).limit(1);
    const user = rows[0];
    if (!user || !verifyPassword(body.password, user.passwordHash)) {
      throw new ApiError("Email or password is incorrect.", 401, "invalid_credentials");
    }
    if (isBanActive(user)) {
      throw new ApiError(user.banReason ? `Account suspended: ${user.banReason}` : "Account suspended.", 403, "banned");
    }
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
    const token = await createSession(user.id, request.headers.get("user-agent"));
    const role = user.role;
    const response = NextResponse.json({ ok: true, redirect: ["owner", "super_admin", "admin", "moderator", "support"].includes(role) ? "/admin" : "/play", role });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  } catch (error) {
    return jsonError(error);
  }
}

export const dynamic = "force-dynamic";
