"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  CalendarClock,
  Check,
  ClipboardList,
  Crown,
  Gift,
  Globe2,
  Lock,
  LogOut,
  Music2,
  PawPrint,
  Search,
  Settings as SettingsIcon,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Ticket,
  Trophy,
  UserRound,
  Volume2,
  VolumeX,
} from "lucide-react";
import { AVATAR_COLORS, DAILY_REWARDS, PETS, RARITIES, SHOP_ITEMS, TITLES, WORLDS, petById, rarityById } from "@/lib/content";
import { formatDuration, formatMultiplier, formatNumber } from "@/lib/economy";
import type { GameState, LeaderboardPayload } from "@/lib/types";
import { Glyph } from "@/components/ui/art";
import { ConfirmDialog } from "@/components/ui/Modal";
import { Countdown, EmptyState, Meter, Panel, RarityPill, SparkValue, StatTile, useNow, type ActFn } from "./ui";

interface PanelProps {
  state: GameState;
  act: ActFn;
  busy: boolean;
}

export function QuestsPanel({ state, act, busy }: PanelProps) {
  const [cadence, setCadence] = useState<"daily" | "weekly" | "milestone">("daily");
  const quests = state.quests.filter((q) => q.def.cadence === cadence);
  const claimable = state.quests.filter((q) => q.claimable).length;

  return (
    <Panel
      eyebrow="Objectives"
      title="Quest ledger"
      description="Daily and weekly objectives reset on UTC boundaries; milestone lines are permanent. Progress is incremented by the server on validated actions only."
      action={<span className="chip chip-gold">{claimable} ready to claim</span>}
    >
      <div className="tab-row mb-4">
        {(["daily", "weekly", "milestone"] as const).map((item) => (
          <button key={item} type="button" className="tab" aria-selected={cadence === item} onClick={() => setCadence(item)}>
            {item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>
      <div className="grid gap-2.5 lg:grid-cols-2">
        {quests.map((quest) => (
          <article key={quest.def.id} className={`panel-soft p-3.5 ${quest.claimable ? "border-[rgba(89,211,165,0.4)]" : ""}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-medium">{quest.def.name}</p>
                <p className="mt-0.5 text-[11px] text-[var(--muted)]">{quest.def.description}</p>
              </div>
              <span className={`chip flex-shrink-0 ${quest.claimed ? "chip-jade" : quest.claimable ? "chip-gold" : ""}`}>
                {quest.claimed ? "Claimed" : quest.claimable ? "Ready" : "Active"}
              </span>
            </div>
            <div className="mt-2.5"><Meter value={quest.progress} total={quest.goal} tone={quest.claimable ? "jade" : "gold"} label={`${formatNumber(quest.progress)} / ${formatNumber(quest.goal)}`} /></div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                <span className="chip"><Sparkles size={10} /> {formatNumber(quest.def.rewardCoins)}</span>
                <span className="chip">{quest.def.rewardGems} prisms</span>
                {quest.def.rewardEmbers ? <span className="chip chip-gold">{quest.def.rewardEmbers} embers</span> : null}
              </div>
              <button
                type="button"
                className="btn btn-xs btn-jade"
                disabled={busy || !quest.claimable}
                onClick={() => act({ type: "quest", questId: quest.def.id })}
              >
                {quest.claimed ? <><Check size={11} /> Claimed</> : "Claim reward"}
              </button>
            </div>
          </article>
        ))}
      </div>
      {!quests.length ? <EmptyState icon={<ClipboardList size={18} />} title="No quests in this cadence" body="The operations team can assign new lines from the admin console." /> : null}
    </Panel>
  );
}

export function AchievementsPanel({ state }: PanelProps) {
  const [filter, setFilter] = useState<"all" | "unlocked" | "locked">("all");
  const list = state.achievements.filter((entry) =>
    filter === "all" ? true : filter === "unlocked" ? entry.unlocked : !entry.unlocked,
  );

  return (
    <Panel
      eyebrow="Permanent record"
      title="Achievements"
      description="Achievements are permanent across every reset and pay prisms automatically the moment the server observes the threshold."
      action={
        <div className="flex items-center gap-1.5">
          <span className="chip chip-gold">{state.achievementSummary.points} points</span>
          <span className="chip">{state.achievementSummary.unlocked}/{state.achievementSummary.total}</span>
        </div>
      }
    >
      <div className="tab-row mb-4">
        {(["all", "unlocked", "locked"] as const).map((item) => (
          <button key={item} type="button" className="tab" aria-selected={filter === item} onClick={() => setFilter(item)}>
            {item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((entry) => {
          const hidden = entry.def.hidden && !entry.unlocked;
          return (
            <article key={entry.def.id} className={`panel-soft p-3 ${entry.unlocked ? "border-[rgba(233,182,98,0.3)]" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-medium">{hidden ? "Hidden achievement" : entry.def.name}</p>
                  <p className="mt-0.5 line-clamp-2 text-[10.5px] text-[var(--muted)]">{hidden ? "Keep forging. Some records are discovered, not listed." : entry.def.description}</p>
                </div>
                <span className={`grid h-7 w-7 flex-shrink-0 place-items-center rounded-full border ${entry.unlocked ? "border-[rgba(233,182,98,0.5)] bg-[rgba(233,182,98,0.14)] text-[var(--gold-bright)]" : "border-[var(--line)] text-[var(--dim)]"}`}>
                  {entry.unlocked ? <Trophy size={13} /> : <Lock size={12} />}
                </span>
              </div>
              <div className="mt-2"><Meter value={entry.progress} total={entry.def.goal} tone={entry.unlocked ? "gold" : "jade"} label={hidden ? "Hidden" : `${formatNumber(entry.progress)} / ${formatNumber(entry.def.goal)}`} /></div>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-[9.5px] uppercase tracking-[0.12em] text-[var(--dim)]">{entry.def.tier} · {entry.def.points} pts</span>
                <span className="text-[10px] text-[var(--gold)]">+{entry.def.rewardGems} prisms</span>
              </div>
            </article>
          );
        })}
      </div>
    </Panel>
  );
}

export function CollectionPanel({ state }: PanelProps) {
  const owned = new Set(state.pets.map((pet) => pet.petId));
  const total = PETS.length;
  const found = PETS.filter((pet) => owned.has(pet.id)).length;

  return (
    <Panel
      eyebrow="The bestiary"
      title="Collection"
      description="A permanent record of every companion definition in OBSIDIA. Collection survives every reset tier."
      action={<span className="chip chip-gold">{found}/{total} discovered</span>}
    >
      <div className="mb-4"><Meter value={found} total={total} label="Collection completion" /></div>
      <div className="space-y-4">
        {WORLDS.map((world) => {
          const pets = PETS.filter((pet) => pet.worldId === world.id);
          const worldFound = pets.filter((pet) => owned.has(pet.id)).length;
          return (
            <div key={world.id} className="rounded-xl border border-[var(--line)] p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: world.accent }} />
                  <p className="text-[12.5px] font-medium">{world.name}</p>
                </div>
                <span className="numeric text-[10.5px] text-[var(--dim)]">{worldFound}/{pets.length}</span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                {pets.map((pet) => {
                  const has = owned.has(pet.id);
                  return (
                    <div key={pet.id} className={`rounded-lg border px-2 py-1.5 text-center ${has ? "" : "opacity-45"}`} style={{ borderColor: has ? `${pet.tint}44` : "var(--line)" }}>
                      <div className="mx-auto grid place-items-center">
                        <Glyph glyph={pet.glyph} tint={has ? pet.tint : "#6b6257"} size={30} />
                      </div>
                      <p className="mt-0.5 truncate text-[9.5px]">{has ? pet.name : "Undiscovered"}</p>
                      <p className="text-[8px] uppercase tracking-wide" style={{ color: has ? rarityById(pet.rarity).color : "#6b6257" }}>{pet.rarity}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        <div className="rounded-xl border border-[var(--line)] p-3">
          <p className="text-[12.5px] font-medium">Any-world companions</p>
          <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-6">
            {PETS.filter((pet) => pet.worldId === "all").map((pet) => {
              const has = owned.has(pet.id);
              return (
                <div key={pet.id} className={`rounded-lg border px-2 py-1.5 text-center ${has ? "" : "opacity-45"}`} style={{ borderColor: has ? `${pet.tint}55` : "var(--line)" }}>
                  <div className="mx-auto grid place-items-center"><Glyph glyph={pet.glyph} tint={has ? pet.tint : "#6b6257"} size={30} /></div>
                  <p className="mt-0.5 truncate text-[9.5px]">{has ? pet.name : "Undiscovered"}</p>
                  <p className="text-[8px] uppercase tracking-wide" style={{ color: has ? rarityById(pet.rarity).color : "#6b6257" }}>{pet.rarity}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Panel>
  );
}

export function ShopPanel({ state, act, busy }: PanelProps) {
  const groups = [
    { kind: "booster" as const, label: "Boosters", icon: Sparkles },
    { kind: "qol" as const, label: "Quality of life", icon: SettingsIcon },
    { kind: "cosmetic" as const, label: "Cosmetics", icon: Star },
  ];
  return (
    <Panel
      eyebrow="Prism exchange"
      title="Shop"
      description="Prisms are earned from achievements, quests and events — never purchased with real money in this build. Booster timers are stored server-side."
      action={<span className="chip chip-gold">{formatNumber(state.player.gems)} prisms</span>}
    >
      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.kind}>
            <p className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-[var(--dim)]"><group.icon size={11} /> {group.label}</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {SHOP_ITEMS.filter((item) => item.kind === group.kind).map((item) => {
                const owned = state.shop.find((s) => s.item.id === item.id);
                const active = state.player.boosters.find((b) => b.id === item.id);
                const isBooster = item.effect.type === "multiplier";
                return (
                  <article key={item.id} className="panel-soft flex flex-col justify-between p-3">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[12.5px] font-medium">{item.name}</p>
                        {owned?.owned ? <span className="chip chip-jade">Owned</span> : <span className="chip chip-gold">{item.price} prisms</span>}
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted)]">{item.description}</p>
                      {active ? <p className="mt-1 text-[10px] text-[var(--gold)]">Active until {new Date(active.endsAt).toLocaleString()}</p> : null}
                    </div>
                    <button
                      type="button"
                      className="btn btn-xs btn-gold mt-2.5"
                      disabled={busy || (!isBooster && Boolean(owned?.owned)) || state.player.gems < item.price}
                      onClick={() => act({ type: "shop", itemId: item.id })}
                    >
                      {owned?.owned && !isBooster ? "Already owned" : state.player.gems < item.price ? `Need ${item.price} prisms` : `Acquire · ${item.price}`}
                    </button>
                  </article>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 rounded-lg border border-[var(--line)] px-3 py-2 text-[10.5px] leading-relaxed text-[var(--dim)]">
        No payment provider is connected in this build and no card data is collected. Every item is earned through play.
      </p>
    </Panel>
  );
}

const METRICS = [
  { id: "earned", label: "Sparks earned" },
  { id: "clicks", label: "Total clicks" },
  { id: "rebirths", label: "Rebirths" },
  { id: "prestiges", label: "Prestiges" },
  { id: "season", label: "Season points" },
  { id: "achievements", label: "Achievement points" },
  { id: "playtime", label: "Playtime" },
];

export function LeaderboardsPanel({ state }: PanelProps) {
  const [metric, setMetric] = useState("earned");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [data, setData] = useState<LeaderboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ metric, page: String(page) });
        if (search.trim()) params.set("q", search.trim());
        const response = await fetch(`/api/leaderboard?${params.toString()}`);
        const payload = (await response.json()) as LeaderboardPayload & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Leaderboard unavailable.");
        if (alive) setData(payload);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Leaderboard unavailable.");
      } finally {
        if (alive) setLoading(false);
      }
    };
    const timer = window.setTimeout(run, search ? 320 : 0);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [metric, page, search]);

  const metricDef = METRICS.find((m) => m.id === metric);
  const format = (value: number) => (metric === "playtime" ? formatDuration(value) : formatNumber(value));

  return (
    <Panel
      eyebrow="Global rankings"
      title="Leaderboards"
      description="Rankings are computed from indexed server columns, not browser storage. Results are cached briefly and paginated so the query stays cheap."
      action={data?.me ? <span className="chip chip-gold">Your rank #{data.me.rank} · {format(data.me.value)}</span> : <span className="chip">{state.player.username}</span>}
    >
      <div className="tab-row mb-3 hidden-scroll">
        {METRICS.map((item) => (
          <button key={item.id} type="button" className="tab" aria-selected={metric === item.id} onClick={() => { setMetric(item.id); setPage(1); }}>
            {item.label}
          </button>
        ))}
      </div>
      <div className="relative mb-3">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--dim)]" />
        <input className="field field-sm pl-8" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search a callsign" aria-label="Search leaderboard" />
      </div>
      {error ? <div className="rounded-lg border border-[rgba(240,112,95,0.4)] bg-[rgba(240,112,95,0.08)] px-3 py-2 text-[12px] text-[#ffbcb0]" role="alert">{error}</div> : null}
      {loading && !data ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-10 w-full" />)}
        </div>
      ) : data ? (
        <>
          <div className="table-wrap rounded-xl border border-[var(--line)]">
            <table className="data">
              <thead>
                <tr><th>#</th><th>Forgemaster</th><th>{metricDef?.label ?? "Value"}</th><th className="hidden sm:table-cell">Rebirths</th><th className="hidden sm:table-cell">Level</th></tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.playerId} className={row.playerId === state.player.id ? "bg-[rgba(233,182,98,0.07)]" : ""}>
                    <td className="numeric">{row.rank}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="grid h-6 w-6 place-items-center rounded-md border border-[var(--line)] bg-[rgba(255,246,230,0.05)] text-[10px]">{row.username.slice(0, 1).toUpperCase()}</span>
                        <span className="truncate">{row.username}</span>
                        {row.playerId === state.player.id ? <span className="chip chip-gold">You</span> : null}
                      </div>
                    </td>
                    <td className="numeric">{format(row.value)}</td>
                    <td className="numeric hidden sm:table-cell">{row.rebirths}</td>
                    <td className="numeric hidden sm:table-cell">{row.level}</td>
                  </tr>
                ))}
                {!data.rows.length ? <tr><td colSpan={5} className="py-6 text-center text-[12px] text-[var(--muted)]">No players match this search yet.</td></tr> : null}
              </tbody>
            </table>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--dim)]">
            <span>{data.total} ranked player(s) · page {data.page}</span>
            <div className="flex gap-1.5">
              <button type="button" className="btn btn-xs" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</button>
              <button type="button" className="btn btn-xs" disabled={loading || page * data.pageSize >= data.total} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          </div>
        </>
      ) : null}
    </Panel>
  );
}

export function EventsPanel({ state, act, busy }: PanelProps) {
  const now = useNow();
  const grouped = {
    active: state.events.filter((e) => e.status === "active"),
    scheduled: state.events.filter((e) => e.status === "scheduled"),
    ended: state.events.filter((e) => e.status === "ended"),
  };
  return (
    <Panel
      eyebrow="Live operations"
      title="Events"
      description="Multipliers are applied by the game service while an event is active. Event goals are tracked from validated strikes and rewards are claim-once."
      action={<span className="chip chip-gold">{grouped.active.length} live</span>}
    >
      <div className="space-y-4">
        {(["active", "scheduled", "ended"] as const).map((group) => (
          <div key={group}>
            <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-[var(--dim)]">{group} · {grouped[group].length}</p>
            {grouped[group].length ? (
              <div className="grid gap-2.5 lg:grid-cols-2">
                {grouped[group].map((event) => {
                  const endsIn = new Date(event.endsAt).getTime() - now;
                  return (
                    <article key={event.id} className={`panel-soft p-3.5 ${group === "active" ? "border-[rgba(233,182,98,0.35)]" : ""}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium">{event.title}</p>
                          <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--dim)]">{event.type.replace(/_/g, " ")}</p>
                        </div>
                        <span className={`chip ${group === "active" ? "chip-gold" : ""}`}>{formatMultiplier(event.multiplier)}</span>
                      </div>
                      <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--muted)]">{event.description}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="chip">{group === "active" ? <><CalendarClock size={10} /> {endsIn > 0 ? <Countdown to={event.endsAt} prefix="ends " /> : "ending"}</> : group === "scheduled" ? <Countdown to={event.startsAt} prefix="starts in " /> : "concluded"}</span>
                        {event.goalClicks > 0 ? <span className="chip"><Sparkles size={10} /> {formatNumber(event.rewardCoins)}</span> : null}
                        {event.rewardGems > 0 ? <span className="chip">{event.rewardGems} prisms</span> : null}
                      </div>
                      {event.goalClicks > 0 ? (
                        <>
                          <div className="mt-2"><Meter value={event.progress} total={event.goalClicks} label={`${formatNumber(event.progress)} / ${formatNumber(event.goalClicks)} strikes`} /></div>
                          <button
                            type="button"
                            className="btn btn-xs btn-jade mt-2"
                            disabled={busy || !event.claimable || event.claimed}
                            onClick={() => act({ type: "claimEvent", eventId: event.id })}
                          >
                            {event.claimed ? "Reward claimed" : event.claimable ? "Claim event reward" : "Reach the goal to claim"}
                          </button>
                        </>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState icon={<CalendarClock size={18} />} title={`No ${group} events`} body="The operations console can schedule and start events instantly; they appear here as soon as they go live." />
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function DailyPanel({ state, act, busy }: PanelProps) {
  return (
    <Panel
      eyebrow="Daily rhythm"
      title="Daily reward"
      description="Eligibility is evaluated against a server timestamp inside an atomic update. Missing a day resets the streak to day one by rule, not by clock tricks."
      action={<span className="chip chip-gold">Streak {state.daily.streak} days</span>}
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {DAILY_REWARDS.map((reward) => {
          const claimed = state.daily.streak >= reward.day && !state.daily.canClaim;
          const isNext = state.daily.canClaim && reward.day === state.daily.nextStreak;
          return (
            <article key={reward.day} className={`rounded-xl border p-3 text-center ${isNext ? "border-[rgba(233,182,98,0.5)] bg-[rgba(233,182,98,0.08)]" : "border-[var(--line)]"}`}>
              <p className="text-[9.5px] uppercase tracking-[0.14em] text-[var(--dim)]">Day {reward.day}</p>
              <div className="mx-auto mt-1.5 grid h-8 w-8 place-items-center rounded-full border border-[var(--line)] bg-[rgba(255,246,230,0.04)]">
                {claimed ? <Check size={14} className="text-[var(--jade)]" /> : reward.day === 7 ? <Crown size={14} className="text-[var(--gold)]" /> : <Gift size={14} className="text-[var(--gold)]" />}
              </div>
              <p className="mt-1.5 text-[10.5px] font-medium">{reward.label}</p>
              <p className="numeric text-[10px] text-[var(--gold)]">{formatNumber(reward.coins)}</p>
              <p className="numeric text-[9.5px] text-[var(--dim)]">+{reward.gems} prisms</p>
            </article>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[rgba(255,246,230,0.02)] px-3 py-2.5">
        <div>
          <p className="text-[12px]">Today&apos;s reward: Day {state.daily.nextStreak} · {DAILY_REWARDS[state.daily.nextStreak - 1]?.label}</p>
          <p className="text-[10.5px] text-[var(--dim)]">
            {state.daily.canClaim ? "Ready to claim." : state.daily.nextClaimAt ? `Next claim unlocks in ` : "Claimed today."}
            {!state.daily.canClaim && state.daily.nextClaimAt ? <Countdown to={state.daily.nextClaimAt} /> : null}
          </p>
        </div>
        <button type="button" className="btn btn-gold btn-sm" disabled={!state.daily.canClaim || busy} onClick={() => act({ type: "daily" })}>
          {state.daily.canClaim ? "Claim now" : "Already claimed"}
        </button>
      </div>
    </Panel>
  );
}

export function CodesPanel({ state, act, busy }: PanelProps) {
  const [code, setCode] = useState("");
  return (
    <Panel
      eyebrow="Promotional ledger"
      title="Codes"
      description="Redemption is an atomic server operation with per-account and global limits. Codes never reveal rewards before they are granted."
      action={<span className="chip">{state.codes.filter((c) => c.active).length} active</span>}
    >
      <form
        className="flex flex-wrap gap-2"
        onSubmit={async (event) => {
          event.preventDefault();
          const result = await act({ type: "code", code });
          if (result) setCode("");
        }}
      >
        <input
          className="field flex-1 uppercase tracking-[0.12em]"
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          placeholder="OBSIDIA-LAUNCH"
          aria-label="Promotional code"
          maxLength={32}
        />
        <button type="submit" className="btn btn-gold" disabled={busy || code.trim().length < 3}>
          <Ticket size={14} /> Redeem code
        </button>
      </form>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {state.codes.map((entry) => (
          <div key={entry.code} className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 ${entry.redeemed ? "border-[rgba(89,211,165,0.3)]" : "border-[var(--line)]"}`}>
            <div className="min-w-0">
              <p className="numeric truncate text-[12px] tracking-[0.08em]">{entry.code}</p>
              <p className="text-[10px] text-[var(--dim)]">
                {entry.rewardCoins > 0 ? `${formatNumber(entry.rewardCoins)} sparks · ` : ""}{entry.rewardGems > 0 ? `${entry.rewardGems} prisms` : "bonus bundle"}
              </p>
            </div>
            {entry.redeemed ? <span className="chip chip-jade">Redeemed</span> : <span className="chip chip-gold">Available</span>}
          </div>
        ))}
        {!state.codes.length ? <p className="text-[12px] text-[var(--muted)]">No active public codes right now. Operators can create one instantly from the codes module.</p> : null}
      </div>
    </Panel>
  );
}

export interface AudioSettings {
  volume: number;
  setVolume: (value: number) => void;
  muted: boolean;
  toggleMute: () => void;
  ambience: boolean;
  toggleAmbience: () => void;
}

export function SettingsPanel({ state, act, busy, audio }: PanelProps & { audio: AudioSettings }) {
  const router = useRouter();
  const [confirmLogout, setConfirmLogout] = useState(false);
  return (
    <div className="space-y-4">
      <Panel eyebrow="Preferences" title="Settings" description="Audio preferences are stored locally; account preferences are stored on the server against your player row.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="panel-soft p-3.5">
            <p className="flex items-center gap-1.5 text-[12px] font-medium">{audio.muted ? <VolumeX size={13} /> : <Volume2 size={13} />} Sound effects</p>
            <p className="mt-1 text-[11px] text-[var(--muted)]">Synthesized in the browser — no external audio files.</p>
            <div className="mt-2 flex items-center gap-2">
              <button type="button" className={`btn btn-xs ${audio.muted ? "" : "btn-jade"}`} onClick={audio.toggleMute}>
                {audio.muted ? "Unmute" : "Mute"}
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(audio.volume * 100)}
                onChange={(event) => audio.setVolume(Number(event.target.value) / 100)}
                aria-label="Effects volume"
                className="w-full accent-[var(--gold)]"
              />
              <span className="numeric w-8 text-right text-[10px] text-[var(--dim)]">{Math.round(audio.volume * 100)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] text-[var(--muted)]"><Music2 size={12} /> Ambience</span>
              <button type="button" className={`btn btn-xs ${audio.ambience ? "btn-jade" : ""}`} onClick={audio.toggleAmbience} aria-pressed={audio.ambience}>
                {audio.ambience ? "On" : "Off"}
              </button>
            </div>
          </div>
          <div className="panel-soft p-3.5">
            <p className="text-[12px] font-medium">Interface density</p>
            <p className="mt-1 text-[11px] text-[var(--muted)]">Compact mode tightens spacing on the forge rail and navigation.</p>
            <button
              type="button"
              className={`btn btn-xs mt-2 ${state.player.compactMode ? "btn-jade" : ""}`}
              disabled={busy}
              onClick={() => act({ type: "profile", compactMode: !state.player.compactMode })}
            >
              {state.player.compactMode ? "Compact mode on" : "Enable compact mode"}
            </button>
            <p className="mt-2 text-[10px] text-[var(--dim)]">Reduced-motion support follows your operating system preference automatically.</p>
          </div>
        </div>
      </Panel>

      <Panel eyebrow="Data & session" title="Account session" description="Sessions are HTTP-only cookies backed by hashed tokens stored in PostgreSQL.">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-sm btn-danger" onClick={() => setConfirmLogout(true)}>
            <LogOut size={13} /> Sign out
          </button>
          <span className="chip">Session protected · sameSite lax · httpOnly</span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <StatTile label="Server config" value={`v${state.configVersion}`} />
          <StatTile label="Click limit" value={`${state.economy.maxClicksPerSecond}/s`} hint="validated rate" />
          <StatTile label="Offline cap" value={`${state.economy.offlineMaxHours}h`} hint={`${Math.round(state.derived.offlineRate * 100)}% rate`} />
        </div>
      </Panel>

      <ConfirmDialog
        open={confirmLogout}
        title="Sign out of OBSIDIA?"
        body={<p>Your progress is already saved on the server. You can sign back in at any time.</p>}
        confirmLabel="Sign out"
        destructive
        onClose={() => setConfirmLogout(false)}
        onConfirm={async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          router.push("/");
          router.refresh();
        }}
      />
    </div>
  );
}

export function ProfilePanel({ state, act, busy }: PanelProps) {
  return (
    <div className="space-y-4">
      <Panel eyebrow="Identity" title="Profile" description="Your callsign is public on leaderboards. Titles are unlocked through the shop and events." action={<span className="chip chip-gold">{state.player.title}</span>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="label">Avatar colour</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {AVATAR_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Set avatar colour ${color}`}
                  aria-pressed={state.player.avatarColor === color}
                  className="h-8 w-8 rounded-lg border-2 transition"
                  style={{
                    background: `linear-gradient(135deg, var(--world-${color}, #e9b662), #2a1a0c)`,
                    borderColor: state.player.avatarColor === color ? "var(--gold-bright)" : "var(--line)",
                    backgroundImage: `linear-gradient(135deg, ${["#f0a94a", "#4fd6a0", "#5cc7de", "#f0b7a0", "#9ec9ff", "#ff7f52", "#8d9cff", "#ea7bd4", "#c9d6e4", "#f6d98c"][AVATAR_COLORS.indexOf(color)]}, #1b1206)`,
                  }}
                  onClick={() => act({ type: "profile", avatarColor: color })}
                  disabled={busy}
                />
              ))}
            </div>
            <p className="label mt-4">Display title</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {TITLES.map((title) => (
                <button
                  key={title}
                  type="button"
                  className={`tab ${state.player.title === title ? "" : ""}`}
                  aria-selected={state.player.title === title}
                  disabled={busy}
                  onClick={() => act({ type: "profile", title })}
                >
                  {title}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-[var(--dim)]">Titles beyond Initiate are intended to be granted by shop cosmetics; the server accepts the published title list only.</p>
          </div>
          <div className="space-y-2">
            <StatTile label="Account created" value={new Date(state.player.createdAt).toLocaleDateString()} />
            <StatTile label="Season points" value={formatNumber(state.player.seasonPoints)} tone="gold" />
            <StatTile label="Achievement points" value={formatNumber(state.player.achievementPoints)} />
            <StatTile label="Playtime" value={formatDuration(state.player.playtimeSeconds)} />
            <StatTile label="Total clicks" value={formatNumber(state.player.totalClicks)} />
          </div>
        </div>
      </Panel>

      <Panel eyebrow="Lifetime ledger" title="All-time statistics">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile label="Sparks earned" value={formatNumber(state.player.totalCoinsEarned)} tone="gold" />
          <StatTile label="Companions" value={state.stats.petsOwned} />
          <StatTile label="Hatches" value={state.player.hatches} />
          <StatTile label="Upgrades bought" value={state.stats.upgradesBought} />
          <StatTile label="Rebirths" value={state.player.rebirths} />
          <StatTile label="Prestiges" value={state.player.prestiges} />
          <StatTile label="Ascensions" value={state.player.ascensions} />
          <StatTile label="Best combo" value={state.player.bestCombo} />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="chip"><Globe2 size={10} /> {WORLDS.find((w) => w.id === state.player.currentWorld)?.name}</span>
          <span className="chip"><PawPrint size={10} /> {state.pets.filter((p) => p.equipped).length} equipped</span>
          <span className="chip"><ShieldCheck size={10} /> {state.achievementSummary.unlocked} achievements</span>
          <span className="chip"><Sparkles size={10} /> {formatMultiplier(state.derived.globalMultiplier)}</span>
        </div>
      </Panel>
    </div>
  );
}

export function RaritiesLegend() {
  return (
    <div className="flex flex-wrap gap-1.5">
      {RARITIES.map((rarity) => (
        <span key={rarity.id} className="chip" style={{ borderColor: `${rarity.color}55`, color: rarity.color }}>
          {rarity.label} ×{rarity.multiplier}
        </span>
      ))}
    </div>
  );
}

export { BarChart3, petById, ShoppingBag, UserRound };
