"use client";

import { useEffect, useState } from "react";
import { formatMultiplier, formatNumber, percent } from "@/lib/economy";
import { rarityById } from "@/lib/content";
import { SparkMark } from "@/components/ui/art";

export type ActFn = (
  payload: { type: string } & Record<string, unknown>,
  options?: { silent?: boolean },
) => Promise<Record<string, unknown> | null>;

export function Panel({
  title,
  eyebrow,
  description,
  action,
  children,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="panel p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h2 className="mt-1 text-xl sm:text-2xl">{title}</h2>
          {description ? <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-[var(--muted)]">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function StatTile({
  label,
  value,
  hint,
  icon,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  tone?: "default" | "gold" | "jade";
}) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[rgba(255,246,230,0.022)] px-3 py-2.5 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[9.5px] font-semibold uppercase tracking-[0.16em] text-[var(--dim)]">{label}</span>
        <span className={tone === "gold" ? "text-[var(--gold)]" : tone === "jade" ? "text-[var(--jade)]" : "text-[var(--dim)]"}>{icon}</span>
      </div>
      <p className={`numeric mt-1 truncate text-[15px] ${tone === "gold" ? "text-[var(--gold-bright)]" : tone === "jade" ? "text-[#bff4dd]" : "text-[#f4ede1]"}`}>
        {value}
      </p>
      {hint ? <p className="mt-0.5 truncate text-[10px] text-[var(--dim)]">{hint}</p> : null}
    </div>
  );
}

export function Meter({ value, total, tone = "gold", label }: { value: number; total: number; tone?: "gold" | "jade"; label?: string }) {
  const pct = percent(value, total);
  return (
    <div>
      {label ? (
        <div className="mb-1 flex items-center justify-between text-[10.5px] text-[var(--dim)]">
          <span className="truncate">{label}</span>
          <span className="numeric">{pct.toFixed(pct >= 10 ? 0 : 1)}%</span>
        </div>
      ) : null}
      <div className="progress" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label ?? "Progress"}>
        <span style={{ width: `${pct}%`, background: tone === "jade" ? "linear-gradient(90deg,#2f8f72,#59d3a5)" : undefined }} />
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: React.ReactNode; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--line-strong)] px-4 py-10 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-full border border-[var(--line)] bg-[rgba(255,246,230,0.03)] text-[var(--dim)]">{icon}</span>
      <p className="mt-1 text-sm font-medium">{title}</p>
      <p className="max-w-sm text-[11.5px] leading-relaxed text-[var(--muted)]">{body}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function RarityPill({ rarity }: { rarity: string }) {
  const def = rarityById(rarity);
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em]"
      style={{ borderColor: `${def.color}55`, color: def.color, background: def.soft }}
    >
      {def.label}
    </span>
  );
}

export function SparkValue({ value, className = "" }: { value: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <SparkMark size={12} color="var(--gold)" />
      <span className="numeric">{formatNumber(value)}</span>
    </span>
  );
}

export function MultiplierPill({ value, label }: { value: number; label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(233,182,98,0.3)] bg-[rgba(233,182,98,0.1)] px-2 py-0.5 text-[10.5px] text-[var(--gold-bright)]">
      {label ? <span className="text-[var(--dim)]">{label}</span> : null}
      <span className="numeric">{formatMultiplier(value)}</span>
    </span>
  );
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

export function Countdown({ to, prefix = "" }: { to: string; prefix?: string }) {
  const now = useNow();
  const target = new Date(to).getTime();
  const diff = Math.max(0, target - now);
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  const text = days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
  return (
    <span className="numeric">
      {prefix}
      {diff === 0 ? "ready" : text}
    </span>
  );
}
