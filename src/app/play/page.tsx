import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";
import { getAuthContext, isBanActive } from "@/lib/auth";
import { getGameState } from "@/server/game-service";
import { GameClient } from "@/components/game/GameClient";

export const metadata: Metadata = { title: "The forge — OBSIDIA" };
export const dynamic = "force-dynamic";

export default async function PlayPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");

  if (isBanActive(ctx.user)) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full border border-[rgba(240,112,95,0.4)] bg-[rgba(240,112,95,0.1)]">
          <AlertTriangle size={22} className="text-[var(--danger)]" />
        </span>
        <h1 className="text-3xl">Forge access suspended</h1>
        <p className="text-[13px] text-[var(--muted)]">
          {ctx.user.banReason ?? "This account has been suspended by the operations team."}
          {ctx.user.bannedUntil ? ` Suspension lifts ${ctx.user.bannedUntil.toLocaleString()}.` : " This suspension is permanent."}
        </p>
        <Link href="/" className="btn btn-sm">Return to overview</Link>
      </main>
    );
  }

  try {
    const state = await getGameState(ctx);
    return <GameClient initialState={state} />;
  } catch (error) {
    console.error("[play] failed to load state", error);
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full border border-[rgba(233,182,98,0.4)] bg-[rgba(233,182,98,0.1)]">
          <AlertTriangle size={22} className="text-[var(--gold)]" />
        </span>
        <h1 className="text-3xl">The forge is not responding</h1>
        <p className="text-[13px] text-[var(--muted)]">
          We could not load your authoritative state from PostgreSQL. Your progress is safe. Try again in a moment.
        </p>
        <div className="flex gap-2">
          <Link href="/play" className="btn btn-sm btn-gold">Retry</Link>
          <Link href="/" className="btn btn-sm">Overview</Link>
        </div>
      </main>
    );
  }
}
