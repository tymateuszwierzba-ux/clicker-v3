import Image from "next/image";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { RARITIES, WORLDS } from "@/lib/content";
import { SparkMark } from "@/components/ui/art";

export function AuthFrame({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle: string }) {
  return (
    <main className="mx-auto grid min-h-screen w-full max-w-6xl items-center gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_0.95fr]">
      <div className="order-2 lg:order-1">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-[rgba(233,182,98,0.4)] bg-[rgba(233,182,98,0.12)]">
            <SparkMark size={17} color="var(--gold-bright)" />
          </span>
          <span className="leading-tight">
            <span className="block font-[var(--serif)] text-[17px] tracking-[0.18em]">OBSIDIA</span>
            <span className="block text-[9px] uppercase tracking-[0.3em] text-[var(--dim)]">The Infinite Forge</span>
          </span>
        </Link>
        <div className="panel mt-6 p-6 sm:p-7">
          <p className="eyebrow">Access the mechanism</p>
          <h1 className="mt-2 text-3xl">{title}</h1>
          <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--muted)]">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
        <div className="mt-4 rounded-xl border border-[var(--line)] bg-[rgba(255,246,230,0.02)] p-3">
          <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-[var(--dim)]">
            <Sparkles size={11} className="text-[var(--gold)]" /> Sandbox operator access
          </p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--muted)]">
            Seeded operator: <span className="numeric text-[var(--gold-bright)]">owner@obsidia.gg</span> ·{" "}
            <span className="numeric text-[var(--gold-bright)]">Obsidian#2026</span>. Use it to review the full admin console. Change it in
            production.
          </p>
        </div>
        <Link href="/" className="btn btn-ghost btn-sm mt-4">
          ← Back to overview
        </Link>
      </div>

      <div className="order-1 hidden lg:order-2 lg:block">
        <div className="relative overflow-hidden rounded-[22px] border border-[rgba(233,182,98,0.22)]">
          <Image src="/images/forge-hero.jpg" alt="The Infinite Forge" width={900} height={1100} className="h-[460px] w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[rgba(7,6,10,0.96)] via-[rgba(7,6,10,0.2)] to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-5">
            <p className="eyebrow">Season one · live ledger</p>
            <p className="mt-1 font-[var(--serif)] text-2xl">Ten worlds are already warm.</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {WORLDS.slice(0, 6).map((world) => (
                <span
                  key={world.id}
                  className="rounded-full border px-2 py-0.5 text-[10px]"
                  style={{ borderColor: `${world.accent}55`, color: world.accent }}
                >
                  {world.name}
                </span>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {RARITIES.slice(-4).map((rarity) => (
                <span key={rarity.id} className="chip" style={{ borderColor: `${rarity.color}55`, color: rarity.color }}>
                  {rarity.label} ×{rarity.multiplier}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
