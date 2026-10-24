import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/** Money is stored as exact integers with a hard ceiling enforced by the services. */
const money = (name: string) => numeric(name, { precision: 30, scale: 0, mode: "number" });

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull().default("player"),
    isBanned: boolean("is_banned").notNull().default(false),
    bannedUntil: timestamp("banned_until", { withTimezone: true }),
    banReason: text("ban_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("users_email_unique").on(t.email)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [uniqueIndex("sessions_token_unique").on(t.tokenHash), index("sessions_user_idx").on(t.userId)],
);

export const players = pgTable(
  "players",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    username: text("username").notNull(),
    avatarColor: text("avatar_color").notNull().default("ember"),
    title: text("title").notNull().default("Initiate"),
    coins: money("coins").notNull().default(0),
    gems: money("gems").notNull().default(0),
    embers: money("embers").notNull().default(0),
    sigils: money("sigils").notNull().default(0),
    echoes: money("echoes").notNull().default(0),
    totalCoinsEarned: money("total_coins_earned").notNull().default(0),
    runCoinsEarned: money("run_coins_earned").notNull().default(0),
    totalClicks: money("total_clicks").notNull().default(0),
    level: integer("level").notNull().default(1),
    xp: money("xp").notNull().default(0),
    rebirths: integer("rebirths").notNull().default(0),
    prestiges: integer("prestiges").notNull().default(0),
    ascensions: integer("ascensions").notNull().default(0),
    currentWorld: text("current_world").notNull().default("ember-foothills"),
    highestWorldIndex: integer("highest_world_index").notNull().default(0),
    bestCombo: integer("best_combo").notNull().default(0),
    pityCounter: integer("pity_counter").notNull().default(0),
    hatches: integer("hatches").notNull().default(0),
    achievementPoints: integer("achievement_points").notNull().default(0),
    seasonPoints: integer("season_points").notNull().default(0),
    playtimeSeconds: integer("playtime_seconds").notNull().default(0),
    dailyStreak: integer("daily_streak").notNull().default(0),
    lastDailyAt: timestamp("last_daily_at", { withTimezone: true }),
    boosters: jsonb("boosters").$type<{ id: string; endsAt: string }[]>().notNull().default([]),
    muted: boolean("muted").notNull().default(false),
    compactMode: boolean("compact_mode").notNull().default(false),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("players_username_unique").on(t.username),
    uniqueIndex("players_user_unique").on(t.userId),
    index("players_clicks_idx").on(t.totalClicks),
    index("players_earned_idx").on(t.totalCoinsEarned),
    index("players_rebirths_idx").on(t.rebirths),
    index("players_prestiges_idx").on(t.prestiges),
    index("players_season_idx").on(t.seasonPoints),
    index("players_created_idx").on(t.createdAt),
  ],
);

export const upgradeStates = pgTable(
  "upgrade_states",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    upgradeId: text("upgrade_id").notNull(),
    level: integer("level").notNull().default(0),
  },
  (t) => [uniqueIndex("upgrade_player_unique").on(t.playerId, t.upgradeId)],
);

export const petInventory = pgTable(
  "pet_inventory",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    petId: text("pet_id").notNull(),
    rarity: text("rarity").notNull(),
    isGolden: boolean("is_golden").notNull().default(false),
    isShiny: boolean("is_shiny").notNull().default(false),
    favorite: boolean("favorite").notNull().default(false),
    equipped: boolean("equipped").notNull().default(false),
    obtainedAt: timestamp("obtained_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("pets_player_idx").on(t.playerId),
    index("pets_equipped_idx").on(t.playerId, t.equipped),
  ],
);

export const playerPurchases = pgTable(
  "player_purchases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    itemId: text("item_id").notNull(),
    currency: text("currency").notNull(),
    price: money("price").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("purchases_player_item_unique").on(t.playerId, t.itemId)],
);

export const playerAchievements = pgTable(
  "player_achievements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    achievementId: text("achievement_id").notNull(),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("achievements_player_unique").on(t.playerId, t.achievementId)],
);

export const playerQuests = pgTable(
  "player_quests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    questId: text("quest_id").notNull(),
    periodKey: text("period_key").notNull(),
    progress: money("progress").notNull().default(0),
    claimed: boolean("claimed").notNull().default(false),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("quests_player_period_unique").on(t.playerId, t.questId, t.periodKey)],
);

export const redeemCodes = pgTable(
  "redeem_codes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
    rewardCoins: money("reward_coins").notNull().default(0),
    rewardGems: money("reward_gems").notNull().default(0),
    rewardEmbers: money("reward_embers").notNull().default(0),
    maxRedemptions: integer("max_redemptions").notNull().default(0),
    redeemedCount: integer("redeemed_count").notNull().default(0),
    perUserLimit: integer("per_user_limit").notNull().default(1),
    active: boolean("active").notNull().default(true),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull().defaultNow(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("codes_code_unique").on(t.code)],
);

export const codeRedemptions = pgTable(
  "code_redemptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    codeId: uuid("code_id")
      .notNull()
      .references(() => redeemCodes.id, { onDelete: "cascade" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    redeemedAt: timestamp("redeemed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("redemptions_code_player_unique").on(t.codeId, t.playerId),
    index("redemptions_player_idx").on(t.playerId),
  ],
);

export const gameEvents = pgTable(
  "game_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    type: text("type").notNull(),
    multiplier: numeric("multiplier", { precision: 10, scale: 2, mode: "number" }).notNull().default(2),
    status: text("status").notNull().default("scheduled"),
    worldId: text("world_id"),
    rewardCoins: money("reward_coins").notNull().default(0),
    rewardGems: money("reward_gems").notNull().default(0),
    goalClicks: money("goal_clicks").notNull().default(0),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    announcement: text("announcement"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("events_slug_unique").on(t.slug), index("events_status_idx").on(t.status, t.endsAt)],
);

export const eventParticipation = pgTable(
  "event_participation",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => gameEvents.id, { onDelete: "cascade" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    progress: money("progress").notNull().default(0),
    claimed: boolean("claimed").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("participation_event_player_unique").on(t.eventId, t.playerId)],
);

export const moderationCases = pgTable(
  "moderation_cases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseNumber: integer("case_number").notNull(),
    playerId: uuid("player_id").references(() => players.id, { onDelete: "set null" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    type: text("type").notNull(),
    reason: text("reason").notNull(),
    notes: text("notes"),
    adminId: uuid("admin_id").references(() => users.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("cases_number_unique").on(t.caseNumber),
    index("cases_player_idx").on(t.playerId),
    index("cases_created_idx").on(t.createdAt),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    adminId: uuid("admin_id").references(() => users.id, { onDelete: "set null" }),
    adminName: text("admin_name").notNull().default("system"),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    reason: text("reason").notNull().default(""),
    before: jsonb("before").$type<Record<string, unknown> | null>(),
    after: jsonb("after").$type<Record<string, unknown> | null>(),
    requestId: text("request_id").notNull(),
    result: text("result").notNull().default("ok"),
    meta: jsonb("meta").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_created_idx").on(t.createdAt),
    index("audit_admin_idx").on(t.adminId),
    index("audit_action_idx").on(t.action),
  ],
);

export const gameConfig = pgTable("game_config", {
  id: text("id").primaryKey().default("live"),
  version: integer("version").notNull().default(1),
  data: jsonb("data").$type<Record<string, unknown>>().notNull(),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const configVersions = pgTable(
  "config_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    version: integer("version").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
    label: text("label").notNull().default("published"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    adminName: text("admin_name").notNull().default("system"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("config_version_unique").on(t.version)],
);

export const announcements = pgTable(
  "announcements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    message: text("message").notNull(),
    tone: text("tone").notNull().default("info"),
    active: boolean("active").notNull().default(true),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("announcements_active_idx").on(t.active, t.createdAt)],
);

export type UserRow = typeof users.$inferSelect;
export type PlayerRow = typeof players.$inferSelect;
export type PetRow = typeof petInventory.$inferSelect;
export type AuditRow = typeof auditLogs.$inferSelect;
export type EventRow = typeof gameEvents.$inferSelect;
export type CodeRow = typeof redeemCodes.$inferSelect;
