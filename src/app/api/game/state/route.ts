import { z } from "zod";
import { getAuthContext } from "@/lib/auth";
import { ApiError, jsonError, jsonOk, requireAuth } from "@/lib/api";
import { getGameState } from "@/server/game-service";
import { getEconomyConfig } from "@/server/config-service";

export async function GET() {
  try {
    const ctx = await getAuthContext();
    if (!ctx) {
      const { config, version } = await getEconomyConfig();
      return jsonOk({ authenticated: false, configVersion: version, maintenance: config.maintenanceMode });
    }
    const state = await getGameState(await requireAuth());
    return jsonOk({ authenticated: true, state });
  } catch (error) {
    return jsonError(error);
  }
}

const schema = z.object({
  type: z.enum(["refresh"]),
});

export async function POST(request: Request) {
  try {
    const ctx = await requireAuth();
    const parsed = schema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throw new ApiError("Unknown refresh request.", 422, "validation_failed");
    return jsonOk({ authenticated: true, state: await getGameState(ctx) });
  } catch (error) {
    return jsonError(error);
  }
}

export const dynamic = "force-dynamic";
