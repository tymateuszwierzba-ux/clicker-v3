"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarClock,
  ChevronLeft,
  ClipboardList,
  Crown,
  Egg as EggIcon,
  Flame,
  Gift,
  Globe2,
  Layers,
  LogOut,
  Menu,
  PawPrint,
  RefreshCw,
  Settings,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Ticket,
  Trophy,
  UserRound,
  X,
  Zap,
} from "lucide-react";
import { ROLE_LABELS, WORLDS, worldById } from "@/lib/content";
import { comboMultiplier, formatDuration, formatMultiplier, formatNumber } from "@/lib/economy";
import type { GameState, Notice } from "@/lib/types";
import { Avatar, PrismMark, SparkMark, EmberMark, WorldPatternArt } from "@/components/ui/art";
import { Modal } from "@/components/ui/Modal";
import { Countdown, Meter, SparkValue, StatTile, type ActFn } from "./ui";
import { EggsPanel, HomePanel, PetsPanel, RebirthPanel, UpgradesPanel, WorldsPanel } from "./panels-a";
import {
  AchievementsPanel,
  CodesPanel,
  CollectionPanel,
  DailyPanel,
  EventsPanel,
  LeaderboardsPanel,
  ProfilePanel,
  QuestsPanel,
  SettingsPanel,
  ShopPanel,
  type AudioSettings,
} from "./panels-b";

type TabId =
  | "home"
  | "upgrades"
  | "pets"
  | "eggs"
  | "rebirth"
  | "worlds"
  | "quests"
  | "achievements"
  | "collection"
  | "shop"
  | "leaderboards"
  | "events"
  | "daily"
  | "codes"
  | "settings"
  | "profile";

const NAV: { id: TabId; label: string; icon: typeof Flame; group: string }[] = [
  { id: "home", label: "Command deck", icon: Flame, group: "Forge" },
  { id: "upgrades", label: "Upgrades", icon: SlidersHorizontal, group: "Forge" },
  { id: "worlds", label: "Worlds", icon: Globe2, group: "Forge" },
  { id: "rebirth", label: "Rebirth", icon: RefreshCw, group: "Forge" },
  { id: "pets", label: "Sanctuary", icon: PawPrint, group: "Collection" },
  { id: "eggs", label: "Hatchery", icon: EggIcon, group: "Collection" },
  { id: "collection", label: "Bestiary", icon: BookOpen, group: "Collection" },
  { id: "quests", label: "Quests", icon: ClipboardList, group: "Progress" },
  { id: "achievements", label: "Achievements", icon: Trophy, group: "Progress" },
  { id: "daily", label: "Daily reward", icon: Gift, group: "Progress" },
  { id: "events", label: "Events", icon: CalendarClock, group: "World" },
  { id: "leaderboards", label: "Leaderboards", icon: BarChart3, group: "World" },
  { id: "shop", label: "Shop", icon: ShoppingBag, group: "World" },
  { id: "codes", label: "Codes", icon: Ticket, group: "World" },
  { id: "profile", label: "Profile", icon: UserRound, group: "Account" },
  { id: "settings", label: "Settings", icon: Settings, group: "Account" },
];

const MOBILE_PRIMARY: TabId[] = ["home", "upgrades", "eggs", "pets", "quests"];

const TAB_TITLES: Record<TabId, string> = Object.fromEntries(NAV.map((item) => [item.id, item.label])) as Record<TabId, string>;

interface Floater {
  id: number;
  x: number;
  y: number;
  text: string;
  crit: boolean;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
}

export function GameClient({ initialState }: { initialState: GameState }) {
  const [state, setState] = useState<GameState>(initialState);
  const [tab, setTab] = useState<TabId>("home");
  const [busy, setBusy] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [pending, setPending] = useState(0);
  const [combo, setCombo] = useState(0);
  const [pressed, setPressed] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [opsDeckOpen, setOpsDeckOpen] = useState(false);
  const [offline, setOffline] = useState(initialState.offlineEarned);
  const [syncing, setSyncing] = useState(false);
  const [flash, setFlash] = useState(false);
  const [volume, setVolume] = useState(0.35);
  const [muted, setMuted] = useState(initialState.player.muted);
  const [ambience, setAmbience] = useState(false);

  const router = useRouter();
  const pendingRef = useRef(0);
  const comboRef = useRef(0);
  const lastClickRef = useRef(0);
  const busyRef = useRef(false);
  const audioRef = useRef<AudioContext | null>(null);
  const ambienceRef = useRef<{ osc: OscillatorNode; gain: GainNode } | null>(null);
  const levelRef = useRef(initialState.player.level);
  const idRef = useRef(1);
  const forgeRef = useRef<HTMLDivElement | null>(null);

  const world = worldById(state.player.currentWorld);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("obsidia.audio");
      if (saved) {
        const parsed = JSON.parse(saved) as { volume?: number; muted?: boolean };
        if (typeof parsed.volume === "number") setVolume(parsed.volume);
        if (typeof parsed.muted === "boolean") setMuted(parsed.muted);
      }
    } catch {
      // preferences are optional
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("obsidia.audio", JSON.stringify({ volume, muted }));
    } catch {
      // ignore storage failures
    }
  }, [volume, muted]);

  const pushNotices = useCallback((incoming: Notice[] | undefined) => {
    if (!incoming?.length) return;
    setNotices((current) => [...current, ...incoming].slice(-4));
    window.setTimeout(() => {
      setNotices((current) => current.slice(incoming.length));
    }, 6500);
  }, []);

  const act = useCallback<ActFn>(
    async (payload, options) => {
      busyRef.current = true;
      setBusy(true);
      try {
        const response = await fetch("/api/game/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await response.json()) as { state?: GameState; notices?: Notice[]; result?: Record<string, unknown>; error?: string };
        if (!response.ok || !data.state) throw new Error(data.error ?? "The forge rejected that request.");
        setState(data.state);
        if (!options?.silent) pushNotices(data.notices);
        return data.result ?? {};
      } catch (error) {
        const message = error instanceof Error ? error.message : "Something went wrong.";
        setNotices((current) => [
          ...current,
          { id: `error-${Date.now()}`, kind: "system" as const, title: "Request blocked", body: message, tone: "danger" },
        ].slice(-4));
        window.setTimeout(() => setNotices((current) => current.slice(1)), 6000);
        return null;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [pushNotices],
  );

  const flush = useCallback(async () => {
    const clicks = pendingRef.current;
    if (clicks <= 0) return;
    pendingRef.current = 0;
    setPending(0);
    setSyncing(true);
    try {
      const response = await fetch("/api/game/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "sync", clicks, combo: comboRef.current }),
      });
      const data = (await response.json()) as { state?: GameState; notices?: Notice[]; error?: string };
      if (!response.ok || !data.state) {
        pendingRef.current += clicks;
        return;
      }
      setState(data.state);
      pushNotices(data.notices);
      if (data.state.player.level > levelRef.current) {
        levelRef.current = data.state.player.level;
        setFlash(true);
        window.setTimeout(() => setFlash(false), 1400);
      }
    } catch {
      pendingRef.current += clicks;
    } finally {
      setSyncing(false);
    }
  }, [pushNotices]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void flush();
    }, 2400);
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [flush]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (Date.now() - lastClickRef.current > 1600 && comboRef.current > 0) {
        comboRef.current = 0;
        setCombo(0);
      }
    }, 400);
    return () => window.clearInterval(timer);
  }, []);

  const getAudio = useCallback(() => {
    if (typeof window === "undefined") return null;
    if (!audioRef.current) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      audioRef.current = new Ctor();
    }
    if (audioRef.current.state === "suspended") void audioRef.current.resume();
    return audioRef.current;
  }, []);

  const tone = useCallback(
    (frequency: number, duration: number, type: OscillatorType = "triangle", gainScale = 1) => {
      if (muted) return;
      const ctx = getAudio();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, frequency * 0.6), ctx.currentTime + duration);
      gain.gain.setValueAtTime(Math.max(0.0001, volume * 0.22 * gainScale), ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    },
    [getAudio, muted, volume],
  );

  useEffect(() => {
    if (!ambience) {
      if (ambienceRef.current) {
        ambienceRef.current.osc.stop();
        ambienceRef.current = null;
      }
      return;
    }
    const ctx = getAudio();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 68;
    gain.gain.value = muted ? 0 : volume * 0.06;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    ambienceRef.current = { osc, gain };
    return () => {
      try {
        osc.stop();
      } catch {
        // already stopped
      }
      ambienceRef.current = null;
    };
  }, [ambience, getAudio, muted, volume]);

  const audioSettings: AudioSettings = useMemo(
    () => ({
      volume,
      setVolume,
      muted,
      toggleMute: () => {
        setMuted((current) => {
          void act({ type: "profile", muted: !current }, { silent: true });
          return !current;
        });
      },
      ambience,
      toggleAmbience: () => setAmbience((value) => !value),
    }),
    [volume, muted, ambience, act],
  );

  const strike = useCallback(
    (count = 1, point?: { x: number; y: number }) => {
      const now = Date.now();
      if (now - lastClickRef.current > 1600) comboRef.current = 0;
      lastClickRef.current = now;
      comboRef.current = Math.min(500, comboRef.current + count);
      setCombo(comboRef.current);
      const factor = comboMultiplier(comboRef.current, state.derived.comboEfficiency);
      const crit = Math.random() * 100 < state.derived.critChance;
      const perClick = state.derived.clickPower * factor * (crit ? state.derived.critMultiplier : 1);
      const total = perClick * count;
      pendingRef.current += count;
      setPending(pendingRef.current);

      const x = point?.x ?? 50;
      const y = point?.y ?? 40;
      const id = idRef.current++;
      setFloaters((current) => [
        ...current.slice(-9),
        { id, x, y, text: `${crit ? "CRIT " : ""}+${formatNumber(total)}`, crit },
      ]);
      window.setTimeout(() => setFloaters((current) => current.filter((item) => item.id !== id)), 1000);

      const sparkCount = Math.min(6, 3 + Math.floor(count / 4));
      const newSparks: Particle[] = Array.from({ length: sparkCount }).map((_, index) => ({
        id: idRef.current++,
        x: x + (Math.random() * 24 - 12),
        y: y + (Math.random() * 20 - 10),
        dx: Math.random() * 90 - 45,
        dy: -30 - Math.random() * 70,
        ...{ key: index },
      }));
      setParticles((current) => [...current.slice(-20), ...newSparks]);
      const ids = newSparks.map((item) => item.id);
      window.setTimeout(() => setParticles((current) => current.filter((item) => !ids.includes(item.id))), 750);

      setPressed(true);
      window.setTimeout(() => setPressed(false), 110);
      tone(crit ? 640 : 320, crit ? 0.16 : 0.09, crit ? "sawtooth" : "triangle", crit ? 1.25 : 1);
      if (pendingRef.current >= 30) void flush();
    },
    [state.derived.clickPower, state.derived.comboEfficiency, state.derived.critChance, state.derived.critMultiplier, tone, flush],
  );

  const onForgeClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    strike(1, { x: event.clientX - rect.left, y: event.clientY - rect.top });
  };

  const claimCount = state.quests.filter((q) => q.claimable).length + state.events.filter((e) => e.claimable).length + (state.daily.canClaim ? 1 : 0);
  const displayCoins = state.player.coins + pending * state.derived.clickPower;
  const comboFactor = comboMultiplier(combo, state.derived.comboEfficiency);
  const activeEvents = state.events.filter((event) => event.status === "active");
  const levelPct = state.player.xpPct;
  const isStaff = ["owner", "super_admin", "admin", "moderator", "support"].includes(state.player.role);

  const panelProps = { state, act, busy };

  const panel = (() => {
    switch (tab) {
      case "home": return <HomePanel {...panelProps} />;
      case "upgrades": return <UpgradesPanel {...panelProps} />;
      case "pets": return <PetsPanel {...panelProps} />;
      case "eggs": return <EggsPanel {...panelProps} />;
      case "rebirth": return <RebirthPanel {...panelProps} />;
      case "worlds": return <WorldsPanel {...panelProps} />;
      case "quests": return <QuestsPanel {...panelProps} />;
      case "achievements": return <AchievementsPanel {...panelProps} />;
      case "collection": return <CollectionPanel {...panelProps} />;
      case "shop": return <ShopPanel {...panelProps} />;
      case "leaderboards": return <LeaderboardsPanel {...panelProps} />;
      case "events": return <EventsPanel {...panelProps} />;
      case "daily": return <DailyPanel {...panelProps} />;
      case "codes": return <CodesPanel {...panelProps} />;
      case "settings": return <SettingsPanel {...panelProps} audio={audioSettings} />;
      case "profile": return <ProfilePanel {...panelProps} />;
      default: return <HomePanel {...panelProps} />;
    }
  })();

  const navGroups = Array.from(new Set(NAV.map((item) => item.group)));

  const navButton = (item: (typeof NAV)[number]) => (
    <button
      key={item.id}
      type="button"
      className="sidebar-link"
      aria-current={tab === item.id ? "page" : undefined}
      onClick={() => {
        setTab(item.id);
        setNavOpen(false);
      }}
      title={collapsed ? item.label : undefined}
    >
      <item.icon size={15} className="nav-icon flex-shrink-0" />
      <span className={collapsed ? "hidden lg:hidden" : "truncate"}>{item.label}</span>
      {item.id === "quests" && claimCount > 0 ? <span className="ml-auto rounded-full bg-[var(--gold)] px-1.5 text-[9px] font-bold text-[#241505]">{claimCount}</span> : null}
    </button>
  );

  return (
    <div
      className="game-shell min-h-screen"
      style={
        {
          "--world-accent": world.accent,
          "--world-soft": world.accentSoft,
          "--world-ink": world.ink,
        } as React.CSSProperties
      }
    >
      <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[rgba(8,7,12,0.82)] glass-blur">
        <div className="flex items-center gap-2 px-3 py-2 sm:px-4">
          <button type="button" className="btn btn-ghost btn-xs lg:hidden" onClick={() => setNavOpen(true)} aria-label="Open navigation">
            <Menu size={17} />
          </button>
          <Link href="/" className="flex items-center gap-2" aria-label="OBSIDIA home">
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-[rgba(233,182,98,0.36)] bg-[rgba(233,182,98,0.1)]">
              <SparkMark size={15} color="var(--gold-bright)" />
            </span>
            <span className="hidden leading-tight sm:block">
              <span className="block font-[var(--serif)] text-[14px] tracking-[0.16em]">OBSIDIA</span>
              <span className="block text-[8px] uppercase tracking-[0.26em] text-[var(--dim)]">The Infinite Forge</span>
            </span>
          </Link>

          <button type="button" className="chip ml-1 hidden md:inline-flex" onClick={() => setTab("worlds")} title="Switch world">
            <Globe2 size={11} style={{ color: world.accent }} /> {world.name} <span className="text-[var(--dim)]">{formatMultiplier(state.derived.worldMultiplier)}</span>
          </button>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[rgba(255,246,230,0.03)] px-2 py-1">
              <SparkMark size={12} color="var(--gold)" />
              <span className="numeric text-[12px] text-[#fdf3e3]">{formatNumber(displayCoins)}</span>
            </div>
            <div className="hidden items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[rgba(255,246,230,0.03)] px-2 py-1 sm:flex">
              <PrismMark size={12} color="#9ef0e2" />
              <span className="numeric text-[12px]">{formatNumber(state.player.gems)}</span>
            </div>
            <div className="hidden items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[rgba(255,246,230,0.03)] px-2 py-1 md:flex">
              <EmberMark size={12} color="#ff9a6c" />
              <span className="numeric text-[12px]">{formatNumber(state.player.embers)}</span>
            </div>

            {isStaff ? (
              <button
                type="button"
                className="btn btn-xs btn-gold flex items-center gap-1 shadow-[0_0_12px_rgba(233,182,98,0.35)]"
                title="Ops Control: test adding clicks/sparks instantly with zero reload"
                onClick={() => setOpsDeckOpen(true)}
              >
                <ShieldCheck size={12} />
                <span className="hidden sm:inline">⚡ Ops Boost</span>
              </button>
            ) : null}

            <div className="relative">
              <button
                type="button"
                className="btn btn-ghost btn-xs relative"
                aria-label={`Notifications${claimCount ? `, ${claimCount} unclaimed` : ""}`}
                aria-expanded={notifOpen}
                onClick={() => {
                  setNotifOpen((value) => !value);
                  setProfileOpen(false);
                }}
              >
                <Bell size={15} />
                {claimCount > 0 ? <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--gold)] px-1 text-[8.5px] font-bold text-[#241505]">{claimCount}</span> : null}
              </button>
              {notifOpen ? (
                <div className="absolute right-0 top-10 z-50 w-[280px] rounded-xl border border-[var(--line-strong)] bg-[#141119] p-2 shadow-[0_24px_60px_-20px_#000]">
                  <p className="px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--dim)]">Notifications</p>
                  {state.quests.filter((q) => q.claimable).slice(0, 3).map((q) => (
                    <button key={q.def.id} type="button" className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-[rgba(255,246,230,0.05)]" onClick={() => { setTab("quests"); setNotifOpen(false); }}>
                      <ClipboardList size={13} className="text-[var(--jade)]" />
                      <span className="truncate text-[11.5px]">{q.def.name} ready</span>
                    </button>
                  ))}
                  {state.daily.canClaim ? (
                    <button type="button" className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-[rgba(255,246,230,0.05)]" onClick={() => { setTab("daily"); setNotifOpen(false); }}>
                      <Gift size={13} className="text-[var(--gold)]" />
                      <span className="truncate text-[11.5px]">Daily reward is ready</span>
                    </button>
                  ) : null}
                  {state.events.filter((e) => e.claimable).slice(0, 2).map((e) => (
                    <button key={e.id} type="button" className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-[rgba(255,246,230,0.05)]" onClick={() => { setTab("events"); setNotifOpen(false); }}>
                      <CalendarClock size={13} className="text-[var(--gold)]" />
                      <span className="truncate text-[11.5px]">{e.title} reward ready</span>
                    </button>
                  ))}
                  {!claimCount ? <p className="px-2 py-3 text-[11.5px] text-[var(--muted)]">Nothing needs your attention. The forge is clean.</p> : null}
                  {state.announcements.slice(0, 2).map((a) => (
                    <div key={a.id} className="mt-1 rounded-lg border border-[var(--line)] px-2 py-1.5 text-[10.5px] text-[var(--muted)]">{a.message}</div>
                  ))}
                </div>
              ) : null}
            </div>

            <button type="button" className="relative" aria-label="Open profile menu" aria-expanded={profileOpen} onClick={() => { setProfileOpen((value) => !value); setNotifOpen(false); }}>
              <Avatar color={state.player.avatarColor} name={state.player.username} size={32} />
            </button>
            {profileOpen ? (
              <div className="absolute right-3 top-[52px] z-50 w-[250px] rounded-xl border border-[var(--line-strong)] bg-[#141119] p-2 shadow-[0_24px_60px_-20px_#000]">
                <div className="flex items-center gap-2 rounded-lg px-2 py-2">
                  <Avatar color={state.player.avatarColor} name={state.player.username} size={36} />
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-medium">{state.player.username}</p>
                    <p className="truncate text-[10px] text-[var(--dim)]">{state.player.title} · Lv {state.player.level} · {ROLE_LABELS[state.player.role] ?? state.player.role}</p>
                  </div>
                </div>
                <div className="my-1 h-px bg-[var(--line)]" />
                <button type="button" className="sidebar-link" onClick={() => { setTab("profile"); setProfileOpen(false); }}><UserRound size={14} /> Profile</button>
                <button type="button" className="sidebar-link" onClick={() => { setTab("settings"); setProfileOpen(false); }}><Settings size={14} /> Settings</button>
                {isStaff ? (
                  <Link href="/admin" className="sidebar-link"><ShieldCheck size={14} /> Operations console</Link>
                ) : null}
                <button
                  type="button"
                  className="sidebar-link"
                  onClick={async () => {
                    await fetch("/api/auth/logout", { method: "POST" });
                    router.push("/");
                    router.refresh();
                  }}
                >
                  <LogOut size={14} /> Sign out
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-[var(--line)] px-3 py-1.5 sm:px-4">
          <div className="flex min-w-0 flex-1 items-center gap-2 text-[10.5px] text-[var(--muted)]">
            <span className="chip chip-gold flex-shrink-0">Lv {state.player.level}</span>
            <div className="max-w-[180px] flex-1"><Meter value={levelPct} total={100} /></div>
            <span className="numeric hidden flex-shrink-0 text-[10px] text-[var(--dim)] sm:inline">{formatNumber(state.player.xpCurrent)}/{formatNumber(state.player.xpNeeded)} XP</span>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1.5 text-[10px]">
            {activeEvents.slice(0, 1).map((event) => (
              <span key={event.id} className="chip chip-gold hidden sm:inline-flex">
                <Sparkles size={10} /> {event.title} {formatMultiplier(event.multiplier)} · <Countdown to={event.endsAt} prefix="" />
              </span>
            ))}
            <span className={`chip ${syncing ? "" : "chip-jade"}`}>{syncing ? <RefreshCw size={9} className="animate-spin" /> : <ShieldCheck size={9} />} {syncing ? "Saving" : "Saved"}</span>
          </div>
        </div>

        {state.announcements.length || activeEvents.length ? (
          <div className="event-bar hidden overflow-hidden px-3 py-1 sm:block">
            <div className="marquee-track text-[10.5px] uppercase tracking-[0.16em] text-[var(--gold-bright)]">
              {[0, 1].map((copy) => (
                <span key={copy} className="flex gap-8">
                  {state.announcements.map((a) => <span key={`${a.id}-${copy}`}>◆ {a.message}</span>)}
                  {activeEvents.map((event) => <span key={`${event.id}-${copy}`}>◆ {event.title} · {formatMultiplier(event.multiplier)} live</span>)}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </header>

      <div className="mx-auto flex w-full max-w-[1560px] gap-4 px-3 pb-24 pt-3 sm:px-4 lg:pb-8">
        <aside className={`hidden flex-shrink-0 lg:block ${collapsed ? "w-[62px]" : "w-[212px]"}`}>
          <div className="sticky top-[104px]">
            <nav className="panel p-2" aria-label="Game sections">
              {navGroups.map((group) => (
                <div key={group} className="mb-1.5 last:mb-0">
                  {!collapsed ? <p className="px-2 pb-1 pt-1 text-[8.5px] uppercase tracking-[0.2em] text-[var(--dim)]">{group}</p> : <div className="mx-1 my-1 h-px bg-[var(--line)]" />}
                  <div className="space-y-0.5">{NAV.filter((item) => item.group === group).map(navButton)}</div>
                </div>
              ))}
            </nav>
            <button type="button" className="btn btn-ghost btn-xs mt-2 w-full" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}>
              <ChevronLeft size={13} className={collapsed ? "rotate-180" : ""} /> {collapsed ? "" : "Collapse"}
            </button>
            <div className="panel mt-2 p-2.5">
              <p className="text-[9px] uppercase tracking-[0.16em] text-[var(--dim)]">Current world</p>
              <p className="mt-0.5 truncate text-[12px]" style={{ color: world.accent }}>{world.name}</p>
              <p className="mt-1 text-[10px] leading-relaxed text-[var(--muted)]">{world.bonus}</p>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <nav className="mb-2 flex gap-1 overflow-x-auto lg:hidden hidden-scroll" aria-label="Game sections">
            {NAV.filter((item) => item.group === "Forge" || item.group === "Collection").map((item) => (
              <button key={item.id} type="button" className="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)}>
                <item.icon size={11} className="mr-1 inline" /> {item.label}
              </button>
            ))}
          </nav>

          <section className="panel relative mb-3 overflow-hidden" aria-label="The forge">
            <div
              className="relative"
              style={{ background: "linear-gradient(165deg, rgba(26,21,32,0.9), rgba(12,10,17,0.96))" }}
            >
              <div className="relative overflow-hidden rounded-t-[inherit]">
                <div className="absolute inset-0 opacity-70" style={{ background: `linear-gradient(120deg, ${world.accentSoft}, transparent 55%)` }} />
                <WorldPatternArt pattern={world.pattern} accent={world.accent} />
                <div className="relative flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="chip" style={{ borderColor: `${world.accent}55`, color: world.accent }}>
                        <Globe2 size={10} /> {world.name}
                      </span>
                      <span className="chip"><Zap size={10} /> {formatNumber(state.derived.clickPower)} / click</span>
                      <span className="chip"><RefreshCw size={10} /> {formatNumber(state.derived.passivePerSecond)} / sec</span>
                      {combo > 0 ? <span className="chip chip-jade">Combo {combo} · {formatMultiplier(comboFactor)}</span> : null}
                    </div>
                    <p className="eyebrow mt-3">Spark reserve</p>
                    <p className="numeric flex items-baseline gap-2 text-[clamp(28px,4.4vw,42px)] leading-none text-[#fdf3e3]" aria-live="polite">
                      {formatNumber(displayCoins)}
                      <span className="text-[11px] font-normal uppercase tracking-[0.18em] text-[var(--dim)]">sparks</span>
                    </p>
                    <div className="mt-3 max-w-md"><Meter value={state.milestone.current} total={state.milestone.next} label={state.milestone.label} /></div>
                    <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                      <StatTile label="Total clicks" value={formatNumber(state.player.totalClicks)} />
                      <StatTile label="Multiplier" value={formatMultiplier(state.derived.globalMultiplier)} tone="gold" />
                      <StatTile label="Rebirth" value={formatMultiplier(state.derived.rebirthMultiplier)} />
                      <StatTile label="Prestige" value={formatMultiplier(state.derived.prestigeMultiplier)} />
                    </div>
                  </div>

                  <div className="flex flex-shrink-0 flex-col items-center gap-2">
                    <div ref={forgeRef} className="relative grid place-items-center" style={{ padding: "14px" }}>
                      <button
                        type="button"
                        className="forge-button drift"
                        data-pressed={pressed}
                        onClick={onForgeClick}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            const rect = event.currentTarget.getBoundingClientRect();
                            strike(1, { x: rect.width / 2, y: rect.height / 2 });
                          }
                        }}
                        aria-label={`Strike the forge. Current click power ${formatNumber(state.derived.clickPower)} sparks.`}
                      >
                        <span className="ring-pulse" aria-hidden="true" />
                        <span className="forge-core">
                          <strong>{formatNumber(state.derived.clickPower)}</strong>
                          <span>strike the forge</span>
                        </span>
                      </button>
                      {floaters.map((floater) => (
                        <span key={floater.id} className={`floater ${floater.crit ? "floater-crit" : ""}`} style={{ left: floater.x, top: floater.y }}>
                          {floater.text}
                        </span>
                      ))}
                      {particles.map((particle) => (
                        <span key={particle.id} className="spark" style={{ left: particle.x, top: particle.y, "--dx": `${particle.dx}px`, "--dy": `${particle.dy}px` } as React.CSSProperties} />
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button type="button" className="btn btn-xs btn-gold" onClick={(event) => {
                        const rect = event.currentTarget.getBoundingClientRect();
                        strike(10, { x: rect.width / 2, y: rect.height / 2 });
                      }}>
                        ×10 strike
                      </button>
                      <span className="chip">{state.derived.critChance.toFixed(0)}% crit</span>
                    </div>
                  </div>
                </div>
              </div>
              {flash ? <div className="pointer-events-none absolute inset-0 animate-[fadeIn_0.3s_ease]" style={{ background: "radial-gradient(circle at 50% 40%, rgba(247,215,154,0.28), transparent 60%)" }} /> : null}
            </div>
          </section>

          <div className="mb-2 flex items-center justify-between">
            <div>
              <p className="eyebrow">Section</p>
              <h1 className="text-xl sm:text-2xl">{TAB_TITLES[tab]}</h1>
            </div>
            <button type="button" className="btn btn-xs" onClick={() => act({ type: "refresh" })} disabled={busy}>
              <RefreshCw size={12} className={busy ? "animate-spin" : ""} /> Sync
            </button>
          </div>

          <div key={tab} className="animate-[fadeIn_0.25s_ease]">{panel}</div>
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line)] bg-[rgba(9,8,13,0.96)] px-2 py-1.5 glass-blur lg:hidden" aria-label="Primary mobile navigation">
        <div className="flex items-center justify-around">
          {MOBILE_PRIMARY.map((id) => {
            const item = NAV.find((n) => n.id === id);
            if (!item) return null;
            return (
              <button
                key={id}
                type="button"
                className={`flex min-w-[56px] flex-col items-center gap-0.5 rounded-lg px-2 py-1 ${tab === id ? "text-[var(--gold-bright)]" : "text-[var(--mutey)] text-[var(--muted)]"}`}
                onClick={() => setTab(id)}
                aria-current={tab === id ? "page" : undefined}
              >
                <item.icon size={17} />
                <span className="text-[9px]">{item.label.split(" ")[0]}</span>
              </button>
            );
          })}
          <button type="button" className="flex min-w-[56px] flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-[var(--muted)]" onClick={() => setNavOpen(true)}>
            <Layers size={17} />
            <span className="text-[9px]">More</span>
          </button>
        </div>
      </nav>

      {navOpen ? (
        <div className="fixed inset-0 z-[70] lg:hidden" role="dialog" aria-modal="true" aria-label="Full navigation">
          <button type="button" className="absolute inset-0 bg-[rgba(4,3,7,0.72)]" aria-label="Close navigation" onClick={() => setNavOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[272px] overflow-y-auto border-r border-[var(--line-strong)] bg-[#0d0b12] p-3">
            <div className="flex items-center justify-between">
              <span className="font-[var(--serif)] text-[15px] tracking-[0.18em]">OBSIDIA</span>
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => setNavOpen(false)} aria-label="Close"><X size={16} /></button>
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-[var(--line)] px-2 py-2">
              <Avatar color={state.player.avatarColor} name={state.player.username} size={32} />
              <div className="min-w-0">
                <p className="truncate text-[12px]">{state.player.username}</p>
                <p className="text-[10px] text-[var(--dim)]">Lv {state.player.level} · {state.player.title}</p>
              </div>
            </div>
            <nav className="mt-2 space-y-3" aria-label="All game sections">
              {navGroups.map((group) => (
                <div key={group}>
                  <p className="px-2 pb-1 text-[8.5px] uppercase tracking-[0.2em] text-[var(--dim)]">{group}</p>
                  <div className="space-y-0.5">{NAV.filter((item) => item.group === group).map(navButton)}</div>
                </div>
              ))}
            </nav>
            {isStaff ? <Link href="/admin" className="btn btn-sm btn-block mt-3"><ShieldCheck size={13} /> Operations console</Link> : null}
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none fixed inset-x-0 top-16 z-[90] flex flex-col items-center gap-2 px-3" aria-live="polite">
        {notices.map((toast) => (
          <div key={toast.id} className={`toast ${toast.tone === "jade" ? "toast-jade" : toast.tone === "danger" ? "toast-gold" : "toast-gold"} pointer-events-auto`}>
            <span className="mt-0.5 flex-shrink-0 text-[var(--gold-bright)]">
              {toast.kind === "achievement" ? <Trophy size={14} /> : toast.kind === "pet" ? <PawPrint size={14} /> : toast.kind === "daily" ? <Gift size={14} /> : toast.kind === "quest" ? <ClipboardList size={14} /> : <Sparkles size={14} />}
            </span>
            <div className="min-w-0">
              <p className="text-[12px] font-semibold">{toast.title}</p>
              <p className="text-[11px] leading-relaxed text-[var(--muted)]">{toast.body}</p>
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={opsDeckOpen}
        onClose={() => setOpsDeckOpen(false)}
        title="⚡ Operations Fast Control (+100000000000000000)"
        subtitle="Staff sandbox testing · writes to PostgreSQL and refreshes in real time with zero page reload"
        size="md"
        footer={
          <div className="flex items-center justify-between w-full">
            <Link href="/admin" className="btn btn-xs btn-gold flex items-center gap-1">
              <ShieldCheck size={12} /> Open Full Ops Console
            </Link>
            <button type="button" className="btn btn-xs" onClick={() => setOpsDeckOpen(false)}>Close</button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-[12px] text-[var(--muted)]">
            Instantly grant massive or micro values to your current active player ({state.player.username}).
            The database updates atomically and your HUD reconciles immediately:
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="btn btn-sm btn-gold flex flex-col items-center justify-center p-2.5 text-center"
              onClick={async () => {
                await fetch("/api/admin/action", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "quickGrant", payload: { playerId: state.player.id, currency: "coins", amount: 100000000000000000 }, reason: "Ops Boost +100000000000000000 sparks" }),
                });
                await act({ type: "refresh" });
                setOpsDeckOpen(false);
              }}
            >
              <span className="font-bold text-[12px]">⚡ +100000000000000000 Sparks</span>
              <span className="text-[9.5px] opacity-80">+100 Quadrillion (1e17)</span>
            </button>
            <button
              type="button"
              className="btn btn-sm btn-gold flex flex-col items-center justify-center p-2.5 text-center"
              onClick={async () => {
                await fetch("/api/admin/action", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "quickGrant", payload: { playerId: state.player.id, currency: "clicks", amount: 100000000000000000 }, reason: "Ops Boost +100000000000000000 clicks" }),
                });
                await act({ type: "refresh" });
                setOpsDeckOpen(false);
              }}
            >
              <span className="font-bold text-[12px]">⚡ +100000000000000000 Clicks</span>
              <span className="text-[9.5px] opacity-80">+100 Quadrillion (1e17)</span>
            </button>
            <button
              type="button"
              className="btn btn-sm flex flex-col items-center justify-center p-2 text-center"
              onClick={async () => {
                await fetch("/api/admin/action", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "quickGrant", payload: { playerId: state.player.id, currency: "clicks", amount: 100 }, reason: "Ops Boost +100 clicks" }),
                });
                await act({ type: "refresh" });
                setOpsDeckOpen(false);
              }}
            >
              <span className="font-bold text-[11.5px]">+100 Clicks</span>
              <span className="text-[9px] text-[var(--dim)]">Test fast click balance</span>
            </button>
            <button
              type="button"
              className="btn btn-sm flex flex-col items-center justify-center p-2 text-center"
              onClick={async () => {
                await fetch("/api/admin/action", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "quickGrant", payload: { playerId: state.player.id, currency: "clicks", amount: 10000 }, reason: "Ops Boost +10,000 clicks" }),
                });
                await act({ type: "refresh" });
                setOpsDeckOpen(false);
              }}
            >
              <span className="font-bold text-[11.5px]">+10,000 Clicks</span>
              <span className="text-[9px] text-[var(--dim)]">Test milestone unlocks</span>
            </button>
            <button
              type="button"
              className="btn btn-sm flex flex-col items-center justify-center p-2 text-center"
              onClick={async () => {
                await fetch("/api/admin/action", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "quickGrant", payload: { playerId: state.player.id, currency: "gems", amount: 1000 }, reason: "Ops Boost +1,000 prisms" }),
                });
                await act({ type: "refresh" });
                setOpsDeckOpen(false);
              }}
            >
              <span className="font-bold text-[11.5px]">+1,000 Prisms</span>
              <span className="text-[9px] text-[var(--dim)]">Test shop purchases</span>
            </button>
            <button
              type="button"
              className="btn btn-sm flex flex-col items-center justify-center p-2 text-center"
              onClick={async () => {
                await fetch("/api/admin/action", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "quickGrant", payload: { playerId: state.player.id, currency: "embers", amount: 100 }, reason: "Ops Boost +100 embers" }),
                });
                await act({ type: "refresh" });
                setOpsDeckOpen(false);
              }}
            >
              <span className="font-bold text-[11.5px]">+100 Embers</span>
              <span className="text-[9px] text-[var(--dim)]">Test rebirth multipliers</span>
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={offline > 0} onClose={() => setOffline(0)} title="While you were away" subtitle="Offline production · computed server-side" size="sm">
        <div className="space-y-3">
          <p className="text-[13px] text-[var(--muted)]">The forge kept working. Your companions and furnace produced:</p>
          <div className="flex items-center gap-2 rounded-xl border border-[rgba(233,182,98,0.35)] bg-[rgba(233,182,98,0.08)] px-4 py-3">
            <SparkMark size={22} color="var(--gold-bright)" />
            <span className="numeric text-2xl text-[var(--gold-bright)]">{formatNumber(offline)}</span>
            <span className="text-[11px] uppercase tracking-[0.16em] text-[var(--dim)]">sparks</span>
          </div>
          <p className="text-[11px] leading-relaxed text-[var(--dim)]">
            Offline income is capped at {state.economy.offlineMaxHours} hours and paid at {Math.round(state.derived.offlineRate * 100)}% of your passive rate. Increase the rate with the Night Shift upgrade.
          </p>
          <button type="button" className="btn btn-gold btn-block" onClick={() => setOffline(0)}>Collect</button>
        </div>
      </Modal>

      <div className="fixed bottom-20 left-3 z-30 hidden items-center gap-2 rounded-lg border border-[var(--line)] bg-[rgba(12,10,16,0.9)] px-2 py-1 text-[10px] text-[var(--dim)] sm:flex lg:bottom-3">
        <Sparkles size={11} className="text-[var(--gold)]" /> Playtime {formatDuration(state.player.playtimeSeconds)} · config v{state.configVersion}
      </div>
    </div>
  );
}
