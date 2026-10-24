import { describe, expect, it } from "vitest";
import {
  bulkUpgradeCost,
  clampValue,
  comboMultiplier,
  dailyStreakAfter,
  deriveStats,
  formatNumber,
  levelFromXp,
  maxAffordableUpgrades,
  offlineEarnings,
  periodKeys,
  petPower,
  rebirthEmbers,
  rebirthRequirement,
  upgradeUnitCost,
  validateEggWeights,
  weightedPick,
} from "./economy";
import { ACHIEVEMENTS, DEFAULT_ECONOMY_CONFIG, EGGS, PETS, QUESTS, UPGRADES, petById } from "./content";

const levels = Object.fromEntries(UPGRADES.map((u) => [u.id, 0]));

describe("number formatting", () => {
  it("formats thousands and quintillions deterministically", () => {
    expect(formatNumber(999)).toBe("999");
    expect(formatNumber(1_500)).toBe("1.5K");
    expect(formatNumber(2_400_000)).toBe("2.4M");
    expect(formatNumber(7_500_000_000)).toBe("7.5B");
    expect(formatNumber(1.2e12)).toBe("1.2T");
    expect(formatNumber(1.1e15)).toBe("1.1Qa");
    expect(formatNumber(1.1e18)).toBe("1.1Qi");
    expect(formatNumber(1e24)).toBe("1Sp");
    expect(formatNumber(1e66)).toContain("e66");
  });

  it("never renders NaN or negative coins", () => {
    expect(formatNumber(Number.NaN)).toBe("0");
    expect(clampValue(-5)).toBe(0);
    expect(clampValue(Number.POSITIVE_INFINITY)).toBe(0);
    expect(clampValue(Number.MAX_SAFE_INTEGER)).toBeLessThanOrEqual(1e18);
  });
});

describe("upgrade pricing", () => {
  const def = UPGRADES[0];
  it("grows geometrically and matches the closed form", () => {
    const first = upgradeUnitCost(def, 0);
    const second = upgradeUnitCost(def, 1);
    expect(second).toBeGreaterThan(first);
    const bulk = bulkUpgradeCost(def, 0, 10);
    const manual = Array.from({ length: 10 }).reduce<number>((sum, _, i) => sum + upgradeUnitCost(def, i), 0);
    // Bulk pricing uses the closed geometric form; per-unit floors accumulate a sub-2% difference.
    expect(Math.abs(bulk - manual) / manual).toBeLessThan(0.02);
    expect(bulkUpgradeCost(def, 0, 0)).toBe(0);
  });

  it("computes the maximum affordable purchase count against a wallet", () => {
    const wallet = bulkUpgradeCost(def, 0, 3) + 1;
    expect(maxAffordableUpgrades(def, 0, wallet)).toBe(3);
    expect(maxAffordableUpgrades(def, 0, 0)).toBe(0);
    expect(maxAffordableUpgrades(def, def.maxLevel, 1e18)).toBe(0);
  });

  it("applies a bounded price multiplier from the live config", () => {
    const doubled = upgradeUnitCost(def, 0, { ...DEFAULT_ECONOMY_CONFIG, upgradeCostMultiplier: 2 });
    expect(doubled).toBe(upgradeUnitCost(def, 0) * 2);
  });
});

describe("derived stats", () => {
  it("is deterministic and never negative", () => {
    const stats = deriveStats({
      levels: { ...levels, hammer: 10, furnace: 4, autoclicker: 3 },
      rebirths: 2,
      prestiges: 1,
      embers: 10,
      sigils: 2,
      echoes: 1,
      worldId: "jade-marsh",
      petMultiplierSum: 2.4,
      boosterMultiplier: 2,
      eventMultiplier: 3,
      equipSlotsBonus: 1,
    });
    expect(stats.clickPower).toBeGreaterThan(0);
    expect(stats.globalMultiplier).toBeGreaterThan(4);
    expect(stats.maxEquipped).toBe(4);
    expect(stats.offlineRate).toBeLessThanOrEqual(0.9 * stats.globalMultiplier);
    expect(Number.isFinite(stats.passivePerSecond)).toBe(true);
  });

  it("caps combo multipliers", () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(100)).toBeCloseTo(1.5, 5);
    expect(comboMultiplier(100000)).toBeLessThanOrEqual(1e6);
  });
});

describe("progression math", () => {
  it("computes rebirth requirements and rewards with thresholds", () => {
    expect(rebirthRequirement(0)).toBe(250_000);
    expect(rebirthRequirement(3)).toBeGreaterThan(rebirthRequirement(2));
    expect(rebirthEmbers(100, 0)).toBe(0);
    expect(rebirthEmbers(250_000, 0)).toBeGreaterThan(0);
    expect(rebirthEmbers(2_500_000, 0)).toBeGreaterThan(rebirthEmbers(250_000, 0));
  });

  it("computes level curves monotonically", () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(120)).toBe(2);
    expect(levelFromXp(480)).toBe(3);
  });

  it("caps offline earnings by the configured hours", () => {
    const input = {
      levels: { ...levels, furnace: 10 },
      rebirths: 0,
      prestiges: 0,
      embers: 0,
      sigils: 0,
      echoes: 0,
      worldId: "ember-foothills",
      petMultiplierSum: 1,
      boosterMultiplier: 1,
      eventMultiplier: 1,
      equipSlotsBonus: 0,
    };
    const short = offlineEarnings(600, 0, input);
    const long = offlineEarnings(60 * 60 * 24 * 30, 0, input);
    expect(long).toBe(short * 72);
    const oneHour = offlineEarnings(5 * 3600, 0, input, { ...DEFAULT_ECONOMY_CONFIG, offlineMaxHours: 1 });
    expect(oneHour).toBe(offlineEarnings(3600, 0, input));
    expect(oneHour * 12).toBe(long);
  });

  it("keeps daily streaks on a 20 hour clock", () => {
    const now = new Date("2026-01-10T12:00:00Z");
    expect(dailyStreakAfter(null, 0, now)).toBe(1);
    expect(dailyStreakAfter(new Date(now.getTime() - 21 * 3600 * 1000), 2, now)).toBe(3);
    expect(dailyStreakAfter(new Date(now.getTime() - 72 * 3600 * 1000), 5, now)).toBe(1);
    expect(periodKeys(now)).toEqual({ dayKey: "2026-01-10", weekKey: "W2026-01-05" });
  });
});

describe("egg probability tables", () => {
  it("every published table totals exactly 1000 parts", () => {
    for (const egg of EGGS) {
      const total = egg.entries.reduce((sum, entry) => sum + entry.weight, 0);
      expect(total, egg.id).toBe(1000);
      expect(validateEggWeights(egg.entries).ok).toBe(true);
      for (const entry of egg.entries) {
        expect(petById(entry.petId), `${egg.id} → ${entry.petId}`).toBeTruthy();
      }
    }
  });

  it("rejects malformed tables", () => {
    expect(validateEggWeights([]).ok).toBe(false);
    expect(validateEggWeights([{ weight: 10 }]).ok).toBe(false);
    expect(validateEggWeights([{ weight: 0 }]).ok).toBe(false);
    expect(validateEggWeights([{ weight: 1000 }]).ok).toBe(true);
  });

  it("weighted picks respect the table and always return a value", () => {
    const entries = [
      { id: "a", weight: 999 },
      { id: "b", weight: 1 },
    ];
    expect(weightedPick(entries, () => 0.001).id).toBe("a");
    expect(weightedPick(entries, () => 0.9999).id).toBe("b");
    expect(weightedPick([{ id: "solo", weight: 0 }], () => 0.5).id).toBe("solo");
  });

  it("pet power scales by rarity and variants", () => {
    expect(petPower("common", false, false)).toBeCloseTo(1.15, 3);
    expect(petPower("mythic", true, true)).toBeCloseTo(5 * 1.5 * 1.25, 3);
    expect(petPower("common", false, false, 5)).toBeGreaterThan(petPower("common", false, false));
  });
});

describe("content integrity", () => {
  it("has unique definitions and valid rarities", () => {
    expect(new Set(UPGRADES.map((u) => u.id)).size).toBe(UPGRADES.length);
    expect(new Set(PETS.map((p) => p.id)).size).toBe(PETS.length);
    expect(new Set(QUESTS.map((q) => q.id)).size).toBe(QUESTS.length);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    expect(new Set(EGGS.map((e) => e.id)).size).toBe(EGGS.length);
  });

  it("only references existing prerequisites", () => {
    const ids = new Set(UPGRADES.map((u) => u.id));
    for (const upgrade of UPGRADES) {
      if (upgrade.prerequisite) expect(ids.has(upgrade.prerequisite.id)).toBe(true);
    }
  });

  it("achievement and quest goals are positive", () => {
    for (const achievement of ACHIEVEMENTS) expect(achievement.goal).toBeGreaterThan(0);
    for (const quest of QUESTS) expect(quest.goal).toBeGreaterThan(0);
  });
});
