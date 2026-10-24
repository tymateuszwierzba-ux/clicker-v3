import { z } from "zod";
import { jsonError, jsonOk, parseBody, rateLimit, requireAuth } from "@/lib/api";
import { isStaff } from "@/lib/auth";
import { getEconomyConfig } from "@/server/config-service";
import {
  buyShopItem,
  buyUpgrade,
  claimDaily,
  claimEventReward,
  claimQuest,
  deepReset,
  equipBest,
  getGameState,
  hatchEgg,
  petAction,
  redeemCode,
  selectWorld,
  syncClicks,
  updateProfile,
} from "@/server/game-service";

const schema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("sync"), clicks: z.number().int().min(0).max(2000), combo: z.number().int().min(0).max(2000) }),
  z.object({ type: z.literal("refresh") }),
  z.object({ type: z.literal("upgrade"), upgradeId: z.string().min(1).max(40), quantity: z.union([z.literal(1), z.literal(10), z.literal(-1)]) }),
  z.object({ type: z.literal("hatch"), eggId: z.string().min(1).max(40), count: z.union([z.literal(1), z.literal(3), z.literal(10)]) }),
  z.object({
    type: z.literal("pet"),
    action: z.enum(["equip", "unequip", "favorite", "fuse", "release"]),
    rowIds: z.array(z.string().uuid()).min(1).max(10),
  }),
  z.object({ type: z.literal("equipBest") }),
  z.object({ type: z.literal("world"), worldId: z.string().min(1).max(40) }),
  z.object({ type: z.literal("quest"), questId: z.string().min(1).max(60) }),
  z.object({ type: z.literal("daily") }),
  z.object({ type: z.literal("code"), code: z.string().min(3).max(32) }),
  z.object({ type: z.literal("shop"), itemId: z.string().min(1).max(40) }),
  z.object({ type: z.literal("rebirth"), tier: z.enum(["rebirth", "prestige", "ascension"]) }),
  z.object({ type: z.literal("claimEvent"), eventId: z.string().uuid() }),
  z.object({
    type: z.literal("profile"),
    avatarColor: z.string().max(20).optional(),
    title: z.string().max(40).optional(),
    muted: z.boolean().optional(),
    compactMode: z.boolean().optional(),
  }),
]);

export async function POST(request: Request) {
  try {
    const ctx = await requireAuth();
    rateLimit(`action:${ctx.player.id}`, 240, 60_000);
    const body = await parseBody(request, schema);
    const { config } = await getEconomyConfig();

    if (config.maintenanceMode && !isStaff(ctx.user.role) && body.type !== "refresh" && body.type !== "sync") {
      return jsonError(new Error("The forge is in maintenance. Actions are paused."));
    }

    switch (body.type) {
      case "refresh": {
        return jsonOk({ ok: true, state: await getGameState(ctx), notices: [], result: {} });
      }
      case "sync": {
        const out = await syncClicks(ctx, { clicks: body.clicks, combo: body.combo });
        return jsonOk({ ok: true, ...out });
      }
      case "upgrade": {
        const out = await buyUpgrade(ctx, body.upgradeId, body.quantity);
        return jsonOk({ ok: true, ...out });
      }
      case "hatch": {
        const out = await hatchEgg(ctx, body.eggId, body.count);
        return jsonOk({ ok: true, ...out });
      }
      case "pet": {
        const out = await petAction(ctx, { action: body.action, rowIds: body.rowIds });
        return jsonOk({ ok: true, ...out });
      }
      case "equipBest": {
        const out = await equipBest(ctx);
        return jsonOk({ ok: true, state: out.state, notices: out.notices, result: {} });
      }
      case "world": {
        const out = await selectWorld(ctx, body.worldId);
        return jsonOk({ ok: true, state: out.state, notices: out.notices, result: {} });
      }
      case "quest": {
        const out = await claimQuest(ctx, body.questId);
        return jsonOk({ ok: true, state: out.state, notices: out.notices, result: {} });
      }
      case "daily": {
        const out = await claimDaily(ctx);
        return jsonOk({ ok: true, state: out.state, notices: out.notices, result: {} });
      }
      case "code": {
        const out = await redeemCode(ctx, body.code);
        return jsonOk({ ok: true, state: out.state, notices: out.notices, result: {} });
      }
      case "shop": {
        const out = await buyShopItem(ctx, body.itemId);
        return jsonOk({ ok: true, state: out.state, notices: out.notices, result: {} });
      }
      case "rebirth": {
        const out = await deepReset(ctx, body.tier);
        return jsonOk({ ok: true, ...out });
      }
      case "claimEvent": {
        const out = await claimEventReward(ctx, body.eventId);
        return jsonOk({ ok: true, state: out.state, notices: out.notices, result: {} });
      }
      case "profile": {
        const out = await updateProfile(ctx, {
          avatarColor: body.avatarColor,
          title: body.title,
          muted: body.muted,
          compactMode: body.compactMode,
        });
        return jsonOk({ ok: true, state: out.state, notices: out.notices, result: {} });
      }
      default:
        return jsonError(new Error("Unknown action"));
    }
  } catch (error) {
    return jsonError(error);
  }
}

export const dynamic = "force-dynamic";
