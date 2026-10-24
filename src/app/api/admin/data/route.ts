import { z } from "zod";
import { jsonError, jsonOk, requireAdmin } from "@/lib/api";
import { getAdminSnapshot, getPlayerDetail } from "@/server/admin-service";

const querySchema = z.object({
  q: z.string().max(40).optional(),
  page: z.coerce.number().int().min(1).max(500).optional(),
  auditAction: z.string().max(60).optional(),
  playerId: z.string().uuid().optional(),
});

export async function GET(request: Request) {
  try {
    const actor = await requireAdmin("overview.read");
    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      q: url.searchParams.get("q") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
      auditAction: url.searchParams.get("auditAction") ?? undefined,
      playerId: url.searchParams.get("playerId") ?? undefined,
    });
    const filters = parsed.success ? parsed.data : {};
    const snapshot = await getAdminSnapshot(actor, {
      q: filters.q,
      page: filters.page,
      auditAction: filters.auditAction,
    });
    const detail = filters.playerId ? await getPlayerDetail(actor, filters.playerId) : null;
    return jsonOk({ ok: true, snapshot, detail });
  } catch (error) {
    return jsonError(error);
  }
}

export const dynamic = "force-dynamic";
