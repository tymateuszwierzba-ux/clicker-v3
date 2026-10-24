/**
 * OBSIDIA content configuration.
 * Pure data + pure helpers so it can be imported by client components and
 * server services without pulling in privileged code.
 */

export const GAME_NAME = "OBSIDIA";
export const GAME_TAGLINE = "The Infinite Forge";

export type RarityId =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary"
  | "mythic"
  | "celestial"
  | "secret";

export const RARITIES: {
  id: RarityId;
  label: string;
  color: string;
  soft: string;
  multiplier: number;
}[] = [
  { id: "common", label: "Common", color: "#a8a3b8", soft: "rgba(168,163,184,0.14)", multiplier: 1.15 },
  { id: "uncommon", label: "Uncommon", color: "#5fd6a4", soft: "rgba(95,214,164,0.14)", multiplier: 1.4 },
  { id: "rare", label: "Rare", color: "#62b6f5", soft: "rgba(98,182,245,0.15)", multiplier: 1.8 },
  { id: "epic", label: "Epic", color: "#c78cf7", soft: "rgba(199,140,247,0.16)", multiplier: 2.5 },
  { id: "legendary", label: "Legendary", color: "#f5c451", soft: "rgba(245,196,81,0.16)", multiplier: 3.6 },
  { id: "mythic", label: "Mythic", color: "#ff7a66", soft: "rgba(255,122,102,0.16)", multiplier: 5 },
  { id: "celestial", label: "Celestial", color: "#9ef0e2", soft: "rgba(158,240,226,0.18)", multiplier: 8 },
  { id: "secret", label: "Secret", color: "#ff5fa2", soft: "rgba(255,95,162,0.18)", multiplier: 14 },
];

export const rarityById = (id: string) => RARITIES.find((r) => r.id === id) ?? RARITIES[0];

export const RARITY_ORDER: RarityId[] = RARITIES.map((r) => r.id);

export type WorldPattern =
  | "rays"
  | "waves"
  | "grid"
  | "shards"
  | "frost"
  | "lava"
  | "bolts"
  | "bazaar"
  | "rings"
  | "mandala";

export interface World {
  id: string;
  index: number;
  name: string;
  subtitle: string;
  description: string;
  unlockAt: number;
  bonus: string;
  bonusMultiplier: number;
  accent: string;
  accentSoft: string;
  ink: string;
  bgFrom: string;
  bgTo: string;
  pattern: WorldPattern;
  eggId: string;
}

export const WORLDS: World[] = [
  {
    id: "ember-foothills",
    index: 0,
    name: "Ember Foothills",
    subtitle: "Where the forge first breathes",
    description: "Ash-grey ridges and slow-burning coals. Every spark here remembers a hand that shaped it.",
    unlockAt: 0,
    bonus: "+0% — the birthplace of the build",
    bonusMultiplier: 1,
    accent: "#f0a94a",
    accentSoft: "rgba(240,169,74,0.16)",
    ink: "#fdf3e3",
    bgFrom: "#191016",
    bgTo: "#2a1712",
    pattern: "rays",
    eggId: "egg-ember",
  },
  {
    id: "jade-marsh",
    index: 1,
    name: "Jade Marsh",
    subtitle: "Roots that price everything",
    description: "Bioluminescent wetlands where old traders buried their ledgers under the moss.",
    unlockAt: 25_000,
    bonus: "+8% global output",
    bonusMultiplier: 1.08,
    accent: "#4fd6a0",
    accentSoft: "rgba(79,214,160,0.16)",
    ink: "#e6fff4",
    bgFrom: "#0b1a17",
    bgTo: "#10302a",
    pattern: "waves",
    eggId: "egg-jade",
  },
  {
    id: "sunken-archive",
    index: 2,
    name: "Sunken Archive",
    subtitle: "Every formula drowned once",
    description: "A flooded library of brass shelves. Its pages still calculate in tidal time.",
    unlockAt: 500_000,
    bonus: "+16% global output",
    bonusMultiplier: 1.16,
    accent: "#5cc7de",
    accentSoft: "rgba(92,199,222,0.16)",
    ink: "#e6f7ff",
    bgFrom: "#08141f",
    bgTo: "#0c2734",
    pattern: "grid",
    eggId: "egg-archive",
  },
  {
    id: "glass-desert",
    index: 3,
    name: "Glass Desert",
    subtitle: "Wealth, fused and fragile",
    description: "A dune sea vitrified by a single perfect strike. Reflections here are worth more than glass.",
    unlockAt: 8_000_000,
    bonus: "+24% global output",
    bonusMultiplier: 1.24,
    accent: "#f0b7a0",
    accentSoft: "rgba(240,183,160,0.16)",
    ink: "#fff1e8",
    bgFrom: "#221310",
    bgTo: "#3a241d",
    pattern: "shards",
    eggId: "egg-glass",
  },
  {
    id: "frost-cathedral",
    index: 4,
    name: "Frost Cathedral",
    subtitle: "Silence under load",
    description: "Vaulted ice that hums when the ledger balances. Choir stalls are carved from frozen arithmetic.",
    unlockAt: 120_000_000,
    bonus: "+32% global output",
    bonusMultiplier: 1.32,
    accent: "#9ec9ff",
    accentSoft: "rgba(158,201,255,0.16)",
    ink: "#edf6ff",
    bgFrom: "#0a1424",
    bgTo: "#152a44",
    pattern: "frost",
    eggId: "egg-frost",
  },
  {
    id: "cinder-caldera",
    index: 5,
    name: "Cinder Caldera",
    subtitle: "The forge that refuses to cool",
    description: "A cauldron of liquid obsidian. Nothing leaves unchanged, including the counter.",
    unlockAt: 2_000_000_000,
    bonus: "+40% global output",
    bonusMultiplier: 1.4,
    accent: "#ff7f52",
    accentSoft: "rgba(255,127,82,0.16)",
    ink: "#fff0e6",
    bgFrom: "#1e0d0c",
    bgTo: "#3b1310",
    pattern: "lava",
    eggId: "egg-cinder",
  },
  {
    id: "storm-reach",
    index: 6,
    name: "Storm Reach",
    subtitle: "Charge without ceremony",
    description: "Floating pylons anchored by lightning. The locals measure income in thunder.",
    unlockAt: 40_000_000_000,
    bonus: "+50% global output",
    bonusMultiplier: 1.5,
    accent: "#8d9cff",
    accentSoft: "rgba(141,156,255,0.16)",
    ink: "#eef0ff",
    bgFrom: "#0d1024",
    bgTo: "#1a1f45",
    pattern: "bolts",
    eggId: "egg-storm",
  },
  {
    id: "void-bazaar",
    index: 7,
    name: "Void Bazaar",
    subtitle: "Everything is on offer",
    description: "A market with no floor and no closing time. Prices are negotiated in memories.",
    unlockAt: 1_000_000_000_000,
    bonus: "+64% global output",
    bonusMultiplier: 1.64,
    accent: "#ea7bd4",
    accentSoft: "rgba(234,123,212,0.16)",
    ink: "#ffeaf9",
    bgFrom: "#180d20",
    bgTo: "#2c1239",
    pattern: "bazaar",
    eggId: "egg-void",
  },
  {
    id: "chrono-spire",
    index: 8,
    name: "Chrono Spire",
    subtitle: "Second thoughts, first profits",
    description: "A tower built from repeating minutes. Climb it and your patience compounds.",
    unlockAt: 30_000_000_000_000,
    bonus: "+80% global output",
    bonusMultiplier: 1.8,
    accent: "#c9d6e4",
    accentSoft: "rgba(201,214,228,0.16)",
    ink: "#f4f8ff",
    bgFrom: "#0b1118",
    bgTo: "#1b2a38",
    pattern: "rings",
    eggId: "egg-chrono",
  },
  {
    id: "obsidia-heart",
    index: 9,
    name: "Obsidia Heart",
    subtitle: "The center holds",
    description: "The first forge, still warm. To stand here is to be part of the mechanism.",
    unlockAt: 1_000_000_000_000_000,
    bonus: "+100% global output",
    bonusMultiplier: 2,
    accent: "#f6d98c",
    accentSoft: "rgba(246,217,140,0.18)",
    ink: "#fff8e4",
    bgFrom: "#16110a",
    bgTo: "#302411",
    pattern: "mandala",
    eggId: "egg-heart",
  },
];

export const worldById = (id: string) => WORLDS.find((w) => w.id === id) ?? WORLDS[0];

export type GlyphId =
  | "spark"
  | "leaf"
  | "wave"
  | "shard"
  | "crown"
  | "fang"
  | "wing"
  | "eye"
  | "orb"
  | "spire"
  | "anvil"
  | "serpent";

export interface PetDef {
  id: string;
  name: string;
  worldId: string;
  rarity: RarityId;
  glyph: GlyphId;
  tint: string;
  description: string;
}

const petNames: Record<string, [name: string, glyph: string, description: string][]> = {
  "ember-foothills": [
    ["Cinder Pup", "spark", "Sleeps in the coal bed and wakes up charging interest."],
    ["Ash Kite", "wing", "Rides thermals above the ridges, dropping warm sparks."],
    ["Forge Wisp", "orb", "A pilot light with opinions about your output."],
    ["Slagback Boar", "fang", "Turns refuse into workable ingots."],
    ["Ember Warden", "anvil", "Keeps the first forge lit no matter the hour."],
    ["Pyra, First Flame", "crown", "The original spark. It still answers when called."],
  ],
  "jade-marsh": [
    ["Mossling", "leaf", "Grows a new leaf for every thousand sparks."],
    ["Bog Lamp", "orb", "Bioluminescence used as a bookkeeping aid."],
    ["Reed Serpent", "serpent", "Slithers through ledgers and balances them."],
    ["Fen Oracle", "eye", "Reads the swamp, predicts the market."],
    ["Verdant Colossus", "crown", "A walking grove that smells of fresh profit."],
    ["Jade Matriarch", "spark", "The marsh itself, wearing a borrowed shape."],
  ],
  "sunken-archive": [
    ["Ink Minnow", "wave", "Swims through footnotes and emerges with answers."],
    ["Brass Kraken", "serpent", "Eight arms, eight simultaneous calculations."],
    ["Tide Scribe", "eye", "Writes in water. The water remembers."],
    ["Drowned Scholar", "orb", "Still teaching, still unpaid."],
    ["Leviathan Codex", "crown", "A whale-sized book with a whale-sized opinion."],
    ["Thalassa Prime", "wave", "The archive's librarian, tidal and exact."],
  ],
  "glass-desert": [
    ["Dune Flea", "spark", "A tiny prospector with expensive taste."],
    ["Mirror Fox", "eye", "Borrows your multiplier and gives back interest."],
    ["Shard Dancer", "shard", "Cuts light into negotiable fragments."],
    ["Vitrified Nomad", "spire", "Walks the glass sea without leaving prints."],
    ["Prism Sovereign", "crown", "Refracts a single spark into a payroll."],
    ["Aurora Glasswing", "wing", "Its wingspan is a currency of its own."],
  ],
  "frost-cathedral": [
    ["Frost Moth", "wing", "Powdered wings carry a quiet, cold bonus."],
    ["Rime Bell", "orb", "Every toll adds a decimal place."],
    ["Glacier Warden", "anvil", "Carves vaults out of living ice."],
    ["Hymn Revenant", "eye", "Sings formulas in perfect fifths."],
    ["Permafrost Titan", "crown", "Older than the ledger, colder than the audit."],
    ["Seraph of Stillness", "spark", "Silence with a measurable yield."],
  ],
  "cinder-caldera": [
    ["Magma Mite", "spark", "Small, molten, extremely motivated."],
    ["Obsidian Hound", "fang", "Tracks value by scent through solid rock."],
    ["Slagwing", "wing", "Leaves a trail of cooling profit."],
    ["Forge Saint", "anvil", "Canonised by the hammer, not the church."],
    ["Caldera Drake", "serpent", "Hoards heat and pays dividends."],
    ["Ignis Rex", "crown", "The caldera's heartbeat wearing a crown."],
  ],
  "storm-reach": [
    ["Static Kit", "spark", "A pocket thunderstorm with a schedule."],
    ["Gale Raptor", "wing", "Rides the vertical economy."],
    ["Arc Warden", "spire", "Keeps the pylons honest."],
    ["Thunder Choir", "eye", "Four voices, one very loud multiplier."],
    ["Stormfather", "crown", "Speaks in voltage, audits in thunder."],
    ["Volt Empress", "serpent", "Wraps around the spire and calls it a necklace."],
  ],
  "void-bazaar": [
    ["Bargain Imp", "spark", "Will trade you tomorrow for today."],
    ["Null Merchant", "eye", "Sells absence at a premium."],
    ["Lantern Ghoul", "orb", "Illuminates the price nobody wanted to see."],
    ["Contract Wraith", "serpent", "Reads the fine print in your future."],
    ["Market Devourer", "fang", "Consumes supply, then sells it back."],
    ["The Velvet Broker", "crown", "Owns a percentage of your ambition."],
  ],
  "chrono-spire": [
    ["Tick Sparrow", "wing", "One wingbeat per earned second."],
    ["Minute Keeper", "orb", "Stores spare minutes for later spending."],
    ["Hourglass Warden", "spire", "Refuses to flip for anyone but you."],
    ["Paradox Archivist", "eye", "Filed this conversation before it happened."],
    ["Eternity Steward", "anvil", "Forge-master of the long game."],
    ["Kairos, the Instant", "crown", "The moment everything compounds."],
  ],
  "obsidia-heart": [
    ["Heart Ember", "spark", "The first heat, distributed."],
    ["Core Sentinel", "anvil", "Guards the mechanism from sentiment."],
    ["Gilded Witness", "eye", "Has watched every rebuild and approved."],
    ["Vein Serpent", "serpent", "Carries sparks through the world's arteries."],
    ["Forge Regent", "crown", "Runs the Infinite Forge in your name."],
    ["Obsidia Incarnate", "spire", "The world itself, finally awake."],
  ],
};

const baseTints: Record<string, string[]> = {
  "ember-foothills": ["#f0a94a", "#ff8f5c", "#f6d98c", "#e2793d", "#ffe3a8", "#ffce6b"],
  "jade-marsh": ["#4fd6a0", "#8fe8bf", "#37b58a", "#b9f5d8", "#2f8f72", "#a6f0c8"],
  "sunken-archive": ["#5cc7de", "#8fd9ee", "#3fa6c4", "#b9edf7", "#2c7c99", "#a0e6f5"],
  "glass-desert": ["#f0b7a0", "#ffd9c8", "#d99178", "#fff0e8", "#c97b63", "#ffc9b0"],
  "frost-cathedral": ["#9ec9ff", "#cfe4ff", "#6fa9ea", "#e8f3ff", "#4f83bd", "#bcd9ff"],
  "cinder-caldera": ["#ff7f52", "#ffab7a", "#e2542a", "#ffd0b0", "#b83a1c", "#ff9468"],
  "storm-reach": ["#8d9cff", "#b6bfff", "#6273e0", "#dfe4ff", "#4b57b8", "#a9b4ff"],
  "void-bazaar": ["#ea7bd4", "#ffb0ef", "#c94fae", "#ffd9f7", "#9c3687", "#f49ee0"],
  "chrono-spire": ["#c9d6e4", "#e8eff7", "#9aaec2", "#f7fbff", "#7c90a6", "#dce6f1"],
  "obsidia-heart": ["#f6d98c", "#ffeebd", "#d9a94f", "#fff8e4", "#b8862f", "#ffe1a0"],
};

const petRarities: RarityId[] = ["common", "uncommon", "rare", "epic", "legendary", "mythic"];

export const PETS: PetDef[] = (() => {
  const out: PetDef[] = [];
  for (const world of WORLDS) {
    const names = petNames[world.id];
    const tints = baseTints[world.id];
    names.forEach((entry, i) => {
      out.push({
        id: `${world.id}-p${i + 1}`,
        name: entry[0],
        worldId: world.id,
        rarity: petRarities[i],
        glyph: entry[1] as GlyphId,
        tint: tints[i],
        description: entry[2],
      });
    });
  }
  out.push({
    id: "celestial-aurelion",
    name: "Aurelion Prime",
    worldId: "all",
    rarity: "celestial",
    glyph: "crown",
    tint: "#ffeab0",
    description: "A light above every world. Appears in any egg, never announces itself.",
  });
  out.push({
    id: "secret-hollow-regent",
    name: "The Hollow Regent",
    worldId: "all",
    rarity: "secret",
    glyph: "eye",
    tint: "#ff5fa2",
    description: "Nobody hatched it. It simply decided you were finally worth meeting.",
  });
  return out;
})();

export const petById = (id: string) => PETS.find((p) => p.id === id);

export interface EggEntry {
  petId: string;
  weight: number; // parts per 1000, each egg table sums to 1000
}

export interface EggDef {
  id: string;
  worldId: string;
  name: string;
  description: string;
  price: number;
  gemPrice: number;
  entries: EggEntry[];
}

const baseWeights = [450, 260, 140, 80, 40, 20];
const globalWeights: [string, number][] = [
  ["celestial-aurelion", 8],
  ["secret-hollow-regent", 2],
];

const eggNames: Record<string, string> = {
  "ember-foothills": "Coalheart Egg",
  "jade-marsh": "Mosscradle Egg",
  "sunken-archive": "Tideledger Egg",
  "glass-desert": "Prismshell Egg",
  "frost-cathedral": "Rimechoir Egg",
  "cinder-caldera": "Magmacore Egg",
  "storm-reach": "Voltcrest Egg",
  "void-bazaar": "Hollowmarket Egg",
  "chrono-spire": "Minuteglass Egg",
  "obsidia-heart": "Heartforge Egg",
};

const eggPrices = [500, 6_000, 75_000, 900_000, 12_000_000, 2.4e8, 5e9, 1.2e11, 3e12, 8e13];

export const EGGS: EggDef[] = WORLDS.map((world) => {
  const pets = PETS.filter((p) => p.worldId === world.id);
  const shift = world.index;
  const weights = baseWeights.map((w, i) => Math.max(6, Math.round(w - shift * 18 + i * 4)));
  const used = weights.reduce((a, b) => a + b, 0);
  const celestial = Math.min(30, 6 + shift * 2);
  const secret = 2 + shift;
  const entries: EggEntry[] = [
    ...pets.map((p, i) => ({ petId: p.id, weight: weights[i] })),
    ...globalWeights.map(([id, w]) => ({ petId: id, weight: id.includes("celestial") ? celestial : secret })),
  ];
  // Normalise to exactly 1000 parts while keeping integers.
  const total = entries.reduce((a, b) => a + b.weight, 0);
  const diff = 1000 - total;
  entries[0].weight += diff;
  return {
    id: `egg-${world.id.split("-")[0]}`,
    worldId: world.id,
    name: eggNames[world.id] ?? `${world.name} Egg`,
    description: `Hatches companions attuned to ${world.name}. Published odds below.`,
    price: eggPrices[world.index],
    gemPrice: 25 + world.index * 20,
    entries,
  };
});

export const eggById = (id: string) => EGGS.find((e) => e.id === id);
export const eggForWorld = (worldId: string) => EGGS.find((e) => e.worldId === worldId) ?? EGGS[0];
export const eggProbability = (egg: EggDef, petId: string) => {
  const entry = egg.entries.find((e) => e.petId === petId);
  if (!entry) return 0;
  const total = egg.entries.reduce((a, b) => a + b.weight, 0);
  return (entry.weight / total) * 100;
};

export const MAX_EQUIPPED_BASE = 3;
export const MAX_INVENTORY = 400;

export interface UpgradeDef {
  id: string;
  name: string;
  category:
    | "Click Power"
    | "Auto Clicker"
    | "Critical Chance"
    | "Critical Multiplier"
    | "Passive Income"
    | "Energy Multiplier"
    | "Luck"
    | "Combo Efficiency"
    | "Pet Power"
    | "Rebirth Bonus"
    | "Offline Earnings"
    | "Special Abilities";
  description: string;
  baseCost: number;
  growth: number;
  maxLevel: number;
  prerequisite?: { id: string; level: number };
  effectLabel: (level: number) => string;
}

export const UPGRADES: UpgradeDef[] = [
  {
    id: "hammer",
    name: "Forge Hammer",
    category: "Click Power",
    description: "Adds flat spark value to every strike.",
    baseCost: 25,
    growth: 1.16,
    maxLevel: 500,
    effectLabel: (l) => `+${(l * 2).toLocaleString()} sparks / click`,
  },
  {
    id: "autoclicker",
    name: "Clockwork Fingers",
    category: "Auto Clicker",
    description: "A mechanism that strikes for you every second.",
    baseCost: 180,
    growth: 1.22,
    maxLevel: 400,
    effectLabel: (l) => `${(l * 0.6).toFixed(1)} auto-strikes / sec`,
  },
  {
    id: "critChance",
    name: "Fracture Lens",
    category: "Critical Chance",
    description: "Finds the fault lines where sparks multiply.",
    baseCost: 400,
    growth: 1.28,
    maxLevel: 80,
    effectLabel: (l) => `${Math.min(75, l * 1.2).toFixed(1)}% crit chance`,
  },
  {
    id: "critMultiplier",
    name: "Overload Seal",
    category: "Critical Multiplier",
    description: "Detonates critical hits for far more.",
    baseCost: 1_200,
    growth: 1.32,
    maxLevel: 120,
    prerequisite: { id: "critChance", level: 3 },
    effectLabel: (l) => `×${(2 + l * 0.22).toFixed(2)} crit multiplier`,
  },
  {
    id: "furnace",
    name: "Eternal Furnace",
    category: "Passive Income",
    description: "Burns quietly and pays continuously.",
    baseCost: 600,
    growth: 1.2,
    maxLevel: 400,
    effectLabel: (l) => `+${(l * 6).toLocaleString()} sparks / sec`,
  },
  {
    id: "amplifier",
    name: "Resonance Amplifier",
    category: "Energy Multiplier",
    description: "Multiplies the yield of boosters and events.",
    baseCost: 3_500,
    growth: 1.3,
    maxLevel: 100,
    effectLabel: (l) => `+${(l * 1.5).toFixed(1)}% booster strength`,
  },
  {
    id: "luck",
    name: "Fortune Prism",
    category: "Luck",
    description: "Nudges egg results toward rarer companions.",
    baseCost: 5_000,
    growth: 1.34,
    maxLevel: 100,
    effectLabel: (l) => `+${(l * 0.8).toFixed(1)}% rare-or-better pressure`,
  },
  {
    id: "comboFlow",
    name: "Chain Rhythm",
    category: "Combo Efficiency",
    description: "Reinforces your combo multiplier per link.",
    baseCost: 9_000,
    growth: 1.36,
    maxLevel: 100,
    prerequisite: { id: "hammer", level: 10 },
    effectLabel: (l) => `+${(l * 0.4).toFixed(1)}% combo gain`,
  },
  {
    id: "petBond",
    name: "Companion Bond",
    category: "Pet Power",
    description: "Raises equipped pet multipliers and slots.",
    baseCost: 18_000,
    growth: 1.38,
    maxLevel: 60,
    effectLabel: (l) => `+${(l * 1.8).toFixed(1)}% pet power · +${Math.floor(l / 20)} slots`,
  },
  {
    id: "rebirthEngine",
    name: "Rebirth Engine",
    category: "Rebirth Bonus",
    description: "Every ember you hold is worth more.",
    baseCost: 40_000,
    growth: 1.42,
    maxLevel: 80,
    prerequisite: { id: "furnace", level: 5 },
    effectLabel: (l) => `+${(l * 2).toFixed(1)}% ember multiplier`,
  },
  {
    id: "nightShift",
    name: "Night Shift",
    category: "Offline Earnings",
    description: "Collect offline output at a better rate, for longer.",
    baseCost: 25_000,
    growth: 1.4,
    maxLevel: 40,
    effectLabel: (l) => `${Math.min(90, 35 + l * 1.5).toFixed(0)}% offline rate`,
  },
  {
    id: "surge",
    name: "Surge Protocol",
    category: "Special Abilities",
    description: "Unlocks golden surge windows where clicks triple.",
    baseCost: 120_000,
    growth: 1.5,
    maxLevel: 20,
    prerequisite: { id: "amplifier", level: 5 },
    effectLabel: (l) => `${Math.min(45, 8 + l * 2)}s surge · every ${Math.max(90, 300 - l * 8)}s`,
  },
];

export const upgradeById = (id: string) => UPGRADES.find((u) => u.id === id);

export type QuestMetric =
  | "clicks"
  | "earned"
  | "hatches"
  | "rebirths"
  | "upgrades"
  | "pets"
  | "level"
  | "combo"
  | "ascensions";

export interface QuestDef {
  id: string;
  name: string;
  description: string;
  cadence: "daily" | "weekly" | "milestone";
  metric: QuestMetric;
  goal: number;
  rewardCoins: number;
  rewardGems: number;
  rewardEmbers?: number;
}

export const QUESTS: QuestDef[] = [
  { id: "d-strike-250", name: "Warm-Up Shift", description: "Land 250 strikes at the forge.", cadence: "daily", metric: "clicks", goal: 250, rewardCoins: 4_000, rewardGems: 2 },
  { id: "d-strike-1500", name: "Long Shift", description: "Land 1,500 strikes today.", cadence: "daily", metric: "clicks", goal: 1_500, rewardCoins: 18_000, rewardGems: 5 },
  { id: "d-earn-50k", name: "First Payroll", description: "Earn 50,000 sparks today.", cadence: "daily", metric: "earned", goal: 50_000, rewardCoins: 25_000, rewardGems: 4 },
  { id: "d-hatch-3", name: "Shellbreaker", description: "Hatch 3 companions.", cadence: "daily", metric: "hatches", goal: 3, rewardCoins: 12_000, rewardGems: 3 },
  { id: "d-upgrade-5", name: "Tune the Line", description: "Purchase 5 upgrades.", cadence: "daily", metric: "upgrades", goal: 5, rewardCoins: 15_000, rewardGems: 3 },
  { id: "d-combo-40", name: "Rhythm Check", description: "Reach a 40-click combo.", cadence: "daily", metric: "combo", goal: 40, rewardCoins: 9_000, rewardGems: 2 },
  { id: "w-strike-25k", name: "Week of Sparks", description: "Land 25,000 strikes this week.", cadence: "weekly", metric: "clicks", goal: 25_000, rewardCoins: 400_000, rewardGems: 30, rewardEmbers: 2 },
  { id: "w-rebirth-2", name: "Two Turns of the Wheel", description: "Rebirth twice this week.", cadence: "weekly", metric: "rebirths", goal: 2, rewardCoins: 900_000, rewardGems: 45, rewardEmbers: 4 },
  { id: "w-hatch-40", name: "Sanctuary Growth", description: "Hatch 40 companions this week.", cadence: "weekly", metric: "hatches", goal: 40, rewardCoins: 700_000, rewardGems: 40, rewardEmbers: 3 },
  { id: "w-earn-5m", name: "Compounding", description: "Earn 5,000,000 sparks this week.", cadence: "weekly", metric: "earned", goal: 5_000_000, rewardCoins: 2_000_000, rewardGems: 60, rewardEmbers: 6 },
  { id: "m-first-forge", name: "The Forge Answers", description: "Reach account level 5.", cadence: "milestone", metric: "level", goal: 5, rewardCoins: 10_000, rewardGems: 5 },
  { id: "m-collector", name: "Living Collection", description: "Own 15 companions.", cadence: "milestone", metric: "pets", goal: 15, rewardCoins: 250_000, rewardGems: 25, rewardEmbers: 2 },
  { id: "m-industrialist", name: "Industrialist", description: "Buy 100 total upgrade levels.", cadence: "milestone", metric: "upgrades", goal: 100, rewardCoins: 1_500_000, rewardGems: 40, rewardEmbers: 5 },
  { id: "m-ascend-1", name: "Echo of a Higher Self", description: "Complete one Ascension.", cadence: "milestone", metric: "ascensions", goal: 1, rewardCoins: 12_000_000, rewardGems: 120, rewardEmbers: 20 },
];

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  metric: QuestMetric;
  goal: number;
  tier: "bronze" | "silver" | "gold" | "prismatic";
  points: number;
  rewardGems: number;
  hidden?: boolean;
}

const achievementSeeds: [string, string, QuestMetric, number, number][] = [
  ["First Contact", "Land your first strike.", "clicks", 1, 1],
  ["Warm Metal", "Land 1,000 strikes.", "clicks", 1_000, 5],
  ["Calloused", "Land 10,000 strikes.", "clicks", 10_000, 15],
  ["Machine Rhythm", "Land 100,000 strikes.", "clicks", 100_000, 40],
  ["Strike Eternal", "Land 1,000,000 strikes.", "clicks", 1_000_000, 120],
  ["Pocket Money", "Earn 10,000 sparks.", "earned", 10_000, 3],
  ["Salaried", "Earn 1,000,000 sparks.", "earned", 1_000_000, 10],
  ["Magnate", "Earn 1,000,000,000 sparks.", "earned", 1e9, 30],
  ["Sovereign of Sparks", "Earn 1,000,000,000,000 sparks.", "earned", 1e12, 80],
  ["Tuned", "Buy 25 upgrade levels.", "upgrades", 25, 5],
  ["Engineered", "Buy 100 upgrade levels.", "upgrades", 100, 15],
  ["Overclocked", "Buy 500 upgrade levels.", "upgrades", 500, 50],
  ["First Shell", "Hatch a companion.", "hatches", 1, 2],
  ["Hatchery", "Hatch 100 companions.", "hatches", 100, 25],
  ["Aviary", "Hatch 1,000 companions.", "hatches", 1_000, 90],
  ["Roommate", "Own 5 companions.", "pets", 5, 4],
  ["Sanctuary", "Own 25 companions.", "pets", 25, 20],
  ["Menagerie", "Own 80 companions.", "pets", 80, 60],
  ["Reborn", "Complete a rebirth.", "rebirths", 1, 10],
  ["Wheel Turner", "Complete 10 rebirths.", "rebirths", 10, 40],
  ["Cycle Master", "Complete 50 rebirths.", "rebirths", 50, 150],
  ["Tier Two", "Reach account level 10.", "level", 10, 10],
  ["Tier Five", "Reach account level 25.", "level", 25, 40],
  ["Ascended", "Complete an Ascension.", "ascensions", 1, 100],
  ["Combo Artist", "Reach a 50-click combo.", "combo", 50, 12],
  ["Combo Virtuoso", "Reach a 150-click combo.", "combo", 150, 45],
];

export const ACHIEVEMENTS: AchievementDef[] = achievementSeeds.map(
  ([name, description, metric, goal, rewardGems], i) => {
    const tier: AchievementDef["tier"] =
      goal >= 1e12 || goal >= 1_000 || i > 20 ? (i > 24 ? "prismatic" : "gold") : i > 12 ? "silver" : "bronze";
    return {
      id: `ach-${metric}-${goal}`,
      name,
      description,
      metric,
      goal,
      tier,
      points: Math.max(5, Math.round(Math.log10(goal + 10) * 18)),
      rewardGems,
    };
  },
);

ACHIEVEMENTS.push({
  id: "ach-hidden-hollow",
  name: "Uninvited Guest",
  description: "Something found you before you found it.",
  metric: "pets",
  goal: 1,
  tier: "prismatic",
  points: 500,
  rewardGems: 250,
  hidden: true,
});

export const DAILY_REWARDS = [
  { day: 1, coins: 5_000, gems: 2, label: "Kindling" },
  { day: 2, coins: 15_000, gems: 3, label: "Warm Coals" },
  { day: 3, coins: 40_000, gems: 5, label: "Steady Flame" },
  { day: 4, coins: 90_000, gems: 8, label: "Forge Heat" },
  { day: 5, coins: 250_000, gems: 12, label: "White Metal" },
  { day: 6, coins: 600_000, gems: 18, label: "Golden Pour" },
  { day: 7, coins: 1_500_000, gems: 30, label: "Obsidian Bounty" },
];

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  kind: "booster" | "cosmetic" | "qol";
  currency: "gems" | "coins";
  price: number;
  effect:
    | { type: "multiplier"; value: number; hours: number }
    | { type: "title"; title: string }
    | { type: "slots"; value: number }
    | { type: "autoHatch" };
}

export const SHOP_ITEMS: ShopItem[] = [
  { id: "surge-tonic", name: "Surge Tonic", description: "×3 spark output for 2 hours (server-timed).", kind: "booster", currency: "gems", price: 20, effect: { type: "multiplier", value: 3, hours: 2 } },
  { id: "ember-draught", name: "Ember Draught", description: "×5 spark output for 1 hour.", kind: "booster", currency: "gems", price: 45, effect: { type: "multiplier", value: 5, hours: 1 } },
  { id: "luxe-slot", name: "Companion Harness", description: "Permanently +1 equipped companion slot.", kind: "qol", currency: "gems", price: 150, effect: { type: "slots", value: 1 } },
  { id: "auto-hatch", name: "Automaton Hatcher", description: "Unlocks auto-hatch controls in the hatchery.", kind: "qol", currency: "gems", price: 120, effect: { type: "autoHatch" } },
  { id: "title-forgemaster", name: "Title: Forgemaster", description: "A display title crafted in the first forge.", kind: "cosmetic", currency: "gems", price: 60, effect: { type: "title", title: "Forgemaster" } },
  { id: "title-voidwalker", name: "Title: Voidwalker", description: "For those who priced the impossible.", kind: "cosmetic", currency: "gems", price: 90, effect: { type: "title", title: "Voidwalker" } },
  { id: "title-emberheir", name: "Title: Ember Heir", description: "Heir to a very warm accounting error.", kind: "cosmetic", currency: "gems", price: 75, effect: { type: "title", title: "Ember Heir" } },
  { id: "starter-crate", name: "Starter Crate", description: "A one-time bundle: 250,000 sparks and 15 prisms.", kind: "qol", currency: "gems", price: 10, effect: { type: "multiplier", value: 1, hours: 0 } },
];

export const RESEARCH_TREE = [
  { id: "deep-forge", name: "Deep Forge", description: "+10% ember gain per rank.", cost: 3, max: 10 },
  { id: "offline-echo", name: "Offline Echo", description: "+5% offline rate per rank.", cost: 5, max: 8 },
  { id: "prism-luck", name: "Prism Luck", description: "+3% rare hatch pressure per rank.", cost: 4, max: 12 },
  { id: "rapid-combo", name: "Rapid Combo", description: "+8% combo efficiency per rank.", cost: 6, max: 10 },
];

export const PRESTIGE_TIERS = [
  { id: "prestige", name: "Prestige", requires: "10 rebirths", gains: "Sigils", description: "Reset embers and rebirths for permanent sigils (+10% each).", cost: 10 },
  { id: "ascension", name: "Ascension", requires: "5 sigils", gains: "Echoes", description: "Reset sigils, embers and upgrades for echoes (+25% each) and unlock the Research Tree.", cost: 5 },
  { id: "galaxy", name: "Galaxy Reset", requires: "3 echoes", gains: "Stardust", description: "The final reset. Everything except collection, achievements and stardust (+50% each).", cost: 3 },
];

export interface EconomyConfig {
  clickMultiplier: number;
  passiveMultiplier: number;
  upgradeCostMultiplier: number;
  rebirthRequirementMultiplier: number;
  eventMultiplier: number;
  petMultiplierScale: number;
  maxClicksPerSecond: number;
  offlineMaxHours: number;
  maintenanceMode: boolean;
  featureFlags: {
    eggs: boolean;
    events: boolean;
    shop: boolean;
    leaderboards: boolean;
    codes: boolean;
    trading: boolean;
  };
}

export const DEFAULT_ECONOMY_CONFIG: EconomyConfig = {
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
};

export const ADMIN_ROLES = ["owner", "super_admin", "admin", "moderator", "support", "player"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const PERMISSIONS: Record<AdminRole, string[]> = {
  owner: ["*"],
  super_admin: [
    "overview.read", "players.read", "players.economy", "players.items", "players.reset", "players.ban",
    "economy.write", "events.write", "content.write", "codes.write", "moderation.write", "audit.read",
    "config.write", "announce.write", "console.use",
  ],
  admin: [
    "overview.read", "players.read", "players.economy", "players.items", "players.ban", "events.write",
    "content.write", "codes.write", "moderation.write", "audit.read", "announce.write",
  ],
  moderator: ["overview.read", "players.read", "players.ban", "moderation.write", "audit.read"],
  support: ["overview.read", "players.read"],
  player: [],
};

export const ROLE_LABELS: Record<AdminRole, string> = {
  owner: "Owner",
  super_admin: "Super Admin",
  admin: "Admin",
  moderator: "Moderator",
  support: "Support",
  player: "Player",
};

export const AVATAR_COLORS = ["ember", "jade", "tide", "glass", "frost", "cinder", "storm", "void", "chrono", "heart"];

export const WORLD_ACCENTS: Record<string, string> = Object.fromEntries(WORLDS.map((w) => [w.id, w.accent]));

export const AVATAR_GRADIENTS: Record<string, string> = {
  ember: "linear-gradient(135deg,#f0a94a,#c9541f)",
  jade: "linear-gradient(135deg,#4fd6a0,#1d7f63)",
  tide: "linear-gradient(135deg,#5cc7de,#1f6c95)",
  glass: "linear-gradient(135deg,#f0b7a0,#b9714f)",
  frost: "linear-gradient(135deg,#9ec9ff,#4f7fbd)",
  cinder: "linear-gradient(135deg,#ff7f52,#a52c14)",
  storm: "linear-gradient(135deg,#8d9cff,#414c9c)",
  void: "linear-gradient(135deg,#ea7bd4,#8c2f76)",
  chrono: "linear-gradient(135deg,#c9d6e4,#7a8b9c)",
  heart: "linear-gradient(135deg,#f6d98c,#b8862f)",
};

export const TITLES = ["Initiate", "Forgemaster", "Voidwalker", "Ember Heir", "Archive Adept", "Decimal Baron", "Nexus Architect"];
