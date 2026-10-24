import { z } from "zod";
import { jsonError, jsonOk, newRequestId, parseBody, rateLimit, requireAdmin } from "@/lib/api";
import { getAdminSnapshot, runCommand } from "@/server/admin-service";

const schema = z.object({ command: z.string().min(2).max(400) });

export async function POST(request: Request) {
  try {
    const actor = await requireAdmin("overview.read");
    rateLimit(`admincmd:${actor.user.id}`, 60, 60_000);
    const body = await parseBody(request, schema);
    const out = await runCommand(actor, body.command);
    const snapshot = await getAdminSnapshot(actor, { page: 1 });
    return jsonOk({ ok: true, message: out.message, detail: "detail" in out ? out.detail : null, snapshot, requestId: newRequestId() });
  } catch (error) {
    return jsonError(error);
  }
}

export const dynamic = "force-dynamic";
