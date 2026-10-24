"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  CalendarClock,
  Coins,
  Database,
  Download,
  Egg,
  Gauge,
  History,
  KeyRound,
  Loader2,
  LogOut,
  PawPrint,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Terminal,
  Ticket,
  Users,
  X,
} from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AdminSnapshot } from "@/server/admin-service";
import { EGGS, PETS, ROLE_LABELS, RARITIES, type AdminRole } from "@/lib/content";
import { formatDuration, formatNumber } from "@/lib/economy";
import { Modal } from "@/components/ui/Modal";
import { AdminEconomy, AdminEvents, AdminCodes, AdminConfig, AdminConsole, AdminContent } from "./AdminSections";

export type AdminSectionId = "overview" | "players" | "economy" | "events" | "content" | "codes" | "moderation" | "audit" | "config" | "console";

export interface RunAdmin {
  (action: string, payload?: Record<string, unknown>, reason?: string): Promise<boolean>;
}

const SECTIONS: { id: AdminSectionId; label: string; icon: typeof Activity; permission?: string }[] = [
  { id: "overview", label: "Overview", icon: Gauge },
  { id: "players", label: "Players", icon: Users, permission: "players.read" },
  { id: "economy", label: "Economy", icon: SlidersHorizontal, permission: "economy.write" },
  { id: "events", label: "Live events", icon: CalendarClock, permission: "events.write" },
  { id: "content", label: "Pets & eggs", icon: Egg, permission: "content.write" },
  { id: "codes", label: "Codes", icon: Ticket, permission: "codes.write" },
  { id: "moderation", label: "Moderation", icon: ShieldAlert, permission: "moderation.write" },
  { id: "audit", label: "Audit log", icon: History, permission: "audit.read" },
  { id: "config", label: "Configuration", icon: Settings, permission: "config.write" },
  { id: "console", label: "Console", icon: Terminal },
];

const CURRENCIES = ["coins", "clicks", "gems", "embers", "sigils", "echoes"];
const STATS = ["totalClicks", "totalCoinsEarned", "seasonPoints", "bestCombo", "playtimeSeconds", "achievementPoints", "rebirths", "prestiges", "level"];
const AMOUNT_PRESETS = [
  { label: "+100", value: 100 },
  { label: "+10,000", value: 10000 },
  { label: "+1,000,000", value: 1000000 },
  { label: "+1,000,000,000", value: 1000000000 },
  { label: "+1,000,000,000,000", value: 1000000000000 },
  { label: "+100000000000000000 (+100Qa)", value: 100000000000000000 },
];

type Player = { id: string; username: string };
type Detail = {
  player: {
    id: string; username: string; email: string; role: string; coins: number; gems: number; embers: number; sigils: number; echoes: number;
    totalClicks: number; totalCoinsEarned: number; rebirths: number; prestiges: number; ascensions: number; level: number; currentWorld: string;
    createdAt: string; lastSeenAt: string; isBanned: boolean; bannedUntil: string | null; banReason: string | null;
  };
  upgrades: { id: string; level: number }[];
  pets: { id: string; petId: string; rarity: string; golden: boolean; shiny: boolean; equipped: boolean }[];
  achievements: number;
  purchases: { id: string; itemId: string; price: number; currency: string }[];
  cases: { id: string; caseNumber: number; type: string; reason: string; createdAt: string }[];
  audit: { id: string; adminName: string; action: string; createdAt: string; reason: string }[];
  quests: { id: string; progress: number; claimed: boolean }[];
  sessions: { id: string; lastSeenAt: string; expiresAt: string }[];
};

interface PendingAction {
  action: string;
  payload: Record<string, unknown>;
  title: string;
  description: string;
  needsReason: boolean;
  fields?: { key: string; label: string; type: "number" | "text" | "select" | "textarea"; options?: { value: string; label: string }[]; value?: string | number; placeholder?: string }[];
}

export function AdminClient({ initialSnapshot }: { initialSnapshot: AdminSnapshot }) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<AdminSnapshot>(initialSnapshot);
  const [section, setSection] = useState<AdminSectionId>("overview");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [auditAction, setAuditAction] = useState("");
  const [loading, setLoading] = useState(false);
  const [flash, setFlash] = useState<{ tone: "ok" | "error"; message: string } | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [pendingFields, setPendingFields] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState<string | null>(null);

  const permissions = snapshot.permissions;
  const allowed = useCallback(
    (permission?: string) => !permission || permissions.includes("*") || permissions.includes(permission),
    [permissions],
  );

  const showFlash = (tone: "ok" | "error", message: string) => {
    setFlash({ tone, message });
    window.setTimeout(() => setFlash(null), 6000);
  };

  const refresh = useCallback(
    async (overrides?: { q?: string; page?: number; auditAction?: string }) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        const query = overrides?.q ?? q;
        const pageValue = overrides?.page ?? page;
        const action = overrides?.auditAction ?? auditAction;
        if (query) params.set("q", query);
        if (pageValue) params.set("page", String(pageValue));
        if (action) params.set("auditAction", action);
        const response = await fetch(`/api/admin/data?${params.toString()}`);
        const data = (await response.json()) as { snapshot?: AdminSnapshot; error?: string };
        if (!response.ok || !data.snapshot) throw new Error(data.error ?? "Snapshot failed");
        setSnapshot(data.snapshot);
      } catch (error) {
        showFlash("error", error instanceof Error ? error.message : "Could not refresh data.");
      } finally {
        setLoading(false);
      }
    },
    [q, page, auditAction],
  );

  const run = useCallback<RunAdmin>(
    async (action, payload = {}, reasonText = "") => {
      setSubmitting(true);
      try {
        const response = await fetch("/api/admin/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, payload, reason: reasonText }),
        });
        const data = (await response.json()) as { ok?: boolean; message?: string; error?: string; snapshot?: AdminSnapshot };
        if (!response.ok || !data.ok) throw new Error(data.error ?? "Operation failed.");
        if (data.snapshot) setSnapshot(data.snapshot);
        showFlash("ok", data.message ?? "Operation applied.");
        return true;
      } catch (error) {
        showFlash("error", error instanceof Error ? error.message : "Operation failed.");
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [],
  );

  const openAction = (config: PendingAction) => {
    setPending(config);
    setReason("");
    setPendingFields(Object.fromEntries((config.fields ?? []).map((field) => [field.key, String(field.value ?? "")])));
  };

  const submitPending = async () => {
    if (!pending) return;
    if (pending.needsReason && reason.trim().length < 3) {
      showFlash("error", "A reason of at least 3 characters is required.");
      return;
    }
    const payload: Record<string, unknown> = { ...pending.payload };
    for (const [key, value] of Object.entries(pendingFields)) {
      payload[key] = key === "amount" || key === "value" || key === "hours" || key === "rowIndex" ? Number(value) : value;
    }
    const ok = await run(pending.action, payload, reason);
    if (ok) {
      setPending(null);
      setDetail(null);
    }
  };

  const inspect = async (playerId: string) => {
    setDetailLoading(playerId);
    try {
      const response = await fetch(`/api/admin/data?playerId=${playerId}`);
      const data = (await response.json()) as { detail?: Detail; error?: string };
      if (!response.ok || !data.detail) throw new Error(data.error ?? "Player lookup failed.");
      setDetail(data.detail);
    } catch (error) {
      showFlash("error", error instanceof Error ? error.message : "Player lookup failed.");
    } finally {
      setDetailLoading(null);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (q || page > 1 || auditAction) void refresh();
    }, 350);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, page, auditAction]);

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  const playerAction = (player: Player, kind: "grant" | "take" | "ban" | "unban" | "setRole" | "reset" | "warn" | "givePet" | "resetSubsystem" | "revoke") => {
    if (kind === "unban") {
      void run("unban", { playerId: player.id }, "Manual unban from control surface");
      return;
    }
    if (kind === "revoke") {
      void run("session.revoke", { playerId: player.id }, "Session revoke from player list");
      return;
    }
    if (kind === "reset") {
      openAction({ action: "resetProgression", payload: { playerId: player.id }, title: `Reset all progression for ${player.username}?`, description: "Currency, upgrades, world progress and rebirth chain are reset. Companions and achievements are preserved. This cannot be undone.", needsReason: true });
      return;
    }
    if (kind === "resetSubsystem") {
      openAction({ action: "resetSubsystem", payload: { playerId: player.id }, title: `Reset a subsystem for ${player.username}`, description: "Choose exactly one subsystem to clear. The audit log records the change.", needsReason: true, fields: [{ key: "subsystem", label: "Subsystem", type: "select", options: ["upgrades", "quests", "achievements", "pets"].map((v) => ({ value: v, label: v })) }] });
      return;
    }
    if (kind === "setRole") {
      openAction({ action: "setRole", payload: { playerId: player.id }, title: `Change admin role for ${player.username}`, description: "Only the owner can change roles. Permissions are enforced server-side on every request.", needsReason: true, fields: [{ key: "role", label: "Role", type: "select", options: ["player", "support", "moderator", "admin", "super_admin"].map((r) => ({ value: r, label: ROLE_LABELS[r as AdminRole] })) }] });
      return;
    }
    if (kind === "warn") {
      openAction({ action: "warn", payload: { playerId: player.id }, title: `Open a warning case for ${player.username}`, description: "Warnings are moderation cases, distinct from economic changes.", needsReason: true });
      return;
    }
    if (kind === "givePet") {
      openAction({ action: "givePet", payload: { playerId: player.id }, title: `Grant a companion to ${player.username}`, description: "Select a published pet definition. The grant is audited.", needsReason: true, fields: [{ key: "petId", label: "Companion", type: "select", options: PETS.map((p) => ({ value: p.id, label: `${p.name} · ${p.rarity}` })) }] });
      return;
    }
    if (kind === "ban") {
      openAction({ action: "ban", payload: { playerId: player.id }, title: `Ban ${player.username}`, description: "All sessions are revoked immediately. Hours = 0 means permanent.", needsReason: true, fields: [{ key: "hours", label: "Duration (hours, 0 = permanent)", type: "number", value: 24 }] });
      return;
    }
    openAction({
      action: kind,
      payload: { playerId: player.id },
      title: `${kind === "grant" ? "Grant" : "Remove"} currency — ${player.username}`,
      description: "The backend clamps the balance to a safe range and records before/after values in the audit trail.",
      needsReason: true,
      fields: [
        { key: "currency", label: "Currency", type: "select", options: CURRENCIES.map((c) => ({ value: c, label: c })) },
        { key: "amount", label: "Amount", type: "number", value: 1000 },
      ],
    });
  };

  const stats = snapshot.overview;
  const kpis = [
    { label: "Registered accounts", value: formatNumber(stats.players), hint: `${stats.newToday} today · ${stats.new7d} this week`, icon: Users },
    { label: "Active sessions (24h)", value: formatNumber(stats.activeSessions), hint: "sessions seen in 24h", icon: Activity },
    { label: "Total strikes", value: formatNumber(stats.totalClicks), hint: "all validated clicks", icon: BarChart3 },
    { label: "Sparks earned", value: formatNumber(stats.totalEarned), hint: `avg ${formatNumber(stats.averageEarned)}`, icon: Coins },
    { label: "Rebirths", value: formatNumber(stats.totalRebirths), hint: "completed resets", icon: RefreshCw },
    { label: "Active events", value: String(stats.activeEvents), hint: "server status = active", icon: CalendarClock },
    { label: "Codes redeemed", value: formatNumber(stats.codesRedeemed), hint: "atomic redemptions", icon: Ticket },
    { label: "Players with companions", value: formatNumber(stats.playersWithPets), hint: `${formatNumber(stats.gemsCirculation)} prisms held`, icon: PawPrint },
  ];

  const chartData = useMemo(() => {
    const map = new Map(snapshot.signups.map((row) => [row.date, row.count]));
    const days: { date: string; signups: number }[] = [];
    for (let i = 13; i >= 0; i -= 1) {
      const date = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      days.push({ date: date.slice(5), signups: map.get(date) ?? 0 });
    }
    return days;
  }, [snapshot.signups]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[rgba(8,7,12,0.9)] glass-blur">
        <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center gap-3 px-3 py-2.5 sm:px-5">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-[rgba(89,211,165,0.4)] bg-[rgba(89,211,165,0.1)]">
              <ShieldCheck size={15} className="text-[var(--jade)]" />
            </span>
            <span className="leading-tight">
              <span className="block font-[var(--serif)] text-[14px] tracking-[0.16em]">OBSIDIA OPS</span>
              <span className="block text-[8px] uppercase tracking-[0.26em] text-[var(--dim)]">Operations console</span>
            </span>
          </Link>
          <span className="chip chip-jade">{ROLE_LABELS[snapshot.role] ?? snapshot.role} · {permissions.includes("*") ? "all permissions" : `${permissions.length} permissions`}</span>
          <span className="chip"><Database size={10} /> DB {stats.dbLatencyMs}ms</span>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <button type="button" className="btn btn-xs" onClick={() => refresh()} disabled={loading}>
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
            <Link href="/play" className="btn btn-xs"><ArrowLeft size={12} /> Player view</Link>
            <button type="button" className="btn btn-xs btn-ghost" onClick={signOut}><LogOut size={12} /> Sign out</button>
          </div>
        </div>
        <nav className="mx-auto flex w-full max-w-[1600px] gap-1 overflow-x-auto px-3 pb-2 sm:px-5 hidden-scroll" aria-label="Admin modules">
          {SECTIONS.map((item) => {
            const licensed = allowed(item.permission);
            return (
              <button
                key={item.id}
                type="button"
                className="tab"
                aria-selected={section === item.id}
                disabled={!licensed}
                title={licensed ? item.label : "Your role cannot access this module"}
                onClick={() => setSection(item.id)}
                style={!licensed ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
              >
                <item.icon size={11} className="mr-1 inline" /> {item.label}
              </button>
            );
          })}
        </nav>
      </header>

      {flash ? (
        <div className={`mx-auto mt-2 flex w-full max-w-[1600px] items-start gap-2 rounded-lg border px-3 py-2 text-[12px] ${flash.tone === "ok" ? "border-[rgba(89,211,165,0.4)] bg-[rgba(89,211,165,0.08)] text-[#bff4dd]" : "border-[rgba(240,112,95,0.4)] bg-[rgba(240,112,95,0.08)] text-[#ffbcb0]"}`} role="status">
          {flash.tone === "ok" ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
          <span className="flex-1">{flash.message}</span>
          <button type="button" className="btn btn-ghost btn-xs" onClick={() => setFlash(null)} aria-label="Dismiss"><X size={12} /></button>
        </div>
      ) : null}

      <main className="mx-auto w-full max-w-[1600px] px-3 py-3 sm:px-5">
        {section === "overview" ? (
          <div className="space-y-3">
            <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
              {kpis.map((kpi) => (
                <div key={kpi.label} className="panel p-3.5">
                  <div className="flex items-start justify-between">
                    <p className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-[var(--dim)]">{kpi.label}</p>
                    <kpi.icon size={14} className="text-[var(--jade)]" />
                  </div>
                  <p className="numeric mt-1.5 text-2xl text-[#fdf3e3]">{kpi.value}</p>
                  <p className="mt-0.5 text-[10.5px] text-[var(--muted)]">{kpi.hint}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-3 xl:grid-cols-[1.5fr_1fr]">
              <div className="panel p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="eyebrow">Acquisition</p>
                    <h2 className="text-lg">Registrations · last 14 days</h2>
                  </div>
                  <span className="chip">source: users.created_at</span>
                </div>
                <div className="mt-3 h-[210px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 4, right: 6, left: -22, bottom: 0 }}>
                      <defs>
                        <linearGradient id="signupGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#e9b662" stopOpacity={0.55} />
                          <stop offset="100%" stopColor="#e9b662" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(240,228,206,0.07)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: "#8c8276", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#8c8276", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: "#141119", border: "1px solid rgba(240,228,206,0.18)", borderRadius: 10, fontSize: 11 }} labelStyle={{ color: "#c9bda9" }} />
                      <Area type="monotone" dataKey="signups" stroke="#e9b662" strokeWidth={2} fill="url(#signupGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="panel p-4">
                <p className="eyebrow">Economy distribution</p>
                <h2 className="text-lg">Players by lifetime sparks</h2>
                <div className="mt-3 h-[210px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={snapshot.economyBuckets} margin={{ top: 4, right: 6, left: -22, bottom: 0 }}>
                      <CartesianGrid stroke="rgba(240,228,206,0.07)" vertical={false} />
                      <XAxis dataKey="bucket" tick={{ fill: "#8c8276", fontSize: 9.5 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#8c8276", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: "#141119", border: "1px solid rgba(240,228,206,0.18)", borderRadius: 10, fontSize: 11 }} />
                      <Bar dataKey="players" radius={[4, 4, 0, 0]}>
                        {snapshot.economyBuckets.map((_, index) => (
                          <Cell key={index} fill={["#6b6257", "#8f6a3a", "#e9b662", "#59d3a5", "#62b6f5", "#c78cf7"][index % 6]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="grid gap-3 xl:grid-cols-3">
              <div className="panel p-4">
                <p className="eyebrow">Health</p>
                <h2 className="text-lg">Service status</h2>
                <div className="mt-2 space-y-1.5 text-[12px]">
                  <Row label="PostgreSQL" value={`${stats.dbLatencyMs}ms`} good />
                  <Row label="Migrations applied" value={String(stats.migrations)} good />
                  <Row label="Process uptime" value={formatDuration(stats.uptimeSeconds)} good />
                  <Row label="Config version" value={`v${snapshot.config.version}`} good />
                  <Row label="Retention (7d active)" value={formatNumber(stats.retention)} good />
                  <Row label="Maintenance mode" value={snapshot.config.live.maintenanceMode ? "ENABLED" : "off"} good={!snapshot.config.live.maintenanceMode} />
                </div>
                <p className="mt-2 text-[10px] text-[var(--dim)]">Snapshot {new Date(stats.generatedAt).toLocaleString()} · values are queried from the live database.</p>
              </div>
              <div className="panel p-4">
                <p className="eyebrow">Live events</p>
                <h2 className="text-lg">Running now</h2>
                <div className="mt-2 space-y-2">
                  {snapshot.activeEventList.map((event) => (
                    <div key={event.id} className="rounded-lg border border-[rgba(233,182,98,0.3)] bg-[rgba(233,182,98,0.06)] px-3 py-2">
                      <p className="text-[12px] font-medium">{event.title}</p>
                      <p className="text-[10.5px] text-[var(--muted)]">×{event.multiplier} · {event.participation} participants · ends {new Date(event.endsAt).toLocaleString()}</p>
                    </div>
                  ))}
                  {!snapshot.activeEventList.length ? <p className="text-[12px] text-[var(--muted)]">No events are active. Open the Live events module to schedule or start one.</p> : null}
                </div>
                <button type="button" className="btn btn-xs mt-3" onClick={() => setSection("events")}>Manage events</button>
              </div>
              <div className="panel p-4">
                <p className="eyebrow">Top earners</p>
                <h2 className="text-lg">Leaderboard sample</h2>
                <div className="mt-2 space-y-1.5">
                  {snapshot.topPlayers.map((player, index) => (
                    <div key={player.id} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--line)] px-2.5 py-1.5">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="numeric text-[10px] text-[var(--dim)]">#{index + 1}</span>
                        <span className="truncate text-[12px]">{player.username}</span>
                      </span>
                      <span className="numeric flex-shrink-0 text-[11px] text-[var(--gold)]">{formatNumber(player.totalCoinsEarned)}</span>
                    </div>
                  ))}
                  {!snapshot.topPlayers.length ? <p className="text-[12px] text-[var(--muted)]">No players yet.</p> : null}
                </div>
              </div>
            </div>

            <div className="panel p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="eyebrow">Immutable trail</p>
                  <h2 className="text-lg">Recent administrative operations</h2>
                </div>
                <div className="flex gap-1.5">
                  <button type="button" className="btn btn-xs" onClick={() => setSection("audit")}>Open audit explorer</button>
                  <a className="btn btn-xs" href="/api/admin/audit-export" download><Download size={11} /> Export CSV</a>
                </div>
              </div>
              <AuditTable rows={snapshot.recentAudit} compact />
            </div>

            <div className="panel p-4">
              <p className="eyebrow">Broadcasts</p>
              <h2 className="text-lg">Announcements</h2>
              <AnnouncementForm run={run} submitting={submitting} announcements={snapshot.announcements} />
            </div>
          </div>
        ) : null}

        {section === "players" ? (
          <div className="space-y-3">
            <div className="panel p-4">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="eyebrow">Directory</p>
                  <h2 className="text-lg">Players</h2>
                  <p className="text-[11px] text-[var(--muted)]">Search matches callsign, email or player UUID. Actions apply immediately and are audited.</p>
                </div>
                <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto">
                  <div className="relative min-w-[200px] flex-1">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--dim)]" />
                    <input className="field field-sm pl-8" value={q} onChange={(event) => { setQ(event.target.value); setPage(1); }} placeholder="username, email or UUID" aria-label="Search players" />
                  </div>
                  <button type="button" className="btn btn-xs" onClick={() => { setQ(""); setPage(1); void refresh({ q: "", page: 1 }); }}>Clear</button>
                </div>
              </div>
              <div className="table-wrap mt-3 rounded-lg border border-[var(--line)]">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Player</th><th>Coins</th><th>Gems</th><th>Rebirths</th><th>Pets</th><th>Status</th><th className="hidden lg:table-cell">Last seen</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(allowed("players.read") ? snapshot.playerRows : []).map((player) => (
                      <tr key={player.id}>
                        <td>
                          <button type="button" className="text-left" onClick={() => inspect(player.id)}>
                            <span className="block text-[12px] font-medium text-[var(--text)] hover:text-[var(--gold)]">{player.username}</span>
                            <span className="block text-[10px] text-[var(--dim)]">{player.email}</span>
                          </button>
                        </td>
                        <td className="numeric">{formatNumber(player.coins)}</td>
                        <td className="numeric">{formatNumber(player.gems)}</td>
                        <td className="numeric">{player.rebirths}</td>
                        <td className="numeric">{player.pets}</td>
                        <td>
                          {player.isBanned ? <span className="chip chip-danger">Banned</span> : <span className="chip chip-jade">Active</span>}
                          <span className="mt-1 block text-[9.5px] uppercase tracking-wide text-[var(--dim)]">{player.role}</span>
                        </td>
                        <td className="hidden text-[10.5px] text-[var(--dim)] lg:table-cell">{new Date(player.lastSeenAt).toLocaleString()}</td>
                        <td>
                          <div className="flex flex-wrap gap-1">
                            <button type="button" className="btn btn-xs" onClick={() => inspect(player.id)} disabled={detailLoading === player.id}>
                              {detailLoading === player.id ? <Loader2 size={10} className="animate-spin" /> : null} Inspect
                            </button>
                            {allowed("players.economy") ? (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-xs btn-gold"
                                  title="Instantly grant +100000000000000000 sparks with zero reload"
                                  onClick={() => run("quickGrant", { playerId: player.id, currency: "coins", amount: 100000000000000000 }, "⚡ Instant +100000000000000000 sparks")}
                                >
                                  ⚡ +100000000000000000
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-xs"
                                  title="Instantly grant +100 clicks with zero reload"
                                  onClick={() => run("quickGrant", { playerId: player.id, currency: "clicks", amount: 100 }, "⚡ Instant +100 clicks")}
                                >
                                  +100 clicks
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-xs"
                                  title="Instantly grant +100000000000000000 clicks with zero reload"
                                  onClick={() => run("quickGrant", { playerId: player.id, currency: "clicks", amount: 100000000000000000 }, "⚡ Instant +100000000000000000 clicks")}
                                >
                                  +100Qa clicks
                                </button>
                                <button type="button" className="btn btn-xs" onClick={() => playerAction(player, "grant")}>Custom</button>
                                <button type="button" className="btn btn-xs" onClick={() => playerAction(player, "take")}>Take</button>
                              </>
                            ) : null}
                            {allowed("players.ban") ? (
                              player.isBanned ? (
                                <button type="button" className="btn btn-xs btn-jade" onClick={() => playerAction(player, "unban")}>Unban</button>
                              ) : (
                                <button type="button" className="btn btn-xs btn-danger" onClick={() => playerAction(player, "ban")}>Ban</button>
                              )
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!snapshot.playerRows.length ? (
                      <tr><td colSpan={8} className="py-6 text-center text-[12px] text-[var(--muted)]">No players match this filter.</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--dim)]">
                <span>{snapshot.playerTotal} account(s) · page {page}</span>
                <div className="flex gap-1.5">
                  <button type="button" className="btn btn-xs" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</button>
                  <button type="button" className="btn btn-xs" disabled={page * 10 >= snapshot.playerTotal} onClick={() => setPage((p) => p + 1)}>Next</button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {section === "economy" && allowed("economy.write") ? (
          <AdminEconomy snapshot={snapshot} run={run} submitting={submitting} />
        ) : null}
        {section === "events" && allowed("events.write") ? (
          <AdminEvents snapshot={snapshot} run={run} submitting={submitting} />
        ) : null}
        {section === "content" && allowed("content.write") ? (
          <AdminContent snapshot={snapshot} run={run} submitting={submitting} />
        ) : null}
        {section === "codes" && allowed("codes.write") ? (
          <AdminCodes snapshot={snapshot} run={run} submitting={submitting} />
        ) : null}
        {section === "config" && allowed("config.write") ? (
          <AdminConfig snapshot={snapshot} run={run} submitting={submitting} />
        ) : null}
        {section === "console" ? (
          <AdminConsole snapshot={snapshot} onSnapshot={setSnapshot} />
        ) : null}

        {section === "moderation" && allowed("moderation.write") ? (
          <div className="space-y-3">
            <div className="panel p-4">
              <p className="eyebrow">Moderation centre</p>
              <h2 className="text-lg">Cases</h2>
              <p className="text-[11px] text-[var(--muted)]">Bans, warnings and unbans are recorded as numbered cases, separate from economic adjustments.</p>
              <div className="table-wrap mt-3 rounded-lg border border-[var(--line)]">
                <table className="data">
                  <thead><tr><th>Case</th><th>Player</th><th>Type</th><th>Reason</th><th>Opened</th><th>Expires</th></tr></thead>
                  <tbody>
                    {snapshot.moderation.map((entry) => (
                      <tr key={entry.id}>
                        <td className="numeric">#{entry.caseNumber}</td>
                        <td>{entry.username ?? entry.playerId?.slice(0, 8) ?? "—"}</td>
                        <td><span className={`chip ${entry.type.includes("ban") ? "chip-danger" : entry.type === "warning" ? "chip-gold" : "chip-jade"}`}>{entry.type.replace(/_/g, " ")}</span></td>
                        <td className="max-w-[280px] text-[11px] text-[var(--muted)]">{entry.reason}</td>
                        <td className="text-[10.5px] text-[var(--dim)]">{new Date(entry.createdAt).toLocaleString()}</td>
                        <td className="text-[10.5px] text-[var(--dim)]">{entry.expiresAt ? new Date(entry.expiresAt).toLocaleString() : "—"}</td>
                      </tr>
                    ))}
                    {!snapshot.moderation.length ? <tr><td colSpan={6} className="py-6 text-center text-[12px] text-[var(--muted)]">No moderation cases yet.</td></tr> : null}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="panel p-4">
              <p className="eyebrow">Quick case</p>
              <h2 className="text-lg">Players at a glance</h2>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {snapshot.playerRows.slice(0, 9).map((player) => (
                  <div key={player.id} className="rounded-lg border border-[var(--line)] p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[12px]">{player.username}</span>
                      {player.isBanned ? <span className="chip chip-danger">banned</span> : null}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      <button type="button" className="btn btn-xs" onClick={() => playerAction(player, "warn")}>Warn</button>
                      <button type="button" className="btn btn-xs btn-danger" onClick={() => playerAction(player, "ban")}>Ban</button>
                      <button type="button" className="btn btn-xs btn-jade" onClick={() => playerAction(player, "unban")}>Unban</button>
                      <button type="button" className="btn btn-xs" onClick={() => playerAction(player, "revoke")}>Revoke sessions</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {section === "audit" && allowed("audit.read") ? (
          <div className="panel p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="eyebrow">Append-only history</p>
                <h2 className="text-lg">Audit log explorer</h2>
                <p className="text-[11px] text-[var(--muted)]">{snapshot.auditTotal} entries. Administrators cannot edit or delete this history from the dashboard.</p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <select className="field field-sm w-auto" value={auditAction} onChange={(event) => setAuditAction(event.target.value)} aria-label="Filter by action">
                  <option value="">All actions</option>
                  {Array.from(new Set(snapshot.auditRows.map((row) => row.action))).map((action) => <option key={action} value={action}>{action}</option>)}
                </select>
                <a className="btn btn-xs" href="/api/admin/audit-export" download><Download size={11} /> Export CSV</a>
              </div>
            </div>
            <AuditTable rows={snapshot.auditRows} />
          </div>
        ) : null}

        {!allowed(SECTIONS.find((s) => s.id === section)?.permission) && !["overview", "console"].includes(section) ? (
          <div className="panel p-6 text-center">
            <p className="text-[13px] text-[var(--muted)]">Your role does not grant access to this module. The server would reject the request even if the UI were forced.</p>
          </div>
        ) : null}
      </main>

      <Modal
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        title={pending?.title ?? "Confirm"}
        subtitle="Backend validation, row locking and audit logging run on every operation."
        footer={
          <>
            <button type="button" className="btn btn-sm" onClick={() => setPending(null)} disabled={submitting}>Cancel</button>
            <button type="button" className="btn btn-sm btn-gold" onClick={submitPending} disabled={submitting}>
              {submitting ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />} Apply & audit
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-[12px] leading-relaxed text-[var(--muted)]">{pending?.description}</p>
          {(pending?.fields ?? []).map((field) => (
            <div key={field.key}>
              <label className="label" htmlFor={`field-${field.key}`}>{field.label}</label>
              {field.type === "select" ? (
                <select id={`field-${field.key}`} className="field mt-1" value={pendingFields[field.key] ?? ""} onChange={(event) => setPendingFields((current) => ({ ...current, [field.key]: event.target.value }))}>
                  <option value="">Select…</option>
                  {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              ) : (
                <>
                  <input
                    id={`field-${field.key}`}
                    className="field mt-1"
                    type={field.type}
                    value={pendingFields[field.key] ?? ""}
                    placeholder={field.placeholder}
                    onChange={(event) => setPendingFields((current) => ({ ...current, [field.key]: event.target.value }))}
                  />
                  {field.key === "amount" ? (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {AMOUNT_PRESETS.map((p) => (
                        <button
                          key={p.value}
                          type="button"
                          className="chip chip-gold text-[10px]"
                          onClick={() => setPendingFields((prev) => ({ ...prev, amount: String(p.value) }))}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ))}
          <div>
            <label className="label" htmlFor="action-reason">Reason {pending?.needsReason ? "(required, min 3 chars)" : "(optional)"}</label>
            <textarea id="action-reason" className="field mt-1" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain the operation for the audit trail" maxLength={500} />
          </div>
          <p className="rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-[10.5px] text-[var(--dim)]">
            Recorded fields: administrator id, action, target, reason, before/after values, request id and result. The operation will surface here immediately on success — no page reload.
          </p>
        </div>
      </Modal>

      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title={detail?.player.username ?? "Player"} subtitle={detail?.player.email} size="lg" footer={
        detail ? (
          <div className="flex flex-wrap gap-1.5">
            {allowed("players.economy") ? <button type="button" className="btn btn-xs btn-gold" onClick={() => playerAction(detail.player, "grant")}>Grant currency</button> : null}
            {allowed("players.items") ? <button type="button" className="btn btn-xs" onClick={() => playerAction(detail.player, "givePet")}>Grant companion</button> : null}
            {allowed("players.reset") ? <button type="button" className="btn btn-xs btn-danger" onClick={() => playerAction(detail.player, "reset")}>Reset progression</button> : null}
          </div>
        ) : null
      }>
        {detail ? (
          <div className="space-y-3">
            <div className="panel-gold panel p-3">
              <div className="flex items-center justify-between">
                <p className="eyebrow text-[var(--gold-bright)]">⚡ Instant Overload Actions (Zero Reload)</p>
                <span className="chip chip-gold">Instant database write</span>
              </div>
              <p className="mt-1 text-[11px] text-[var(--muted)]">
                Click any button to grant immediately to {detail.player.username}. Updates state and database live with zero reload:
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  className="btn btn-xs btn-gold"
                  onClick={async () => {
                    const ok = await run("quickGrant", { playerId: detail.player.id, currency: "coins", amount: 100000000000000000 }, "⚡ Instant +100000000000000000 sparks");
                    if (ok) setDetail((prev) => prev ? { ...prev, player: { ...prev.player, coins: Math.min(1e18, prev.player.coins + 100000000000000000), totalCoinsEarned: Math.min(1e18, prev.player.totalCoinsEarned + 100000000000000000) } } : null);
                  }}
                >
                  ⚡ +100000000000000000 Sparks (+100Qa)
                </button>
                <button
                  type="button"
                  className="btn btn-xs btn-gold"
                  onClick={async () => {
                    const ok = await run("quickGrant", { playerId: detail.player.id, currency: "clicks", amount: 100000000000000000 }, "⚡ Instant +100000000000000000 clicks");
                    if (ok) setDetail((prev) => prev ? { ...prev, player: { ...prev.player, totalClicks: Math.min(1e18, prev.player.totalClicks + 100000000000000000) } } : null);
                  }}
                >
                  ⚡ +100000000000000000 Clicks (+100Qa)
                </button>
                <button
                  type="button"
                  className="btn btn-xs"
                  onClick={async () => {
                    const ok = await run("quickGrant", { playerId: detail.player.id, currency: "clicks", amount: 100 }, "⚡ Instant +100 clicks");
                    if (ok) setDetail((prev) => prev ? { ...prev, player: { ...prev.player, totalClicks: prev.player.totalClicks + 100 } } : null);
                  }}
                >
                  +100 Clicks
                </button>
                <button
                  type="button"
                  className="btn btn-xs"
                  onClick={async () => {
                    const ok = await run("quickGrant", { playerId: detail.player.id, currency: "clicks", amount: 10000 }, "⚡ Instant +10,000 clicks");
                    if (ok) setDetail((prev) => prev ? { ...prev, player: { ...prev.player, totalClicks: prev.player.totalClicks + 10000 } } : null);
                  }}
                >
                  +10,000 Clicks
                </button>
                <button
                  type="button"
                  className="btn btn-xs"
                  onClick={async () => {
                    const ok = await run("quickGrant", { playerId: detail.player.id, currency: "gems", amount: 1000 }, "⚡ Instant +1,000 gems");
                    if (ok) setDetail((prev) => prev ? { ...prev, player: { ...prev.player, gems: prev.player.gems + 1000 } } : null);
                  }}
                >
                  +1,000 Prisms
                </button>
                <button
                  type="button"
                  className="btn btn-xs"
                  onClick={async () => {
                    const ok = await run("quickGrant", { playerId: detail.player.id, currency: "embers", amount: 100 }, "⚡ Instant +100 embers");
                    if (ok) setDetail((prev) => prev ? { ...prev, player: { ...prev.player, embers: prev.player.embers + 100 } } : null);
                  }}
                >
                  +100 Embers
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MiniStat label="Sparks" value={formatNumber(detail.player.coins)} />
              <MiniStat label="Prisms" value={formatNumber(detail.player.gems)} />
              <MiniStat label="Embers" value={formatNumber(detail.player.embers)} />
              <MiniStat label="Sigils / Echoes" value={`${formatNumber(detail.player.sigils)} / ${formatNumber(detail.player.echoes)}`} />
              <MiniStat label="Total clicks" value={formatNumber(detail.player.totalClicks)} />
              <MiniStat label="Lifetime sparks" value={formatNumber(detail.player.totalCoinsEarned)} />
              <MiniStat label="Rebirths / Prestiges" value={`${detail.player.rebirths} / ${detail.player.prestiges}`} />
              <MiniStat label="Level / World" value={`${detail.player.level} · ${detail.player.currentWorld}`} />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="panel-soft p-3">
                <p className="label">Upgrades ({detail.upgrades.length})</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {detail.upgrades.map((upgrade) => <span key={upgrade.id} className="chip">{upgrade.id} · {upgrade.level}</span>)}
                  {!detail.upgrades.length ? <span className="text-[11px] text-[var(--dim)]">No upgrades purchased.</span> : null}
                </div>
              </div>
              <div className="panel-soft p-3">
                <p className="label">Companions ({detail.pets.length})</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {detail.pets.slice(0, 24).map((pet) => (
                    <span key={pet.id} className="chip" style={{ borderColor: `${RARITIES.find((r) => r.id === pet.rarity)?.color ?? "#fff"}44` }}>
                      {PETS.find((p) => p.id === pet.petId)?.name ?? pet.petId}{pet.golden ? " ✦" : ""}{pet.equipped ? " · eq" : ""}
                    </span>
                  ))}
                  {!detail.pets.length ? <span className="text-[11px] text-[var(--dim)]">No companions.</span> : null}
                </div>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="panel-soft p-3">
                <p className="label">Moderation history</p>
                {detail.cases.map((entry) => <p key={entry.id} className="mt-1 text-[11px] text-[var(--muted)]">#{entry.caseNumber} {entry.type.replace(/_/g, " ")} — {entry.reason}</p>)}
                {!detail.cases.length ? <p className="mt-1 text-[11px] text-[var(--dim)]">Clean record.</p> : null}
              </div>
              <div className="panel-soft p-3">
                <p className="label">Recent admin operations</p>
                {detail.audit.map((entry) => <p key={entry.id} className="mt-1 text-[11px] text-[var(--muted)]">{entry.adminName} → {entry.action} <span className="text-[var(--dim)]">{new Date(entry.createdAt).toLocaleString()}</span></p>)}
                {!detail.audit.length ? <p className="mt-1 text-[11px] text-[var(--dim)]">No operations recorded.</p> : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {allowed("players.ban") ? <button type="button" className="btn btn-xs btn-danger" onClick={() => playerAction(detail.player, "ban")}>Ban player</button> : null}
              {allowed("players.ban") ? <button type="button" className="btn btn-xs" onClick={() => playerAction(detail.player, "unban")}>Unban</button> : null}
              {allowed("players.reset") ? <button type="button" className="btn btn-xs" onClick={() => playerAction(detail.player, "resetSubsystem")}>Reset subsystem</button> : null}
              {snapshot.role === "owner" ? <button type="button" className="btn btn-xs" onClick={() => playerAction(detail.player, "setRole")}>Change role</button> : null}
            </div>
            <p className="text-[10px] text-[var(--dim)]">Player created {new Date(detail.player.createdAt).toLocaleString()} · last seen {new Date(detail.player.lastSeenAt).toLocaleString()} · {detail.achievements} achievements · {detail.sessions.length} sessions</p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function Row({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] pb-1 last:border-0">
      <span className="text-[11px] text-[var(--muted)]">{label}</span>
      <span className={`numeric text-[11px] ${good ? "text-[#bff4dd]" : "text-[#ffbcb0]"}`}>{value}</span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--line)] px-2 py-1.5">
      <p className="text-[9px] uppercase tracking-[0.12em] text-[var(--dim)]">{label}</p>
      <p className="numeric mt-0.5 truncate text-[12px]">{value}</p>
    </div>
  );
}

function AuditTable({ rows, compact }: { rows: AdminSnapshot["auditRows"]; compact?: boolean }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <div className="table-wrap mt-3 rounded-lg border border-[var(--line)]">
      <table className="data">
        <thead>
          <tr><th>Time</th><th>Administrator</th><th>Action</th><th>Target</th><th>Reason</th><th>Result</th></tr>
        </thead>
        <tbody>
          {(compact ? rows.slice(0, 8) : rows).map((row) => (
            <>
              <tr key={row.id}>
                <td className="text-[10.5px] text-[var(--dim)]">{new Date(row.createdAt).toLocaleString()}</td>
                <td className="text-[11.5px]">{row.adminName}</td>
                <td><span className="chip">{row.action}</span></td>
                <td className="text-[10.5px] text-[var(--muted)]">{row.targetType}{row.targetId ? ` · ${row.targetId.slice(0, 8)}` : ""}</td>
                <td className="max-w-[240px] truncate text-[11px] text-[var(--muted)]">{row.reason || "—"}</td>
                <td>
                  <button type="button" className={`chip ${row.result === "ok" ? "chip-jade" : "chip-danger"}`} onClick={() => setExpanded(expanded === row.id ? null : row.id)} aria-expanded={expanded === row.id}>
                    {row.result}
                  </button>
                </td>
              </tr>
              {expanded === row.id ? (
                <tr key={`${row.id}-detail`}>
                  <td colSpan={6}>
                    <div className="grid gap-2 rounded-lg border border-[var(--line)] bg-[rgba(8,7,11,0.6)] p-2 sm:grid-cols-2">
                      <div>
                        <p className="label">Before</p>
                        <pre className="mt-1 max-h-32 overflow-auto text-[10px] text-[var(--muted)]">{JSON.stringify(row.before ?? {}, null, 2)}</pre>
                      </div>
                      <div>
                        <p className="label">After</p>
                        <pre className="mt-1 max-h-32 overflow-auto text-[10px] text-[var(--muted)]">{JSON.stringify(row.after ?? {}, null, 2)}</pre>
                      </div>
                      <p className="text-[10px] text-[var(--dim)] sm:col-span-2">Request id <span className="numeric">{row.requestId}</span></p>
                    </div>
                  </td>
                </tr>
              ) : null}
            </>
          ))}
          {!rows.length ? <tr><td colSpan={6} className="py-6 text-center text-[12px] text-[var(--muted)]">No audit entries for this filter.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

function AnnouncementForm({ run, submitting, announcements }: { run: RunAdmin; submitting: boolean; announcements: AdminSnapshot["announcements"] }) {
  const [message, setMessage] = useState("");
  return (
    <div className="mt-2">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={async (event) => {
          event.preventDefault();
          if (message.trim().length < 3) return;
          const ok = await run("announce", { message, tone: "info" });
          if (ok) setMessage("");
        }}
      >
        <input className="field field-sm flex-1" value={message} maxLength={240} onChange={(event) => setMessage(event.target.value)} placeholder="Global announcement shown in the player ticker" aria-label="Announcement message" />
        <button type="submit" className="btn btn-sm btn-gold" disabled={submitting || message.trim().length < 3}>Publish</button>
      </form>
      <div className="mt-2 space-y-1">
        {announcements.map((entry) => (
          <div key={entry.id} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--line)] px-2.5 py-1.5">
            <p className={`min-w-0 flex-1 truncate text-[11.5px] ${entry.active ? "" : "text-[var(--dim)] line-through"}`}>{entry.message}</p>
            <span className="text-[9.5px] text-[var(--dim)]">{new Date(entry.createdAt).toLocaleDateString()}</span>
            {entry.active ? <button type="button" className="btn btn-xs btn-ghost" onClick={() => run("announce.delete", { id: entry.id })}>Retire</button> : <span className="chip">retired</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

export { EGGS, KeyRound };
