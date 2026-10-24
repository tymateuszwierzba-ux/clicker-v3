"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Crown,
  Egg as EggIcon,
  Flame,
  Globe2,
  Layers,
  Lock,
  PawPrint,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Zap,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/Modal";
import { Glyph, SparkMark, WorldPatternArt } from "@/components/ui/art";
import {
  ACHIEVEMENTS,
  EGGS,
  PETS,
  QUESTS,
  RARITIES,
  UPGRADES,
  WORLDS,
  petById,
  rarityById,
  type EconomyConfig,
  DEFAULT_ECONOMY_CONFIG,
} from "@/lib/content";
import {
  formatDuration,
  formatMultiplier,
  formatNumber,
  petPower,
  rebirthEmbers,
  rebirthRequirement,
} from "@/lib/economy";
import { DAILY_REWARDS } from "@/lib/content";
import type { GameState } from "@/lib/types";
import { EmptyState, Meter, Panel, RarityPill, SparkValue, StatTile, type ActFn } from "./ui";

interface PanelProps {
  state: GameState;
  act: ActFn;
  busy: boolean;
}

export function HomePanel({ state, act, busy }: PanelProps) {
  const topUpgrades = useMemo(
    () =>
      [...state.upgrades]
        .filter((u) => u.unlocked && u.level < u.maxLevel)
        .sort((a, b) => Number(b.affordableMax > 0) - Number(a.affordableMax > 0) || a.nextCost - b.nextCost)
        .slice(0, 4),
    [state.upgrades],
  );
  const nextQuest = state.quests.find((q) => !q.claimed) ?? state.quests[0];
  const activeEvents = state.events.filter((event) => event.status === "active");
  const recentAchievements = state.achievements.filter((a) => a.unlocked).slice(-3);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <Panel
          eyebrow="Run telemetry"
          title="The forge is listening"
          description={state.milestone.label}
          action={<span className="chip chip-gold"><Flame size={11} /> {state.player.rebirths} rebirths</span>}
        >
          <Meter value={state.milestone.current} total={state.milestone.next} tone="gold" />
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile label="Click power" value={formatNumber(state.derived.clickPower)} icon={<Zap size={13} />} tone="gold" />
            <StatTile label="Passive / sec" value={formatNumber(state.derived.passivePerSecond)} icon={<RefreshCw size={13} />} />
            <StatTile label="Global multiplier" value={formatMultiplier(state.derived.globalMultiplier)} icon={<Sparkles size={12} />} />
            <StatTile label="Companion power" value={formatMultiplier(state.derived.petMultiplier)} icon={<PawPrint size={12} />} tone="jade" />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="chip chip-jade"><Sparkles size={11} /> World {formatMultiplier(state.derived.worldMultiplier)}</span>
            <span className="chip"><Crown size={11} /> Rebirth {formatMultiplier(state.derived.rebirthMultiplier)}</span>
            <span className="chip"><Layers size={11} /> Prestige {formatMultiplier(state.derived.prestigeMultiplier)}</span>
            <span className="chip"><Star size={11} /> Crit {state.derived.critChance.toFixed(1)}% · ×{state.derived.critMultiplier.toFixed(2)}</span>
            {state.derived.boosterMultiplier > 1 ? <span className="chip chip-gold">Booster {formatMultiplier(state.derived.boosterMultiplier)}</span> : null}
            {state.derived.eventMultiplier > 1 ? <span className="chip chip-gold">Event {formatMultiplier(state.derived.eventMultiplier)}</span> : null}
          </div>
          {state.player.boosters.length ? (
            <div className="mt-3 rounded-lg border border-[rgba(233,182,98,0.28)] bg-[rgba(233,182,98,0.07)] px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--gold-bright)]">Active boosters</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {state.player.boosters.map((booster) => (
                  <span key={booster.id} className="chip chip-gold">
                    {booster.label} · {formatMultiplier(booster.multiplier)} · ends {new Date(booster.endsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </Panel>

        <div className="space-y-4">
          <Panel eyebrow="Best next action" title="Next upgrades" action={<button type="button" className="btn btn-ghost btn-xs" onClick={() => act({ type: "refresh" })} disabled={busy}>Refresh</button>}>
            <div className="space-y-2">
              {topUpgrades.map((upgrade) => {
                const def = UPGRADES.find((u) => u.id === upgrade.id);
                if (!def) return null;
                return (
                  <div key={upgrade.id} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-[rgba(255,246,230,0.02)] px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px] font-medium">{def.name}</p>
                      <p className="truncate text-[10.5px] text-[var(--dim)]">Lv {upgrade.level} · {upgrade.nextEffect}</p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm btn-gold flex-shrink-0"
                      disabled={busy || upgrade.affordableMax < 1 || upgrade.level >= upgrade.maxLevel}
                      onClick={() => act({ type: "upgrade", upgradeId: upgrade.id, quantity: 1 })}
                    >
                      <SparkValue value={upgrade.cost1} />
                    </button>
                  </div>
                );
              })}
              {!topUpgrades.length ? <p className="text-[12px] text-[var(--muted)]">Everything available is maxed. Rebirth to reset the tracks.</p> : null}
            </div>
          </Panel>

          {nextQuest ? (
            <Panel eyebrow={`${nextQuest.def.cadence} quest`} title={nextQuest.def.name} action={<span className="chip">{formatNumber(nextQuest.progress)} / {formatNumber(nextQuest.goal)}</span>}>
              <p className="text-[12px] text-[var(--muted)]">{nextQuest.def.description}</p>
              <div className="mt-2"><Meter value={nextQuest.progress} total={nextQuest.goal} tone="jade" /></div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[11px] text-[var(--dim)]">+{formatNumber(nextQuest.def.rewardCoins)} sparks · +{nextQuest.def.rewardGems} prisms</span>
                <button
                  type="button"
                  className="btn btn-xs btn-jade"
                  disabled={!nextQuest.claimable || busy}
                  onClick={() => act({ type: "quest", questId: nextQuest.def.id })}
                >
                  {nextQuest.claimed ? "Claimed" : nextQuest.claimable ? "Claim" : "In progress"}
                </button>
              </div>
            </Panel>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel eyebrow="Live operations" title="Events" action={<span className="chip chip-gold">{activeEvents.length} live</span>}>
          {activeEvents.length ? (
            <div className="space-y-2">
              {activeEvents.slice(0, 2).map((event) => (
                <div key={event.id} className="rounded-lg border border-[rgba(233,182,98,0.26)] bg-[rgba(233,182,98,0.06)] px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[12.5px] font-medium">{event.title}</p>
                    <span className="chip chip-gold">{formatMultiplier(event.multiplier)}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11px] text-[var(--muted)]">{event.description}</p>
                  {event.goalClicks > 0 ? <div className="mt-2"><Meter value={event.progress} total={event.goalClicks} label="Event goal" /></div> : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-[var(--muted)]">No events are live right now. The next window is scheduled by the operations team — check the Events tab.</p>
          )}
        </Panel>

        <Panel eyebrow="Daily rhythm" title="Daily reward" action={<span className="chip chip-gold">Streak {state.daily.streak}/7</span>}>
          <p className="text-[12px] text-[var(--muted)]">
            Day {state.daily.nextStreak}: +{formatNumber(DAILY_REWARDS[state.daily.nextStreak - 1]?.coins ?? 0)} sparks and +{DAILY_REWARDS[state.daily.nextStreak - 1]?.gems ?? 0} prisms.
          </p>
          <button type="button" className="btn btn-gold btn-sm mt-3" disabled={!state.daily.canClaim || busy} onClick={() => act({ type: "daily" })}>
            {state.daily.canClaim ? "Claim daily reward" : "Claimed — return tomorrow"}
          </button>
          {!state.daily.canClaim && state.daily.nextClaimAt ? (
            <p className="mt-2 text-[10.5px] text-[var(--dim)]">Next claim unlocks {new Date(state.daily.nextClaimAt).toLocaleString()}.</p>
          ) : null}
        </Panel>

        <Panel eyebrow="Sanctuary" title="Companions" action={<span className="chip chip-jade">{state.pets.filter((p) => p.equipped).length}/{state.equipSlots} equipped</span>}>
          <div className="flex items-center gap-1.5">
            {state.pets.filter((p) => p.equipped).map((pet) => (
              <span key={pet.rowId} className="grid h-11 w-11 place-items-center rounded-lg border border-[var(--line)]" style={{ background: `${pet.tint}14` }}>
                <Glyph glyph={pet.glyph} tint={pet.tint} size={30} />
              </span>
            ))}
            {!state.pets.some((p) => p.equipped) ? <p className="text-[12px] text-[var(--muted)]">No companions equipped. Open the Sanctuary to equip your best lineup.</p> : null}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <StatTile label="Owned" value={`${state.stats.petsOwned}`} />
            <StatTile label="Pity" value={`${state.player.pityCounter}/20`} hint="guaranteed rare" />
          </div>
        </Panel>
      </div>

      <Panel eyebrow="Progress ledger" title="Milestones" description="Server-tracked counters used by achievements and leaderboards.">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile label="Total clicks" value={formatNumber(state.player.totalClicks)} />
          <StatTile label="Total earned" value={formatNumber(state.player.totalCoinsEarned)} />
          <StatTile label="Achievements" value={`${state.achievementSummary.unlocked} / ${state.achievementSummary.total}`} hint={`${state.achievementSummary.points} points`} />
          <StatTile label="Playtime" value={formatDuration(state.player.playtimeSeconds)} />
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {recentAchievements.map((entry) => (
            <div key={entry.def.id} className="flex items-center gap-2 rounded-lg border border-[var(--line)] px-3 py-2">
              <ShieldCheck size={14} className="text-[var(--gold)]" />
              <div className="min-w-0">
                <p className="truncate text-[11.5px]">{entry.def.name}</p>
                <p className="truncate text-[10px] text-[var(--dim)]">{entry.def.description}</p>
              </div>
            </div>
          ))}
          {!recentAchievements.length ? <p className="text-[12px] text-[var(--muted)]">Achievements unlock as your counters rise — they pay out prisms automatically.</p> : null}
        </div>
      </Panel>
    </div>
  );
}

export function UpgradesPanel({ state, act, busy }: PanelProps) {
  const [category, setCategory] = useState<string>("All");
  const categories = ["All", ...Array.from(new Set(UPGRADES.map((u) => u.category)))];
  const filtered = UPGRADES.filter((u) => category === "All" || u.category === category);
  const stateById = new Map(state.upgrades.map((u) => [u.id, u]));

  return (
    <Panel
      eyebrow="Twelve disciplines"
      title="Forge upgrades"
      description="Prices scale geometrically and are computed server-side. Bulk purchases are atomic — you either receive every level or none."
      action={<span className="chip chip-gold"><SparkValue value={state.player.coins} /> available</span>}
    >
      <div className="tab-row mb-4 hidden-scroll">
        {categories.map((item) => (
          <button key={item} type="button" className="tab" aria-selected={category === item} onClick={() => setCategory(item)}>
            {item}
          </button>
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {filtered.map((def) => {
          const upgrade = stateById.get(def.id);
          if (!upgrade) return null;
          const maxed = upgrade.level >= upgrade.maxLevel;
          const locked = !upgrade.unlocked;
          const pct = (upgrade.level / upgrade.maxLevel) * 100;
          return (
            <article key={def.id} className={`panel-soft p-3.5 ${locked ? "opacity-70" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[9px] uppercase tracking-[0.16em] text-[var(--dim)]">{def.category}</p>
                  <h3 className="mt-0.5 truncate text-[15px]">{def.name}</h3>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--muted)]">{def.description}</p>
                </div>
                <span className={`chip flex-shrink-0 ${maxed ? "chip-gold" : ""}`}>Lv {upgrade.level}/{def.maxLevel}</span>
              </div>
              <div className="mt-2"><Meter value={upgrade.level} total={def.maxLevel} /></div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-md border border-[var(--line)] px-2 py-1">
                  <p className="text-[9px] uppercase tracking-[0.12em] text-[var(--dim)]">Current</p>
                  <p className="truncate text-[var(--text)]">{upgrade.currentEffect}</p>
                </div>
                <div className="rounded-md border border-[rgba(89,211,165,0.25)] px-2 py-1">
                  <p className="text-[9px] uppercase tracking-[0.12em] text-[var(--dim)]">Next</p>
                  <p className="truncate text-[#bff4dd]">{maxed ? "Maximum reached" : upgrade.nextEffect}</p>
                </div>
              </div>
              {locked ? (
                <p className="mt-2 flex items-center gap-1.5 rounded-md border border-[rgba(240,112,95,0.3)] bg-[rgba(240,112,95,0.07)] px-2 py-1 text-[10.5px] text-[#ffbcb0]">
                  <Lock size={11} /> {upgrade.lockedReason}
                </p>
              ) : (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    className="btn btn-xs btn-gold"
                    disabled={busy || maxed || upgrade.affordableMax < 1}
                    onClick={() => act({ type: "upgrade", upgradeId: def.id, quantity: 1 })}
                  >
                    Buy 1 · {formatNumber(upgrade.cost1)}
                  </button>
                  <button
                    type="button"
                    className="btn btn-xs"
                    disabled={busy || maxed || upgrade.affordableMax < 1}
                    onClick={() => act({ type: "upgrade", upgradeId: def.id, quantity: 10 })}
                  >
                    Buy 10 · {formatNumber(upgrade.cost10)}
                  </button>
                  <button
                    type="button"
                    className="btn btn-xs"
                    disabled={busy || maxed || upgrade.affordableMax < 1}
                    onClick={() => act({ type: "upgrade", upgradeId: def.id, quantity: -1 })}
                  >
                    Buy max ({upgrade.affordableMax})
                  </button>
                  {maxed ? <span className="ml-auto text-[10px] text-[var(--gold)]">Maxed</span> : null}
                  {!maxed && upgrade.affordableMax < 1 ? <span className="ml-auto text-[10px] text-[var(--dim)]">Need {formatNumber(upgrade.cost1)}</span> : null}
                </div>
              )}
              {pct >= 100 ? null : null}
            </article>
          );
        })}
      </div>
    </Panel>
  );
}

export function PetsPanel({ state, act, busy }: PanelProps) {
  const [query, setQuery] = useState("");
  const [rarity, setRarity] = useState("all");
  const [sort, setSort] = useState("power");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  const pets = useMemo(() => {
    const list = state.pets.filter((pet) => {
      if (rarity !== "all" && pet.rarity !== rarity) return false;
      if (favoritesOnly && !pet.favorite) return false;
      if (query && !pet.name.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
    return list.sort((a, b) => {
      if (sort === "recent") return new Date(b.obtainedAt).getTime() - new Date(a.obtainedAt).getTime();
      if (sort === "rarity") return RARITIES.findIndex((r) => r.id === b.rarity) - RARITIES.findIndex((r) => r.id === a.rarity);
      if (sort === "name") return a.name.localeCompare(b.name);
      return b.power - a.power;
    });
  }, [state.pets, rarity, favoritesOnly, query, sort]);

  const toggle = (rowId: string) =>
    setSelected((current) => (current.includes(rowId) ? current.filter((id) => id !== rowId) : current.length >= 10 ? current : [...current, rowId]));

  const equipped = state.pets.filter((pet) => pet.equipped);
  const duplicates = state.pets.filter((p) => !p.equipped && !p.favorite);

  return (
    <Panel
      eyebrow="The sanctuary"
      title="Companions"
      description={`Equip up to ${state.equipSlots} companions. Fusing three unequipped duplicates of the same pet yields a Golden variant. Favourites cannot be released.`}
      action={
        <div className="flex gap-1.5">
          <button type="button" className="btn btn-xs" disabled={busy || !state.pets.length} onClick={() => act({ type: "equipBest" })}>
            Equip best
          </button>
          <span className="chip chip-gold">{equipped.length}/{state.equipSlots} active</span>
        </div>
      }
    >
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        {Array.from({ length: state.equipSlots }).map((_, index) => {
          const pet = equipped[index];
          return (
            <div key={index} className="flex items-center gap-2 rounded-lg border border-dashed border-[var(--line-strong)] px-2 py-1.5">
              {pet ? (
                <>
                  <Glyph glyph={pet.glyph} tint={pet.tint} size={26} />
                  <div className="min-w-0">
                    <p className="truncate text-[10.5px]">{pet.name}</p>
                    <p className="numeric text-[9px] text-[var(--jade)]">×{pet.power.toFixed(2)}</p>
                  </div>
                </>
              ) : (
                <span className="text-[10px] text-[var(--dim)]">Empty slot {index + 1}</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[160px] flex-1">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--dim)]" />
          <input className="field field-sm pl-8" placeholder="Search sanctuary" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search companions" />
        </div>
        <select className="field field-sm w-auto" value={rarity} onChange={(event) => setRarity(event.target.value)} aria-label="Filter by rarity">
          <option value="all">All rarities</option>
          {RARITIES.map((r) => (
            <option key={r.id} value={r.id}>{r.label}</option>
          ))}
        </select>
        <select className="field field-sm w-auto" value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort companions">
          <option value="power">Sort: power</option>
          <option value="rarity">Sort: rarity</option>
          <option value="recent">Sort: newest</option>
          <option value="name">Sort: name</option>
        </select>
        <button type="button" className="btn btn-xs" aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly((v) => !v)}>
          <Star size={12} /> Favourites
        </button>
        <span className="chip">{pets.length} shown</span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5 rounded-lg border border-[var(--line)] bg-[rgba(255,246,230,0.02)] p-2">
        <span className="chip chip-jade">{selected.length} selected</span>
        <button type="button" className="btn btn-xs" disabled={!selected.length || busy} onClick={() => { void act({ type: "pet", action: "equip", rowIds: selected }); setSelected([]); }}>
          Equip
        </button>
        <button type="button" className="btn btn-xs" disabled={!selected.length || busy} onClick={() => { void act({ type: "pet", action: "unequip", rowIds: selected }); setSelected([]); }}>
          Unequip
        </button>
        <button type="button" className="btn btn-xs" disabled={!selected.length || busy} onClick={() => act({ type: "pet", action: "favorite", rowIds: selected })}>
          <Star size={11} /> Favourite
        </button>
        <button type="button" className="btn btn-xs" disabled={!selected.length || busy} onClick={() => act({ type: "pet", action: "fuse", rowIds: selected })}>
          Fuse 3 duplicates
        </button>
        <button type="button" className="btn btn-xs btn-danger" disabled={!selected.length || busy} onClick={() => act({ type: "pet", action: "release", rowIds: selected })}>
          <Trash2 size={11} /> Release
        </button>
        {selected.length ? <button type="button" className="btn btn-xs btn-ghost" onClick={() => setSelected([])}>Clear</button> : null}
        {duplicates.length >= 3 && !selected.length ? <span className="ml-auto self-center text-[10px] text-[var(--dim)]">Fusion candidates available</span> : null}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {pets.map((pet) => {
          const rarityDef = rarityById(pet.rarity);
          return (
            <button
              key={pet.rowId}
              type="button"
              className="pet-card"
              data-selected={selected.includes(pet.rowId)}
              data-equipped={pet.equipped}
              onClick={() => toggle(pet.rowId)}
              aria-pressed={selected.includes(pet.rowId)}
              aria-label={`${pet.name}, ${rarityDef.label}, power ${pet.power}`}
            >
              <div className="flex items-start justify-between gap-1">
                <div className="relative">
                  <span className="grid h-14 w-14 place-items-center rounded-xl border" style={{ borderColor: `${pet.tint}44`, background: `radial-gradient(circle at 35% 25%, ${pet.tint}33, transparent 70%)` }}>
                    <Glyph glyph={pet.glyph} tint={pet.tint} size={40} />
                  </span>
                  {pet.equipped ? <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-[var(--jade)] text-[#08231a]"><Check size={10} /></span> : null}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <RarityPill rarity={pet.rarity} />
                  <span className="numeric text-[10px] text-[var(--gold-bright)]">×{pet.power.toFixed(2)}</span>
                </div>
              </div>
              <p className="mt-2 truncate text-[11.5px] font-medium">{pet.name}</p>
              <p className="truncate text-[9.5px] text-[var(--dim)]">{pet.worldId === "all" ? "Any world" : WORLDS.find((w) => w.id === pet.worldId)?.name}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {pet.isGolden ? <span className="text-[8.5px] uppercase tracking-wide text-[var(--gold)]">Golden</span> : null}
                {pet.isShiny ? <span className="text-[8.5px] uppercase tracking-wide text-[#9ef0e2]">Shiny</span> : null}
                {pet.favorite ? <Star size={9} className="text-[var(--gold)]" /> : null}
              </div>
            </button>
          );
        })}
      </div>
      {!pets.length ? (
        <div className="mt-3">
          <EmptyState
            icon={<PawPrint size={18} />}
            title="Nothing in the sanctuary"
            body="Hatch an egg in the Hatchery to summon your first companion. Odds are published; pity guarantees a rare-or-better on the twentieth attempt."
            action={<button type="button" className="btn btn-sm btn-gold" onClick={() => act({ type: "refresh" })}>Refresh sanctuary</button>}
          />
        </div>
      ) : null}
    </Panel>
  );
}

export function EggsPanel({ state, act, busy }: PanelProps) {
  const [openOdds, setOpenOdds] = useState<string | null>(null);
  const [autoEgg, setAutoEgg] = useState<string | null>(null);
  const busyRef = useRef(false);
  busyRef.current = busy;

  useEffect(() => {
    if (!autoEgg) return;
    const timer = window.setInterval(() => {
      if (busyRef.current) return;
      const egg = EGGS.find((e) => e.id === autoEgg);
      if (!egg) return;
      if (state.player.coins < egg.price) return;
      void act({ type: "hatch", eggId: autoEgg, count: 1 }, { silent: true });
    }, 6500);
    return () => window.clearInterval(timer);
  }, [autoEgg, act, state.player.coins]);

  return (
    <Panel
      eyebrow="The hatchery"
      title="Eggs & published odds"
      description="Every table sums to exactly 100.00%. Rolls happen on the server; the pity counter is stored per player and resets on a rare-or-better pull."
      action={
        <div className="flex flex-wrap gap-1.5">
          <span className="chip chip-gold">Pity {state.player.pityCounter}/20</span>
          {state.derived.autoHatchUnlocked ? (
            <button type="button" className={`btn btn-xs ${autoEgg ? "btn-jade" : ""}`} onClick={() => setAutoEgg(autoEgg ? null : (state.worlds.find((w) => w.unlocked)?.eggId ?? EGGS[0].id))}>
              {autoEgg ? "Auto-hatch running" : "Auto-hatch"}
            </button>
          ) : (
            <span className="chip"><Lock size={10} /> Auto-hatch in shop</span>
          )}
        </div>
      }
    >
      <div className="grid gap-3 lg:grid-cols-2">
        {state.worlds.map((world) => {
          const egg = EGGS.find((e) => e.id === world.eggId);
          if (!egg) return null;
          const affordable = state.player.coins >= egg.price;
          return (
            <article key={egg.id} className="panel-soft overflow-hidden">
              <div className="relative overflow-hidden p-3.5" style={{ background: `linear-gradient(140deg, ${world.accentSoft}, transparent 70%)` }}>
                <WorldPatternArt pattern={world.pattern} accent={world.accent} />
                <div className="relative flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-11 w-11 place-items-center rounded-xl border" style={{ borderColor: `${world.accent}55`, background: `${world.accent}18` }}>
                      <EggIcon size={20} style={{ color: world.accent }} />
                    </span>
                    <div>
                      <h3 className="text-[15px]">{egg.name}</h3>
                      <p className="text-[10.5px] text-[var(--muted)]">{world.name} · {world.bonus}</p>
                    </div>
                  </div>
                  {!world.unlocked ? <span className="chip"><Lock size={10} /> {formatNumber(world.unlockAt)} sparks</span> : <span className="chip chip-jade">Unlocked</span>}
                </div>
                <div className="relative mt-3 flex flex-wrap items-center gap-1.5">
                  <span className="chip chip-gold"><SparkMark size={10} /> {formatNumber(egg.price)} per hatch</span>
                  <button type="button" className="btn btn-xs btn-gold" disabled={busy || !world.unlocked || !affordable} onClick={() => act({ type: "hatch", eggId: egg.id, count: 1 })}>Hatch 1</button>
                  <button type="button" className="btn btn-xs" disabled={busy || !world.unlocked || state.player.coins < egg.price * 3} onClick={() => act({ type: "hatch", eggId: egg.id, count: 3 })}>Hatch 3</button>
                  <button type="button" className="btn btn-xs" disabled={busy || !world.unlocked || state.player.coins < egg.price * 10} onClick={() => act({ type: "hatch", eggId: egg.id, count: 10 })}>Hatch 10</button>
                  <button type="button" className="btn btn-xs btn-ghost" onClick={() => setOpenOdds(openOdds === egg.id ? null : egg.id)} aria-expanded={openOdds === egg.id}>
                    Odds <ChevronDown size={11} />
                  </button>
                </div>
              </div>
              {openOdds === egg.id ? (
                <div className="border-t border-[var(--line)] px-3.5 py-2">
                  <table className="data">
                    <thead>
                      <tr><th>Companion</th><th>Rarity</th><th>Weight</th><th>Chance</th></tr>
                    </thead>
                    <tbody>
                      {egg.entries.map((entry) => {
                        const def = petById(entry.petId);
                        const total = egg.entries.reduce((a, b) => a + b.weight, 0);
                        const chance = (entry.weight / total) * 100;
                        return (
                          <tr key={entry.petId}>
                            <td className="flex items-center gap-2">
                              {def ? <Glyph glyph={def.glyph} tint={def.tint} size={20} /> : null}
                              <span className="truncate">{def?.name ?? entry.petId}</span>
                            </td>
                            <td>{def ? <RarityPill rarity={def.rarity} /> : null}</td>
                            <td className="numeric">{entry.weight}</td>
                            <td className="numeric">{chance.toFixed(2)}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <p className="mt-1 text-right text-[10px] text-[var(--dim)]">Table total 1000 parts = 100.00%</p>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </Panel>
  );
}

export function WorldsPanel({ state, act, busy }: PanelProps) {
  return (
    <Panel
      eyebrow="The dimensional ledger"
      title="Worlds"
      description="Each world carries its own palette, hatch table and permanent output bonus. Travelling is instant and free; unlocks are permanent."
      action={<span className="chip chip-gold">{state.worlds.filter((w) => w.unlocked).length}/{WORLDS.length} unlocked</span>}
    >
      <div className="grid gap-3 md:grid-cols-2">
        {state.worlds.map((world) => (
          <article
            key={world.id}
            className="world-stage relative overflow-hidden rounded-[16px] border border-[var(--line)]"
            style={{
              "--world-accent": world.accent,
              "--world-soft": world.accentSoft,
              "--world-bg-from": world.bgFrom,
              "--world-bg-to": world.bgTo,
            } as React.CSSProperties}
          >
            <WorldPatternArt pattern={world.pattern} accent={world.accent} />
            <div className="relative p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="eyebrow">World {String(world.index + 1).padStart(2, "0")}</p>
                  <h3 className="mt-0.5 text-lg" style={{ color: world.ink }}>{world.name}</h3>
                  <p className="text-[10.5px] text-[var(--muted)]">{world.subtitle}</p>
                </div>
                {world.id === state.player.currentWorld ? <span className="chip chip-jade">Current</span> : world.unlocked ? <span className="chip">Unlocked</span> : <span className="chip"><Lock size={10} /> Sealed</span>}
              </div>
              <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-[var(--muted)]">{world.description}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="chip" style={{ borderColor: `${world.accent}44`, color: world.accent }}>{world.bonus}</span>
                <span className="chip">{world.petsOwned}/{world.petsTotal} companions</span>
                {!world.unlocked ? <span className="chip">Needs {formatNumber(world.unlockAt)} sparks</span> : null}
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="flex gap-1">
                  {PETS.filter((p) => p.worldId === world.id).slice(0, 4).map((pet) => (
                    <span key={pet.id} className="grid h-7 w-7 place-items-center rounded-md border border-[var(--line)]" style={{ background: `${pet.tint}12` }}>
                      <Glyph glyph={pet.glyph} tint={pet.tint} size={20} />
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  className={`btn btn-xs ${world.id === state.player.currentWorld ? "" : "btn-gold"}`}
                  disabled={busy || !world.unlocked || world.id === state.player.currentWorld}
                  onClick={() => act({ type: "world", worldId: world.id })}
                >
                  {world.id === state.player.currentWorld ? "You are here" : world.unlocked ? <>Travel <ArrowRight size={11} /></> : "Sealed"}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </Panel>
  );
}

export function RebirthPanel({ state, act, busy }: PanelProps) {
  const config: EconomyConfig = DEFAULT_ECONOMY_CONFIG;
  const requirement = rebirthRequirement(state.player.rebirths, config);
  const embers = rebirthEmbers(state.player.runCoinsEarned, state.player.rebirths, config);
  const sigilGain = Math.max(1, Math.floor(state.player.rebirths / 10) * 2);
  const echoGain = Math.max(1, Math.floor(state.player.sigils / 5));
  const [confirm, setConfirm] = useState<null | "rebirth" | "prestige" | "ascension">(null);

  const tiers = [
    {
      id: "rebirth" as const,
      icon: Flame,
      name: "Rebirth",
      currency: "Embers",
      requirement: `${formatNumber(requirement)} sparks this run`,
      ready: state.player.runCoinsEarned >= requirement,
      gain: `+${embers} embers → ${formatMultiplier(1 + (state.player.embers + embers) * 0.02)} passive multiplier`,
      resets: ["Sparks and run progress", "All twelve upgrade levels", "Current world (unlocks preserved)"],
      keeps: ["Companions and sanctuary", "Achievements and points", "World unlocks", "Season points"],
      preview: `Current embers: ${formatNumber(state.player.embers)}`,
    },
    {
      id: "prestige" as const,
      icon: Crown,
      name: "Prestige",
      currency: "Sigils",
      requirement: "10 rebirths",
      ready: state.player.rebirths >= 10,
      gain: `+${sigilGain} sigils → ${formatMultiplier(1 + (state.player.sigils + sigilGain) * 0.1)} permanent multiplier`,
      resets: ["Embers and rebirth count", "Sparks and upgrades"],
      keeps: ["Companions", "Achievements", "Sigils already banked"],
      preview: `Current sigils: ${formatNumber(state.player.sigils)}`,
    },
    {
      id: "ascension" as const,
      icon: Sparkles,
      name: "Ascension",
      currency: "Echoes",
      requirement: "5 sigils",
      ready: state.player.sigils >= 5,
      gain: `+${echoGain} echoes → ${formatMultiplier(1 + (state.player.echoes + echoGain) * 0.25)} endgame multiplier`,
      resets: ["Sigils, embers, rebirths", "Sparks and upgrades"],
      keeps: ["Companions", "Achievements", "Collection completion"],
      preview: `Current echoes: ${formatNumber(state.player.echoes)}`,
    },
  ];

  return (
    <Panel
      eyebrow="The wheel"
      title="Reset with intention"
      description="Every reset is explicit about what is destroyed and what is permanent. The server recomputes your rewards inside a locked transaction, so a double-click cannot double-claim."
    >
      <div className="grid gap-3 lg:grid-cols-3">
        {tiers.map((tier) => (
          <article key={tier.id} className={`panel-soft p-4 ${tier.ready ? "border-[rgba(233,182,98,0.35)]" : ""}`}>
            <div className="flex items-center justify-between">
              <span className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--line)] bg-[rgba(233,182,98,0.08)]">
                <tier.icon size={16} className="text-[var(--gold)]" />
              </span>
              <span className={`chip ${tier.ready ? "chip-gold" : ""}`}>{tier.ready ? "Available" : tier.requirement}</span>
            </div>
            <h3 className="mt-2.5 text-lg">{tier.name}</h3>
            <p className="text-[10.5px] uppercase tracking-[0.14em] text-[var(--dim)]">Reward currency · {tier.currency}</p>
            <p className="mt-2 text-[11.5px] leading-relaxed text-[var(--gold-bright)]">{tier.gain}</p>
            <p className="mt-1 text-[10.5px] text-[var(--muted)]">{tier.preview}</p>
            <div className="mt-2.5 space-y-1">
              <p className="text-[9.5px] uppercase tracking-[0.14em] text-[var(--dim)]">Resets</p>
              {tier.resets.map((item) => <p key={item} className="text-[11px] text-[#ffbcb0]">− {item}</p>)}
            </div>
            <div className="mt-2 space-y-1">
              <p className="text-[9.5px] uppercase tracking-[0.14em] text-[var(--dim)]">Preserved</p>
              {tier.keeps.map((item) => <p key={item} className="text-[11px] text-[#bff4dd]">+ {item}</p>)}
            </div>
            <button
              type="button"
              className={`btn btn-sm mt-3 w-full ${tier.ready ? "btn-gold" : ""}`}
              disabled={!tier.ready || busy}
              onClick={() => setConfirm(tier.id)}
            >
              {tier.ready ? `Confirm ${tier.name.toLowerCase()}` : `Locked · ${tier.requirement}`}
            </button>
          </article>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-[var(--line)] bg-[rgba(255,246,230,0.02)] p-3">
        <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--dim)]">Deeper resets</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-2 rounded-lg border border-[var(--line)] px-3 py-2">
            <div>
              <p className="text-[12px]">Research path</p>
              <p className="text-[10.5px] text-[var(--dim)]">Galaxy reset preview · requires 3 echoes</p>
            </div>
            <span className="chip"><Lock size={10} /> {formatNumber(state.player.echoes)}/3 echoes</span>
          </div>
          <div className="flex items-center justify-between gap-2 rounded-lg border border-[var(--line)] px-3 py-2">
            <div>
              <p className="text-[12px]">Endgame multiplier</p>
              <p className="text-[10.5px] text-[var(--dim)]">Echoes compound at +25% each, applied to every source</p>
            </div>
            <span className="chip chip-gold">{formatMultiplier(state.derived.echoMultiplier)}</span>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm ? `Confirm ${confirm}` : "Confirm"}
        destructive
        busy={busy}
        confirmLabel={confirm ? `Yes, ${confirm}` : "Confirm"}
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          if (!confirm) return;
          const result = await act({ type: "rebirth", tier: confirm });
          if (result) setConfirm(null);
        }}
        body={
          <div className="space-y-2">
            <p>This is irreversible. The server will verify the requirement again before applying anything.</p>
            {confirm ? (
              <div className="rounded-lg border border-[var(--line)] bg-[rgba(255,246,230,0.03)] p-3 text-[11.5px]">
                {tiers.find((t) => t.id === confirm)?.resets.map((item) => <p key={item} className="text-[#ffbcb0]">Resets: {item}</p>)}
                {tiers.find((t) => t.id === confirm)?.keeps.map((item) => <p key={item} className="text-[#bff4dd]">Keeps: {item}</p>)}
              </div>
            ) : null}
          </div>
        }
      />
    </Panel>
  );
}

export const QUICK_ACHIEVEMENT_TOTAL = ACHIEVEMENTS.length;
export const QUICK_QUEST_TOTAL = QUESTS.length;
export { ArrowUpRight, Globe2 };
void formatDuration;
void petPower;
