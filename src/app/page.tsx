import Image from "next/image";
import Link from "next/link";
import { count, sql } from "drizzle-orm";
import {
  ArrowRight,
  Activity,
  Boxes,
  Crown,
  Egg,
  GaugeCircle,
  Layers,
  LockKeyhole,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Telescope,
  Timer,
  Users,
  Wand2,
} from "lucide-react";
import { db } from "@/db";
import { players, users } from "@/db/schema";
import { getAuthContext, isStaff } from "@/lib/auth";
import { ACHIEVEMENTS, EGGS, PETS, QUESTS, RARITIES, UPGRADES, WORLDS } from "@/lib/content";
import { formatNumber } from "@/lib/economy";
import { Glyph, SparkMark, WorldPatternArt } from "@/components/ui/art";
import { GuestEntry } from "@/components/GuestEntry";

export const dynamic = "force-dynamic";

async function liveStats() {
  try {
    const [accountRow] = await db.select({ value: count() }).from(users);
    const [strikeRow] = await db.select({ value: sql<number>`COALESCE(SUM(${players.totalClicks}), 0)` }).from(players);
    const [worldRow] = await db.select({ value: sql<number>`COALESCE(MAX(${players.highestWorldIndex}), 0)` }).from(players);
    return {
      accounts: Number(accountRow?.value ?? 0),
      strikes: Number(strikeRow?.value ?? 0),
      deepestWorld: WORLDS[Number(worldRow?.value ?? 0)]?.name ?? WORLDS[0].name,
      online: true,
    };
  } catch {
    return { accounts: 0, strikes: 0, deepestWorld: WORLDS[0].name, online: false };
  }
}

const featureBlocks = [
  {
    icon: GaugeCircle,
    title: "Server-authoritative strikes",
    body: "Every click is rate-validated, every price is computed by the forge, and combos, crits and multipliers reconcile against the database — not localStorage.",
  },
  {
    icon: Egg,
    title: "Sixty companions, ten hatch tables",
    body: "Published odds totalling exactly 100% per egg, a transparent 20-hatch pity rule, golden and shiny variants, fusion, favourites and instant equip-best.",
  },
  {
    icon: Crown,
    title: "Three resets, real decisions",
    body: "Rebirth for embers, prestige for sigils, ascend for echoes — each with an explicit preview of what resets and what is preserved forever.",
  },
  {
    icon: Activity,
    title: "Live operations",
    body: "Scheduled events with real multipliers, event quests and reward claims, global announcements, promocodes with atomic redemption and hard limits.",
  },
  {
    icon: ShieldCheck,
    title: "Anti-cheat by design",
    body: "Hashed sessions, scrypt passwords, per-account rate limits, bounded bulk transactions, row locks against duplicate rewards and full audit trails.",
  },
  {
    icon: LockKeyhole,
    title: "A genuine operations console",
    body: "Ten modules, five roles, granular permissions, economy versioning with rollback, moderation cases and immutable audit history that admins cannot edit.",
  },
];

export default async function LandingPage() {
  const [ctx, stats] = await Promise.all([getAuthContext(), liveStats()]);
  const staff = ctx ? isStaff(ctx.user.role) : false;

  return (
    <main className="relative min-h-screen">
      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[rgba(7,6,10,0.72)] glass-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-[rgba(233,182,98,0.4)] bg-[rgba(233,182,98,0.12)]">
              <SparkMark size={17} color="var(--gold-bright)" />
            </span>
            <span className="leading-tight">
              <span className="block font-[var(--serif)] text-[17px] tracking-[0.18em] text-[#fdf3e3]">OBSIDIA</span>
              <span className="block text-[9px] uppercase tracking-[0.3em] text-[var(--dim)]">The Infinite Forge</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-6 text-[12.5px] text-[var(--muted)] md:flex" aria-label="Main navigation">
            <a href="#forge" className="hover:text-[var(--text)]">The forge</a>
            <a href="#worlds" className="hover:text-[var(--text)]">Ten worlds</a>
            <a href="#progression" className="hover:text-[var(--text)]">Progression</a>
            <a href="#companions" className="hover:text-[var(--text)]">Companions</a>
            <a href="#operations" className="hover:text-[var(--text)]">Operations</a>
          </nav>
          <div className="flex items-center gap-2">
            {ctx ? (
              <>
                {staff ? (
                  <Link href="/admin" className="btn btn-sm hidden sm:inline-flex">
                    <ShieldCheck size={14} /> Admin
                  </Link>
                ) : null}
                <Link href="/play" className="btn btn-gold btn-sm">
                  Resume forge <ArrowRight size={14} />
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" className="btn btn-ghost btn-sm hidden sm:inline-flex">
                  Sign in
                </Link>
                <Link href="/register" className="btn btn-gold btn-sm">
                  Create account
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section id="forge" className="relative mx-auto grid w-full max-w-7xl items-center gap-10 px-4 pb-14 pt-12 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:pb-20 lg:pt-16">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip chip-gold">
              <Sparkles size={12} /> Persistent online economy
            </span>
            <span className="chip">
              <ShieldCheck size={12} /> Server validated
            </span>
            <span className="chip">
              <Users size={12} /> {stats.accounts > 0 ? `${formatNumber(stats.accounts)} accounts` : "Founding season"}
            </span>
          </div>
          <h1 className="mt-6 text-[40px] leading-[1.02] sm:text-[58px] lg:text-[66px]">
            Strike once.
            <br />
            <span className="bg-gradient-to-r from-[#ffe7b6] via-[#e9b662] to-[#b87a33] bg-clip-text text-transparent">Own the mechanism.</span>
          </h1>
          <p className="mt-5 max-w-xl text-[14.5px] leading-relaxed text-[var(--muted)]">
            OBSIDIA is an incremental forge that rewards precision over noise. Build a machine of twelve upgrade disciplines, hatch companions
            across ten hand-painted worlds, and reset the wheel three times to compound what you keep. Every spark on this page is computed on
            our server and stored in PostgreSQL.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href={ctx ? "/play" : "/register"} className="btn btn-gold">
              {ctx ? "Enter your forge" : "Claim your forge"} <ArrowRight size={15} />
            </Link>
            <GuestEntry className="btn" label="Try instantly as guest" />
          </div>
          <p className="mt-3 text-[11px] text-[var(--dim)]">
            No card, no paywall. Guest progress upgrades to a full account whenever you are ready.
          </p>

          <dl className="mt-9 grid max-w-xl grid-cols-3 divide-x divide-[var(--line)] rounded-2xl border border-[var(--line)] bg-[rgba(255,246,230,0.02)]">
            <div className="px-4 py-3">
              <dt className="eyebrow">Forgemasters</dt>
              <dd className="numeric mt-1 text-lg text-[#fdf3e3]">{stats.online ? formatNumber(stats.accounts) : "—"}</dd>
            </div>
            <div className="px-4 py-3">
              <dt className="eyebrow">Strikes recorded</dt>
              <dd className="numeric mt-1 text-lg text-[#fdf3e3]">{stats.online ? formatNumber(stats.strikes) : "—"}</dd>
            </div>
            <div className="px-4 py-3">
              <dt className="eyebrow">Deepest world</dt>
              <dd className="mt-1 truncate text-[13px] text-[#fdf3e3]">{stats.deepestWorld}</dd>
            </div>
          </dl>
        </div>

        <div className="relative">
          <div className="relative overflow-hidden rounded-[24px] border border-[rgba(233,182,98,0.24)] shadow-[0_40px_120px_-50px_rgba(233,182,98,0.55)]">
            <Image
              src="/images/forge-hero.jpg"
              alt="The Infinite Forge: obsidian machinery threaded with molten gold"
              width={1024}
              height={768}
              priority
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[rgba(7,6,10,0.92)] via-transparent to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="eyebrow">Active dimension</p>
                  <p className="mt-1 font-[var(--serif)] text-xl">Ember Foothills</p>
                  <p className="text-[11.5px] text-[var(--muted)]">Where the forge first breathes · +0% output</p>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-[rgba(233,182,98,0.3)] bg-[rgba(10,8,12,0.65)] px-3 py-2">
                  <Timer size={14} className="text-[var(--gold)]" />
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.2em] text-[var(--dim)]">Rebirth preview</p>
                    <p className="numeric text-[12px] text-[#fdf3e3]">Auto-calculated server-side</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="pointer-events-none absolute -left-3 -top-3 hidden rotate-[-4deg] rounded-xl border border-[rgba(89,211,165,0.4)] bg-[rgba(9,20,16,0.9)] px-3 py-2 lg:block">
            <p className="text-[9.5px] uppercase tracking-[0.2em] text-[#9de8ca]">Combo chain</p>
            <p className="numeric text-sm text-white">×3.42 · 148 links</p>
          </div>
          <div className="pointer-events-none absolute -bottom-4 -right-2 hidden rotate-[3deg] rounded-xl border border-[rgba(233,182,98,0.35)] bg-[rgba(20,15,9,0.94)] px-3 py-2 lg:block">
            <p className="text-[9.5px] uppercase tracking-[0.2em] text-[var(--gold-bright)]">Published hatch odds</p>
            <p className="numeric text-sm text-white">100.00% total · 20-hatch pity</p>
          </div>
        </div>
      </section>

      <div className="hairline mx-auto max-w-7xl" />

      <section className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Why it holds up</p>
            <h2 className="mt-2 text-3xl sm:text-4xl">Built like a game. Operated like a platform.</h2>
          </div>
          <p className="max-w-md text-[13px] text-[var(--muted)]">
            {UPGRADES.length} upgrade disciplines · {PETS.length} companion definitions · {ACHIEVEMENTS.length} achievements · {QUESTS.length} quest
            lines · {EGGS.length} hatch tables — all configuration-driven and validated.
          </p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featureBlocks.map((block) => (
            <article key={block.title} className="panel p-5">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-[rgba(233,182,98,0.26)] bg-[rgba(233,182,98,0.08)]">
                <block.icon size={18} className="text-[var(--gold-bright)]" />
              </span>
              <h3 className="mt-4 text-lg">{block.title}</h3>
              <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--muted)]">{block.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="worlds" className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">The dimensional ledger</p>
            <h2 className="mt-2 text-3xl sm:text-4xl">Ten worlds, ten visual languages.</h2>
          </div>
          <span className="chip">
            <Telescope size={12} /> Each world: palette, pattern, egg, pets, multiplier
          </span>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-2">
          {WORLDS.map((world) => (
            <article
              key={world.id}
              className="world-stage relative overflow-hidden rounded-[18px] border border-[var(--line)]"
              style={
                {
                  "--world-accent": world.accent,
                  "--world-soft": world.accentSoft,
                  "--world-bg-from": world.bgFrom,
                  "--world-bg-to": world.bgTo,
                } as React.CSSProperties
              }
            >
              <WorldPatternArt pattern={world.pattern} accent={world.accent} />
              <div className="relative flex h-full flex-col justify-between gap-6 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="eyebrow">World {String(world.index + 1).padStart(2, "0")}</p>
                    <h3 className="mt-1 text-xl" style={{ color: world.ink }}>
                      {world.name}
                    </h3>
                    <p className="text-[11.5px] text-[var(--muted)]">{world.subtitle}</p>
                  </div>
                  <span className="chip" style={{ borderColor: `${world.accent}55`, color: world.accent }}>
                    {world.bonus}
                  </span>
                </div>
                <div className="flex items-end justify-between gap-3">
                  <p className="max-w-sm text-[12px] leading-relaxed text-[var(--muted)]">{world.description}</p>
                  <div className="text-right">
                    <p className="text-[9px] uppercase tracking-[0.18em] text-[var(--dim)]">Unlock at</p>
                    <p className="numeric text-[13px]" style={{ color: world.ink }}>
                      {world.unlockAt === 0 ? "Immediate" : formatNumber(world.unlockAt)}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {PETS.filter((p) => p.worldId === world.id).slice(0, 5).map((pet) => (
                    <span key={pet.id} className="flex items-center gap-1 rounded-full border border-[var(--line)] bg-[rgba(8,7,11,0.45)] pl-1 pr-2 py-0.5">
                      <Glyph glyph={pet.glyph} tint={pet.tint} size={18} />
                      <span className="text-[10px] text-[var(--muted)]">{pet.name}</span>
                    </span>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="progression" className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="eyebrow">Long game</p>
            <h2 className="mt-2 text-3xl sm:text-4xl">The wheel turns three times.</h2>
            <p className="mt-3 max-w-md text-[13px] leading-relaxed text-[var(--muted)]">
              Early play is fast: your first rebirth lands inside the first session. Mid-game asks which discipline compounds hardest. Endgame is
              about what you refuse to reset — collections, achievements and echoes stay with you forever.
            </p>
            <div className="mt-6 space-y-3">
              {[
                { icon: ScrollText, title: "Rebirth", body: "Reset sparks, run progress and all twelve upgrade tracks. Keep companions, achievements, worlds and collection. Gain embers." },
                { icon: Layers, title: "Prestige", body: "Reset embers and rebirth count at 10 rebirths. Gain sigils, each permanently worth +10% to everything." },
                { icon: Sparkles, title: "Ascension", body: "Reset sigils at 5 sigils for echoes at +25% each. Unlocks the endgame research mindset and galaxy reset preview." },
              ].map((tier) => (
                <div key={tier.title} className="panel-soft flex gap-3 p-4">
                  <tier.icon size={17} className="mt-0.5 flex-shrink-0 text-[var(--gold)]" />
                  <div>
                    <p className="text-sm font-semibold">{tier.title}</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-[var(--muted)]">{tier.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="panel overflow-hidden">
            <div className="border-b border-[var(--line)] px-5 py-4">
              <p className="eyebrow">Companion rarity ledger</p>
              <h3 className="mt-1 text-lg">Every published multiplier</h3>
            </div>
            <div className="divide-y divide-[var(--line)]">
              {RARITIES.map((rarity) => {
                const count = PETS.filter((p) => p.rarity === rarity.id).length;
                return (
                  <div key={rarity.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: rarity.color }} />
                      <div>
                        <p className="text-[13px] font-medium">{rarity.label}</p>
                        <p className="text-[10.5px] text-[var(--dim)]">{count} definitions</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--dim)]">base</span>
                      <span className="numeric text-[13px]" style={{ color: rarity.color }}>×{rarity.multiplier.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-[var(--line)] bg-[rgba(255,246,230,0.02)] px-5 py-4 text-[11.5px] leading-relaxed text-[var(--muted)]">
              Golden variants multiply ×1.5 and shiny ×1.25. Every egg table sums to exactly 1000 parts (100.00%). A pity counter guarantees
              rare-or-better on the 20th hatch without a rare pull. All rolls happen on the server.
            </div>
          </div>
        </div>
      </section>

      <section id="companions" className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6">
        <div className="panel-gold panel p-6 sm:p-8">
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <p className="eyebrow">Daily rhythm</p>
              <h2 className="mt-2 text-3xl">A reason to return that is not a timer popup.</h2>
              <ul className="mt-5 space-y-3 text-[13px] text-[var(--muted)]">
                {[
                  "Seven-day escalating calendar with a 20-hour server clock and anti-double-claim transaction.",
                  "Daily and weekly quest lines with real objective tracking, plus permanent milestone lines.",
                  "Offline earnings computed server-side, capped by your Night Shift upgrade and published hours.",
                  "Events with live multipliers, participation goals and claimable rewards.",
                ].map((item) => (
                  <li key={item} className="flex gap-2">
                    <ArrowRight size={14} className="mt-0.5 flex-shrink-0 text-[var(--gold)]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {PETS.filter((p) => ["celestial", "secret", "legendary", "mythic"].includes(p.rarity)).slice(0, 4).map((pet) => (
                <div key={pet.id} className="rounded-xl border border-[var(--line)] bg-[rgba(9,7,12,0.6)] p-3">
                  <div className="flex items-center gap-2">
                    <Glyph glyph={pet.glyph} tint={pet.tint} size={34} />
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px] font-medium">{pet.name}</p>
                      <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: pet.tint }}>{pet.rarity}</p>
                    </div>
                  </div>
                  <p className="mt-2 line-clamp-2 text-[10.5px] leading-relaxed text-[var(--muted)]">{pet.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="operations" className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div>
            <p className="eyebrow">For the operators</p>
            <h2 className="mt-2 text-3xl sm:text-4xl">A live-ops console, not a settings page.</h2>
            <p className="mt-3 text-[13px] leading-relaxed text-[var(--muted)]">
              The protected <code className="numeric text-[var(--gold)]">/admin</code> surface reads the real database. Every economy change is
              versioned, previewed and reversible. Every destructive action demands a reason and lands in an append-only audit log with a request id.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {[
                "Overview metrics + charts",
                "Player search & inspect",
                "Grant / take with audit",
                "Economy config + rollback",
                "Event scheduling & live start",
                "Hatch table probability viewer",
                "Code creation & limits",
                "Moderation cases",
                "Audit explorer + CSV",
                "Command console with /help",
              ].map((item) => (
                <span key={item} className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[rgba(255,246,230,0.02)] px-3 py-2 text-[11.5px] text-[var(--muted)]">
                  <Boxes size={12} className="text-[var(--jade)]" /> {item}
                </span>
              ))}
            </div>
            <Link href={staff ? "/admin" : "/login"} className="btn mt-5">
              <Wand2 size={14} /> {staff ? "Open operations console" : "Staff sign in"}
            </Link>
          </div>
          <div className="panel p-5">
            <div className="flex items-center justify-between">
              <p className="eyebrow">Role matrix</p>
              <span className="chip chip-jade">
                <ShieldCheck size={11} /> Enforced server-side
              </span>
            </div>
            <div className="mt-4 space-y-2">
              {[
                { role: "Owner", text: "Full authority, role management, configuration" },
                { role: "Super Admin", text: "Economy, content, events, moderation, console" },
                { role: "Admin", text: "Player economy, content, codes, moderation" },
                { role: "Moderator", text: "Cases, bans, read-only player view" },
                { role: "Support", text: "Read-only player lookup" },
              ].map((row) => (
                <div key={row.role} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] px-3 py-2">
                  <span className="text-[12px] font-medium">{row.role}</span>
                  <span className="max-w-[58%] text-right text-[10.5px] text-[var(--muted)]">{row.text}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-[rgba(89,211,165,0.3)] bg-[rgba(89,211,165,0.07)] p-3 text-[11px] leading-relaxed text-[#bff4dd]">
              Hiding a button is never the security model. Every admin request re-checks the session, the ban state and the granular permission on the
              server before touching a row.
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6">
        <div className="relative overflow-hidden rounded-[22px] border border-[rgba(233,182,98,0.28)] bg-[linear-gradient(140deg,rgba(58,42,22,0.72),rgba(12,10,16,0.94))] p-7 sm:p-10">
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
            <div>
              <p className="eyebrow">Season one</p>
              <h2 className="mt-2 text-3xl sm:text-4xl">The forge is warm. The ledger is open.</h2>
              <p className="mt-2 max-w-xl text-[13px] text-[var(--muted)]">
                Create an account in seconds, or light a guest forge and upgrade it later without losing a single spark.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href={ctx ? "/play" : "/register"} className="btn btn-gold">
                {ctx ? "Resume forge" : "Create account"} <ArrowRight size={15} />
              </Link>
              <GuestEntry className="btn" label="Guest forge" />
            </div>
          </div>
          <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(233,182,98,0.3),transparent_65%)]" />
        </div>
      </section>

      <footer className="border-t border-[var(--line)]">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-6 text-[11.5px] text-[var(--dim)] sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            © {new Date().getFullYear()} OBSIDIA · The Infinite Forge. No real-money purchases. Prisms are earned in game only.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/login" className="hover:text-[var(--muted)]">Sign in</Link>
            <Link href="/register" className="hover:text-[var(--muted)]">Create account</Link>
            <a href="#forge" className="hover:text-[var(--muted)]">Back to top</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
