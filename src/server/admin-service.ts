import { and, asc, count, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  announcements,
  auditLogs,
  codeRedemptions,
  configVersions,
  gameConfig,
  gameEvents,
  moderationCases,
  petInventory,
  playerAchievements,
  playerPurchases,
  playerQuests,
  players,
  redeemCodes,
  sessions,
  upgradeStates,
  users,
} from "@/db/schema";
import { ApiError, newRequestId, writeAudit } from "@/lib/api";
import { hasPermission, type AuthContext } from "@/lib/auth";
import { ADMIN_ROLES, EGGS, PERMISSIONS, ROLE_LABELS, type AdminRole } from "@/lib/content";
import { clampValue, validateEggWeights } from "@/lib/economy";
import { getEconomyConfig, listConfigVersions, publishConfig, rollbackConfig } from "@/server/config-service";

export type AdminSection =
  | "overview"
  | "players"
  | "economy"
  | "events"
  | "codes"
  | "moderation"
  | "audit"
  | "config";

export interface AdminSnapshot {
  overview: {
    players: number;
    activeSessions: number;
    newToday: number;
    new7d: number;
    totalClicks: number;
    totalEarned: number;
    totalRebirths: number;
    activeEvents: number;
    codesRedeemed: number;
    gemsCirculation: number;
    averageEarned: number;
    retention: number;
    playersWithPets: number;
    dbLatencyMs: number;
    migrations: number;
    uptimeSeconds: number;
    generatedAt: string;
  };
  signups: { date: string; count: number }[];
  economyBuckets: { bucket: string; players: number }[];
  topPlayers: { id: string; username: string; totalCoinsEarned: number; rebirths: number; level: number }[];
  activeEventList: { id: string; title: string; status: string; multiplier: number; startsAt: string; endsAt: string; participation: number }[];
  recentAudit: AuditEntry[];
  playerRows: PlayerRowView[];
  playerTotal: number;
  auditRows: AuditEntry[];
  auditTotal: number;
  events: EventAdminView[];
  codes: CodeAdminView[];
  moderation: ModerationView[];
  config: { live: Record<string, unknown>; version: number; permissions: Record<string, string[]>; roleLabels: Record<string, string> };
  versions: { version: number; label: string; adminName: string; createdAt: string }[];
  eggs: { id: string; name: string; worldId: string; price: number; total: number; valid: boolean; entries: { petId: string; name: string; rarity: string; weight: number; probability: number }[] }[];
  announcements: { id: string; message: string; tone: string; active: boolean; createdAt: string }[];
  permissions: string[];
  role: AdminRole;
  requests: { id: string; window: string }[];
}

interface AuditEntry {
  id: string;
  adminName: string;
  action: string;
  targetType: string;
  targetId: string | null;
  reason: string;
  result: string;
  requestId: string;
  createdAt: string;
  before: unknown;
  after: unknown;
}

interface PlayerRowView {
  id: string;
  userId: string;
  username: string;
  email: string;
  role: string;
  coins: number;
  gems: number;
  totalCoinsEarned: number;
  totalClicks: number;
  rebirths: number;
  level: number;
  pets: number;
  isBanned: boolean;
  bannedUntil: string | null;
  createdAt: string;
  lastSeenAt: string;
}

interface EventAdminView {
  id: string;
  slug: string;
  title: string;
  description: string;
  type: string;
  multiplier: number;
  status: string;
  startsAt: string;
  endsAt: string;
  goalClicks: number;
  rewardCoins: number;
  rewardGems: number;
  participation: number;
}

interface CodeAdminView {
  id: string;
  code: string;
  rewardCoins: number;
  rewardGems: number;
  rewardEmbers: number;
  maxRedemptions: number;
  redeemedCount: number;
  perUserLimit: number;
  active: boolean;
  startsAt: string;
  endsAt: string | null;
}

interface ModerationView {
  id: string;
  caseNumber: number;
  playerId: string | null;
  username: string | null;
  type: string;
  reason: string;
  notes: string | null;
  adminId: string | null;
  expiresAt: string | null;
  createdAt: string;
}

const mapAudit = (row: typeof auditLogs.$inferSelect): AuditEntry => ({
  id: row.id,
  adminName: row.adminName,
  action: row.action,
  targetType: row.targetType,
  targetId: row.targetId,
  reason: row.reason,
  result: row.result,
  requestId: row.requestId,
  createdAt: row.createdAt.toISOString(),
  before: row.before,
  after: row.after,
});

export async function getAdminSnapshot(
  actor: AuthContext,
  filters: { q?: string; page?: number; auditAction?: string; section?: AdminSection },
): Promise<AdminSnapshot> {
  if (!hasPermission(actor.user.role, "overview.read")) throw new ApiError("Admin access required.", 403, "forbidden");
  const started = Date.now();
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 3600 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 3600 * 1000);
  const page = Math.max(1, Math.min(500, Math.floor(filters.page ?? 1)));
  const pageSize = 10;
  const q = (filters.q ?? "").trim().slice(0, 40);

  const playerCountRow = await db.select({ value: count() }).from(players);
  const activeSessionsRow = await db.select({ value: count() }).from(sessions).where(gte(sessions.lastSeenAt, dayAgo));
  const newTodayRow = await db.select({ value: count() }).from(users).where(gte(users.createdAt, new Date(now.getFullYear(), now.getMonth(), now.getDate())));
  const new7dRow = await db.select({ value: count() }).from(users).where(gte(users.createdAt, weekAgo));
  const totalsRow = await db
    .select({
      clicks: sql<number>`COALESCE(SUM(${players.totalClicks}), 0)`,
      earned: sql<number>`COALESCE(SUM(${players.totalCoinsEarned}), 0)`,
      rebirths: sql<number>`COALESCE(SUM(${players.rebirths}), 0)`,
      gems: sql<number>`COALESCE(SUM(${players.gems}), 0)`,
      avg: sql<number>`COALESCE(AVG(${players.totalCoinsEarned}), 0)`,
    })
    .from(players);
  const activeEventsRow = await db.select({ value: count() }).from(gameEvents).where(and(eq(gameEvents.status, "active"), gte(gameEvents.endsAt, now)));
  const redemptionsRow = await db.select({ value: count() }).from(codeRedemptions);
  const retentionRow = await db.select({ value: count() }).from(players).where(gte(players.lastSeenAt, weekAgo));
  const petsOwnersRow = await db.select({ value: sql<number>`COUNT(DISTINCT ${petInventory.playerId})` }).from(petInventory);
  const migrationsRow = await db.execute(sql`SELECT COUNT(*)::int AS n FROM drizzle.__drizzle_migrations`).catch(() => ({ rows: [{ n: 0 }] }));
  const migrationCount = Number((migrationsRow as { rows: { n: number }[] }).rows?.[0]?.n ?? 0);

  const signupRows = await db
    .select({ date: sql<string>`to_char(${users.createdAt}, 'YYYY-MM-DD')`, value: count() })
    .from(users)
    .where(gte(users.createdAt, twoWeeksAgo))
    .groupBy(sql`to_char(${users.createdAt}, 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(${users.createdAt}, 'YYYY-MM-DD')`);

  const bucketDefs = [
    { bucket: "0 – 1K", min: 0, max: 1_000 },
    { bucket: "1K – 1M", min: 1_000, max: 1_000_000 },
    { bucket: "1M – 1B", min: 1_000_000, max: 1_000_000_000 },
    { bucket: "1B – 1T", min: 1_000_000_000, max: 1_000_000_000_000 },
    { bucket: "1T – 1Qa", min: 1_000_000_000_000, max: 1e15 },
    { bucket: "1Qa+", min: 1e15, max: 1e18 },
  ];
  const bucketRows = await db
    .select({
      low: sql<number>`CASE
        WHEN ${players.totalCoinsEarned} < 1000 THEN 0
        WHEN ${players.totalCoinsEarned} < 1000000 THEN 1
        WHEN ${players.totalCoinsEarned} < 1000000000 THEN 2
        WHEN ${players.totalCoinsEarned} < 1000000000000 THEN 3
        WHEN ${players.totalCoinsEarned} < 1e15 THEN 4
        ELSE 5 END`,
      value: count(),
    })
    .from(players)
    .groupBy(sql`1`);
  const bucketMap = new Map(bucketRows.map((r) => [Number(r.low), Number(r.value)]));

  const topPlayers = await db
    .select({ id: players.id, username: players.username, totalCoinsEarned: players.totalCoinsEarned, rebirths: players.rebirths, level: players.level })
    .from(players)
    .orderBy(desc(players.totalCoinsEarned))
    .limit(5);

  const eventRows = await db.select().from(gameEvents).orderBy(desc(gameEvents.startsAt)).limit(30);
  const participationCounts = await db
    .select({ eventId: sql<string>`${sql.raw("event_id")}`, value: count() })
    .from(sql`event_participation`)
    .groupBy(sql`event_id`);
  const participationMap = new Map((participationCounts as unknown as { eventId: string; value: number }[]).map((r) => [r.eventId, Number(r.value)]));

  const auditRows = await db
    .select()
    .from(auditLogs)
    .where(filters.auditAction ? eq(auditLogs.action, filters.auditAction) : undefined)
    .orderBy(desc(auditLogs.createdAt))
    .limit(60);
  const auditTotalRow = await db.select({ value: count() }).from(auditLogs);
  const recentAudit = auditRows.slice(0, 8).map(mapAudit);

  const searchWhere = q
    ? or(ilike(players.username, `%${q}%`), ilike(users.email, `%${q}%`), sql`${players.id}::text ILIKE ${`%${q}%`}`)
    : undefined;

  const playerRowsRaw = await db
    .select({
      id: players.id,
      userId: players.userId,
      username: players.username,
      email: users.email,
      role: users.role,
      coins: players.coins,
      gems: players.gems,
      totalCoinsEarned: players.totalCoinsEarned,
      totalClicks: players.totalClicks,
      rebirths: players.rebirths,
      level: players.level,
      isBanned: users.isBanned,
      bannedUntil: users.bannedUntil,
      createdAt: players.createdAt,
      lastSeenAt: players.lastSeenAt,
    })
    .from(players)
    .innerJoin(users, eq(users.id, players.userId))
    .where(searchWhere)
    .orderBy(desc(players.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const playerTotalRow = await db
    .select({ value: count() })
    .from(players)
    .innerJoin(users, eq(users.id, players.userId))
    .where(searchWhere);

  const petCountRows = await db
    .select({ playerId: petInventory.playerId, value: count() })
    .from(petInventory)
    .where(inArray(petInventory.playerId, playerRowsRaw.length ? playerRowsRaw.map((p) => p.id) : ["00000000-0000-0000-0000-000000000000"]))
    .groupBy(petInventory.playerId);
  const petMap = new Map(petCountRows.map((r) => [r.playerId, Number(r.value)]));

  const codeRows = await db.select().from(redeemCodes).orderBy(desc(redeemCodes.createdAt)).limit(40);
  const moderationRows = await db
    .select({
      id: moderationCases.id,
      caseNumber: moderationCases.caseNumber,
      playerId: moderationCases.playerId,
      username: players.username,
      type: moderationCases.type,
      reason: moderationCases.reason,
      notes: moderationCases.notes,
      adminId: moderationCases.adminId,
      expiresAt: moderationCases.expiresAt,
      createdAt: moderationCases.createdAt,
    })
    .from(moderationCases)
    .leftJoin(players, eq(players.id, moderationCases.playerId))
    .orderBy(desc(moderationCases.createdAt))
    .limit(40);

  const versions = await listConfigVersions(12);
  const economy = await getEconomyConfig();
  const announcementRows = await db.select().from(announcements).orderBy(desc(announcements.createdAt)).limit(12);

  const eggs = EGGS.map((egg) => {
    const validation = validateEggWeights(egg.entries);
    const total = egg.entries.reduce((a, b) => a + b.weight, 0);
    return {
      id: egg.id,
      name: egg.name,
      worldId: egg.worldId,
      price: egg.price,
      total,
      valid: validation.ok,
      entries: egg.entries.map((entry) => {
        const pet = EGGS.find((e) => e.id === egg.id)?.entries.find((e) => e.petId === entry.petId);
        void pet;
        const nameParts = entry.petId.split("-");
        return {
          petId: entry.petId,
          name: nameParts.slice(0, -1).join(" ").replace(/-/g, " "),
          rarity: entry.petId.includes("celestial") ? "celestial" : entry.petId.includes("secret") ? "secret" : "world",
          weight: entry.weight,
          probability: Math.round((entry.weight / total) * 10000) / 100,
        };
      }),
    };
  });

  return {
    overview: {
      players: Number(playerCountRow[0]?.value ?? 0),
      activeSessions: Number(activeSessionsRow[0]?.value ?? 0),
      newToday: Number(newTodayRow[0]?.value ?? 0),
      new7d: Number(new7dRow[0]?.value ?? 0),
      totalClicks: Number(totalsRow[0]?.clicks ?? 0),
      totalEarned: Number(totalsRow[0]?.earned ?? 0),
      totalRebirths: Number(totalsRow[0]?.rebirths ?? 0),
      activeEvents: Number(activeEventsRow[0]?.value ?? 0),
      codesRedeemed: Number(redemptionsRow[0]?.value ?? 0),
      gemsCirculation: Number(totalsRow[0]?.gems ?? 0),
      averageEarned: Number(totalsRow[0]?.avg ?? 0),
      retention: Number(retentionRow[0]?.value ?? 0),
      playersWithPets: Number(petsOwnersRow[0]?.value ?? 0),
      dbLatencyMs: Date.now() - started,
      migrations: migrationCount,
      uptimeSeconds: Math.floor(process.uptime()),
      generatedAt: now.toISOString(),
    },
    signups: signupRows.map((r) => ({ date: r.date, count: Number(r.value) })),
    economyBuckets: bucketDefs.map((def, i) => ({ bucket: def.bucket, players: bucketMap.get(i) ?? 0 })),
    topPlayers: topPlayers.map((p) => ({ ...p, totalCoinsEarned: Number(p.totalCoinsEarned) })),
    activeEventList: eventRows
      .filter((e) => e.status === "active")
      .map((e) => ({
        id: e.id,
        title: e.title,
        status: e.status,
        multiplier: e.multiplier,
        startsAt: e.startsAt.toISOString(),
        endsAt: e.endsAt.toISOString(),
        participation: participationMap.get(e.id) ?? 0,
      })),
    recentAudit,
    playerRows: playerRowsRaw.map((row) => ({
      ...row,
      coins: Number(row.coins),
      gems: Number(row.gems),
      totalCoinsEarned: Number(row.totalCoinsEarned),
      totalClicks: Number(row.totalClicks),
      pets: petMap.get(row.id) ?? 0,
      bannedUntil: row.bannedUntil ? row.bannedUntil.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      lastSeenAt: row.lastSeenAt.toISOString(),
    })),
    playerTotal: Number(playerTotalRow[0]?.value ?? 0),
    auditRows: auditRows.map(mapAudit),
    auditTotal: Number(auditTotalRow[0]?.value ?? 0),
    events: eventRows.map((e) => ({
      id: e.id,
      slug: e.slug,
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
      participation: participationMap.get(e.id) ?? 0,
    })),
    codes: codeRows.map((c) => ({
      id: c.id,
      code: c.code,
      rewardCoins: c.rewardCoins,
      rewardGems: c.rewardGems,
      rewardEmbers: c.rewardEmbers,
      maxRedemptions: c.maxRedemptions,
      redeemedCount: c.redeemedCount,
      perUserLimit: c.perUserLimit,
      active: c.active,
      startsAt: c.startsAt.toISOString(),
      endsAt: c.endsAt ? c.endsAt.toISOString() : null,
    })),
    moderation: moderationRows.map((m) => ({
      ...m,
      expiresAt: m.expiresAt ? m.expiresAt.toISOString() : null,
      createdAt: m.createdAt.toISOString(),
    })),
    config: {
      live: economy.config as unknown as Record<string, unknown>,
      version: economy.version,
      permissions: PERMISSIONS,
      roleLabels: ROLE_LABELS,
    },
    versions: versions.map((v) => ({ version: v.version, label: v.label, adminName: v.adminName, createdAt: v.createdAt.toISOString() })),
    eggs,
    announcements: announcementRows.map((a) => ({ id: a.id, message: a.message, tone: a.tone, active: a.active, createdAt: a.createdAt.toISOString() })),
    permissions: PERMISSIONS[actor.user.role] ?? [],
    role: actor.user.role,
    requests: [],
  };
}

export async function getPlayerDetail(actor: AuthContext, playerId: string) {
  if (!hasPermission(actor.user.role, "players.read")) throw new ApiError("Permission denied.", 403, "forbidden");
  const rows = await db
    .select({
      id: players.id,
      userId: players.userId,
      username: players.username,
      email: users.email,
      role: users.role,
      coins: players.coins,
      gems: players.gems,
      embers: players.embers,
      sigils: players.sigils,
      echoes: players.echoes,
      totalClicks: players.totalClicks,
      totalCoinsEarned: players.totalCoinsEarned,
      rebirths: players.rebirths,
      prestiges: players.prestiges,
      ascensions: players.ascensions,
      level: players.level,
      currentWorld: players.currentWorld,
      createdAt: players.createdAt,
      lastSeenAt: players.lastSeenAt,
      isBanned: users.isBanned,
      bannedUntil: users.bannedUntil,
      banReason: users.banReason,
    })
    .from(players)
    .innerJoin(users, eq(users.id, players.userId))
    .where(eq(players.id, playerId))
    .limit(1);
  const row = rows[0];
  if (!row) throw new ApiError("Player not found.", 404, "not_found");
  const [upgrades, pets, achievements, purchases, cases, logs, questRows, sessionRows] = await Promise.all([
    db.select().from(upgradeStates).where(eq(upgradeStates.playerId, playerId)),
    db.select().from(petInventory).where(eq(petInventory.playerId, playerId)),
    db.select({ value: count() }).from(playerAchievements).where(eq(playerAchievements.playerId, playerId)),
    db.select().from(playerPurchases).where(eq(playerPurchases.playerId, playerId)),
    db.select().from(moderationCases).where(eq(moderationCases.playerId, playerId)).orderBy(desc(moderationCases.createdAt)).limit(10),
    db.select().from(auditLogs).where(eq(auditLogs.targetId, playerId)).orderBy(desc(auditLogs.createdAt)).limit(15),
    db.select().from(playerQuests).where(eq(playerQuests.playerId, playerId)).orderBy(desc(playerQuests.assignedAt)).limit(20),
    db.select().from(sessions).where(eq(sessions.userId, row.userId)).orderBy(desc(sessions.lastSeenAt)).limit(5),
  ]);
  return {
    player: {
      ...row,
      coins: Number(row.coins),
      gems: Number(row.gems),
      embers: Number(row.embers),
      sigils: Number(row.sigils),
      echoes: Number(row.echoes),
      totalClicks: Number(row.totalClicks),
      totalCoinsEarned: Number(row.totalCoinsEarned),
      createdAt: row.createdAt.toISOString(),
      lastSeenAt: row.lastSeenAt.toISOString(),
      bannedUntil: row.bannedUntil ? row.bannedUntil.toISOString() : null,
    },
    upgrades: upgrades.map((u) => ({ id: u.upgradeId, level: u.level })),
    pets: pets.map((p) => ({ id: p.id, petId: p.petId, rarity: p.rarity, golden: p.isGolden, shiny: p.isShiny, equipped: p.equipped })),
    achievements: Number(achievements[0]?.value ?? 0),
    purchases,
    cases: cases.map((c) => ({ ...c, createdAt: c.createdAt.toISOString(), expiresAt: c.expiresAt?.toISOString() ?? null })),
    audit: logs.map(mapAudit),
    quests: questRows.map((q) => ({ id: q.questId, progress: q.progress, claimed: q.claimed })),
    sessions: sessionRows.map((s) => ({ id: s.id, lastSeenAt: s.lastSeenAt.toISOString(), expiresAt: s.expiresAt.toISOString() })),
  };
}

interface ActionContext {
  actor: AuthContext;
  requestId?: string;
  reason?: string;
}

const CURRENCY_COLUMNS = {
  coins: players.coins,
  gems: players.gems,
  embers: players.embers,
  sigils: players.sigils,
  echoes: players.echoes,
  clicks: players.totalClicks,
} as const;

type CurrencyKey = keyof typeof CURRENCY_COLUMNS;

function getPlayerBalance(player: typeof players.$inferSelect, currency: CurrencyKey): number {
  if (currency === "clicks") return Number(player.totalClicks);
  if (currency === "coins") return Number(player.coins);
  if (currency === "gems") return Number(player.gems);
  if (currency === "embers") return Number(player.embers);
  if (currency === "sigils") return Number(player.sigils);
  if (currency === "echoes") return Number(player.echoes);
  return 0;
}

const STAT_COLUMNS = {
  totalClicks: players.totalClicks,
  totalCoinsEarned: players.totalCoinsEarned,
  seasonPoints: players.seasonPoints,
  bestCombo: players.bestCombo,
  playtimeSeconds: players.playtimeSeconds,
  achievementPoints: players.achievementPoints,
  rebirths: players.rebirths,
  prestiges: players.prestiges,
  level: players.level,
} as const;

async function findPlayer(playerId: string) {
  const rows = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
  if (!rows[0]) throw new ApiError("Player not found.", 404, "not_found");
  return rows[0];
}

async function auditAction(ctx: ActionContext, input: {
  action: string;
  targetType: string;
  targetId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  meta?: Record<string, unknown>;
  reason?: string;
}) {
  await writeAudit({
    adminId: ctx.actor.user.id,
    adminName: ctx.actor.player.username,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId ?? null,
    reason: input.reason ?? ctx.reason ?? "",
    before: input.before ?? null,
    after: input.after ?? null,
    requestId: ctx.requestId ?? newRequestId(),
    meta: input.meta ?? null,
  });
}

export async function runAdminAction(actor: AuthContext, input: { action: string; payload: Record<string, unknown>; reason?: string; requestId?: string }) {
  const ctx: ActionContext = { actor, reason: input.reason, requestId: input.requestId };
  const payload = input.payload;
  const action = input.action;
  const reason = (input.reason ?? "").trim();

  const requireReason = () => {
    if (reason.length < 3) throw new ApiError("A reason of at least 3 characters is required.", 422, "reason_required");
  };

  try {
    switch (action) {
      case "quickGrant": {
        if (!hasPermission(actor.user.role, "players.economy")) throw new ApiError("Permission denied.", 403, "forbidden");
        const playerId = String(payload.playerId ?? "");
        const currency = String(payload.currency ?? "coins") as CurrencyKey;
        const amount = Math.floor(Number(payload.amount ?? 0));
        if (!(currency in CURRENCY_COLUMNS)) throw new ApiError("Unknown currency.", 422, "bad_currency");
        if (!Number.isFinite(amount) || amount <= 0 || amount > 1e18) throw new ApiError("Amount must be between 1 and 1e18.", 422, "bad_amount");
        const player = await findPlayer(playerId);
        const delta = amount;
        if (currency === "clicks") {
          await db
            .update(players)
            .set({
              totalClicks: sql`GREATEST(0, LEAST(1e18, ${players.totalClicks} + ${delta}))`,
              seasonPoints: sql`GREATEST(0, LEAST(1e18, ${players.seasonPoints} + ${delta}))`,
            })
            .where(eq(players.id, playerId));
        } else {
          const column = CURRENCY_COLUMNS[currency];
          await db
            .update(players)
            .set({
              [currency]: sql`GREATEST(0, LEAST(1e18, ${column} + ${delta}))`,
              ...(currency === "coins" ? { totalCoinsEarned: sql`LEAST(1e18, ${players.totalCoinsEarned} + ${amount})` } : {}),
            })
            .where(eq(players.id, playerId));
        }
        const updated = await findPlayer(playerId);
        const beforeVal = getPlayerBalance(player, currency);
        const afterVal = getPlayerBalance(updated, currency);
        const actReason = reason || `⚡ Instant Quick Grant +${amount.toLocaleString("en-US")} ${currency}`;
        await auditAction(ctx, {
          action: "economy.quickGrant",
          targetType: "player",
          targetId: playerId,
          reason: actReason,
          before: { [currency]: beforeVal },
          after: { [currency]: afterVal },
          meta: { amount, currency, quick: true },
        });
        return {
          message: `⚡ Instant Quick Grant: +${amount.toLocaleString("en-US")} ${currency} to ${player.username} (new balance: ${afterVal.toLocaleString("en-US")}).`,
          player: updated.id,
        };
      }
      case "grant":
      case "take": {
        if (!hasPermission(actor.user.role, "players.economy")) throw new ApiError("Permission denied.", 403, "forbidden");
        requireReason();
        const playerId = String(payload.playerId ?? "");
        const currency = String(payload.currency ?? "coins") as CurrencyKey;
        const amount = Math.floor(Number(payload.amount ?? 0));
        if (!(currency in CURRENCY_COLUMNS)) throw new ApiError("Unknown currency.", 422, "bad_currency");
        if (!Number.isFinite(amount) || amount <= 0 || amount > 1e18) throw new ApiError("Amount must be between 1 and 1e18.", 422, "bad_amount");
        const player = await findPlayer(playerId);
        const currentVal = getPlayerBalance(player, currency);
        const delta = action === "grant" ? amount : -amount;
        if (action === "take" && currentVal < amount) throw new ApiError("Player does not hold that much.", 422, "insufficient");
        if (currency === "clicks") {
          await db
            .update(players)
            .set({
              totalClicks: sql`GREATEST(0, LEAST(1e18, ${players.totalClicks} + ${delta}))`,
              seasonPoints: sql`GREATEST(0, LEAST(1e18, ${players.seasonPoints} + ${delta}))`,
            })
            .where(eq(players.id, playerId));
        } else {
          const column = CURRENCY_COLUMNS[currency];
          await db
            .update(players)
            .set({
              [currency]: sql`GREATEST(0, LEAST(1e18, ${column} + ${delta}))`,
              ...(currency === "coins" && action === "grant" ? { totalCoinsEarned: sql`LEAST(1e18, ${players.totalCoinsEarned} + ${amount})` } : {}),
            })
            .where(eq(players.id, playerId));
        }
        const updated = await findPlayer(playerId);
        const newVal = getPlayerBalance(updated, currency);
        await auditAction(ctx, {
          action: action === "grant" ? "economy.grant" : "economy.take",
          targetType: "player",
          targetId: playerId,
          reason,
          before: { [currency]: currentVal },
          after: { [currency]: newVal },
          meta: { amount, currency },
        });
        return { message: `${action === "grant" ? "Granted" : "Removed"} ${amount.toLocaleString("en-US")} ${currency} — live balance ${newVal.toLocaleString("en-US")}.`, player: updated.id };
      }
      case "setstat": {
        if (!hasPermission(actor.user.role, "players.economy")) throw new ApiError("Permission denied.", 403, "forbidden");
        requireReason();
        const playerId = String(payload.playerId ?? "");
        const stat = String(payload.stat ?? "") as keyof typeof STAT_COLUMNS;
        const value = Math.floor(Number(payload.value ?? 0));
        if (!(stat in STAT_COLUMNS)) throw new ApiError("Unknown statistic.", 422, "bad_stat");
        if (!Number.isFinite(value) || value < 0 || value > 1e18) throw new ApiError("Value out of allowed range.", 422, "bad_amount");
        const player = await findPlayer(playerId);
        const column = STAT_COLUMNS[stat];
        await db.update(players).set({ [stat]: sql`${column} * 0 + ${value}` }).where(eq(players.id, playerId));
        await auditAction(ctx, {
          action: "player.setstat",
          targetType: "player",
          targetId: playerId,
          reason,
          before: { [stat]: Number(player[stat]) },
          after: { [stat]: value },
        });
        return { message: `${stat} set to ${value.toLocaleString("en-US")}.`, player: playerId };
      }
      case "givePet": {
        if (!hasPermission(actor.user.role, "players.items")) throw new ApiError("Permission denied.", 403, "forbidden");
        requireReason();
        const playerId = String(payload.playerId ?? "");
        const petId = String(payload.petId ?? "");
        const pet = EGGS.flatMap((e) => e.entries).find((e) => e.petId === petId);
        if (!pet) throw new ApiError("Unknown pet definition.", 404, "no_pet");
        await findPlayer(playerId);
        const inserted = await db
          .insert(petInventory)
          .values({ playerId, petId, rarity: petId.includes("celestial") ? "celestial" : petId.includes("secret") ? "secret" : "rare" })
          .returning();
        await auditAction(ctx, { action: "player.pet.give", targetType: "player", targetId: playerId, reason, after: { petId, rowId: inserted[0]?.id } });
        return { message: `Companion ${petId} added to the sanctuary.`, petId };
      }
      case "removePet": {
        if (!hasPermission(actor.user.role, "players.items")) throw new ApiError("Permission denied.", 403, "forbidden");
        requireReason();
        const playerId = String(payload.playerId ?? "");
        const rowId = String(payload.rowId ?? "");
        const deleted = await db.delete(petInventory).where(and(eq(petInventory.id, rowId), eq(petInventory.playerId, playerId))).returning();
        if (!deleted.length) throw new ApiError("Companion not found on this player.", 404, "not_found");
        await auditAction(ctx, { action: "player.pet.remove", targetType: "player", targetId: playerId, reason, before: { petId: deleted[0].petId } });
        return { message: "Companion removed.", rowId };
      }
      case "resetProgression": {
        if (!hasPermission(actor.user.role, "players.reset")) throw new ApiError("Permission denied.", 403, "forbidden");
        requireReason();
        const playerId = String(payload.playerId ?? "");
        const player = await findPlayer(playerId);
        await db.transaction(async (tx) => {
          await tx.delete(upgradeStates).where(eq(upgradeStates.playerId, playerId));
          await tx
            .update(players)
            .set({ coins: 0, runCoinsEarned: 0, totalCoinsEarned: 0, totalClicks: 0, embers: 0, sigils: 0, echoes: 0, rebirths: 0, prestiges: 0, ascensions: 0, level: 1, xp: 0, currentWorld: "ember-foothills", highestWorldIndex: 0 })
            .where(eq(players.id, playerId));
        });
        await auditAction(ctx, {
          action: "player.reset",
          targetType: "player",
          targetId: playerId,
          reason,
          before: { coins: player.coins, rebirths: player.rebirths, totalClicks: player.totalClicks },
          after: { coins: 0, rebirths: 0, totalClicks: 0 },
        });
        return { message: "Progression reset. Collection and achievements preserved." };
      }
      case "resetSubsystem": {
        if (!hasPermission(actor.user.role, "players.reset")) throw new ApiError("Permission denied.", 403, "forbidden");
        requireReason();
        const playerId = String(payload.playerId ?? "");
        const subsystem = String(payload.subsystem ?? "");
        await findPlayer(playerId);
        if (subsystem === "upgrades") await db.delete(upgradeStates).where(eq(upgradeStates.playerId, playerId));
        else if (subsystem === "quests") await db.delete(playerQuests).where(eq(playerQuests.playerId, playerId));
        else if (subsystem === "achievements") await db.delete(playerAchievements).where(eq(playerAchievements.playerId, playerId));
        else if (subsystem === "pets") await db.delete(petInventory).where(eq(petInventory.playerId, playerId));
        else throw new ApiError("Unknown subsystem.", 422, "bad_subsystem");
        await auditAction(ctx, { action: `player.reset.${subsystem}`, targetType: "player", targetId: playerId, reason });
        return { message: `${subsystem} reset for player.` };
      }
      case "ban": {
        if (!hasPermission(actor.user.role, "players.ban")) throw new ApiError("Permission denied.", 403, "forbidden");
        requireReason();
        const playerId = String(payload.playerId ?? "");
        const hours = Number(payload.hours ?? 0);
        const permanent = hours <= 0;
        const player = await findPlayer(playerId);
        const expiresAt = permanent ? null : new Date(Date.now() + Math.min(hours, 24 * 365) * 3600 * 1000);
        await db.update(users).set({ isBanned: true, bannedUntil: expiresAt, banReason: reason.slice(0, 200) }).where(eq(users.id, player.userId));
        await db.delete(sessions).where(eq(sessions.userId, player.userId));
        const caseCount = await db.select({ value: count() }).from(moderationCases);
        await db.insert(moderationCases).values({
          caseNumber: Number(caseCount[0]?.value ?? 0) + 1,
          playerId,
          userId: player.userId,
          type: permanent ? "permanent_ban" : "temporary_ban",
          reason: reason.slice(0, 500),
          adminId: actor.user.id,
          expiresAt,
        });
        await auditAction(ctx, { action: "moderation.ban", targetType: "player", targetId: playerId, reason, after: { permanent, expiresAt: expiresAt?.toISOString() ?? null }, meta: { sessionsRevoked: true } });
        return { message: permanent ? "Player permanently banned. Sessions revoked." : `Player banned for ${hours}h. Sessions revoked.` };
      }
      case "unban": {
        if (!hasPermission(actor.user.role, "players.ban")) throw new ApiError("Permission denied.", 403, "forbidden");
        requireReason();
        const playerId = String(payload.playerId ?? "");
        const player = await findPlayer(playerId);
        await db.update(users).set({ isBanned: false, bannedUntil: null, banReason: null }).where(eq(users.id, player.userId));
        const caseCount = await db.select({ value: count() }).from(moderationCases);
        await db.insert(moderationCases).values({
          caseNumber: Number(caseCount[0]?.value ?? 0) + 1,
          playerId,
          userId: player.userId,
          type: "unban",
          reason: reason.slice(0, 500),
          adminId: actor.user.id,
        });
        await auditAction(ctx, { action: "moderation.unban", targetType: "player", targetId: playerId, reason });
        return { message: "Player unbanned." };
      }
      case "warn": {
        if (!hasPermission(actor.user.role, "moderation.write")) throw new ApiError("Permission denied.", 403, "forbidden");
        requireReason();
        const playerId = String(payload.playerId ?? "");
        const player = await findPlayer(playerId);
        const caseCount = await db.select({ value: count() }).from(moderationCases);
        await db.insert(moderationCases).values({
          caseNumber: Number(caseCount[0]?.value ?? 0) + 1,
          playerId,
          userId: player.userId,
          type: "warning",
          reason: reason.slice(0, 500),
          notes: String(payload.notes ?? "").slice(0, 1000) || null,
          adminId: actor.user.id,
        });
        await auditAction(ctx, { action: "moderation.warn", targetType: "player", targetId: playerId, reason });
        return { message: "Warning case opened." };
      }
      case "setRole": {
        if (actor.user.role !== "owner") throw new ApiError("Only the owner can manage administrator roles.", 403, "forbidden");
        requireReason();
        const playerId = String(payload.playerId ?? "");
        const role = String(payload.role ?? "player") as AdminRole;
        if (!ADMIN_ROLES.includes(role)) throw new ApiError("Unknown role.", 422, "bad_role");
        if (playerId === actor.player.id && role !== "owner") throw new ApiError("You cannot remove your own ownership.", 422, "self_demote");
        const player = await findPlayer(playerId);
        await db.update(users).set({ role }).where(eq(users.id, player.userId));
        await auditAction(ctx, { action: "admin.setRole", targetType: "player", targetId: playerId, reason, before: { role: player.userId }, after: { role } });
        return { message: `Role updated to ${ROLE_LABELS[role]}.` };
      }
      case "event.create":
      case "event.update": {
        if (!hasPermission(actor.user.role, "events.write")) throw new ApiError("Permission denied.", 403, "forbidden");
        const title = String(payload.title ?? "").trim().slice(0, 80);
        const description = String(payload.description ?? "").trim().slice(0, 400);
        const type = String(payload.type ?? "double_energy").slice(0, 40);
        const multiplier = Math.min(20, Math.max(1, Number(payload.multiplier ?? 2)));
        const startsAt = new Date(String(payload.startsAt ?? ""));
        const endsAt = new Date(String(payload.endsAt ?? ""));
        if (title.length < 3) throw new ApiError("Title must be at least 3 characters.", 422, "bad_title");
        if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) throw new ApiError("Valid schedule required.", 422, "bad_schedule");
        if (endsAt <= startsAt) throw new ApiError("End must be after start.", 422, "bad_schedule");
        if (!description) throw new ApiError("Description required.", 422, "bad_description");
        const goalClicks = Math.max(0, Math.floor(Number(payload.goalClicks ?? 0)));
        const rewardCoins = clampValue(Number(payload.rewardCoins ?? 0));
        const rewardGems = clampValue(Number(payload.rewardGems ?? 0));
        const announcement = String(payload.announcement ?? "").slice(0, 200) || null;
        const status = endsAt < new Date() ? "ended" : startsAt <= new Date() ? "active" : "scheduled";
        if (action === "event.create") {
          const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}-${Date.now().toString(36).slice(-4)}`;
          const inserted = await db
            .insert(gameEvents)
            .values({ slug, title, description, type, multiplier, startsAt, endsAt, status, goalClicks, rewardCoins, rewardGems, announcement, createdBy: actor.user.id })
            .returning();
          if (announcement) await db.insert(announcements).values({ message: announcement, tone: "event", createdBy: actor.user.id });
          await auditAction(ctx, { action: "event.create", targetType: "event", targetId: inserted[0]?.id, after: { title, multiplier, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() } });
          return { message: `Event "${title}" scheduled with ×${multiplier} and status ${status}.`, eventId: inserted[0]?.id };
        }
        const eventId = String(payload.eventId ?? "");
        const existing = await db.select().from(gameEvents).where(eq(gameEvents.id, eventId)).limit(1);
        if (!existing[0]) throw new ApiError("Event not found.", 404, "not_found");
        await db.update(gameEvents).set({ title, description, type, multiplier, startsAt, endsAt, status, goalClicks, rewardCoins, rewardGems, announcement }).where(eq(gameEvents.id, eventId));
        await auditAction(ctx, {
          action: "event.update",
          targetType: "event",
          targetId: eventId,
          before: { title: existing[0].title, multiplier: existing[0].multiplier, status: existing[0].status },
          after: { title, multiplier, status },
        });
        return { message: `Event "${title}" updated (${status}).` };
      }
      case "event.start":
      case "event.stop": {
        if (!hasPermission(actor.user.role, "events.write")) throw new ApiError("Permission denied.", 403, "forbidden");
        const eventId = String(payload.eventId ?? "");
        const existing = await db.select().from(gameEvents).where(eq(gameEvents.id, eventId)).limit(1);
        if (!existing[0]) throw new ApiError("Event not found.", 404, "not_found");
        if (action === "event.start") {
          await db.update(gameEvents).set({ status: "active", startsAt: new Date(), endsAt: existing[0].endsAt > new Date() ? existing[0].endsAt : new Date(Date.now() + 6 * 3600 * 1000) }).where(eq(gameEvents.id, eventId));
        } else {
          await db.update(gameEvents).set({ status: "ended", endsAt: new Date() }).where(eq(gameEvents.id, eventId));
        }
        await auditAction(ctx, { action: action.replace(".", "."), targetType: "event", targetId: eventId, before: { status: existing[0].status }, after: { status: action === "event.start" ? "active" : "ended" } });
        return { message: action === "event.start" ? "Event is live." : "Event stopped." };
      }
      case "code.create": {
        if (!hasPermission(actor.user.role, "codes.write")) throw new ApiError("Permission denied.", 403, "forbidden");
        const code = String(payload.code ?? "").trim().toUpperCase().replace(/\s+/g, "-").slice(0, 32);
        if (!/^[A-Z0-9-]{3,32}$/.test(code)) throw new ApiError("Code must be 3–32 characters A–Z, 0–9 or dash.", 422, "bad_code");
        const rewardCoins = clampValue(Number(payload.rewardCoins ?? 0));
        const rewardGems = clampValue(Number(payload.rewardGems ?? 0));
        const rewardEmbers = clampValue(Number(payload.rewardEmbers ?? 0));
        if (rewardCoins + rewardGems + rewardEmbers <= 0) throw new ApiError("Code needs at least one reward.", 422, "bad_reward");
        const maxRedemptions = Math.max(0, Math.min(1_000_000, Math.floor(Number(payload.maxRedemptions ?? 0))));
        const perUserLimit = Math.max(1, Math.min(10, Math.floor(Number(payload.perUserLimit ?? 1))));
        const startsAt = payload.startsAt ? new Date(String(payload.startsAt)) : new Date();
        const endsAt = payload.endsAt ? new Date(String(payload.endsAt)) : null;
        if (endsAt && endsAt <= startsAt) throw new ApiError("Expiry must be after activation.", 422, "bad_schedule");
        const inserted = await db
          .insert(redeemCodes)
          .values({ code, rewardCoins, rewardGems, rewardEmbers, maxRedemptions, perUserLimit, startsAt, endsAt, createdBy: actor.user.id })
          .onConflictDoNothing()
          .returning();
        if (!inserted.length) throw new ApiError("That code already exists.", 409, "duplicate");
        await auditAction(ctx, { action: "code.create", targetType: "code", targetId: inserted[0].id, after: { code, rewardCoins, rewardGems, maxRedemptions } });
        return { message: `Code ${code} created and active.` };
      }
      case "code.toggle": {
        if (!hasPermission(actor.user.role, "codes.write")) throw new ApiError("Permission denied.", 403, "forbidden");
        const codeId = String(payload.codeId ?? "");
        const rows = await db.select().from(redeemCodes).where(eq(redeemCodes.id, codeId)).limit(1);
        if (!rows[0]) throw new ApiError("Code not found.", 404, "not_found");
        await db.update(redeemCodes).set({ active: !rows[0].active }).where(eq(redeemCodes.id, codeId));
        await auditAction(ctx, { action: "code.toggle", targetType: "code", targetId: codeId, before: { active: rows[0].active }, after: { active: !rows[0].active } });
        return { message: `Code ${rows[0].code} is now ${rows[0].active ? "disabled" : "active"}.` };
      }
      case "config.publish": {
        if (!hasPermission(actor.user.role, "config.write")) throw new ApiError("Permission denied.", 403, "forbidden");
        requireReason();
        const before = await getEconomyConfig();
        const result = await publishConfig({
          patch: (payload.config ?? {}) as Record<string, unknown>,
          adminId: actor.user.id,
          adminName: actor.player.username,
          label: reason,
        });
        await auditAction(ctx, { action: "config.publish", targetType: "config", targetId: "live", reason, before: before.config as unknown as Record<string, unknown>, after: result.config as unknown as Record<string, unknown> });
        return { message: `Configuration published as v${result.version}.`, version: result.version };
      }
      case "config.rollback": {
        if (!hasPermission(actor.user.role, "config.write")) throw new ApiError("Permission denied.", 403, "forbidden");
        requireReason();
        const version = Math.floor(Number(payload.version ?? 0));
        if (!Number.isFinite(version) || version <= 0) throw new ApiError("Version required.", 422, "bad_version");
        const result = await rollbackConfig({ version, adminId: actor.user.id, adminName: actor.player.username });
        await auditAction(ctx, { action: "config.rollback", targetType: "config", targetId: "live", reason, after: { restoredFrom: version, newVersion: result.version } });
        return { message: `Configuration rolled back from v${version}; published as v${result.version}.`, version: result.version };
      }
      case "announce": {
        if (!hasPermission(actor.user.role, "announce.write")) throw new ApiError("Permission denied.", 403, "forbidden");
        const message = String(payload.message ?? "").trim().slice(0, 240);
        if (message.length < 3) throw new ApiError("Announcement too short.", 422, "bad_message");
        const inserted = await db.insert(announcements).values({ message, tone: String(payload.tone ?? "info"), createdBy: actor.user.id }).returning();
        await auditAction(ctx, { action: "announce.publish", targetType: "announcement", targetId: inserted[0]?.id, after: { message } });
        return { message: "Announcement published to all players." };
      }
      case "announce.delete": {
        if (!hasPermission(actor.user.role, "announce.write")) throw new ApiError("Permission denied.", 403, "forbidden");
        const id = String(payload.id ?? "");
        await db.update(announcements).set({ active: false }).where(eq(announcements.id, id));
        await auditAction(ctx, { action: "announce.retire", targetType: "announcement", targetId: id });
        return { message: "Announcement retired." };
      }
      case "session.revoke": {
        if (!hasPermission(actor.user.role, "players.ban")) throw new ApiError("Permission denied.", 403, "forbidden");
        requireReason();
        const playerId = String(payload.playerId ?? "");
        const player = await findPlayer(playerId);
        const revoked = await db.delete(sessions).where(eq(sessions.userId, player.userId)).returning();
        await auditAction(ctx, { action: "session.revoke", targetType: "player", targetId: playerId, reason, meta: { revoked: revoked.length } });
        return { message: `${revoked.length} session(s) revoked.` };
      }
      case "purchase.refund": {
        if (!hasPermission(actor.user.role, "players.items")) throw new ApiError("Permission denied.", 403, "forbidden");
        requireReason();
        const playerId = String(payload.playerId ?? "");
        const purchaseId = String(payload.purchaseId ?? "");
        const rows = await db.select().from(playerPurchases).where(and(eq(playerPurchases.id, purchaseId), eq(playerPurchases.playerId, playerId))).limit(1);
        if (!rows[0]) throw new ApiError("Purchase not found.", 404, "not_found");
        await db.delete(playerPurchases).where(eq(playerPurchases.id, purchaseId));
        await db.update(players).set({ gems: sql`LEAST(1e18, ${players.gems} + ${rows[0].price})` }).where(eq(players.id, playerId));
        await auditAction(ctx, { action: "purchase.refund", targetType: "player", targetId: playerId, reason, before: { itemId: rows[0].itemId, price: rows[0].price } });
        return { message: `Purchase reversed and ${rows[0].price} gems returned.` };
      }
      case "database.health": {
        const started = Date.now();
        await db.execute(sql`SELECT 1`);
        const cfg = await getEconomyConfig();
        return { message: `Database responded in ${Date.now() - started}ms. Configuration v${cfg.version}.`, latency: Date.now() - started };
      }
      default:
        throw new ApiError("Unknown administrative action.", 400, "unknown_action");
    }
  } catch (error) {
    if (error instanceof ApiError) {
      await writeAudit({
        adminId: actor.user.id,
        adminName: actor.player.username,
        action: input.action,
        targetType: "system",
        targetId: String(input.payload.playerId ?? input.payload.eventId ?? "") || null,
        reason: input.reason ?? "",
        requestId: input.requestId ?? newRequestId(),
        result: "error",
        meta: { error: error.message },
      });
    }
    throw error;
  }
}

export async function runCommand(actor: AuthContext, raw: string) {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/")) throw new ApiError("Commands start with '/'. Type /help for the list.", 422, "bad_command");
  const parts = trimmed.slice(1).match(/(?:[^\s"]+|"[^"]*")+/g)?.map((p) => p.replace(/^"|"$/g, "")) ?? [];
  const [command, ...args] = parts;
  if (!command) throw new ApiError("Empty command.", 422, "bad_command");
  if (!hasPermission(actor.user.role, "console.use") && actor.user.role !== "admin") throw new ApiError("Command console is not available for your role.", 403, "forbidden");

  const resolvePlayer = async (identifier: string) => {
    const rows = await db
      .select({ id: players.id, username: players.username })
      .from(players)
      .where(or(eq(players.id, identifier), eq(players.username, identifier)))
      .limit(1);
    if (!rows[0]) throw new ApiError(`Player "${identifier}" not found. Use a username or player id.`, 404, "not_found");
    return rows[0];
  };

  switch (command) {
    case "help":
      return {
        message: [
          "/help — commands",
          "/player <username|id> — inspect a player",
          "/give <player> <coins|gems|embers|sigils|echoes|clicks> <amount> [reason]",
          "/take <player> <currency> <amount> [reason]",
          "/addclicks <player> <amount> [reason] — instantly add clicks",
          "/setstat <player> <stat> <value> <reason>",
          "/pet give <player> <petId> <reason>",
          "/event start|stop <eventId>",
          "/announce <message>",
          "/ban <player> <hours|0> <reason>",
          "/unban <player> <reason>",
          "/logs — recent audit entries",
          "/config validate — validate current economy config",
        ].join("\n"),
      };
    case "addclicks": {
      if (!args[0] || !args[1]) throw new ApiError("Usage: /addclicks <player> <amount> [reason]", 422, "usage");
      const target = await resolvePlayer(args[0]);
      const amount = Number(args[1]);
      if (!Number.isFinite(amount) || amount <= 0) throw new ApiError("Amount must be a positive number.", 422, "bad_amount");
      const reasonText = args.slice(2).join(" ") || "Admin console /addclicks";
      return runAdminAction(actor, {
        action: "quickGrant",
        reason: reasonText,
        payload: { playerId: target.id, currency: "clicks", amount },
      });
    }
    case "player": {
      if (!args[0]) throw new ApiError("Usage: /player <username|id>", 422, "usage");
      const target = await resolvePlayer(args[0]);
      const detail = await getPlayerDetail(actor, target.id);
      return { message: `${detail.player.username} · level ${detail.player.level} · ${Number(detail.player.coins).toLocaleString("en-US")} sparks · ${detail.player.rebirths} rebirths · ${detail.pets.length} companions · ${detail.achievements} achievements.`, detail };
    }
    case "give":
    case "take": {
      const reason = args.slice(3).join(" ");
      return runAdminAction(actor, {
        action: command,
        reason,
        payload: { playerId: (await resolvePlayer(args[0] ?? "")).id, currency: args[1] ?? "coins", amount: Number(args[2] ?? 0) },
      });
    }
    case "setstat": {
      return runAdminAction(actor, {
        action: "setstat",
        reason: args.slice(3).join(" "),
        payload: { playerId: (await resolvePlayer(args[0] ?? "")).id, stat: args[1], value: Number(args[2] ?? 0) },
      });
    }
    case "pet": {
      if (args[0] !== "give" || !args[1] || !args[2]) throw new ApiError("Usage: /pet give <player> <petId> <reason>", 422, "usage");
      return runAdminAction(actor, {
        action: "givePet",
        reason: args.slice(3).join(" ") || "command console",
        payload: { playerId: (await resolvePlayer(args[1])).id, petId: args[2] },
      });
    }
    case "event": {
      const sub = args[0];
      if (!["start", "stop"].includes(sub)) throw new ApiError("Usage: /event start|stop <eventId>", 422, "usage");
      const rows = await db.select().from(gameEvents).where(or(eq(gameEvents.id, args[1] ?? ""), eq(gameEvents.slug, args[1] ?? ""))).limit(1);
      if (!rows[0]) throw new ApiError("Event not found by id or slug.", 404, "not_found");
      return runAdminAction(actor, { action: sub === "start" ? "event.start" : "event.stop", payload: { eventId: rows[0].id } });
    }
    case "announce": {
      const message = args.join(" ");
      return runAdminAction(actor, { action: "announce", payload: { message } });
    }
    case "ban":
    case "unban": {
      const target = await resolvePlayer(args[0] ?? "");
      if (command === "ban") {
        return runAdminAction(actor, { action: "ban", reason: args.slice(2).join(" "), payload: { playerId: target.id, hours: Number(args[1] ?? 0) } });
      }
      return runAdminAction(actor, { action: "unban", reason: args.slice(1).join(" ") || "command console", payload: { playerId: target.id } });
    }
    case "logs": {
      const rows = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(8);
      return { message: rows.map((r) => `${r.createdAt.toISOString().slice(11, 19)} ${r.adminName} → ${r.action}${r.targetId ? ` (${r.targetId.slice(0, 8)})` : ""} [${r.result}]`).join("\n") || "No audit entries yet." };
    }
    case "config": {
      if (args[0] !== "validate") throw new ApiError("Usage: /config validate", 422, "usage");
      const cfg = await getEconomyConfig();
      const issues: string[] = [];
      if (cfg.config.maxClicksPerSecond < 4 || cfg.config.maxClicksPerSecond > 40) issues.push("maxClicksPerSecond out of bounds");
      if (cfg.config.upgradeCostMultiplier < 0.1) issues.push("upgradeCostMultiplier too low");
      if (cfg.config.passiveMultiplier < 0.1) issues.push("passiveMultiplier too low");
      return { message: issues.length ? `Invalid: ${issues.join(", ")}` : `Configuration v${cfg.version} is valid. Clicking ${cfg.config.clickMultiplier}× · passive ${cfg.config.passiveMultiplier}× · max ${cfg.config.maxClicksPerSecond} clicks/s.` };
    }
    default:
      throw new ApiError(`Unknown command "/${command}". Type /help.`, 422, "unknown_command");
  }
}

export async function adminBootstrapInfo() {
  const [counts] = await db.select({ value: count() }).from(users);
  return { users: Number(counts?.value ?? 0) };
}

export async function exportAuditCsv(actor: AuthContext, limit = 500) {
  if (!hasPermission(actor.user.role, "audit.read")) throw new ApiError("Permission denied.", 403, "forbidden");
  const rows = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(Math.min(limit, 2000));
  const header = "timestamp,administrator,action,targetType,targetId,reason,result,requestId";
  const lines = rows.map((r) =>
    [r.createdAt.toISOString(), r.adminName, r.action, r.targetType, r.targetId ?? "", r.reason ?? "", r.result, r.requestId]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [header, ...lines].join("\n");
}

export async function ensureSeedAnnouncement() {
  const rows = await db.select({ value: count() }).from(announcements);
  if (Number(rows[0]?.value ?? 0) === 0) {
    await db.insert(announcements).values({ message: "OBSIDIA is live. The forge is warm — welcome, Initiate.", tone: "info" }).catch(() => undefined);
  }
}

export async function recentConfigState() {
  const [row] = await db.select().from(gameConfig).where(eq(gameConfig.id, "live")).limit(1);
  return row;
}

export async function adminCounts() {
  const [playerRow] = await db.select({ value: count() }).from(players);
  const [eventRow] = await db.select({ value: count() }).from(gameEvents).where(eq(gameEvents.status, "active"));
  return { players: Number(playerRow?.value ?? 0), events: Number(eventRow?.value ?? 0) };
}

export async function listAuditForTarget(actor: AuthContext, targetId: string) {
  if (!hasPermission(actor.user.role, "audit.read")) throw new ApiError("Permission denied.", 403, "forbidden");
  const rows = await db.select().from(auditLogs).where(eq(auditLogs.targetId, targetId)).orderBy(desc(auditLogs.createdAt)).limit(50);
  return rows.map(mapAudit);
}

export async function recentCases(actor: AuthContext) {
  if (!hasPermission(actor.user.role, "moderation.write")) throw new ApiError("Permission denied.", 403, "forbidden");
  return db.select().from(moderationCases).orderBy(desc(moderationCases.createdAt)).limit(100);
}

export async function latestSnapshotTimes() {
  const rows = await db
    .select({ id: players.id, username: players.username, createdAt: players.createdAt })
    .from(players)
    .orderBy(desc(players.createdAt))
    .limit(5);
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

export async function activeSessionsList(actor: AuthContext) {
  if (!hasPermission(actor.user.role, "players.read")) throw new ApiError("Permission denied.", 403, "forbidden");
  const rows = await db
    .select({ id: sessions.id, username: players.username, lastSeenAt: sessions.lastSeenAt, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .innerJoin(players, eq(players.userId, users.id))
    .where(and(gte(sessions.expiresAt, new Date()), gte(sessions.lastSeenAt, new Date(Date.now() - 24 * 3600 * 1000))))
    .orderBy(desc(sessions.lastSeenAt))
    .limit(50);
  return rows.map((r) => ({ ...r, lastSeenAt: r.lastSeenAt.toISOString(), expiresAt: r.expiresAt.toISOString() }));
}

export async function playersByWorld(actor: AuthContext) {
  if (!hasPermission(actor.user.role, "players.read")) throw new ApiError("Permission denied.", 403, "forbidden");
  const rows = await db
    .select({ world: players.currentWorld, value: count() })
    .from(players)
    .groupBy(players.currentWorld)
    .orderBy(asc(players.currentWorld));
  return rows.map((r) => ({ world: r.world, value: Number(r.value) }));
}

export async function moderationCasesFor(actor: AuthContext, type?: string) {
  if (!hasPermission(actor.user.role, "moderation.write")) throw new ApiError("Permission denied.", 403, "forbidden");
  const rows = await db
    .select()
    .from(moderationCases)
    .where(type ? eq(moderationCases.type, type) : undefined)
    .orderBy(desc(moderationCases.createdAt))
    .limit(100);
  return rows;
}

export async function sessionsForPlayer(actor: AuthContext, playerId: string) {
  if (!hasPermission(actor.user.role, "players.read")) throw new ApiError("Permission denied.", 403, "forbidden");
  const playerRows = await db.select({ userId: players.userId }).from(players).where(eq(players.id, playerId)).limit(1);
  if (!playerRows[0]) throw new ApiError("Player not found.", 404, "not_found");
  const rows = await db.select().from(sessions).where(eq(sessions.userId, playerRows[0].userId)).orderBy(desc(sessions.lastSeenAt)).limit(20);
  return rows.map((r) => ({ id: r.id, lastSeenAt: r.lastSeenAt.toISOString(), expiresAt: r.expiresAt.toISOString() }));
}

export async function playersList(actor: AuthContext, filters: { q?: string; page?: number }) {
  return getAdminSnapshot(actor, { ...filters, section: "players" });
}

export async function auditPage(actor: AuthContext, filters: { page?: number; action?: string }) {
  if (!hasPermission(actor.user.role, "audit.read")) throw new ApiError("Permission denied.", 403, "forbidden");
  const page = Math.max(1, filters.page ?? 1);
  const rows = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(50).offset((page - 1) * 50);
  return rows.map(mapAudit);
}

export async function deleteStaleSessions() {
  await db.delete(sessions).where(lte(sessions.expiresAt, new Date()));
}
