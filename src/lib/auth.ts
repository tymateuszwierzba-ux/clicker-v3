import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { players, sessions, users } from "@/db/schema";
import type { AdminRole } from "@/lib/content";
import { PERMISSIONS } from "@/lib/content";

export const SESSION_COOKIE = "obsidia_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$2$${salt}$${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const parts = stored.split("$");
    if (parts.length !== 4) return false;
    const [, , salt, digest] = parts;
    const derived = scryptSync(password, salt, 64);
    const expected = Buffer.from(digest, "hex");
    if (expected.length !== derived.length) return false;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export interface AuthContext {
  user: {
    id: string;
    email: string;
    role: AdminRole;
    isBanned: boolean;
    bannedUntil: Date | null;
    banReason: string | null;
    createdAt: Date;
  };
  player: {
    id: string;
    username: string;
    avatarColor: string;
    title: string;
  };
  sessionId: string;
}

export async function createSession(userId: string, userAgent?: string | null): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({ userId, tokenHash: hashToken(token), expiresAt, userAgent: userAgent?.slice(0, 250) ?? null });
  return token;
}

export function sessionCookieOptions(expiresAt?: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt ?? new Date(Date.now() + SESSION_TTL_MS),
  };
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({
      sessionId: sessions.id,
      userId: users.id,
      email: users.email,
      role: users.role,
      isBanned: users.isBanned,
      bannedUntil: users.bannedUntil,
      banReason: users.banReason,
      userCreatedAt: users.createdAt,
      playerId: players.id,
      username: players.username,
      avatarColor: players.avatarColor,
      title: players.title,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .innerJoin(players, eq(players.userId, users.id))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  return {
    user: {
      id: row.userId,
      email: row.email,
      role: (row.role as AdminRole) ?? "player",
      isBanned: row.isBanned,
      bannedUntil: row.bannedUntil,
      banReason: row.banReason,
      createdAt: row.userCreatedAt,
    },
    player: { id: row.playerId, username: row.username, avatarColor: row.avatarColor, title: row.title },
    sessionId: row.sessionId,
  };
}

export async function destroyCurrentSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  }
  store.delete(SESSION_COOKIE);
}

export function hasPermission(role: AdminRole | string, permission: string): boolean {
  const perms = PERMISSIONS[role as AdminRole] ?? [];
  return perms.includes("*") || perms.includes(permission);
}

export function isStaff(role: AdminRole | string): boolean {
  return ["owner", "super_admin", "admin", "moderator", "support"].includes(role);
}

export function isBanActive(user: { isBanned: boolean; bannedUntil: Date | null }): boolean {
  if (!user.isBanned) return false;
  if (!user.bannedUntil) return true;
  return user.bannedUntil.getTime() > Date.now();
}
