import { jsonError, requireAdmin } from "@/lib/api";
import { exportAuditCsv } from "@/server/admin-service";

export async function GET() {
  try {
    const actor = await requireAdmin("audit.read");
    const csv = await exportAuditCsv(actor);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="obsidia-audit-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}

export const dynamic = "force-dynamic";
