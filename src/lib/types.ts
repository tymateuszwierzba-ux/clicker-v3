import type { AchievementDef, AdminRole, GlyphId, QuestDef, RarityId, ShopItem, World } from "./content";
import type { DerivedStats } from "./economy";

export interface Notice {
  id: string;
  kind: "achievement" | "event" | "daily" | "system" | "pet" | "quest";
  title: string;
  body: string;
  tone?: string;
}

export interface OwnedPet {
  rowId: string;
  petId: string;
  name: string;
  rarity: RarityId;
  glyph: GlyphId;
  tint: string;
  worldId: string;
  description: string;
  isGolden: boolean;
  isShiny: boolean;
  favorite: boolean;
  equipped: boolean;
  power: number;
  obtainedAt: string;
}

export interface PlayerState {
  id: string;
  username: string;
  avatarColor: string;
  title: string;
  role: AdminRole;
  coins: number;
  gems: number;
  embers: number;
  sigils: number;
  echoes: number;
  totalCoinsEarned: number;
  runCoinsEarned: number;
  totalClicks: number;
  level: number;
  xp: number;
  xpCurrent: number;
  xpNeeded: number;
  xpPct: number;
  rebirths: number;
  prestiges: number;
  ascensions: number;
  seasonPoints: number;
  bestCombo: number;
  acheivementPoints: number;
  achievementPoints: number;
  playtimeSeconds: number;
  hatches: number;
  pityCounter: number;
  currentWorld: string;
  createdAt: string;
  boosters: { id: string; label: string; multiplier: number; endsAt: string }[];
  muted: boolean;
  compactMode: boolean;
}

export interface UpgradeStateEntry {
  id: string;
  level: number;
  maxLevel: number;
  unlocked: boolean;
  lockedReason: string | null;
  unitCost: number;
  nextCost: number;
  cost1: number;
  cost10: number;
  costMax: number;
  affordableMax: number;
  currentEffect: string;
  nextEffect: string;
}

export interface QuestEntry {
  def: QuestDef;
  progress: number;
  goal: number;
  claimed: boolean;
  complete: boolean;
  claimable: boolean;
}

export interface AchievementEntry {
  def: AchievementDef;
  unlocked: boolean;
  progress: number;
}

export interface EventEntry {
  id: string;
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
  progress: number;
  claimed: boolean;
  claimable: boolean;
}

export interface DailyState {
  canClaim: boolean;
  streak: number;
  nextStreak: number;
  todayIndex: number;
  nextClaimAt: string | null;
  rewards: { day: number; coins: number; gems: number; label: string }[];
}

export interface ShopEntry {
  item: ShopItem;
  owned: boolean;
  activeUntil: string | null;
}

export interface CodeEntry {
  code: string;
  rewardCoins: number;
  rewardGems: number;
  active: boolean;
  redeemed: number;
}

export interface GameState {
  serverNow: string;
  player: PlayerState;
  derived: DerivedStats;
  upgrades: UpgradeStateEntry[];
  pets: OwnedPet[];
  equipSlots: number;
  quests: QuestEntry[];
  achievements: AchievementEntry[];
  achievementSummary: { unlocked: number; total: number; points: number };
  daily: DailyState;
  events: EventEntry[];
  codes: CodeEntry[];
  worlds: (World & { unlocked: boolean; eggId: string; petsOwned: number; petsTotal: number })[];
  shop: ShopEntry[];
  offlineEarned: number;
  announcements: { id: string; message: string; tone: string; createdAt: string }[];
  configVersion: number;
  maintenance: boolean;
  featureFlags: Record<string, boolean>;
  economy: { maxClicksPerSecond: number; offlineMaxHours: number; clickMultiplier: number; passiveMultiplier: number };
  stats: { petsOwned: number; upgradesBought: number; codesRedeemed: number; eventsJoined: number };
  currentRank: number | null;
  milestone: { next: number; current: number; pct: number; label: string };
}

export interface ActionResult {
  state: GameState;
  notices: Notice[];
  result?: Record<string, unknown>;
}

export interface LeaderboardRow {
  rank: number;
  playerId: string;
  username: string;
  title: string;
  avatarColor: string;
  level: number;
  value: number;
  rebirths: number;
}

export interface LeaderboardPayload {
  metric: string;
  rows: LeaderboardRow[];
  total: number;
  page: number;
  pageSize: number;
  me: { rank: number; value: number } | null;
  generatedAt: string;
}
