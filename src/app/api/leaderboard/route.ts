import { z } from "zod";
import { getAuthContext } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api";
import { getLeaderboard } from "@/server/game-service";

const querySchema = z.object({
  metric: z.string().max(30).optional(),
  page: z.coerce.number().int().min(1).max(1000).optional(),
  q: z.string().max(32).optional(),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      metric: url.searchParams.get("metric") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
      q: url.searchParams.get("q") ?? undefined,
    });
    const filters = parsed.success ? parsed.data : { metric: undefined, page: 1, q: undefined };
    const ctx = await getAuthContext();
    const payload = await getLeaderboard({
      metric: filters.metric ?? "earned",
      page: filters.page ?? 1,
      search: filters.q,
      viewerId: ctx?.player.id,
    });
    return jsonOk(payload);
  } catch (error) {
    return jsonError(error);
  }
}

export const dynamic = "force-dynamic";
