import { NextResponse } from "next/server";
import { z } from "zod";
import { and, count, eq, like } from "drizzle-orm";
import { db } from "@/db";
import { players, users } from "@/db/schema";
import { SESSION_COOKIE, createSession, getAuthContext, hashPassword, sessionCookieOptions } from "@/lib/auth";
import { ApiError, jsonError, parseBody, rateLimit } from "@/lib/api";
import { createPlayerProfile } from "@/server/game-service";

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(160),
  password: z.string().min(8, "Use at least 8 characters").max(200),
  username: z
    .string()
    .trim()
    .min(3, "At least 3 characters")
    .max(16, "At most 16 characters")
    .regex(/^[A-Za-z0-9_]+$/, "Letters, numbers and underscore only"),
  avatarColor: z.string().max(20).optional(),
});

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    rateLimit(`register:${ip}`, 8, 60_000);
    const body = await parseBody(request, schema);

    const existingPlayer = await db.select({ id: players.id }).from(players).where(eq(players.username, body.username)).limit(1);
    if (existingPlayer.length) throw new ApiError("That callsign is already in the forge records.", 409, "username_taken");

    const current = await getAuthContext();
    const isGuestUpgrade = current && current.user.email.startsWith("guest+") && current.user.role === "player";

    if (isGuestUpgrade && current) {
      const emailTaken = await db.select({ id: users.id }).from(users).where(eq(users.email, body.email)).limit(1);
      if (emailTaken.length) throw new ApiError("That email already has an account.", 409, "email_taken");
      await db.transaction(async (tx) => {
        await tx.update(users).set({ email: body.email, passwordHash: hashPassword(body.password) }).where(eq(users.id, current.user.id));
        await tx
          .update(players)
          .set({ username: body.username, avatarColor: body.avatarColor ?? current.player.avatarColor })
          .where(eq(players.userId, current.user.id));
      });
      return NextResponse.json({ ok: true, upgraded: true, redirect: "/play" });
    }

    const emailTaken = await db.select({ id: users.id }).from(users).where(eq(users.email, body.email)).limit(1);
    if (emailTaken.length) throw new ApiError("That email already has an account. Sign in instead.", 409, "email_taken");

    const totalUsers = await db.select({ value: count() }).from(users);
    const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
    const isFirst = Number(totalUsers[0]?.value ?? 0) === 0;
    const role = isFirst || (ownerEmail && ownerEmail === body.email) ? "owner" : "player";

    const created = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(users)
        .values({ email: body.email, passwordHash: hashPassword(body.password), role })
        .returning();
      const user = inserted[0];
      await tx.insert(players).values({
        userId: user.id,
        username: body.username,
        avatarColor: body.avatarColor ?? "ember",
      });
      return user;
    });

    const token = await createSession(created.id, request.headers.get("user-agent"));
    const response = NextResponse.json({ ok: true, redirect: "/play", role: created.role });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  } catch (error) {
    return jsonError(error);
  }
}

export async function GET() {
  try {
    const guests = await db.select({ value: count() }).from(users).where(and(like(users.email, "guest+%")));
    return NextResponse.json({ guestAccounts: Number(guests[0]?.value ?? 0) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT() {
  return jsonError(new ApiError("Method not supported.", 405, "method_not_allowed"));
}

export async function DELETE() {
  return jsonError(new ApiError("Method not supported.", 405, "method_not_allowed"));
}

export async function PATCH() {
  return jsonError(new ApiError("Method not supported.", 405, "method_not_allowed"));
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { Allow: "GET,POST" } });
}

export const dynamic = "force-dynamic";

// Referenced to keep strict unused checks happy while documenting the helper contract.
void createPlayerProfile;
