import {
  type EconomyConfig,
  type UpgradeDef,
  DEFAULT_ECONOMY_CONFIG,
  WORLD_ACCENTS,
  type RarityId,
  rarityById,
} from "./content";

export const MAX_VALUE = 1e18;
export const MAX_MULTIPLIER = 1e6;
export type UpgradeLevels = Record<string, number>;

export const clampValue = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  return Math.min(MAX_VALUE, Math.floor(value));
};

export const safeMult = (value: number): number => {
  if (!Number.isFinite(value) || value <= 0) return 1;
  return Math.min(MAX_MULTIPLIER, value);
};

const UNITS = [
  "", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc", "Ud", "Dd", "Td",
  "Qad", "Qid", "Sxd", "Spd", "Ocd", "Nod", "Vg",
];

/** Deterministic, locale-independent number formatting for very large values. */
export function formatNumber(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return "0";
  const negative = value < 0;
  const abs = Math.abs(value);
  if (abs < 1000) {
    const rounded = abs >= 100 ? Math.round(abs) : Math.round(abs * 10) / 10;
    return `${negative ? "-" : ""}${rounded.toLocaleString("en-US", { maximumFractionDigits: 1 })}`;
  }
  const tier = Math.floor(Math.log10(abs) / 3);
  if (tier >= UNITS.length) {
    return `${negative ? "-" : ""}${abs.toExponential(decimals).replace("e+", "e")}`;
  }
  const scaled = abs / Math.pow(1000, tier);
  const body = scaled >= 100 ? scaled.toFixed(0) : scaled.toFixed(decimals).replace(/\.?0+$/, "");
  return `${negative ? "-" : ""}${body}${UNITS[tier]}`;
}

export function formatExact(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return Math.floor(value).toLocaleString("en-US");
}

export function formatMultiplier(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  if (safe >= 1000) return `×${formatNumber(safe)}`;
  return `×${safe.toFixed(2)}`;
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${sec.toString().padStart(2, "0")}s`;
  return `${sec}s`;
}

export function percent(value: number, total: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.min(100, Math.max(0, (value / total) * 100));
}

export function upgradeUnitCost(def: UpgradeDef, level: number, config: EconomyConfig = DEFAULT_ECONOMY_CONFIG): number {
  const raw = def.baseCost * Math.pow(def.growth, Math.max(0, level));
  return clampValue(Math.max(def.baseCost, raw) * Math.max(0.1, config.upgradeCostMultiplier));
}

export function bulkUpgradeCost(
  def: UpgradeDef,
  level: number,
  count: number,
  config: EconomyConfig = DEFAULT_ECONOMY_CONFIG,
): number {
  const n = Math.max(0, Math.min(1000, Math.floor(count)));
  if (n === 0) return 0;
  const first = upgradeUnitCost(def, level, config);
  const factor = Math.pow(def.growth, n);
  const total = first * ((factor - 1) / (def.growth - 1));
  return clampValue(total);
}

export function maxAffordableUpgrades(
  def: UpgradeDef,
  level: number,
  coins: number,
  config: EconomyConfig = DEFAULT_ECONOMY_CONFIG,
): number {
  let capacity = Math.max(0, def.maxLevel - level);
  capacity = Math.min(capacity, 500);
  if (capacity <= 0) return 0;
  let affordable = 0;
  while (affordable < capacity) {
    const next = bulkUpgradeCost(def, level, affordable + 1, config);
    if (next <= coins) affordable += 1;
    else break;
  }
  return affordable;
}

export interface DeriveInput {
  levels: UpgradeLevels;
  rebirths: number;
  prestiges: number;
  embers: number;
  sigils: number;
  echoes: number;
  worldId: string;
  petMultiplierSum: number;
  boosterMultiplier: number;
  eventMultiplier: number;
  equipSlotsBonus: number;
  config?: EconomyConfig;
}

export interface DerivedStats {
  clickPower: number;
  rawClickPower: number;
  passivePerSecond: number;
  autoClicksPerSecond: number;
  critChance: number;
  critMultiplier: number;
  globalMultiplier: number;
  rebirthMultiplier: number;
  prestigeMultiplier: number;
  echoMultiplier: number;
  worldMultiplier: number;
  petMultiplier: number;
  boosterMultiplier: number;
  eventMultiplier: number;
  comboEfficiency: number;
  luck: number;
  offlineRate: number;
  offlineCapHours: number;
  maxEquipped: number;
  autoHatchUnlocked: boolean;
  surgeUnlocked: boolean;
  surgeDuration: number;
}

const num = (levels: UpgradeLevels, id: string) => Math.max(0, Math.floor(levels[id] ?? 0));

export function deriveStats(input: DeriveInput): DerivedStats {
  const config = input.config ?? DEFAULT_ECONOMY_CONFIG;
  const lv = input.levels;

  const hammer = num(lv, "hammer");
  const autoclicker = num(lv, "autoclicker");
  const critChanceLevel = num(lv, "critChance");
  const critMultiplierLevel = num(lv, "critMultiplier");
  const furnace = num(lv, "furnace");
  const amplifier = num(lv, "amplifier");
  const luck = num(lv, "luck");
  const comboFlow = num(lv, "comboFlow");
  const petBond = num(lv, "petBond");
  const rebirthEngine = num(lv, "rebirthEngine");
  const nightShift = num(lv, "nightShift");
  const surge = num(lv, "surge");

  const rebirthMultiplier = safeMult((1 + input.rebirths * 0.25) * (1 + input.embers * (0.02 + rebirthEngine * 0.002)));
  const prestigeMultiplier = safeMult(1 + input.sigils * 0.1);
  const echoMultiplier = safeMult(1 + input.echoes * 0.25);
  const worldMultiplier = safeMult(1 + worldBonus(input.worldId));
  const petMultiplier = safeMult(Math.max(1, input.petMultiplierSum) * (1 + petBond * 0.018) * config.petMultiplierScale);
  const boosterMultiplier = safeMult(1 + (input.boosterMultiplier - 1) * (1 + amplifier * 0.015));
  const eventMultiplier = safeMult(input.eventMultiplier);

  const globalMultiplier = safeMult(
    rebirthMultiplier * prestigeMultiplier * echoMultiplier * worldMultiplier * petMultiplier * boosterMultiplier * eventMultiplier * config.clickMultiplier,
  );

  const rawClickPower = 1 + hammer * 2;
  const clickPower = clampValue(rawClickPower * globalMultiplier);
  const autoClicksPerSecond = autoclicker * 0.6;
  const passivePerSecond = clampValue((furnace * 6 + autoclicker * 0.6 * rawClickPower) * globalMultiplier * config.passiveMultiplier);

  return {
    clickPower,
    rawClickPower,
    passivePerSecond,
    autoClicksPerSecond,
    critChance: Math.min(75, critChanceLevel * 1.2),
    critMultiplier: 2 + critMultiplierLevel * 0.22,
    globalMultiplier,
    rebirthMultiplier,
    prestigeMultiplier,
    echoMultiplier,
    worldMultiplier,
    petMultiplier,
    boosterMultiplier,
    eventMultiplier,
    comboEfficiency: 1 + comboFlow * 0.004,
    luck: luck * 0.8,
    offlineRate: Math.min(0.9, 0.35 + nightShift * 0.015) * globalMultiplier,
    offlineCapHours: config.offlineMaxHours,
    maxEquipped: 3 + Math.floor(petBond / 20) + input.equipSlotsBonus,
    autoHatchUnlocked: false,
    surgeUnlocked: surge > 0,
    surgeDuration: Math.min(45, 8 + surge * 2),
  };
}

export function worldBonus(worldId: string): number {
  // Local import-free lookup keeps this module pure and client safe.
  const bonuses: Record<string, number> = {
    "ember-foothills": 0,
    "jade-marsh": 0.08,
    "sunken-archive": 0.16,
    "glass-desert": 0.24,
    "frost-cathedral": 0.32,
    "cinder-caldera": 0.4,
    "storm-reach": 0.5,
    "void-bazaar": 0.64,
    "chrono-spire": 0.8,
    "obsidia-heart": 1,
  };
  return bonuses[worldId] ?? 0;
}

export function worldAccent(worldId: string): string {
  return WORLD_ACCENTS[worldId] ?? "#f0a94a";
}

export function comboMultiplier(combo: number, comboEfficiency = 1): number {
  const chain = Math.max(0, Math.min(500, Math.floor(combo)));
  return safeMult(1 + chain * 0.005 * comboEfficiency);
}

export function petPower(rarity: RarityId, golden: boolean, shiny: boolean, petBondLevel = 0): number {
  const base = rarityById(rarity).multiplier;
  const variant = (golden ? 1.5 : 1) * (shiny ? 1.25 : 1);
  return Number((base * variant * (1 + petBondLevel * 0.018)).toFixed(3));
}

export function rebirthRequirement(rebirths: number, config: EconomyConfig = DEFAULT_ECONOMY_CONFIG): number {
  const base = 250_000 * Math.pow(5.4, Math.max(0, rebirths));
  return clampValue(base * Math.max(0.1, config.rebirthRequirementMultiplier));
}

export function rebirthEmbers(runEarned: number, rebirths: number, config: EconomyConfig = DEFAULT_ECONOMY_CONFIG): number {
  const req = rebirthRequirement(rebirths, config);
  if (runEarned < req) return 0;
  const ratio = runEarned / req;
  return clampValue(Math.floor(3 + Math.pow(ratio, 0.62) * 4));
}

export function offlineEarnings(
  secondsAway: number,
  passivePerSecond: number,
  derived: DeriveInput,
  config: EconomyConfig = DEFAULT_ECONOMY_CONFIG,
): number {
  const stats = deriveStats({ ...derived, config });
  const capped = Math.min(Math.max(0, secondsAway), config.offlineMaxHours * 3600);
  return clampValue(capped * (stats.passivePerSecond * stats.offlineRate + stats.autoClicksPerSecond * stats.clickPower * 0.35));
}

export function levelFromXp(xp: number): number {
  if (!Number.isFinite(xp) || xp <= 0) return 1;
  return Math.max(1, Math.floor(Math.sqrt(xp / 120)) + 1);
}

export function xpForLevel(level: number): number {
  return Math.max(0, Math.pow(Math.max(1, level) - 1, 2) * 120);
}

export function levelProgress(xp: number): { level: number; current: number; needed: number; pct: number } {
  const level = levelFromXp(xp);
  const start = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const current = Math.max(0, xp - start);
  const needed = Math.max(1, next - start);
  return { level, current: Math.floor(current), needed: Math.floor(needed), pct: percent(current, needed) };
}

export function periodKeys(now = new Date()): { dayKey: string; weekKey: string } {
  const dayKey = now.toISOString().slice(0, 10);
  const tmp = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayNum = (tmp.getUTCDay() + 6) % 7;
  tmp.setUTCDate(tmp.getUTCDate() - dayNum);
  return { dayKey, weekKey: `W${tmp.toISOString().slice(0, 10)}` };
}

export function canClaimDaily(lastDailyAt: Date | null, now = new Date()): boolean {
  if (!lastDailyAt) return true;
  return now.getTime() - lastDailyAt.getTime() >= 20 * 60 * 60 * 1000;
}

export function dailyStreakAfter(lastDailyAt: Date | null, streak: number, now = new Date()): number {
  if (!lastDailyAt) return 1;
  const elapsed = now.getTime() - lastDailyAt.getTime();
  if (elapsed >= 20 * 60 * 60 * 1000 && elapsed <= 48 * 60 * 60 * 1000) return (streak % 7) + 1;
  return 1;
}

/** Validates that an egg probability table is well formed and totals exactly 1000 parts. */
export function validateEggWeights(entries: { weight: number }[]): { ok: boolean; total: number; message?: string } {
  if (!entries.length) return { ok: false, total: 0, message: "Egg has no entries" };
  if (entries.some((e) => !Number.isFinite(e.weight) || e.weight <= 0)) {
    return { ok: false, total: 0, message: "Every weight must be a positive number" };
  }
  const total = entries.reduce((a, b) => a + b.weight, 0);
  if (Math.abs(total - 1000) > 0.001) return { ok: false, total, message: `Weights must total 1000 (got ${total})` };
  return { ok: true, total };
}

export function weightedPick<T extends { weight: number }>(entries: T[], rng: () => number): T {
  const total = entries.reduce((a, b) => a + Math.max(0, b.weight), 0);
  if (total <= 0) return entries[0];
  let roll = rng() * total;
  for (const entry of entries) {
    roll -= Math.max(0, entry.weight);
    if (roll <= 0) return entry;
  }
  return entries[entries.length - 1];
}
