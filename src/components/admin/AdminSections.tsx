"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, Copy, Loader2, Play, RotateCcw, Save, ShieldCheck, Square, Terminal, Ticket, Wand2 } from "lucide-react";
import type { AdminSnapshot } from "@/server/admin-service";
import { RARITIES } from "@/lib/content";
import { formatNumber } from "@/lib/economy";
import type { RunAdmin } from "./AdminClient";

interface SectionProps {
  snapshot: AdminSnapshot;
  run: RunAdmin;
  submitting: boolean;
}

const toLocalInput = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

const liveNumber = (live: Record<string, unknown>, key: string, fallback = 1) => {
  const value = Number(live[key]);
  return Number.isFinite(value) ? value : fallback;
};

export function AdminEconomy({ snapshot, run, submitting }: SectionProps) {
  const live = snapshot.config.live;
  const [draft, setDraft] = useState({
    clickMultiplier: liveNumber(live, "clickMultiplier"),
    passiveMultiplier: liveNumber(live, "passiveMultiplier"),
    upgradeCostMultiplier: liveNumber(live, "upgradeCostMultiplier"),
    rebirthRequirementMultiplier: liveNumber(live, "rebirthRequirementMultiplier"),
    eventMultiplier: liveNumber(live, "eventMultiplier"),
    petMultiplierScale: liveNumber(live, "petMultiplierScale"),
    maxClicksPerSecond: liveNumber(live, "maxClicksPerSecond", 14),
    offlineMaxHours: liveNumber(live, "offlineMaxHours", 12),
  });
  const [reason, setReason] = useState("");

  const changes = useMemo(() => {
    const out: { key: string; from: number; to: number }[] = [];
    for (const [key, value] of Object.entries(draft)) {
      const current = liveNumber(live, key);
      if (Math.abs(current - Number(value)) > 1e-9) out.push({ key, from: current, to: Number(value) });
    }
    return out;
  }, [draft, live]);

  const bounds: Record<string, [number, number]> = {
    clickMultiplier: [0.1, 100],
    passiveMultiplier: [0.1, 100],
    upgradeCostMultiplier: [0.1, 10],
    rebirthRequirementMultiplier: [0.1, 10],
    eventMultiplier: [0.1, 10],
    petMultiplierScale: [0.1, 10],
    maxClicksPerSecond: [4, 40],
    offlineMaxHours: [1, 72],
  };

  const outOfBounds = Object.entries(draft).filter(([key, value]) => {
    const [min, max] = bounds[key] ?? [0, Number.MAX_SAFE_INTEGER];
    return Number(value) < min || Number(value) > max;
  });

  return (
    <div className="grid gap-3 xl:grid-cols-[1.25fr_1fr]">
      <div className="panel p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="eyebrow">Versioned economy</p>
            <h2 className="text-lg">Tuning surface · v{snapshot.config.version}</h2>
            <p className="text-[11px] text-[var(--muted)]">Server clamps every value to the allowed range, writes a new immutable version and clears the config cache.</p>
          </div>
          <span className="chip chip-jade"><ShieldCheck size={10} /> validated server-side</span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {Object.keys(draft).map((key) => {
            const [min, max] = bounds[key] ?? [0, 0];
            const invalid = Number((draft as Record<string, number>)[key]) < min || Number((draft as Record<string, number>)[key]) > max;
            return (
              <div key={key}>
                <label className="label" htmlFor={`eco-${key}`}>{key.replace(/([A-Z])/g, " $1")}</label>
                <input
                  id={`eco-${key}`}
                  className={`field field-sm mt-1 ${invalid ? "border-[var(--danger)]" : ""}`}
                  type="number"
                  step="0.05"
                  min={min}
                  max={max}
                  value={(draft as Record<string, number>)[key]}
                  onChange={(event) => setDraft((current) => ({ ...current, [key]: Number(event.target.value) }))}
                  aria-describedby={`eco-${key}-hint`}
                />
                <p id={`eco-${key}-hint`} className={`mt-0.5 text-[9.5px] ${invalid ? "text-[#ffbcb0]" : "text-[var(--dim)]"}`}>allowed {min} – {max}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-3 rounded-lg border border-[var(--line)] bg-[rgba(255,246,230,0.02)] p-2.5">
          <p className="label">Preview</p>
          {changes.length ? (
            <div className="mt-1 space-y-1">
              {changes.map((change) => (
                <p key={change.key} className="text-[11px] text-[var(--muted)]">
                  <span className="numeric text-[var(--text)]">{change.key}</span>: {change.from} → <span className={change.to > change.from ? "text-[#bff4dd]" : "text-[#ffbcb0]"}>{change.to}</span>
                </p>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-[11px] text-[var(--dim)]">No changes yet. Publishing with no changes still creates a new version and audit entry.</p>
          )}
          {outOfBounds.length ? (
            <p className="mt-1 flex items-center gap-1 text-[11px] text-[#ffbcb0]"><AlertTriangle size={11} /> {outOfBounds.length} value(s) outside bounds will be clamped.</p>
          ) : null}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input className="field field-sm min-w-[180px] flex-1" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason for the change (required)" aria-label="Config change reason" maxLength={400} />
          <button type="button" className="btn btn-sm btn-gold" disabled={submitting || reason.trim().length < 3} onClick={() => run("config.publish", { config: draft }, reason)}>
            {submitting ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Publish version
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="panel p-4">
          <p className="eyebrow">Rollback</p>
          <h2 className="text-lg">Configuration versions</h2>
          <p className="text-[11px] text-[var(--muted)]">Restoring an older version publishes it forward as a new version — history is never rewritten.</p>
          <div className="mt-2 space-y-1.5">
            {snapshot.versions.map((version) => (
              <div key={version.version} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--line)] px-2.5 py-1.5">
                <div className="min-w-0">
                  <p className="text-[11.5px]">v{version.version} <span className="text-[var(--dim)]">· {version.label}</span></p>
                  <p className="truncate text-[9.5px] text-[var(--dim)]">{version.adminName} · {new Date(version.createdAt).toLocaleString()}</p>
                </div>
                {version.version !== snapshot.config.version ? (
                  <button type="button" className="btn btn-xs" disabled={submitting} onClick={() => run("config.rollback", { version: version.version }, `Rollback to v${version.version}`)}>
                    <RotateCcw size={10} /> Restore
                  </button>
                ) : (
                  <span className="chip chip-jade">live</span>
                )}
              </div>
            ))}
            {!snapshot.versions.length ? <p className="text-[11px] text-[var(--dim)]">No versions recorded yet.</p> : null}
          </div>
        </div>
        <div className="panel p-4">
          <p className="eyebrow">Guardrails</p>
          <h2 className="text-lg">Why this is safe</h2>
          <ul className="mt-1.5 space-y-1 text-[11px] leading-relaxed text-[var(--muted)]">
            <li>• Values are integers or bounded decimals; NaN and Infinity are rejected before write.</li>
            <li>• The game service reads the config with a short cache, so changes apply without a deploy.</li>
            <li>• Every publish stores an immutable version row with administrator, label and timestamp.</li>
            <li>• Click validation uses the published rate limit, not a client-supplied value.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export function AdminEvents({ snapshot, run, submitting }: SectionProps) {
  const now = new Date();
  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "double_energy",
    multiplier: 2,
    startsAt: toLocalInput(now),
    endsAt: toLocalInput(new Date(now.getTime() + 6 * 3600 * 1000)),
    goalClicks: 1000,
    rewardCoins: 250000,
    rewardGems: 25,
    announcement: "",
  });
  const [editing, setEditing] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const submit = async () => {
    const payload = {
      ...form,
      startsAt: new Date(form.startsAt).toISOString(),
      endsAt: new Date(form.endsAt).toISOString(),
      multiplier: Number(form.multiplier),
      goalClicks: Number(form.goalClicks),
      rewardCoins: Number(form.rewardCoins),
      rewardGems: Number(form.rewardGems),
      ...(editing ? { eventId: editing } : {}),
    };
    const ok = await run(editing ? "event.update" : "event.create", payload, reason);
    if (ok) {
      setEditing(null);
      setForm((current) => ({ ...current, title: "", description: "", announcement: "" }));
    }
  };

  return (
    <div className="grid gap-3 xl:grid-cols-[1fr_1.2fr]">
      <div className="panel p-4">
        <p className="eyebrow">Live operations</p>
        <h2 className="text-lg">{editing ? "Edit event" : "Schedule an event"}</h2>
        <p className="text-[11px] text-[var(--muted)]">Events activate and expire on the server by timestamp. Status is recomputed on every read, so a restart cannot leave a stale live event.</p>
        <div className="mt-3 space-y-2">
          <Field label="Title" value={form.title} onChange={(value) => setForm({ ...form, title: value })} placeholder="Golden Hour" />
          <Field label="Description" value={form.description} onChange={(value) => setForm({ ...form, description: value })} placeholder="Every strike yields double sparks for six hours." textarea />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label" htmlFor="event-type">Type</label>
              <select id="event-type" className="field field-sm mt-1" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
                {["double_energy", "triple_clicks", "super_luck", "golden_hour", "meteor_shower", "click_race", "limited_egg", "treasure_hunt", "weekend_festival", "seasonal"].map((type) => (
                  <option key={type} value={type}>{type.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="event-mult">Multiplier</label>
              <input id="event-mult" className="field field-sm mt-1" type="number" min={1} max={20} step={0.5} value={form.multiplier} onChange={(event) => setForm({ ...form, multiplier: Number(event.target.value) })} />
            </div>
            <div>
              <label className="label" htmlFor="event-start">Starts</label>
              <input id="event-start" className="field field-sm mt-1" type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="event-end">Ends</label>
              <input id="event-end" className="field field-sm mt-1" type="datetime-local" value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="event-goal">Strike goal</label>
              <input id="event-goal" className="field field-sm mt-1" type="number" min={0} value={form.goalClicks} onChange={(event) => setForm({ ...form, goalClicks: Number(event.target.value) })} />
            </div>
            <div>
              <label className="label" htmlFor="event-coins">Reward sparks</label>
              <input id="event-coins" className="field field-sm mt-1" type="number" min={0} value={form.rewardCoins} onChange={(event) => setForm({ ...form, rewardCoins: Number(event.target.value) })} />
            </div>
            <div>
              <label className="label" htmlFor="event-gems">Reward prisms</label>
              <input id="event-gems" className="field field-sm mt-1" type="number" min={0} value={form.rewardGems} onChange={(event) => setForm({ ...form, rewardGems: Number(event.target.value) })} />
            </div>
            <div>
              <label className="label" htmlFor="event-announce">Announcement</label>
              <input id="event-announce" className="field field-sm mt-1" value={form.announcement} onChange={(event) => setForm({ ...form, announcement: event.target.value })} placeholder="Optional ticker line" />
            </div>
          </div>
          <Field label="Internal reason (optional)" value={reason} onChange={setReason} placeholder="why this event exists" />
          <button type="button" className="btn btn-gold btn-sm w-full" disabled={submitting || form.title.trim().length < 3 || form.description.trim().length < 3} onClick={submit}>
            {submitting ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />} {editing ? "Save changes" : "Schedule event"}
          </button>
          {editing ? <button type="button" className="btn btn-xs w-full" onClick={() => setEditing(null)}>Cancel edit</button> : null}
        </div>
      </div>

      <div className="panel p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="eyebrow">Schedule</p>
            <h2 className="text-lg">All events</h2>
          </div>
          <span className="chip chip-gold">{snapshot.overview.activeEvents} live</span>
        </div>
        <div className="mt-2 space-y-2">
          {snapshot.events.map((event) => (
            <div key={event.id} className="rounded-lg border border-[var(--line)] p-2.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-medium">{event.title}</p>
                  <p className="text-[10px] text-[var(--dim)]">{event.type.replace(/_/g, " ")} · ×{event.multiplier} · {event.participation} participants</p>
                </div>
                <span className={`chip ${event.status === "active" ? "chip-jade" : event.status === "ended" ? "" : "chip-gold"}`}>{event.status}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-[10.5px] text-[var(--muted)]">{event.description}</p>
              <p className="mt-1 text-[9.5px] text-[var(--dim)]">{new Date(event.startsAt).toLocaleString()} → {new Date(event.endsAt).toLocaleString()}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                <button type="button" className="btn btn-xs btn-jade" disabled={submitting || event.status === "active"} onClick={() => run("event.start", { eventId: event.id })}>
                  <Play size={10} /> Start now
                </button>
                <button type="button" className="btn btn-xs" disabled={submitting || event.status === "ended"} onClick={() => run("event.stop", { eventId: event.id })}>
                  <Square size={10} /> Stop
                </button>
                <button
                  type="button"
                  className="btn btn-xs"
                  onClick={() => {
                    setEditing(event.id);
                    setForm({
                      title: event.title,
                      description: event.description,
                      type: event.type,
                      multiplier: event.multiplier,
                      startsAt: toLocalInput(new Date(event.startsAt)),
                      endsAt: toLocalInput(new Date(event.endsAt)),
                      goalClicks: event.goalClicks,
                      rewardCoins: event.rewardCoins,
                      rewardGems: event.rewardGems,
                      announcement: "",
                    });
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  Edit
                </button>
              </div>
            </div>
          ))}
          {!snapshot.events.length ? <p className="text-[11.5px] text-[var(--muted)]">No events yet. Schedule the first one — it appears live for all players immediately.</p> : null}
        </div>
      </div>
    </div>
  );
}

export function AdminContent({ snapshot }: SectionProps) {
  const [copied, setCopied] = useState(false);
  const totals = snapshot.eggs.map((egg) => egg.total);
  const allValid = snapshot.eggs.every((egg) => egg.valid && egg.total === 1000);

  return (
    <div className="space-y-3">
      <div className="panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="eyebrow">Content validation</p>
            <h2 className="text-lg">Pets & egg probability tables</h2>
            <p className="text-[11px] text-[var(--muted)]">Definitions ship as versioned code configuration and are validated on every deploy. This module reads the live definitions and their published probabilities.</p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`chip ${allValid ? "chip-jade" : "chip-danger"}`}>{allValid ? <><Check size={10} /> all tables valid</> : "validation errors"}</span>
            <button
              type="button"
              className="btn btn-xs"
              onClick={async () => {
                await navigator.clipboard.writeText(JSON.stringify(snapshot.eggs, null, 2));
                setCopied(true);
                window.setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? <CheckCircle2 size={11} /> : <Copy size={11} />} {copied ? "Copied" : "Copy JSON"}
            </button>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Mini label="Egg tables" value={String(snapshot.eggs.length)} />
          <Mini label="Tables at 1000 parts" value={`${totals.filter((t) => t === 1000).length}/${totals.length}`} />
          <Mini label="Rare-or-better pity" value="20 hatches" />
          <Mini label="Variant rules" value="Golden ×1.5 · Shiny ×1.25" />
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        {snapshot.eggs.map((egg) => (
          <div key={egg.id} className="panel p-3.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[12.5px] font-medium">{egg.name}</p>
                <p className="text-[10px] text-[var(--dim)]">{egg.worldId} · {formatNumber(egg.price)} sparks</p>
              </div>
              <span className={`chip ${egg.total === 1000 ? "chip-jade" : "chip-danger"}`}>{egg.total}/1000</span>
            </div>
            <div className="mt-2 space-y-1">
              {egg.entries.map((entry) => (
                <div key={entry.petId} className="flex items-center gap-2">
                  <span className="w-[130px] truncate text-[10.5px] text-[var(--muted)]">{entry.name || entry.petId}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[rgba(255,246,230,0.08)]">
                    <span className="block h-full rounded-full bg-[var(--gold)]" style={{ width: `${Math.min(100, entry.probability)}%` }} />
                  </div>
                  <span className="numeric w-14 text-right text-[10px]">{entry.probability.toFixed(2)}%</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="panel p-4">
        <p className="eyebrow">Rarity multipliers</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {RARITIES.map((rarity) => (
            <span key={rarity.id} className="chip" style={{ borderColor: `${rarity.color}55`, color: rarity.color }}>{rarity.label} ×{rarity.multiplier}</span>
          ))}
        </div>
        <p className="mt-2 text-[10.5px] leading-relaxed text-[var(--dim)]">
          Every egg table is normalised to exactly 1000 parts when generated and re-validated here. Any table that does not total 1000 is flagged above and rejected by the test suite before deployment.
        </p>
      </div>
    </div>
  );
}

export function AdminCodes({ snapshot, run, submitting }: SectionProps) {
  const [form, setForm] = useState({ code: "", rewardCoins: 50000, rewardGems: 10, rewardEmbers: 0, maxRedemptions: 100, perUserLimit: 1, endsAt: "" });
  const create = async () => {
    const ok = await run("code.create", {
      code: form.code,
      rewardCoins: Number(form.rewardCoins),
      rewardGems: Number(form.rewardGems),
      rewardEmbers: Number(form.rewardEmbers),
      maxRedemptions: Number(form.maxRedemptions),
      perUserLimit: Number(form.perUserLimit),
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
    });
    if (ok) setForm({ ...form, code: "" });
  };
  return (
    <div className="grid gap-3 xl:grid-cols-[1fr_1.3fr]">
      <div className="panel p-4">
        <p className="eyebrow">Promotions</p>
        <h2 className="text-lg">Create a code</h2>
        <p className="text-[11px] text-[var(--muted)]">Redemption is a locked transaction with a unique (code, player) constraint — duplicate rewards are impossible even under concurrent requests.</p>
        <div className="mt-3 space-y-2">
          <Field label="Code" value={form.code} onChange={(value) => setForm({ ...form, code: value.toUpperCase().replace(/\s+/g, "-") })} placeholder="OBSIDIA-LAUNCH" />
          <div className="grid grid-cols-2 gap-2">
            <NumField label="Reward sparks" value={form.rewardCoins} onChange={(value) => setForm({ ...form, rewardCoins: value })} />
            <NumField label="Reward prisms" value={form.rewardGems} onChange={(value) => setForm({ ...form, rewardGems: value })} />
            <NumField label="Reward embers" value={form.rewardEmbers} onChange={(value) => setForm({ ...form, rewardEmbers: value })} />
            <NumField label="Global limit (0 = ∞)" value={form.maxRedemptions} onChange={(value) => setForm({ ...form, maxRedemptions: value })} />
            <NumField label="Per account" value={form.perUserLimit} onChange={(value) => setForm({ ...form, perUserLimit: value })} />
            <div>
              <label className="label" htmlFor="code-expiry">Expires</label>
              <input id="code-expiry" className="field field-sm mt-1" type="datetime-local" value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} />
            </div>
          </div>
          <button type="button" className="btn btn-gold btn-sm w-full" disabled={submitting || form.code.trim().length < 3} onClick={create}>
            {submitting ? <Loader2 size={12} className="animate-spin" /> : <Ticket size={12} />} Create code
          </button>
        </div>
      </div>
      <div className="panel p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="eyebrow">Ledger</p>
            <h2 className="text-lg">Codes & redemption counts</h2>
          </div>
          <span className="chip chip-gold">{snapshot.codes.filter((c) => c.active).length} active</span>
        </div>
        <div className="table-wrap mt-2 rounded-lg border border-[var(--line)]">
          <table className="data">
            <thead><tr><th>Code</th><th>Rewards</th><th>Used</th><th>Window</th><th>State</th><th></th></tr></thead>
            <tbody>
              {snapshot.codes.map((code) => (
                <tr key={code.id}>
                  <td className="numeric text-[11px]">{code.code}</td>
                  <td className="text-[10.5px] text-[var(--muted)]">{formatNumber(code.rewardCoins)}<br />{code.rewardGems} prisms · {code.rewardEmbers} embers</td>
                  <td className="numeric">{code.redeemedCount}/{code.maxRedemptions || "∞"}</td>
                  <td className="text-[9.5px] text-[var(--dim)]">{new Date(code.startsAt).toLocaleDateString()}<br />{code.endsAt ? new Date(code.endsAt).toLocaleDateString() : "no expiry"}</td>
                  <td>{code.active ? <span className="chip chip-jade">active</span> : <span className="chip">disabled</span>}</td>
                  <td><button type="button" className="btn btn-xs" disabled={submitting} onClick={() => run("code.toggle", { codeId: code.id })}>{code.active ? "Disable" : "Enable"}</button></td>
                </tr>
              ))}
              {!snapshot.codes.length ? <tr><td colSpan={6} className="py-5 text-center text-[11.5px] text-[var(--muted)]">No codes created yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function AdminConfig({ snapshot, run, submitting }: SectionProps) {
  const flags = (snapshot.config.live.featureFlags ?? {}) as Record<string, boolean>;
  const [draft, setDraft] = useState({
    maintenanceMode: Boolean(snapshot.config.live.maintenanceMode),
    eggs: flags.eggs !== false,
    events: flags.events !== false,
    shop: flags.shop !== false,
    leaderboards: flags.leaderboards !== false,
    codes: flags.codes !== false,
    trading: flags.trading === true,
    maxClicksPerSecond: liveNumber(snapshot.config.live, "maxClicksPerSecond", 14),
    offlineMaxHours: liveNumber(snapshot.config.live, "offlineMaxHours", 12),
  });
  const [reason, setReason] = useState("");
  const publish = () =>
    run(
      "config.publish",
      {
        config: {
          maintenanceMode: draft.maintenanceMode,
          maxClicksPerSecond: draft.maxClicksPerSecond,
          offlineMaxHours: draft.offlineMaxHours,
          featureFlags: { eggs: draft.eggs, events: draft.events, shop: draft.shop, leaderboards: draft.leaderboards, codes: draft.codes, trading: draft.trading },
        },
      },
      reason,
    );

  return (
    <div className="grid gap-3 xl:grid-cols-[1.2fr_1fr]">
      <div className="panel p-4">
        <p className="eyebrow">Global switches</p>
        <h2 className="text-lg">Configuration centre</h2>
        <p className="text-[11px] text-[var(--muted)]">Feature flags and limits are validated server-side. Maintenance mode pauses mutations for players while staff keep access.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {[
            ["eggs", "Hatchery"],
            ["events", "Events"],
            ["shop", "Prism shop"],
            ["leaderboards", "Leaderboards"],
            ["codes", "Codes"],
            ["trading", "Trading (not shipped)"],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--line)] px-2.5 py-2 text-[11.5px]">
              {label}
              <input
                type="checkbox"
                checked={Boolean(draft[key as keyof typeof draft])}
                onChange={(event) => setDraft({ ...draft, [key]: event.target.checked })}
                className="h-4 w-4 accent-[var(--gold)]"
                disabled={key === "trading"}
              />
            </label>
          ))}
          <label className="flex items-center justify-between gap-2 rounded-lg border border-[rgba(240,112,95,0.4)] bg-[rgba(240,112,95,0.06)] px-2.5 py-2 text-[11.5px] sm:col-span-2">
            Maintenance mode (players cannot mutate state)
            <input type="checkbox" checked={draft.maintenanceMode} onChange={(event) => setDraft({ ...draft, maintenanceMode: event.target.checked })} className="h-4 w-4 accent-[var(--danger)]" />
          </label>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <NumField label="Max clicks per second" value={draft.maxClicksPerSecond} onChange={(value) => setDraft({ ...draft, maxClicksPerSecond: value })} />
          <NumField label="Offline cap (hours)" value={draft.offlineMaxHours} onChange={(value) => setDraft({ ...draft, offlineMaxHours: value })} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input className="field field-sm min-w-[180px] flex-1" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason (required, audited)" aria-label="Configuration reason" />
          <button type="button" className="btn btn-sm btn-gold" disabled={submitting || reason.trim().length < 3} onClick={publish}>
            {submitting ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Publish
          </button>
        </div>
      </div>
      <div className="space-y-3">
        <div className="panel p-4">
          <p className="eyebrow">Audit</p>
          <h2 className="text-lg">Latest configuration events</h2>
          <div className="mt-2 space-y-1.5">
            {snapshot.recentAudit.filter((entry) => entry.action.startsWith("config")).slice(0, 6).map((entry) => (
              <div key={entry.id} className="rounded-lg border border-[var(--line)] px-2.5 py-1.5">
                <p className="text-[11px]">{entry.action} <span className="text-[var(--dim)]">by {entry.adminName}</span></p>
                <p className="text-[9.5px] text-[var(--dim)]">{new Date(entry.createdAt).toLocaleString()} · {entry.reason || "no reason"}</p>
              </div>
            ))}
            {!snapshot.recentAudit.some((entry) => entry.action.startsWith("config")) ? <p className="text-[11px] text-[var(--dim)]">No configuration changes recorded yet.</p> : null}
          </div>
        </div>
        <div className="panel p-4">
          <p className="eyebrow">Reference</p>
          <h2 className="text-lg">Role permissions</h2>
          <div className="mt-1.5 space-y-1">
            {Object.entries(snapshot.config.permissions).filter(([role]) => role !== "player").map(([role, perms]) => (
              <p key={role} className="text-[10.5px] text-[var(--muted)]">
                <span className="text-[var(--text)]">{snapshot.config.roleLabels[role] ?? role}</span>: {perms.includes("*") ? "all permissions" : perms.join(", ")}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminConsole({ snapshot, onSnapshot }: { snapshot: AdminSnapshot; onSnapshot?: (snapshot: AdminSnapshot) => void }) {
  const [command, setCommand] = useState("");
  const [history, setHistory] = useState<{ command: string; output: string; ok: boolean }[]>([]);
  const [busy, setBusy] = useState(false);
  const suggestions = [
    "/help",
    "/addclicks Emberwright 100",
    "/addclicks Emberwright 100000000000000000",
    "/give Emberwright coins 100000000000000000",
    "/give Emberwright clicks 100",
    "/player Emberwright",
    "/config validate",
    "/logs",
    "/announce Golden hour begins now!",
  ];

  const execute = async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: trimmed }),
      });
      const data = (await response.json()) as { message?: string; error?: string; snapshot?: AdminSnapshot };
      if (!response.ok) {
        setHistory((current) => [{ command: trimmed, output: data.error ?? "Command failed.", ok: false }, ...current].slice(0, 30));
      } else {
        setHistory((current) => [{ command: trimmed, output: data.message ?? "Done.", ok: true }, ...current].slice(0, 30));
        if (data.snapshot && onSnapshot) onSnapshot(data.snapshot);
      }
    } catch (error) {
      setHistory((current) => [{ command: trimmed, output: error instanceof Error ? error.message : "Network error", ok: false }, ...current].slice(0, 30));
    } finally {
      setBusy(false);
      setCommand("");
    }
  };

  return (
    <div className="grid gap-3 xl:grid-cols-[1.3fr_1fr]">
      <div className="panel p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="eyebrow">Operations shell</p>
            <h2 className="text-lg">Command console</h2>
          </div>
          <span className="chip chip-jade"><Terminal size={10} /> authorization shared with UI</span>
        </div>
        <p className="text-[11px] text-[var(--muted)]">Commands call the same validated service layer as the dashboard — there is no arbitrary SQL or JavaScript execution.</p>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void execute(command);
          }}
        >
          <span className="grid place-items-center rounded-lg border border-[var(--line)] px-2 text-[var(--jade)]"><Terminal size={14} /></span>
          <input
            className="field flex-1 font-[var(--mono)] text-[12px]"
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            placeholder="/player Emberwright"
            aria-label="Admin command"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" className="btn btn-gold btn-sm" disabled={busy || command.trim().length < 2}>
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} Run
          </button>
        </form>
        <div className="mt-2 flex flex-wrap gap-1">
          {suggestions.map((item) => (
            <button key={item} type="button" className="chip" onClick={() => setCommand(item)}>{item}</button>
          ))}
        </div>
        <div className="mt-3 max-h-[420px] space-y-1.5 overflow-y-auto scroll-area">
          {history.map((entry, index) => (
            <div key={index} className="rounded-lg border border-[var(--line)] bg-[rgba(8,7,11,0.6)] px-2.5 py-1.5">
              <p className="font-[var(--mono)] text-[11px] text-[var(--gold)]">{entry.command}</p>
              <pre className={`mt-1 whitespace-pre-wrap break-words font-[var(--mono)] text-[10.5px] ${entry.ok ? "text-[#bff4dd]" : "text-[#ffbcb0]"}`}>{entry.output}</pre>
            </div>
          ))}
          {!history.length ? <p className="text-[11px] text-[var(--dim)]">No commands executed in this session. Type /help or pick a suggestion.</p> : null}
        </div>
      </div>
      <div className="space-y-3">
        <div className="panel p-4">
          <p className="eyebrow">Your authority</p>
          <h2 className="text-lg">{snapshot.role === "owner" ? "Owner" : snapshot.role.replace("_", " ")}</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted)]">
            {snapshot.permissions.includes("*") ? "Full authority including role management and configuration." : `Granted permissions: ${snapshot.permissions.join(", ")}`}
          </p>
        </div>
        <div className="panel p-4">
          <p className="eyebrow">Recently affected players</p>
          <div className="mt-1.5 space-y-1">
            {snapshot.playerRows.slice(0, 6).map((player) => (
              <p key={player.id} className="text-[10.5px] text-[var(--muted)]"><span className="text-[var(--text)]">{player.username}</span> · {formatNumber(player.coins)} sparks · {player.rebirths} rebirths</p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, textarea }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; textarea?: boolean }) {
  const id = `field-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      {textarea ? (
        <textarea id={id} className="field field-sm mt-1" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} maxLength={400} />
      ) : (
        <input id={id} className="field field-sm mt-1" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} maxLength={200} />
      )}
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const id = `num-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <input id={id} className="field field-sm mt-1" type="number" min={0} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--line)] px-2 py-1.5">
      <p className="text-[9px] uppercase tracking-[0.12em] text-[var(--dim)]">{label}</p>
      <p className="numeric mt-0.5 truncate text-[12px]">{value}</p>
    </div>
  );
}

export { formatNumber };
