#!/usr/bin/env node
/**
 * OBSIDIA development seed.
 * Idempotent: safe to re-run. Never contains production credentials.
 *
 *   node scripts/seed.mjs
 */
import { randomBytes, scryptSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
try {
  const envFile = readFileSync(resolve(here, "..", ".env"), "utf8");
  for (const line of envFile.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^"|"$/g, "");
  }
} catch {
  // .env is optional when DATABASE_URL is exported by the environment
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required. Copy .env.example to .env first.");
  process.exit(1);
}

const hash = (password) => {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$2$${salt}$${scryptSync(password, salt, 64).toString("hex")}`;
};

const pool = new pg.Pool({ connectionString: DATABASE_URL });
const client = await pool.connect();

const DEMO_ACCOUNTS = [
  { email: "owner@obsidia.gg", password: "Obsidian#2026", username: "ObsidianKeeper", role: "owner", coins: 125000000, clicks: 184000, rebirths: 12, level: 27, color: "heart", title: "Nexus Architect" },
  { email: "ops@obsidia.gg", password: "Operations#2026", username: "OpsWarden", role: "super_admin", coins: 4200000, clicks: 22000, rebirths: 3, level: 11, color: "jade", title: "Forgemaster" },
  { email: "mod@obsidia.gg", password: "Moderation#2026", username: "CaseKeeper", role: "moderator", coins: 800000, clicks: 7400, rebirths: 1, level: 7, color: "storm", title: "Initiate" },
  { email: "emberwright@obsidia.gg", password: "Forge#2026", username: "Emberwright", role: "player", coins: 980000, clicks: 31500, rebirths: 2, level: 9, color: "ember", title: "Initiate" },
  { email: "glass@obsidia.gg", password: "Forge#2026", username: "GlassNomad", role: "player", coins: 15600000, clicks: 88200, rebirths: 4, level: 14, color: "glass", title: "Ember Heir" },
  { email: "jade@obsidia.gg", password: "Forge#2026", username: "JadeCartographer", role: "player", coins: 340000, clicks: 9100, rebirths: 0, level: 5, color: "jade", title: "Initiate" },
  { email: "void@obsidia.gg", password: "Forge#2026", username: "VoidBroker", role: "player", coins: 74000000, clicks: 264000, rebirths: 8, level: 21, color: "void", title: "Voidwalker" },
];

async function main() {
  await client.query("BEGIN");

  const config = await client.query("SELECT version FROM game_config WHERE id = 'live'");
  if (!config.rows.length) {
    await client.query(
      `INSERT INTO game_config (id, version, data) VALUES ('live', 1, $1::jsonb)`,
      [
        JSON.stringify({
          clickMultiplier: 1,
          passiveMultiplier: 1,
          upgradeCostMultiplier: 1,
          rebirthRequirementMultiplier: 1,
          eventMultiplier: 1,
          petMultiplierScale: 1,
          maxClicksPerSecond: 14,
          offlineMaxHours: 12,
          maintenanceMode: false,
          featureFlags: { eggs: true, events: true, shop: true, leaderboards: true, codes: true, trading: false },
        }),
      ],
    );
    await client.query(
      `INSERT INTO config_versions (version, data, label, admin_name) VALUES (1, $1::jsonb, 'seed baseline', 'seed') ON CONFLICT (version) DO NOTHING`,
      [
        JSON.stringify({
          clickMultiplier: 1,
          passiveMultiplier: 1,
          upgradeCostMultiplier: 1,
          rebirthRequirementMultiplier: 1,
          eventMultiplier: 1,
          petMultiplierScale: 1,
          maxClicksPerSecond: 14,
          offlineMaxHours: 12,
          maintenanceMode: false,
          featureFlags: { eggs: true, events: true, shop: true, leaderboards: true, codes: true, trading: false },
        }),
      ],
    );
  }

  for (const account of DEMO_ACCOUNTS) {
    let userId;
    const existing = await client.query("SELECT id FROM users WHERE email = $1", [account.email]);
    if (existing.rows.length) {
      userId = existing.rows[0].id;
    } else {
      const inserted = await client.query(
        "INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id",
        [account.email, hash(account.password), account.role],
      );
      userId = inserted.rows[0].id;
    }

    const player = await client.query("SELECT id FROM players WHERE user_id = $1", [userId]);
    let playerId;
    if (player.rows.length) {
      playerId = player.rows[0].id;
    } else {
      const inserted = await client.query(
        `INSERT INTO players (user_id, username, avatar_color, title, coins, total_coins_earned, run_coins_earned, total_clicks, level, xp, rebirths, season_points, best_combo, achievement_points, playtime_seconds)
         VALUES ($1,$2,$3,$4,$5,$5,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
        [
          userId,
          account.username,
          account.color,
          account.title,
          account.coins,
          account.clicks,
          account.level,
          Math.pow(account.level - 1, 2) * 120,
          account.rebirths,
          account.clicks,
          Math.min(220, Math.floor(account.clicks / 400) + 12),
          account.level * 40,
          Math.floor(account.clicks / 2),
        ],
      );
      playerId = inserted.rows[0].id;
    }

    const upgrades = [
      ["hammer", Math.min(120, 6 + account.level * 4)],
      ["furnace", Math.min(90, account.level * 3)],
      ["autoclicker", Math.min(60, account.level * 2)],
      ["critChance", Math.min(30, account.level)],
      ["critMultiplier", Math.min(20, Math.floor(account.level / 2))],
      ["luck", Math.min(25, account.level)],
      ["comboFlow", Math.min(20, Math.floor(account.level / 3))],
      ["petBond", Math.min(10, Math.floor(account.level / 5))],
      ["nightShift", Math.min(8, Math.floor(account.level / 6))],
    ];
    for (const [id, level] of upgrades) {
      if (level <= 0) continue;
      await client.query(
        "INSERT INTO upgrade_states (player_id, upgrade_id, level) VALUES ($1,$2,$3) ON CONFLICT (player_id, upgrade_id) DO NOTHING",
        [playerId, id, level],
      );
    }

    const petCount = await client.query("SELECT COUNT(*)::int AS n FROM pet_inventory WHERE player_id = $1", [playerId]);
    if (petCount.rows[0].n === 0) {
      const pets = [
        ["ember-foothills-p1", "common", false, false, true],
        ["ember-foothills-p2", "uncommon", false, false, true],
        ["jade-marsh-p3", "rare", false, true, true],
        ["sunken-archive-p4", "epic", true, false, false],
        ["frost-cathedral-p5", "legendary", false, false, false],
        ["celestial-aurelion", "celestial", false, false, false],
      ].slice(0, account.rebirths >= 8 ? 6 : account.rebirths >= 3 ? 5 : account.rebirths >= 1 ? 4 : 3);
      for (const [petId, rarity, golden, shiny, equipped] of pets) {
        await client.query(
          "INSERT INTO pet_inventory (player_id, pet_id, rarity, is_golden, is_shiny, equipped) VALUES ($1,$2,$3,$4,$5,$6)",
          [playerId, petId, rarity, golden, shiny, equipped],
        );
      }
    }
  }

  const announcement = await client.query("SELECT COUNT(*)::int AS n FROM announcements");
  if (announcement.rows[0].n === 0) {
    await client.query(
      "INSERT INTO announcements (message, tone) VALUES ($1,'info'), ($2,'event')",
      [
        "OBSIDIA is live. The forge is warm — welcome, Initiate.",
        "Golden Hour runs for six hours: every validated strike yields double sparks.",
      ],
    );
  }

  const codes = [
    ["OBSIDIA-LAUNCH", 250000, 25, 5, 0, 25],
    ["GOLDENHOUR", 75000, 10, 0, 0, 100],
    ["FORGE-FRIENDS", 40000, 8, 0, 0, 500],
  ];
  for (const [code, coins, gems, embers, max, perUser] of codes) {
    await client.query(
      `INSERT INTO redeem_codes (code, reward_coins, reward_gems, reward_embers, max_redemptions, per_user_limit)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (code) DO NOTHING`,
      [code, coins, gems, embers, max, perUser],
    );
  }

  const events = await client.query("SELECT COUNT(*)::int AS n FROM game_events");
  if (events.rows[0].n === 0) {
    await client.query(
      `INSERT INTO game_events (slug, title, description, type, multiplier, status, goal_clicks, reward_coins, reward_gems, starts_at, ends_at)
       VALUES
         ('golden-hour-seed', 'Golden Hour', 'Every strike is heated twice over. All spark output is multiplied while this window is open.', 'golden_hour', 2, 'active', 1000, 250000, 25, NOW() - INTERVAL '1 hour', NOW() + INTERVAL '6 hours'),
         ('meteor-shower-seed', 'Meteor Shower', 'The sky over Storm Reach is falling upward. Triple output for three hours, then silence.', 'meteor_shower', 3, 'scheduled', 2500, 1000000, 60, NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day 3 hours'),
         ('launch-festival-seed', 'Founding Festival', 'The first week of OBSIDIA. Doubled prisms on every claim, doubled sparks on every strike.', 'seasonal', 2, 'ended', 500, 500000, 40, NOW() - INTERVAL '14 days', NOW() - INTERVAL '7 days')`,
    );
  }

  await client.query("COMMIT");
  console.log("OBSIDIA seed complete.");
  console.log("Operator: owner@obsidia.gg / Obsidian#2026 (owner role)");
  console.log("Players : emberwright@obsidia.gg / Forge#2026");
}

try {
  await main();
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("Seed failed:", error);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
