import { and, desc, eq, gt, inArray, lte, sql, count } from "drizzle-orm";
import { randomInt } from "node:crypto";
import { db } from "@/db";
import {
  announcements,
  codeRedemptions,
  eventParticipation,
  gameEvents,
  petInventory,
  playerAchievements,
  playerPurchases,
  playerQuests,
  players,
  redeemCodes,
  upgradeStates,
} from "@/db/schema";
import type { AuthContext } from "@/lib/auth";
import {
  ACHIEVEMENTS,
  AVATAR_COLORS,
  DAILY_REWARDS,
  EGGS,
  PETS,
  QUESTS,
  SHOP_ITEMS,
  TITLES,
  UPGRADES,
  WORLDS,
  eggById,
  petById,
  rarityById,
  type AchievementDef,
  type EggEntry,
  type QuestDef,
  type QuestMetric,
  type World,
} from "@/lib/content";
import {
  bulkUpgradeCost,
  canClaimDaily,
  clampValue,
  comboMultiplier,
  dailyStreakAfter,
  deriveStats,
  formatMultiplier,
  levelFromXp,
  levelProgress,
  maxAffordableUpgrades,
  offlineEarnings,
  petPower,
  periodKeys,
  rebirthEmbers,
  rebirthRequirement,
  safeMult,
  upgradeUnitCost,
  type DerivedStats,
  type UpgradeLevels,
} from "@/lib/economy";
import { ApiError } from "@/lib/api";
import { getEconomyConfig } from "@/server/config-service";
import type {
  AchievementEntry,
  DailyState,
  EventEntry,
  GameState,
  LeaderboardRow,
  Notice,
  OwnedPet,
  PlayerState,
  QuestEntry,
  UpgradeStateEntry,
} from "@/lib/types";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type PlayerRow = typeof players.$inferSelect;

const MAX_INVENTORY = 400;

function randomFloat() {
  return randomInt(0, 1_000_000) / 1_000_000;
}

function notice(kind: Notice["kind"], title: string, body: string, tone?: string): Notice {
  return { id: `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, kind, title, body, tone };
}

async function refreshEventStatuses(tx: Tx, now = new Date()) {
  await tx
    .update(gameEvents)
    .set({ status: "active" })
    .where(and(eq(gameEvents.status, "scheduled"), lte(gameEvents.startsAt, now), gt(gameEvents.endsAt, now)));
  await tx
    .update(gameEvents)
    .set({ status: "ended" })
    .where(and(inArray(gameEvents.status, ["scheduled", "active"]), lte(gameEvents.endsAt, now)));
}

export function boosterStatus(list: { id: string; endsAt: string }[], now = Date.now()) {
  return list.filter((b) => new Date(b.endsAt).getTime() > now);
}

function boosterMultiplierFor(list: { id: string; endsAt: string }[], now = Date.now()): number {
  const active = boosterStatus(list, now);
  if (!active.length) return 1;
  return active.reduce((max, b) => {
    const item = SHOP_ITEMS.find((s) => s.id === b.id);
    const value = item && item.effect.type === "multiplier" ? item.effect.value : 1;
    return Math.max(max, value);
  }, 1);
}

async function loadLevels(tx: Tx, playerId: string): Promise<UpgradeLevels> {
  const rows = await tx.select().from(upgradeStates).where(eq(upgradeStates.playerId, playerId));
  return Object.fromEntries(rows.map((r) => [r.upgradeId, r.level]));
}

async function loadPets(tx: Tx, playerId: string) {
  return tx.select().from(petInventory).where(eq(petInventory.playerId, playerId)).orderBy(desc(petInventory.obtainedAt));
}

function petMultiplierSum(petRows: { petId: string; rarity: string; isGolden: boolean; isShiny: boolean; equipped: boolean }[], bondLevel: number) {
  return petRows
    .filter((p) => p.equipped)
    .reduce((sum, p) => sum + petPower(p.rarity as OwnedPet["rarity"], p.isGolden, p.isShiny, bondLevel), 0);
}

async function deriveFor(tx: Tx, player: PlayerRow, opts?: { eventMultiplier?: number }) {
  const levels = await loadLevels(tx, player.id);
  const petRows = await loadPets(tx, player.id);
  const now = Date.now();

  let eventMultiplier = opts?.eventMultiplier ?? 1;
  if (opts?.eventMultiplier === undefined) {
    const active = await tx
      .select()
      .from(gameEvents)
      .where(and(eq(gameEvents.status, "active"), gt(gameEvents.endsAt, new Date(now))));
    eventMultiplier = active.reduce((max, e) => Math.max(max, e.multiplier), 1);
  }

  const purchases = await tx.select().from(playerPurchases).where(eq(playerPurchases.playerId, player.id));
  const slots = purchases.filter((p) => p.itemId === "luxe-slot").length;
  const owned = new Set(purchases.map((p) => p.itemId));
  const { config } = await getEconomyConfig();

  const derived = deriveStats({
    levels,
    rebirths: player.rebirths,
    prestiges: player.prestiges,
    embers: player.embers,
    sigils: player.sigils,
    echoes: player.echoes,
    worldId: player.currentWorld,
    petMultiplierSum: petMultiplierSum(petRows, levels.petBond ?? 0),
    boosterMultiplier: boosterMultiplierFor(player.boosters, now),
    eventMultiplier,
    equipSlotsBonus: slots,
    config,
  });
  derived.autoHatchUnlocked = owned.has("auto-hatch");
  return { derived, levels, petRows, config };
}

function toOwnedPet(row: typeof petInventory.$inferSelect, bondLevel: number): OwnedPet {
  const def = petById(row.petId);
  return {
    rowId: row.id,
    petId: row.petId,
    name: def?.name ?? row.petId,
    rarity: (def?.rarity ?? row.rarity) as OwnedPet["rarity"],
    glyph: def?.glyph ?? "orb",
    tint: def?.tint ?? "#f0a94a",
    worldId: def?.worldId ?? "all",
    description: def?.description ?? "",
    isGolden: row.isGolden,
    isShiny: row.isShiny,
    favorite: row.favorite,
    equipped: row.equipped,
    power: petPower((def?.rarity ?? row.rarity) as OwnedPet["rarity"], row.isGolden, row.isShiny, bondLevel),
    obtainedAt: row.obtainedAt.toISOString(),
  };
}

function questMetricStats(input: {
  totalClicks: number;
  totalCoinsEarned: number;
  hatches: number;
  rebirths: number;
  upgradesBought: number;
  petsOwned: number;
  level: number;
  bestCombo: number;
  ascensions: number;
}): Record<QuestMetric, number> {
  return {
    clicks: input.totalClicks,
    earned: input.totalCoinsEarned,
    hatches: input.hatches,
    rebirths: input.rebirths,
    upgrades: input.upgradesBought,
    pets: input.petsOwned,
    level: input.level,
    combo: input.bestCombo,
    ascensions: input.ascensions,
  };
}

async function ensureQuests(tx: Tx, playerId: string): Promise<(typeof playerQuests.$inferSelect)[]> {
  const now = new Date();
  const dayKey = now.toISOString().slice(0, 10);
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const weekKey = `W${monday.toISOString().slice(0, 10)}`;
  const values = QUESTS.map((q) => ({
    playerId,
    questId: q.id,
    periodKey: q.cadence === "daily" ? dayKey : q.cadence === "weekly" ? weekKey : "milestone",
  }));
  await tx.insert(playerQuests).values(values).onConflictDoNothing();
  const rows = await tx.select().from(playerQuests).where(eq(playerQuests.playerId, playerId));
  return rows.filter((r) =>
    QUESTS.some(
      (q) => q.id === r.questId && (q.cadence === "milestone" ? r.periodKey === "milestone" : q.cadence === "daily" ? r.periodKey === dayKey : r.periodKey === weekKey),
    ),
  );
}

async function syncProgress(
  tx: Tx,
  playerId: string,
  absolute: Record<QuestMetric, number>,
  deltas: Partial<Record<QuestMetric, number>>,
): Promise<{ completedQuests: QuestDef[]; achievements: AchievementDef[] }> {
  const questRows = await ensureQuests(tx, playerId);
  const completedQuests: QuestDef[] = [];
  for (const row of questRows) {
    const def = QUESTS.find((q) => q.id === row.questId);
    if (!def || row.claimed) continue;
    const target = def.cadence === "milestone" ? absolute[def.metric] : row.progress + (deltas[def.metric] ?? 0);
    const next = clampValue(Math.min(def.goal, target));
    if (next !== row.progress) {
      await tx.update(playerQuests).set({ progress: next }).where(eq(playerQuests.id, row.id));
    }
    if (next >= def.goal && row.progress < def.goal) completedQuests.push(def);
  }

  const existing = await tx.select().from(playerAchievements).where(eq(playerAchievements.playerId, playerId));
  const owned = new Set(existing.map((e) => e.achievementId));
  const unlocked: AchievementDef[] = [];
  for (const def of ACHIEVEMENTS) {
    if (owned.has(def.id)) continue;
    if (absolute[def.metric] >= def.goal) {
      const inserted = await tx
        .insert(playerAchievements)
        .values({ playerId, achievementId: def.id })
        .onConflictDoNothing()
        .returning();
      if (inserted.length) unlocked.push(def);
    }
  }
  if (unlocked.length) {
    const gems = unlocked.reduce((a, b) => a + b.rewardGems, 0);
    const points = unlocked.reduce((a, b) => a + b.points, 0);
    await tx
      .update(players)
      .set({
        gems: sql`${players.gems} + ${gems}`,
        achievementPoints: sql`${players.achievementPoints} + ${points}`,
      })
      .where(eq(players.id, playerId));
  }
  return { completedQuests, achievements: unlocked };
}

async function counters(tx: Tx, playerId: string, levels: UpgradeLevels) {
  const petsOwnedRows = await tx.select({ value: count() }).from(petInventory).where(eq(petInventory.playerId, playerId));
  const codes = await tx.select({ value: count() }).from(codeRedemptions).where(eq(codeRedemptions.playerId, playerId));
  return {
    petsOwned: Number(petsOwnedRows[0]?.value ?? 0),
    upgradesBought: Object.values(levels).reduce((a, b) => a + b, 0),
    codesRedeemed: Number(codes[0]?.value ?? 0),
  };
}

function buildMilestone(player: PlayerRow, config: Awaited<ReturnType<typeof getEconomyConfig>>["config"]) {
  const target = rebirthRequirement(player.rebirths, config);
  const current = Math.min(player.runCoinsEarned, target);
  return {
    next: target,
    current,
    pct: target > 0 ? Math.min(100, (current / target) * 100) : 0,
    label: `Next rebirth at ${target.toLocaleString("en-US")} sparks this run`,
  };
}

export async function getGameState(ctx: AuthContext, options?: { applyOffline?: boolean }): Promise<GameState> {
  const offline = { amount: 0 };
  const state = await db.transaction(async (tx) => {
    await refreshEventStatuses(tx);
    const playerRows = await tx.select().from(players).where(eq(players.id, ctx.player.id)).for("update").limit(1);
    const player = playerRows[0];
    if (!player) throw new ApiError("Player profile missing.", 404, "no_player");

    const { derived, levels, petRows, config } = await deriveFor(tx, player);

    if (options?.applyOffline !== false) {
      const away = (Date.now() - player.lastSeenAt.getTime()) / 1000;
      if (away > 90) {
        const gain = offlineEarnings(
          away,
          derived.passivePerSecond,
          {
            levels,
            rebirths: player.rebirths,
            prestiges: player.prestiges,
            embers: player.embers,
            sigils: player.sigils,
            echoes: player.echoes,
            worldId: player.currentWorld,
            petMultiplierSum: petMultiplierSum(petRows, levels.petBond ?? 0),
            boosterMultiplier: 1,
            eventMultiplier: 1,
            equipSlotsBonus: 0,
          },
          config,
        );
        if (gain > 0) {
          offline.amount = gain;
          await tx
            .update(players)
            .set({
              coins: sql`LEAST(${players.coins} + ${gain}, 1e18)`,
              totalCoinsEarned: sql`LEAST(${players.totalCoinsEarned} + ${gain}, 1e18)`,
              runCoinsEarned: sql`LEAST(${players.runCoinsEarned} + ${gain}, 1e18)`,
              lastSeenAt: new Date(),
            })
            .where(eq(players.id, player.id));
          player.coins = clampValue(player.coins + gain);
          player.totalCoinsEarned = clampValue(player.totalCoinsEarned + gain);
          player.runCoinsEarned = clampValue(player.runCoinsEarned + gain);
        }
      }
    }

    await tx.update(players).set({ lastSeenAt: new Date() }).where(eq(players.id, player.id));

    const petCounts = await counters(tx, player.id, levels);
    const absolutes = questMetricStats({
      totalClicks: player.totalClicks,
      totalCoinsEarned: player.totalCoinsEarned,
      hatches: player.hatches,
      rebirths: player.rebirths,
      upgradesBought: petCounts.upgradesBought,
      petsOwned: petCounts.petsOwned,
      level: player.level,
      bestCombo: player.bestCombo,
      ascensions: player.ascensions,
    });
    await syncProgress(tx, player.id, absolutes, {});
    const questRows = await ensureQuests(tx, player.id);
    const achievementRows = await tx.select().from(playerAchievements).where(eq(playerAchievements.playerId, player.id));
    const unlockedMap = new Map(achievementRows.map((a) => [a.achievementId, a.unlockedAt]));
    const purchaseRows = await tx.select().from(playerPurchases).where(eq(playerPurchases.playerId, player.id));
    const ownedItems = new Set(purchaseRows.map((p) => p.itemId));

    const eventRows = await tx.select().from(gameEvents).orderBy(desc(gameEvents.startsAt)).limit(12);
    const participationRows = await tx.select().from(eventParticipation).where(eq(eventParticipation.playerId, player.id));
    const participationMap = new Map(participationRows.map((p) => [p.eventId, p]));

    const announcementRows = await tx
      .select()
      .from(announcements)
      .where(eq(announcements.active, true))
      .orderBy(desc(announcements.createdAt))
      .limit(3);

    const codeRows = await tx
      .select()
      .from(redeemCodes)
      .where(and(eq(redeemCodes.active, true), lte(redeemCodes.startsAt, new Date())))
      .orderBy(desc(redeemCodes.createdAt))
      .limit(12);
    const redemptionRows = await tx.select().from(codeRedemptions).where(eq(codeRedemptions.playerId, player.id));
    const redeemedCodeIds = new Set(redemptionRows.map((r) => r.codeId));

    const levelInfo = levelProgress(player.xp);

    const upgrades: UpgradeStateEntry[] = UPGRADES.map((def) => {
      const level = levels[def.id] ?? 0;
      const prereqLevel = def.prerequisite ? (levels[def.prerequisite.id] ?? 0) : 0;
      const unlocked = !def.prerequisite || prereqLevel >= def.prerequisite.level;
      const unitCost = upgradeUnitCost(def, level, config);
      const affordableMax = maxAffordableUpgrades(def, level, player.coins, config);
      const prereqName = def.prerequisite ? UPGRADES.find((u) => u.id === def.prerequisite?.id)?.name ?? "" : "";
      return {
        id: def.id,
        level,
        maxLevel: def.maxLevel,
        unlocked,
        lockedReason: unlocked ? null : `Requires ${prereqName} level ${def.prerequisite?.level}`,
        unitCost,
        nextCost: level >= def.maxLevel ? 0 : unitCost,
        cost1: level >= def.maxLevel ? 0 : bulkUpgradeCost(def, level, 1, config),
        cost10: level >= def.maxLevel ? 0 : bulkUpgradeCost(def, level, 10, config),
        costMax: level >= def.maxLevel ? 0 : bulkUpgradeCost(def, level, Math.max(1, Math.min(affordableMax, def.maxLevel - level)), config),
        affordableMax,
        currentEffect: def.effectLabel(level),
        nextEffect: def.effectLabel(Math.min(def.maxLevel, level + 1)),
      };
    });

    const ownedPets = petRows.map((p) => toOwnedPet(p, levels.petBond ?? 0));
    const quests: QuestEntry[] = QUESTS.map((def) => {
      const row = questRows.find((r) => r.questId === def.id);
      const progress = clampValue(Math.min(def.goal, row?.progress ?? 0));
      return {
        def,
        progress,
        goal: def.goal,
        claimed: Boolean(row?.claimed),
        complete: Boolean(row?.claimed) || progress >= def.goal,
        claimable: Boolean(row && !row.claimed && progress >= def.goal),
      };
    }).sort((a, b) => Number(b.claimable) - Number(a.claimable));

    const achievements: AchievementEntry[] = ACHIEVEMENTS.map((def) => ({
      def,
      unlocked: unlockedMap.has(def.id),
      progress: clampValue(Math.min(def.goal, absolutes[def.metric] ?? 0)),
    }));

    const worlds = WORLDS.map((world) => ({
      ...world,
      unlocked: world.index <= player.highestWorldIndex || player.totalCoinsEarned >= world.unlockAt,
      eggId: EGGS.find((e) => e.worldId === world.id)?.id ?? EGGS[0].id,
      petsOwned: ownedPets.filter((p) => p.worldId === world.id).length,
      petsTotal: PETS.filter((p) => p.worldId === world.id).length,
    })) as (World & { unlocked: boolean; eggId: string; petsOwned: number; petsTotal: number })[];

    const events: EventEntry[] = eventRows.map((e) => {
      const p = participationMap.get(e.id);
      return {
        id: e.id,
        title: e.title,
        description: e.description,
        type: e.type,
        multiplier: e.multiplier,
        status: e.status,
        startsAt: e.startsAt.toISOString(),
        endsAt: e.endsAt.toISOString(),
        goalClicks: e.goalClicks,
        rewardCoins: e.rewardCoins,
        rewardGems: e.rewardGems,
        progress: p?.progress ?? 0,
        claimed: p?.claimed ?? false,
        claimable: Boolean(p && !p.claimed && p.progress >= e.goalClicks && e.goalClicks > 0),
      };
    });

    const nextStreak = dailyStreakAfter(player.lastDailyAt, player.dailyStreak);
    const daily: DailyState = {
      canClaim: canClaimDaily(player.lastDailyAt),
      streak: player.dailyStreak,
      nextStreak,
      todayIndex: nextStreak - 1,
      nextClaimAt: player.lastDailyAt ? new Date(player.lastDailyAt.getTime() + 20 * 3600 * 1000).toISOString() : null,
      rewards: DAILY_REWARDS,
    };

    const activeBoosters = boosterStatus(player.boosters).map((b) => {
      const item = SHOP_ITEMS.find((s) => s.id === b.id);
      return {
        id: b.id,
        label: item?.name ?? b.id,
        multiplier: item && item.effect.type === "multiplier" ? item.effect.value : 1,
        endsAt: b.endsAt,
      };
    });

    const playerState: PlayerState = {
      id: player.id,
      username: player.username,
      avatarColor: player.avatarColor,
      title: player.title,
      role: ctx.user.role,
      coins: clampValue(player.coins),
      gems: clampValue(player.gems),
      embers: clampValue(player.embers),
      sigils: clampValue(player.sigils),
      echoes: clampValue(player.echoes),
      totalCoinsEarned: clampValue(player.totalCoinsEarned),
      runCoinsEarned: clampValue(player.runCoinsEarned),
      totalClicks: clampValue(player.totalClicks),
      level: levelInfo.level,
      xp: player.xp,
      xpCurrent: levelInfo.current,
      xpNeeded: levelInfo.needed,
      xpPct: levelInfo.pct,
      rebirths: player.rebirths,
      prestiges: player.prestiges,
      ascensions: player.ascensions,
      seasonPoints: player.seasonPoints,
      bestCombo: player.bestCombo,
      acheivementPoints: player.achievementPoints,
      achievementPoints: player.achievementPoints,
      playtimeSeconds: player.playtimeSeconds,
      hatches: player.hatches,
      pityCounter: player.pityCounter,
      currentWorld: player.currentWorld,
      createdAt: player.createdAt.toISOString(),
      boosters: activeBoosters,
      muted: player.muted,
      compactMode: player.compactMode,
    };

    const state: GameState = {
      serverNow: new Date().toISOString(),
      player: playerState,
      derived,
      upgrades,
      pets: ownedPets,
      equipSlots: derived.maxEquipped,
      quests,
      achievements,
      achievementSummary: {
        unlocked: achievementRows.length,
        total: ACHIEVEMENTS.length,
        points: player.achievementPoints,
      },
      daily,
      events,
      codes: codeRows.map((c) => ({
        code: c.code,
        rewardCoins: c.rewardCoins,
        rewardGems: c.rewardGems,
        active: c.active && (!c.endsAt || c.endsAt.getTime() > Date.now()),
        redeemed: redeemedCodeIds.has(c.id) ? 1 : 0,
      })),
      worlds,
      shop: SHOP_ITEMS.map((item) => ({
        item,
        owned: ownedItems.has(item.id),
        activeUntil: activeBoosters.find((b) => b.id === item.id)?.endsAt ?? null,
      })),
      offlineEarned: offline.amount,
      announcements: announcementRows.map((a) => ({ id: a.id, message: a.message, tone: a.tone, createdAt: a.createdAt.toISOString() })),
      configVersion: (await getEconomyConfig()).version,
      maintenance: config.maintenanceMode,
      featureFlags: config.featureFlags as unknown as Record<string, boolean>,
      economy: {
        maxClicksPerSecond: config.maxClicksPerSecond,
        offlineMaxHours: config.offlineMaxHours,
        clickMultiplier: config.clickMultiplier,
        passiveMultiplier: config.passiveMultiplier,
      },
      stats: { ...petCounts, eventsJoined: participationRows.length },
      currentRank: null,
      milestone: buildMilestone(player, config),
    };
    return state;
  });
  return state;
}

interface MutationResult {
  notices: Notice[];
  result?: Record<string, unknown>;
  skipRebuild?: boolean;
}

async function mutate(ctx: AuthContext, fn: (tx: Tx, player: PlayerRow, config: Awaited<ReturnType<typeof getEconomyConfig>>["config"]) => Promise<MutationResult>): Promise<{ state: GameState; notices: Notice[]; result: Record<string, unknown> }> {
  const { config } = await getEconomyConfig();
  const outcome = await db.transaction(async (tx) => {
    const rows = await tx.select().from(players).where(eq(players.id, ctx.player.id)).for("update").limit(1);
    const player = rows[0];
    if (!player) throw new ApiError("Player profile missing.", 404, "no_player");
    return fn(tx, player, config);
  });
  const state = await getGameState(ctx);
  return { state, notices: outcome.notices, result: outcome.result ?? {} };
}

export async function syncClicks(ctx: AuthContext, input: { clicks: number; combo: number }): Promise<{ state: GameState; notices: Notice[]; result: Record<string, unknown> }> {
  const rateLimitResult = await mutate(ctx, async (tx, player, config) => {
    const now = new Date();
    const { derived, levels, petRows } = await deriveFor(tx, player);
    const elapsed = Math.min(30, Math.max(0, (now.getTime() - player.lastSyncAt.getTime()) / 1000)) + 1.5;
    const allowed = Math.min(600, Math.floor(elapsed * config.maxClicksPerSecond) + 20);
    const clicks = Math.max(0, Math.min(Math.floor(input.clicks), allowed));
    if (clicks <= 0) {
      return { notices: [], result: { acceptedClicks: 0, gained: 0, crits: 0 } };
    }
    const combo = Math.max(0, Math.min(Math.floor(input.combo), clicks));
    const comboFactor = comboMultiplier(combo, derived.comboEfficiency);
    const expectedCrits = (clicks * derived.critChance) / 100;
    const guaranteed = Math.floor(expectedCrits);
    const extra = randomFloat() < expectedCrits - guaranteed ? 1 : 0;
    const crits = Math.min(clicks, guaranteed + extra);

    const normalGain = (clicks - crits) * derived.clickPower * comboFactor;
    const critGain = crits * derived.clickPower * derived.critMultiplier * comboFactor;
    const passiveGain = derived.passivePerSecond * Math.min(30, Math.max(0, elapsed));
    const gained = clampValue(normalGain + critGain + passiveGain);
    const xpGain = clampValue(clicks * 1 + gained / 40);

    await tx
      .update(players)
      .set({
        coins: sql`LEAST(${players.coins} + ${gained}, 1e18)`,
        totalCoinsEarned: sql`LEAST(${players.totalCoinsEarned} + ${gained}, 1e18)`,
        runCoinsEarned: sql`LEAST(${players.runCoinsEarned} + ${gained}, 1e18)`,
        totalClicks: sql`LEAST(${players.totalClicks} + ${clicks}, 1e18)`,
        xp: sql`LEAST(${players.xp} + ${xpGain}, 1e18)`,
        seasonPoints: sql`${players.seasonPoints} + ${clicks}`,
        bestCombo: Math.max(player.bestCombo, combo),
        playtimeSeconds: sql`LEAST(${players.playtimeSeconds} + ${Math.min(120, Math.max(0, Math.round(elapsed)))}, 100000000)`,
        lastSyncAt: now,
        lastSeenAt: now,
      })
      .where(eq(players.id, player.id));

    const activeEvents = await tx.select().from(gameEvents).where(and(eq(gameEvents.status, "active"), gt(gameEvents.endsAt, now)));
    for (const event of activeEvents) {
      await tx
        .insert(eventParticipation)
        .values({ eventId: event.id, playerId: player.id, progress: clicks })
        .onConflictDoUpdate({
          target: [eventParticipation.eventId, eventParticipation.playerId],
          set: { progress: sql`LEAST(${eventParticipation.progress} + ${clicks}, 1e18)`, updatedAt: now },
        });
    }

    const nextStats = questMetricStats({
      totalClicks: clampValue(player.totalClicks + clicks),
      totalCoinsEarned: clampValue(player.totalCoinsEarned + gained),
      hatches: player.hatches,
      rebirths: player.rebirths,
      upgradesBought: Object.values(levels).reduce((a, b) => a + b, 0),
      petsOwned: petRows.length,
      level: levelFromXp(clampValue(player.xp + xpGain)),
      bestCombo: Math.max(player.bestCombo, combo),
      ascensions: player.ascensions,
    });
    const { achievements, completedQuests } = await syncProgress(tx, player.id, nextStats, {
      clicks,
      earned: gained,
      combo: Math.max(0, combo - player.bestCombo),
    });

    const notices: Notice[] = achievements.map((a) => notice("achievement", `Achievement — ${a.name}`, `${a.description} +${a.rewardGems} prisms.`, "gold"));
    for (const q of completedQuests) notices.push(notice("quest", `Quest ready — ${q.name}`, "Objective complete. Claim your reward.", "jade"));
    if (clicks < Math.floor(input.clicks * 0.85)) {
      notices.push(notice("system", "Click rate capped", "Some strikes were ignored because they exceeded the validated rate.", "amber"));
    }
    return {
      notices,
      result: { acceptedClicks: clicks, gained, crits, combo, comboFactor },
    };
  });
  return { state: rateLimitResult.state, notices: rateLimitResult.notices, result: rateLimitResult.result ?? {} };
}

export async function buyUpgrade(ctx: AuthContext, upgradeId: string, quantity: number): Promise<{ state: GameState; notices: Notice[]; result: Record<string, unknown> }> {
  return mutate(ctx, async (tx, player, config) => {
    const def = UPGRADES.find((u) => u.id === upgradeId);
    if (!def) throw new ApiError("Unknown upgrade.", 404, "no_upgrade");
    const rows = await tx.select().from(upgradeStates).where(and(eq(upgradeStates.playerId, player.id), eq(upgradeStates.upgradeId, upgradeId))).limit(1);
    const level = rows[0]?.level ?? 0;
    if (def.prerequisite) {
      const preReq = await tx
        .select()
        .from(upgradeStates)
        .where(and(eq(upgradeStates.playerId, player.id), eq(upgradeStates.upgradeId, def.prerequisite.id)))
        .limit(1);
      if ((preReq[0]?.level ?? 0) < def.prerequisite.level) {
        throw new ApiError(`Requires ${def.prerequisite.id} level ${def.prerequisite.level}.`, 422, "locked");
      }
    }
    if (level >= def.maxLevel) throw new ApiError("This upgrade is already at maximum level.", 422, "maxed");
    const want = quantity === -1 ? Math.max(1, Math.min(500, def.maxLevel - level)) : Math.max(1, Math.min(100, Math.floor(quantity)));
    const affordable = maxAffordableUpgrades(def, level, player.coins, config);
    const buyCount = quantity === -1 ? affordable : Math.min(want, affordable, def.maxLevel - level);
    if (buyCount <= 0) throw new ApiError("Not enough sparks for this upgrade.", 422, "insufficient_funds");
    const cost = bulkUpgradeCost(def, level, buyCount, config);
    if (cost > player.coins || !Number.isFinite(cost)) throw new ApiError("Not enough sparks for this upgrade.", 422, "insufficient_funds");

    if (rows[0]) {
      await tx.update(upgradeStates).set({ level: level + buyCount }).where(eq(upgradeStates.id, rows[0].id));
    } else {
      await tx.insert(upgradeStates).values({ playerId: player.id, upgradeId, level: buyCount }).onConflictDoNothing();
    }
    await tx.update(players).set({ coins: sql`${players.coins} - ${cost}` }).where(eq(players.id, player.id));

    const nextStats = questMetricStats({
      totalClicks: player.totalClicks,
      totalCoinsEarned: player.totalCoinsEarned,
      hatches: player.hatches,
      rebirths: player.rebirths,
      upgradesBought: Object.values(await loadLevels(tx, player.id)).reduce((a, b) => a + b, 0) + buyCount,
      petsOwned: (await loadPets(tx, player.id)).length,
      level: player.level,
      bestCombo: player.bestCombo,
      ascensions: player.ascensions,
    });
    const { achievements, completedQuests } = await syncProgress(tx, player.id, nextStats, { upgrades: buyCount });
    const notices: Notice[] = [notice("system", `${def.name} upgraded`, `+${buyCount} level${buyCount > 1 ? "s" : ""} for ${cost.toLocaleString("en-US")} sparks.`, "gold")];
    for (const a of achievements) notices.push(notice("achievement", `Achievement — ${a.name}`, `${a.description} +${a.rewardGems} prisms.`, "gold"));
    for (const q of completedQuests) notices.push(notice("quest", `Quest ready — ${q.name}`, "Objective complete. Claim your reward.", "jade"));
    return { notices, result: { upgradeId, levels: buyCount, cost } };
  });
}

function adjustWeights(entries: EggEntry[], luck: number): EggEntry[] {
  if (luck <= 0) return entries;
  const strength = Math.min(0.6, luck / 100);
  return entries.map((entry) => {
    const rarity = petById(entry.petId)?.rarity ?? "common";
    const order = ["common", "uncommon", "rare", "epic", "legendary", "mythic", "celestial", "secret"].indexOf(rarity);
    const factor = 1 + strength * (order - 2) * 0.35;
    return { ...entry, weight: Math.max(0.5, entry.weight * factor) };
  });
}

export async function hatchEgg(ctx: AuthContext, eggId: string, count: 1 | 3 | 10): Promise<{ state: GameState; notices: Notice[]; result: Record<string, unknown> }> {
  const { config } = await getEconomyConfig();
  if (!config.featureFlags.eggs) throw new ApiError("The hatchery is temporarily closed.", 403, "disabled");
  return mutate(ctx, async (tx, player) => {
    const egg = eggById(eggId);
    if (!egg) throw new ApiError("Unknown egg.", 404, "no_egg");
    const world = WORLDS.find((w) => w.id === egg.worldId);
    if (!world) throw new ApiError("Unknown world.", 404, "no_world");
    const unlocked = player.highestWorldIndex >= world.index || player.totalCoinsEarned >= world.unlockAt;
    if (!unlocked) throw new ApiError(`Unlock ${world.name} before hatching this egg.`, 422, "world_locked");
    const qty = count === 10 ? 10 : count === 3 ? 3 : 1;
    const cost = clampValue(egg.price * qty);
    if (player.coins < cost) throw new ApiError("Not enough sparks to hatch.", 422, "insufficient_funds");
    const existing = await loadPets(tx, player.id);
    if (existing.length + qty > MAX_INVENTORY) throw new ApiError("Sanctuary is full. Release or fuse companions first.", 422, "inventory_full");

    const levels = await loadLevels(tx, player.id);
    const luck = (levels.luck ?? 0) * 0.8;
    const { derived } = await deriveFor(tx, player);
    const weighted = adjustWeights(egg.entries, luck);

    let pity = player.pityCounter;
    const pulled: string[] = [];
    const values: (typeof petInventory.$inferInsert)[] = [];
    for (let i = 0; i < qty; i += 1) {
      pity += 1;
      let pick: EggEntry | null = null;
      if (pity >= 20) {
        const rarePool = weighted.filter((entry) => {
          const order = ["common", "uncommon", "rare", "epic", "legendary", "mythic", "celestial", "secret"];
          return order.indexOf(petById(entry.petId)?.rarity ?? "common") >= 2;
        });
        pick = rarePool[randomInt(0, rarePool.length)] ?? weighted[randomInt(0, weighted.length)];
        pity = 0;
      } else {
        if (luck > 0 && randomFloat() < Math.min(0.35, luck / 250)) {
          const rarePool = weighted.filter((entry) => {
            const order = ["common", "uncommon", "rare", "epic", "legendary", "mythic", "celestial", "secret"];
            return order.indexOf(petById(entry.petId)?.rarity ?? "common") >= 2;
          });
          pick = rarePool[randomInt(0, Math.max(1, rarePool.length))] ?? null;
        }
        if (!pick) {
          const total = weighted.reduce((a, b) => a + b.weight, 0);
          let roll = randomFloat() * total;
          for (const entry of weighted) {
            roll -= entry.weight;
            if (roll <= 0) {
              pick = entry;
              break;
            }
          }
          pick ??= weighted[weighted.length - 1];
        }
      }
      const def = petById(pick.petId);
      if (!def) continue;
      const golden = randomFloat() < 0.02 + Math.min(0.08, luck / 800);
      const shiny = randomFloat() < 0.04 + Math.min(0.1, luck / 600);
      values.push({ playerId: player.id, petId: def.id, rarity: def.rarity, isGolden: golden, isShiny: shiny });
      pulled.push(def.id);
    }

    await tx.insert(petInventory).values(values);
    await tx
      .update(players)
      .set({
        coins: sql`${players.coins} - ${cost}`,
        hatches: sql`${players.hatches} + ${qty}`,
        pityCounter: pity,
      })
      .where(eq(players.id, player.id));

    const nextStats = questMetricStats({
      totalClicks: player.totalClicks,
      totalCoinsEarned: player.totalCoinsEarned,
      hatches: player.hatches + qty,
      rebirths: player.rebirths,
      upgradesBought: Object.values(levels).reduce((a, b) => a + b, 0),
      petsOwned: existing.length + qty,
      level: player.level,
      bestCombo: player.bestCombo,
      ascensions: player.ascensions,
    });
    const { achievements, completedQuests } = await syncProgress(tx, player.id, nextStats, { hatches: qty, pets: qty });
    const notices: Notice[] = [];
    const best = values
      .map((v) => petById(v.petId as string))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .sort((a, b) => rarityById(b.rarity).multiplier - rarityById(a.rarity).multiplier)[0];
    if (best && ["rare", "epic", "legendary", "mythic", "celestial", "secret"].includes(best.rarity)) {
      notices.push(notice("pet", `${rarityById(best.rarity).label} discovery`, `${best.name} emerged from the ${egg.name}.`, best.rarity));
    }
    for (const a of achievements) notices.push(notice("achievement", `Achievement — ${a.name}`, `${a.description} +${a.rewardGems} prisms.`, "gold"));
    for (const q of completedQuests) notices.push(notice("quest", `Quest ready — ${q.name}`, "Complete. Claim your reward.", "jade"));
    return { notices, result: { pets: pulled, cost, pity } };
  });
}

export async function petAction(
  ctx: AuthContext,
  input: { rowIds: string[]; action: "equip" | "unequip" | "favorite" | "fuse" | "release" },
): Promise<{ state: GameState; notices: Notice[]; result: Record<string, unknown> }> {
  return mutate(ctx, async (tx, player) => {
    const { derived, levels } = await deriveFor(tx, player);
    const rows = await tx.select().from(petInventory).where(eq(petInventory.playerId, player.id));
    const targetRows = rows.filter((r) => input.rowIds.includes(r.id));
    if (!targetRows.length) throw new ApiError("No matching companions found.", 404, "no_pet");

    if (input.action === "favorite") {
      for (const row of targetRows) await tx.update(petInventory).set({ favorite: !row.favorite }).where(eq(petInventory.id, row.id));
      return { notices: [notice("system", "Favourites updated", "Your sanctuary order has been saved.", "gold")] };
    }

    if (input.action === "unequip") {
      for (const row of targetRows) await tx.update(petInventory).set({ equipped: false }).where(eq(petInventory.id, row.id));
      return { notices: [notice("system", "Companion rested", "The slot is free again.", "gold")] };
    }

    if (input.action === "equip") {
      const already = rows.filter((r) => r.equipped && !input.rowIds.includes(r.id)).length;
      const wanted = targetRows.filter((r) => !r.equipped);
      if (already + wanted.length > derived.maxEquipped) {
        throw new ApiError(`Only ${derived.maxEquipped} companions can be equipped. Unequip one first.`, 422, "slots_full");
      }
      for (const row of wanted) await tx.update(petInventory).set({ equipped: true }).where(eq(petInventory.id, row.id));
      return { notices: [notice("system", "Companion equipped", `${wanted.length} companion(s) joined your line.`, "gold")] };
    }

    if (input.action === "release") {
      for (const row of targetRows) {
        if (row.favorite) throw new ApiError("Favourite companions cannot be released.", 422, "favorite");
        await tx.delete(petInventory).where(eq(petInventory.id, row.id));
      }
      const refund = targetRows.reduce((sum, r) => sum + Math.floor(EGGS.find((e) => WORLDS.find((w) => w.id === petById(r.petId)?.worldId)?.id === e.worldId)?.price ?? 500) * 0.1, 0);
      if (refund > 0) {
        await tx.update(players).set({ coins: sql`LEAST(${players.coins} + ${refund}, 1e18)` }).where(eq(players.id, player.id));
      }
      return { notices: [notice("system", "Companions released", `Recovered ${refund.toLocaleString("en-US")} sparks.`, "gold")] };
    }

    // fuse: three unequipped duplicates of the same pet -> one golden variant
    const pool = rows.filter((r) => !r.equipped && !r.favorite && targetRows.some((t) => t.petId === r.petId));
    const byPet = new Map<string, typeof pool>();
    for (const row of pool) {
      const arr = byPet.get(row.petId) ?? [];
      arr.push(row);
      byPet.set(row.petId, arr);
    }
    const candidate = [...byPet.entries()].find(([, arr]) => arr.length >= 3);
    if (!candidate) throw new ApiError("Fusion needs three unequipped, non-favourite duplicates of the same companion.", 422, "cannot_fuse");
    const [petId, arr] = candidate;
    await tx.delete(petInventory).where(inArray(petInventory.id, arr.slice(0, 3).map((r) => r.id)));
    await tx.insert(petInventory).values({ playerId: player.id, petId, rarity: petById(petId)?.rarity ?? "common", isGolden: true });
    void levels;
    return { notices: [notice("pet", "Fusion complete", `${petById(petId)?.name ?? "Companion"} is now a Golden variant.`, "gold")] };
  });
}

export async function equipBest(ctx: AuthContext): Promise<{ state: GameState; notices: Notice[] }> {
  return mutate(ctx, async (tx, player) => {
    const { derived } = await deriveFor(tx, player);
    const rows = await loadPets(tx, player.id);
    const sorted = [...rows].sort((a, b) => petPower(b.rarity as OwnedPet["rarity"], b.isGolden, b.isShiny) - petPower(a.rarity as OwnedPet["rarity"], a.isGolden, a.isShiny));
    const keep = sorted.slice(0, derived.maxEquipped).map((r) => r.id);
    if (!keep.length) {
      return { notices: [notice("system", "Sanctuary is empty", "Hatch a companion first — there is no lineup to equip.", "gold")] };
    }
    await tx
      .update(petInventory)
      .set({ equipped: false })
      .where(eq(petInventory.playerId, player.id));
    await tx
      .update(petInventory)
      .set({ equipped: true })
      .where(and(eq(petInventory.playerId, player.id), inArray(petInventory.id, keep)));
    return { notices: [notice("system", "Best lineup equipped", `${Math.min(keep.length, derived.maxEquipped)} companions active.`, "gold")] };
  });
}

export async function selectWorld(ctx: AuthContext, worldId: string): Promise<{ state: GameState; notices: Notice[] }> {
  return mutate(ctx, async (tx, player) => {
    const world = WORLDS.find((w) => w.id === worldId);
    if (!world) throw new ApiError("Unknown world.", 404, "no_world");
    const unlocked = player.highestWorldIndex >= world.index || player.totalCoinsEarned >= world.unlockAt;
    if (!unlocked) throw new ApiError("This world is still sealed.", 422, "world_locked");
    await tx.update(players).set({ currentWorld: worldId }).where(eq(players.id, player.id));
    return { notices: [notice("system", `Entering ${world.name}`, `${world.bonus} now applies to your output.`, "gold")] };
  });
}

export async function claimQuest(ctx: AuthContext, questId: string): Promise<{ state: GameState; notices: Notice[] }> {
  return mutate(ctx, async (tx, player) => {
    const def = QUESTS.find((q) => q.id === questId);
    if (!def) throw new ApiError("Unknown quest.", 404, "no_quest");
    await ensureQuests(tx, player.id);
    const rows = await tx.select().from(playerQuests).where(and(eq(playerQuests.playerId, player.id), eq(playerQuests.questId, questId)));
    const { dayKey, weekKey } = periodKeys();
    const current = rows.find(
      (r) => (def.cadence === "daily" && r.periodKey === dayKey) || (def.cadence === "milestone" && r.periodKey === "milestone") || (def.cadence === "weekly" && r.periodKey === weekKey),
    );
    if (!current) throw new ApiError("Quest not assigned to this period.", 404, "not_assigned");
    if (current.claimed) throw new ApiError("This quest reward was already claimed.", 409, "already_claimed");
    if (current.progress < def.goal) throw new ApiError("Objective not complete yet.", 422, "incomplete");
    const updated = await tx
      .update(playerQuests)
      .set({ claimed: true })
      .where(and(eq(playerQuests.id, current.id), eq(playerQuests.claimed, false)))
      .returning();
    if (!updated.length) throw new ApiError("This quest reward was already claimed.", 409, "already_claimed");
    await tx
      .update(players)
      .set({
        coins: sql`LEAST(${players.coins} + ${def.rewardCoins}, 1e18)`,
        totalCoinsEarned: sql`LEAST(${players.totalCoinsEarned} + ${def.rewardCoins}, 1e18)`,
        gems: sql`${players.gems} + ${def.rewardGems}`,
        embers: sql`${players.embers} + ${def.rewardEmbers ?? 0}`,
        seasonPoints: sql`${players.seasonPoints} + 25`,
      })
      .where(eq(players.id, player.id));
    return { notices: [notice("quest", `${def.name} claimed`, `+${def.rewardCoins.toLocaleString("en-US")} sparks, +${def.rewardGems} prisms.`, "jade")] };
  });
}

export async function claimDaily(ctx: AuthContext): Promise<{ state: GameState; notices: Notice[] }> {
  return mutate(ctx, async (tx, player) => {
    const now = new Date();
    if (!canClaimDaily(player.lastDailyAt, now)) throw new ApiError("Daily reward is not ready yet.", 409, "cooldown");
    const streak = dailyStreakAfter(player.lastDailyAt, player.dailyStreak, now);
    const reward = DAILY_REWARDS[streak - 1] ?? DAILY_REWARDS[0];
    const updated = await tx
      .update(players)
      .set({
        coins: sql`LEAST(${players.coins} + ${reward.coins}, 1e18)`,
        totalCoinsEarned: sql`LEAST(${players.totalCoinsEarned} + ${reward.coins}, 1e18)`,
        gems: sql`${players.gems} + ${reward.gems}`,
        dailyStreak: streak,
        lastDailyAt: now,
      })
      .where(and(eq(players.id, player.id), sql`(${players.lastDailyAt} IS NULL OR ${players.lastDailyAt} < ${new Date(now.getTime() - 20 * 3600 * 1000)})`))
      .returning();
    if (!updated.length) throw new ApiError("Daily reward already claimed today.", 409, "already_claimed");
    return { notices: [notice("daily", `Day ${streak} — ${reward.label}`, `+${reward.coins.toLocaleString("en-US")} sparks, +${reward.gems} prisms.`, "gold")] };
  });
}

export async function redeemCode(ctx: AuthContext, rawCode: string): Promise<{ state: GameState; notices: Notice[] }> {
  const code = rawCode.trim().toUpperCase();
  if (!/^[A-Z0-9-]{3,32}$/.test(code)) throw new ApiError("Codes use letters, numbers and dashes.", 422, "invalid_code");
  return mutate(ctx, async (tx, player, config) => {
    if (!config.featureFlags.codes) throw new ApiError("Codes are temporarily disabled.", 403, "disabled");
    const rows = await tx.select().from(redeemCodes).where(eq(redeemCodes.code, code)).for("update").limit(1);
    const entry = rows[0];
    const now = new Date();
    if (!entry || !entry.active) throw new ApiError("That code is not active.", 404, "code_not_found");
    if (entry.startsAt > now) throw new ApiError("That code is not active yet.", 422, "code_future");
    if (entry.endsAt && entry.endsAt < now) throw new ApiError("That code has expired.", 422, "code_expired");
    if (entry.maxRedemptions > 0 && entry.redeemedCount >= entry.maxRedemptions) throw new ApiError("That code has reached its global limit.", 409, "code_exhausted");
    const mine = await tx.select().from(codeRedemptions).where(and(eq(codeRedemptions.codeId, entry.id), eq(codeRedemptions.playerId, player.id)));
    if (mine.length >= entry.perUserLimit) throw new ApiError("You already redeemed this code.", 409, "already_redeemed");
    const inserted = await tx
      .insert(codeRedemptions)
      .values({ codeId: entry.id, playerId: player.id })
      .onConflictDoNothing()
      .returning();
    if (!inserted.length) throw new ApiError("You already redeemed this code.", 409, "already_redeemed");
    await tx.update(redeemCodes).set({ redeemedCount: sql`${redeemCodes.redeemedCount} + 1` }).where(eq(redeemCodes.id, entry.id));
    await tx
      .update(players)
      .set({
        coins: sql`LEAST(${players.coins} + ${entry.rewardCoins}, 1e18)`,
        totalCoinsEarned: sql`LEAST(${players.totalCoinsEarned} + ${entry.rewardCoins}, 1e18)`,
        gems: sql`${players.gems} + ${entry.rewardGems}`,
        embers: sql`${players.embers} + ${entry.rewardEmbers}`,
      })
      .where(eq(players.id, player.id));
    return {
      notices: [
        notice(
          "system",
          "Code redeemed",
          `+${entry.rewardCoins.toLocaleString("en-US")} sparks, +${entry.rewardGems} prisms${entry.rewardEmbers ? `, +${entry.rewardEmbers} embers` : ""}.`,
          "gold",
        ),
      ],
    };
  });
}

export async function buyShopItem(ctx: AuthContext, itemId: string): Promise<{ state: GameState; notices: Notice[] }> {
  return mutate(ctx, async (tx, player, config) => {
    if (!config.featureFlags.shop) throw new ApiError("The shop is closed right now.", 403, "disabled");
    const item = SHOP_ITEMS.find((s) => s.id === itemId);
    if (!item) throw new ApiError("Unknown shop item.", 404, "no_item");
    if (item.effect.type === "multiplier") {
      if (player.gems < item.price) throw new ApiError("Not enough prisms.", 422, "insufficient_funds");
      const endsAt = new Date(Date.now() + item.effect.hours * 3600 * 1000).toISOString();
      const boosters = [...boosterStatus(player.boosters), { id: item.id, endsAt }];
      await tx
        .update(players)
        .set({ gems: sql`${players.gems} - ${item.price}`, boosters })
        .where(eq(players.id, player.id));
      return { notices: [notice("system", `${item.name} activated`, `${formatMultiplier(item.effect.value)} output for ${item.effect.hours}h.`, "gold")] };
    }
    const purchased = await tx.select().from(playerPurchases).where(and(eq(playerPurchases.playerId, player.id), eq(playerPurchases.itemId, item.id))).limit(1);
    if (purchased.length) throw new ApiError("You already own this.", 409, "owned");
    if (player.gems < item.price) throw new ApiError("Not enough prisms.", 422, "insufficient_funds");
    await tx.insert(playerPurchases).values({ playerId: player.id, itemId: item.id, currency: item.currency, price: item.price });
    await tx.update(players).set({ gems: sql`${players.gems} - ${item.price}` }).where(eq(players.id, player.id));
    let extra = "";
    if (item.effect.type === "title") {
      const currentTitle = TITLES.includes(item.effect.title) ? item.effect.title : player.title;
      await tx.update(players).set({ title: currentTitle }).where(eq(players.id, player.id));
      extra = ` Title unlocked: ${item.effect.title}.`;
    }
    if (item.id === "starter-crate") {
      await tx.update(players).set({ coins: sql`LEAST(${players.coins} + 250000, 1e18)` }).where(eq(players.id, player.id));
      extra = " 250,000 sparks delivered.";
    }
    return { notices: [notice("system", `${item.name} unlocked`, `Purchase recorded.${extra}`, "gold")] };
  });
}

export async function claimEventReward(ctx: AuthContext, eventId: string): Promise<{ state: GameState; notices: Notice[] }> {
  return mutate(ctx, async (tx, player) => {
    const rows = await tx.select().from(gameEvents).where(eq(gameEvents.id, eventId)).limit(1);
    const event = rows[0];
    if (!event) throw new ApiError("Unknown event.", 404, "no_event");
    const parts = await tx.select().from(eventParticipation).where(and(eq(eventParticipation.eventId, eventId), eq(eventParticipation.playerId, player.id))).limit(1);
    const participation = parts[0];
    if (!participation) throw new ApiError("You did not join this event.", 422, "not_participating");
    if (participation.claimed) throw new ApiError("Event reward already claimed.", 409, "already_claimed");
    if (participation.progress < event.goalClicks) throw new ApiError("Event goal not reached.", 422, "incomplete");
    const updated = await tx
      .update(eventParticipation)
      .set({ claimed: true })
      .where(and(eq(eventParticipation.id, participation.id), eq(eventParticipation.claimed, false)))
      .returning();
    if (!updated.length) throw new ApiError("Event reward already claimed.", 409, "already_claimed");
    await tx
      .update(players)
      .set({
        coins: sql`LEAST(${players.coins} + ${event.rewardCoins}, 1e18)`,
        totalCoinsEarned: sql`LEAST(${players.totalCoinsEarned} + ${event.rewardCoins}, 1e18)`,
        gems: sql`${players.gems} + ${event.rewardGems}`,
      })
      .where(eq(players.id, player.id));
    return { notices: [notice("event", `${event.title} reward`, `+${event.rewardCoins.toLocaleString("en-US")} sparks, +${event.rewardGems} prisms.`, "gold")] };
  });
}

export async function deepReset(ctx: AuthContext, tier: "rebirth" | "prestige" | "ascension"): Promise<{ state: GameState; notices: Notice[]; result: Record<string, unknown> }> {
  return mutate(ctx, async (tx, player, config) => {
    if (tier === "rebirth") {
      const required = rebirthRequirement(player.rebirths, config);
      const gain = rebirthEmbers(player.runCoinsEarned, player.rebirths, config);
      if (player.runCoinsEarned < required || gain <= 0) throw new ApiError(`You need ${required.toLocaleString("en-US")} sparks this run.`, 422, "requirement");
      await tx.delete(upgradeStates).where(eq(upgradeStates.playerId, player.id));
      await tx
        .update(players)
        .set({
          coins: 0,
          runCoinsEarned: 0,
          embers: sql`${players.embers} + ${gain}`,
          rebirths: sql`${players.rebirths} + 1`,
          seasonPoints: sql`${players.seasonPoints} + 100`,
          currentWorld: "ember-foothills",
          lastSyncAt: new Date(),
        })
        .where(eq(players.id, player.id));
      return { notices: [notice("system", "Rebirth complete", `+${gain} embers. Upgrades and sparks reset; companions, achievements and collection preserved.`, "gold")], result: { gain } };
    }
    if (tier === "prestige") {
      if (player.rebirths < 10) throw new ApiError("Prestige requires 10 rebirths.", 422, "requirement");
      const gain = Math.max(1, Math.floor(player.rebirths / 10) * 2);
      await tx.delete(upgradeStates).where(eq(upgradeStates.playerId, player.id));
      await tx
        .update(players)
        .set({
          coins: 0,
          runCoinsEarned: 0,
          embers: 0,
          rebirths: 0,
          sigils: sql`${players.sigils} + ${gain}`,
          prestiges: sql`${players.prestiges} + 1`,
          currentWorld: "ember-foothills",
        })
        .where(eq(players.id, player.id));
      return { notices: [notice("system", "Prestige complete", `+${gain} sigils. Embers and rebirth count reset; companions and achievements preserved.`, "gold")], result: { gain } };
    }
    if (player.sigils < 5) throw new ApiError("Ascension requires 5 sigils.", 422, "requirement");
    const gain = Math.max(1, Math.floor(player.sigils / 5));
    await tx.delete(upgradeStates).where(eq(upgradeStates.playerId, player.id));
    await tx
      .update(players)
      .set({
        coins: 0,
        runCoinsEarned: 0,
        embers: 0,
        rebirths: 0,
        sigils: 0,
        echoes: sql`${players.echoes} + ${gain}`,
        ascensions: sql`${players.ascensions} + 1`,
        currentWorld: "ember-foothills",
      })
      .where(eq(players.id, player.id));
    return { notices: [notice("system", "Ascension complete", `+${gain} echoes. All lower currencies reset; collection and achievements remain.`, "gold")], result: { gain } };
  });
}

export async function updateProfile(
  ctx: AuthContext,
  patch: { avatarColor?: string; title?: string; muted?: boolean; compactMode?: boolean },
): Promise<{ state: GameState; notices: Notice[] }> {
  return mutate(ctx, async (tx, player) => {
    const set: Partial<typeof players.$inferInsert> = {};
    if (patch.avatarColor && AVATAR_COLORS.includes(patch.avatarColor)) set.avatarColor = patch.avatarColor;
    if (patch.title && TITLES.includes(patch.title)) set.title = patch.title;
    if (typeof patch.muted === "boolean") set.muted = patch.muted;
    if (typeof patch.compactMode === "boolean") set.compactMode = patch.compactMode;
    if (!Object.keys(set).length) throw new ApiError("Nothing to update.", 422, "empty");
    void player;
    await tx.update(players).set(set).where(eq(players.id, ctx.player.id));
    return { notices: [notice("system", "Profile saved", "Your preferences are stored on the server.", "gold")] };
  });
}

export const LEADERBOARD_METRICS = [
  { id: "clicks", label: "Total Clicks", column: players.totalClicks },
  { id: "earned", label: "Sparks Earned", column: players.totalCoinsEarned },
  { id: "rebirths", label: "Rebirths", column: players.rebirths },
  { id: "prestiges", label: "Prestiges", column: players.prestiges },
  { id: "season", label: "Season Points", column: players.seasonPoints },
  { id: "achievements", label: "Achievement Points", column: players.achievementPoints },
  { id: "playtime", label: "Playtime", column: players.playtimeSeconds },
] as const;

const boardCache = globalThis as typeof globalThis & {
  __obsidiaBoards?: Map<string, { at: number; payload: unknown }>;
};
const boards = (boardCache.__obsidiaBoards ??= new Map());

export async function getLeaderboard(input: { metric: string; page: number; search?: string; viewerId?: string }) {
  const metric = LEADERBOARD_METRICS.find((m) => m.id === input.metric) ?? LEADERBOARD_METRICS[0];
  const page = Math.max(1, Math.min(1000, Math.floor(input.page)));
  const pageSize = 20;
  const search = (input.search ?? "").trim().slice(0, 32);
  const cacheKey = `${metric.id}:${page}:${search}`;
  const cached = boards.get(cacheKey);
  if (cached && Date.now() - cached.at < 12000) return cached.payload;

  const where = search ? sql`${players.username} ILIKE ${`%${search}%`}` : undefined;
  const rows = await db
    .select({
      playerId: players.id,
      username: players.username,
      title: players.title,
      avatarColor: players.avatarColor,
      level: players.level,
      rebirths: players.rebirths,
      value: metric.column,
    })
    .from(players)
    .where(where)
    .orderBy(desc(metric.column), desc(players.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const totalRows = await db.select({ value: count() }).from(players).where(where);
  const total = Number(totalRows[0]?.value ?? 0);

  let me: { rank: number; value: number } | null = null;
  if (input.viewerId) {
    const mine = await db.select({ value: metric.column }).from(players).where(eq(players.id, input.viewerId)).limit(1);
    if (mine.length) {
      const higher = await db
        .select({ value: count() })
        .from(players)
        .where(sql`${metric.column} > ${mine[0].value}`);
      me = { rank: Number(higher[0]?.value ?? 0) + 1, value: Number(mine[0].value) };
    }
  }

  const payload = {
    metric: metric.id,
    rows: rows.map((row, i) => ({
      rank: (page - 1) * pageSize + i + 1,
      playerId: row.playerId,
      username: row.username,
      title: row.title,
      avatarColor: row.avatarColor,
      level: row.level,
      rebirths: row.rebirths,
      value: Number(row.value),
    })) as LeaderboardRow[],
    total,
    page,
    pageSize,
    me,
    generatedAt: new Date().toISOString(),
  };
  boards.set(cacheKey, { at: Date.now(), payload });
  return payload;
}

export async function createPlayerProfile(userId: string, username: string, avatarColor = "ember") {
  const rows = await db
    .insert(players)
    .values({
      userId,
      username,
      avatarColor: AVATAR_COLORS.includes(avatarColor) ? avatarColor : "ember",
      coins: 0,
      title: "Initiate",
    })
    .returning();
  return rows[0];
}

export async function updateHighestWorld(tx: Tx, player: PlayerRow) {
  const unlockedIndex = WORLDS.filter((w) => player.totalCoinsEarned >= w.unlockAt).reduce((max, w) => Math.max(max, w.index), 0);
  if (unlockedIndex > player.highestWorldIndex) {
    await tx.update(players).set({ highestWorldIndex: unlockedIndex }).where(eq(players.id, player.id));
  }
}

export type { DerivedStats };
