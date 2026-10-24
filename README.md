# OBSIDIA — The Infinite Forge

A complete, server-authoritative incremental clicker built with Next.js (App Router), React 19, TypeScript,
Tailwind CSS 4, Drizzle ORM and PostgreSQL. Everything that matters — currency, upgrades, eggs, quests,
achievements, codes, events, rebirths and rankings — is validated and stored on the server.

> **Design identity:** obsidian surfaces, molten-gold detailing, editorial serif display type and a jade
> secondary accent. Ten worlds each carry their own palette, pattern language, hatch table and pets. This is
> deliberately not the usual cyan/purple neon dashboard.

## Feature map

| Area | What ships |
| --- | --- |
| Clicking | Server-authoritative strike batching, crits, combo chains, passive income, offline production, ×10 strike, animated particles and synthesized sound |
| Upgrades | 12 configuration-driven disciplines, geometric pricing, buy 1 / 10 / max, prerequisites, atomic bulk purchases |
| Progression | Rebirth → Prestige → Ascension tiers with explicit reset/preserve contracts, embers, sigils, echoes |
| Worlds | 10 unlockable worlds, per-world bonus, palette, pattern, egg and 6 pets each |
| Companions | 60 pet definitions, 8 rarities, golden/shiny variants, published odds totalling exactly 1000 parts, 20-hatch pity, equip/unequip/equip-best/favourite/fuse/release, search, filters, sorting |
| Quests | Daily, weekly and milestone objectives with server-tracked progress and claim-once rewards |
| Achievements | 27+ definitions, points, prism payouts, hidden record, permanent across resets |
| Daily | 7-day escalating calendar, server 20-hour clock, atomic claim |
| Events | Scheduled/live/ended events, multiplier applied server-side, participation goals, claimable rewards, announcements |
| Codes | Atomic redemption with global and per-account limits and unique constraints |
| Leaderboards | Seven metrics, pagination, search, personal rank, cached queries against indexed columns |
| Accounts | scrypt password hashing, hashed session tokens, HTTP-only cookies, ban enforcement, guest accounts that upgrade in place |
| Admin | 10 modules: overview KPIs + Recharts, player management, economy versioning/rollback, live events, pets & eggs inspector, codes, moderation centre, audit explorer + CSV, configuration/flags, command console |
| Security | RBAC with five staff roles, per-request permission checks, Zod validation, rate limits, row locks, atomic rewards, immutable audit log, no client-trusted amounts |

## Stack

- Next.js 16 App Router · React 19 · TypeScript (strict)
- Tailwind CSS 4 with a bespoke CSS design system
- Drizzle ORM + PostgreSQL (node-postgres pool)
- Zod for every request body
- Recharts for admin analytics, lucide-react for icons
- Vitest for the economy/configuration test suite

## Getting started

```bash
npm install
cp .env.example .env         # set DATABASE_URL
npx drizzle-kit push         # create tables
node scripts/seed.mjs        # idempotent demo data
npm run dev                  # http://localhost:3000
```

Production build:

```bash
npm run build
npm start
```

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string used by Drizzle and the seed script |
| `OWNER_EMAIL` | no | Email that receives the `owner` role on registration. If unset, the first registered account becomes owner. |
| `NODE_ENV` | no | Set to `production` for secure session cookies |

No secrets are exposed to the browser: only `NEXT_PUBLIC_*` variables would be, and none are used.

### Seeded accounts (development only)

| Account | Role |
| --- | --- |
| `owner@obsidia.gg` / `Obsidian#2026` | Owner — full ops console |
| `ops@obsidia.gg` / `Operations#2026` | Super Admin |
| `mod@obsidia.gg` / `Moderation#2026` | Moderator |
| `emberwright@obsidia.gg` / `Forge#2026` | Player |

These are demo credentials created by `scripts/seed.mjs`. Delete or rotate them before any public deployment.

## Architecture

```
src/
  app/                 routes: landing, login, register, play, admin, api/*
  components/          ui primitives, game shell + panels, admin console + modules
  db/                  drizzle schema + pooled client
  lib/                 content config, economy formulas, auth, api helpers, shared types
  server/              config service, game service, admin service (server-only)
scripts/seed.mjs       idempotent development seed
```

### Authoritative gameplay

- **Clicks are batched.** The client shows optimistic feedback and flushes validated clicks every ~2.4s
  (and on tab hide). The server recomputes allowed clicks from elapsed time × `maxClicksPerSecond`,
  rolls crits, applies combo, passive and event multipliers, then writes balances in one statement.
- **Rewards are atomic.** Upgrades, hatches, quest/daily/event claims, code redemptions and rebirths run in
  transactions with `SELECT … FOR UPDATE` row locks and unique constraints, so concurrent or repeated
  requests cannot double-claim.
- **Numbers are bounded.** Every mutation clamps to `0 … 1e18`; non-finite values are rejected. Prices and
  rewards are always recomputed from the configuration, never accepted from the client.
- **Offline production** is computed by the server on state load (capped hours × published offline rate).

### Admin operations

Every admin request re-authenticates the session, checks the ban state, then checks a granular permission
(`players.economy`, `moderation.write`, `config.write`, …). Role matrix lives in `src/lib/content.ts` and is
enforced in `src/server/admin-service.ts`. All economy-changing and destructive actions require a reason and
write an `audit_logs` row with administrator, target, before/after values and a request id. The audit table is
append-only from the dashboard — there is no delete or edit endpoint.

The console (`/admin` → Console) exposes `/help`, `/player`, `/give`, `/take`, `/setstat`, `/pet give`,
`/event start|stop`, `/announce`, `/ban`, `/unban`, `/logs`, `/config validate`. It calls the same service
layer as the buttons; no arbitrary SQL or JavaScript is executed.

### Tests

```bash
npx vitest run
```

The suite covers number formatting (including very large magnitudes), upgrade pricing and bulk purchasing,
derived stats, combo caps, rebirth thresholds and rewards, level curves, offline caps, daily streak clocks,
egg probability totals, weighted selection, pet power variants and content integrity (unique ids, valid
prerequisites, positive goals). The production TypeScript build is run separately via `tsc --noEmit` and
`next build` in CI/validation.

### Known limitations / next steps

- **Content definitions are code-configured.** Pets, eggs, quests and achievements are versioned TS config
  validated by the test suite; the admin “Pets & eggs” module inspects the live definitions and their
  published probabilities rather than mutating them at runtime. Editing those tables at runtime would need a
  definition table and cache invalidation — deliberately not faked.
- **No payment provider.** Prisms are earned only. No card data is collected and no revenue metrics are shown.
- **Trading** is flagged off and labelled as not shipped; there is no half-working trade screen.
- **Galaxy reset** is previewed in the rebirth module but not implemented as a fourth reset tier.
- **Playwright** is not installed in this environment; browser verification was done against the running
  production server, and the interactive flows are covered by the API/service design and manual checks.
- Rate limiting is in-process; for multi-instance deployments use Redis (or similar) for shared limits and
  event coordination. Event status is recomputed from timestamps on every read, so multiple instances agree
  without a scheduler.

## Deployment notes

1. Provision PostgreSQL and set `DATABASE_URL`.
2. Run `npx drizzle-kit push` (or generate SQL migrations with `drizzle-kit generate` for a reviewable flow).
3. Seed only in non-production environments.
4. Set `OWNER_EMAIL` to the address that should receive ownership, register it, then remove the variable.
5. Serve behind HTTPS so session cookies are marked `secure` (`NODE_ENV=production`).
