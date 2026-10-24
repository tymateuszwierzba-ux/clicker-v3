import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { type AuthContext, getAuthContext, hasPermission, isBanActive } from "@/lib/auth";

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 400, code = "bad_request") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function jsonOk(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function jsonError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  console.error("[api] unhandled", error);
  return NextResponse.json({ error: "Something went wrong on the forge floor. Try again.", code: "server_error" }, { status: 500 });
}

export async function requireAuth(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) throw new ApiError("Sign in to continue.", 401, "unauthenticated");
  if (isBanActive(ctx.user)) {
    throw new ApiError(ctx.user.banReason ? `Account suspended: ${ctx.user.banReason}` : "Account suspended.", 403, "banned");
  }
  return ctx;
}

export async function requireAdmin(permission: string): Promise<AuthContext> {
  const ctx = await requireAuth();
  if (!hasPermission(ctx.user.role, permission)) {
    throw new ApiError("You do not have permission for this operation.", 403, "forbidden");
  }
  return ctx;
}

const globalLimiter = globalThis as typeof globalThis & {
  __obsidiaLimits?: Map<string, { count: number; resetAt: number }>;
};
const limits = (globalLimiter.__obsidiaLimits ??= new Map());

export function rateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  const record = limits.get(key);
  if (!record || record.resetAt < now) {
    limits.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  record.count += 1;
  if (record.count > limit) {
    throw new ApiError("Too many requests. Slow down for a moment.", 429, "rate_limited");
  }
  if (limits.size > 5000) {
    for (const [k, v] of limits) if (v.resetAt < now) limits.delete(k);
  }
}

export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    throw new ApiError("Invalid JSON body.", 400, "invalid_json");
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ApiError(issue ? `${issue.path.join(".") || "input"}: ${issue.message}` : "Invalid request.", 422, "validation_failed");
  }
  return parsed.data;
}

export const newRequestId = () => randomUUID();

export async function writeAudit(input: {
  adminId: string | null;
  adminName: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  reason?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  requestId?: string;
  result?: string;
  meta?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      adminId: input.adminId,
      adminName: input.adminName,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      reason: input.reason ?? "",
      before: input.before ?? null,
      after: input.after ?? null,
      requestId: input.requestId ?? newRequestId(),
      result: input.result ?? "ok",
      meta: input.meta ?? null,
    });
  } catch (error) {
    console.error("[audit] failed to persist entry", error);
  }
}
