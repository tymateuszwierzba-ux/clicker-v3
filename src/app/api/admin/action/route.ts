import { z } from "zod";
import { newRequestId, jsonError, jsonOk, parseBody, rateLimit, requireAdmin, writeAudit } from "@/lib/api";
import { getAdminSnapshot, runAdminAction } from "@/server/admin-service";

const schema = z.object({
  action: z.string().min(2).max(60),
  payload: z.record(z.string(), z.unknown()).optional().default({}),
  reason: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  const requestId = newRequestId();
  try {
    const actor = await requireAdmin("overview.read");
    rateLimit(`admin:${actor.user.id}`, 120, 60_000);
    const body = await parseBody(request, schema);
    const result = await runAdminAction(actor, {
      action: body.action,
      payload: body.payload,
      reason: body.reason,
      requestId,
    });
    const snapshot = await getAdminSnapshot(actor, { page: 1 });
    return jsonOk({ ok: true, ...result, snapshot, requestId });
  } catch (error) {
    try {
      const actor = await requireAdmin("overview.read");
      await writeAudit({
        adminId: actor.user.id,
        adminName: actor.player.username,
        action: "request.rejected",
        targetType: "request",
        reason: error instanceof Error ? error.message : "unknown",
        requestId,
        result: "error",
      });
    } catch {
      // unauthenticated requests are not audit-worthy
    }
    return jsonError(error);
  }
}

export const dynamic = "force-dynamic";
