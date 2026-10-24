import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { configVersions, gameConfig } from "@/db/schema";
import { DEFAULT_ECONOMY_CONFIG, type EconomyConfig } from "@/lib/content";

const cache = globalThis as typeof globalThis & {
  __obsidiaConfig?: { data: EconomyConfig; version: number; fetchedAt: number };
};

export function invalidateConfigCache() {
  cache.__obsidiaConfig = undefined;
}

const sanitize = (value: unknown): EconomyConfig => {
  const raw = (value ?? {}) as Partial<EconomyConfig>;
  const num = (input: unknown, min: number, max: number, fallback: number) => {
    const n = Number(input);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  };
  return {
    clickMultiplier: num(raw.clickMultiplier, 0.1, 100, DEFAULT_ECONOMY_CONFIG.clickMultiplier),
    passiveMultiplier: num(raw.passiveMultiplier, 0.1, 100, DEFAULT_ECONOMY_CONFIG.passiveMultiplier),
    upgradeCostMultiplier: num(raw.upgradeCostMultiplier, 0.1, 10, DEFAULT_ECONOMY_CONFIG.upgradeCostMultiplier),
    rebirthRequirementMultiplier: num(raw.rebirthRequirementMultiplier, 0.1, 10, DEFAULT_ECONOMY_CONFIG.rebirthRequirementMultiplier),
    eventMultiplier: num(raw.eventMultiplier, 0.1, 10, DEFAULT_ECONOMY_CONFIG.eventMultiplier),
    petMultiplierScale: num(raw.petMultiplierScale, 0.1, 10, DEFAULT_ECONOMY_CONFIG.petMultiplierScale),
    maxClicksPerSecond: Math.round(num(raw.maxClicksPerSecond, 4, 40, DEFAULT_ECONOMY_CONFIG.maxClicksPerSecond)),
    offlineMaxHours: Math.round(num(raw.offlineMaxHours, 1, 72, DEFAULT_ECONOMY_CONFIG.offlineMaxHours)),
    maintenanceMode: Boolean(raw.maintenanceMode),
    featureFlags: {
      eggs: raw.featureFlags?.eggs !== false,
      events: raw.featureFlags?.events !== false,
      shop: raw.featureFlags?.shop !== false,
      leaderboards: raw.featureFlags?.leaderboards !== false,
      codes: raw.featureFlags?.codes !== false,
      trading: raw.featureFlags?.trading === true,
    },
  };
};

export async function getEconomyConfig(): Promise<{ config: EconomyConfig; version: number }> {
  const now = Date.now();
  if (cache.__obsidiaConfig && now - cache.__obsidiaConfig.fetchedAt < 4000) {
    return { config: cache.__obsidiaConfig.data, version: cache.__obsidiaConfig.version };
  }
  try {
    const rows = await db.select().from(gameConfig).where(eq(gameConfig.id, "live")).limit(1);
    if (!rows.length) {
      const created = await db
        .insert(gameConfig)
        .values({ id: "live", version: 1, data: DEFAULT_ECONOMY_CONFIG as unknown as Record<string, unknown> })
        .onConflictDoNothing()
        .returning();
      const data = sanitize(created[0]?.data ?? DEFAULT_ECONOMY_CONFIG);
      const version = created[0]?.version ?? 1;
      if (created[0]) {
        await db.insert(configVersions).values({ version, data: data as unknown as Record<string, unknown>, label: "initial", adminName: "system" }).onConflictDoNothing();
      }
      cache.__obsidiaConfig = { data, version, fetchedAt: now };
      return { config: data, version };
    }
    const row = rows[0];
    const data = sanitize(row.data);
    cache.__obsidiaConfig = { data, version: row.version, fetchedAt: now };
    return { config: data, version: row.version };
  } catch (error) {
    console.error("[config] falling back to defaults", error);
    return { config: DEFAULT_ECONOMY_CONFIG, version: 0 };
  }
}

export async function publishConfig(input: {
  patch: Partial<EconomyConfig>;
  adminId: string;
  adminName: string;
  label?: string;
}): Promise<{ config: EconomyConfig; version: number }> {
  const current = await getEconomyConfig();
  const merged = sanitize({ ...current.config, ...input.patch, featureFlags: { ...current.config.featureFlags, ...(input.patch.featureFlags ?? {}) } });
  const nextVersion = current.version + 1;
  await db
    .insert(gameConfig)
    .values({ id: "live", version: nextVersion, data: merged as unknown as Record<string, unknown>, updatedBy: input.adminId })
    .onConflictDoUpdate({
      target: gameConfig.id,
      set: { version: nextVersion, data: merged as unknown as Record<string, unknown>, updatedBy: input.adminId, updatedAt: new Date() },
    });
  await db.insert(configVersions).values({
    version: nextVersion,
    data: merged as unknown as Record<string, unknown>,
    label: input.label ?? "published",
    createdBy: input.adminId,
    adminName: input.adminName,
  });
  invalidateConfigCache();
  return { config: merged, version: nextVersion };
}

export async function rollbackConfig(input: {
  version: number;
  adminId: string;
  adminName: string;
}): Promise<{ config: EconomyConfig; version: number }> {
  const rows = await db.select().from(configVersions).where(eq(configVersions.version, input.version)).limit(1);
  if (!rows.length) throw new Error("Configuration version not found");
  const target = sanitize(rows[0].data);
  return publishConfig({ patch: target, adminId: input.adminId, adminName: input.adminName, label: `rollback from v${input.version}` });
}

export async function listConfigVersions(limit = 20) {
  return db.select().from(configVersions).orderBy(desc(configVersions.version)).limit(limit);
}
