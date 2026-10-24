import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";
import { getAuthContext, hasPermission } from "@/lib/auth";
import { getAdminSnapshot } from "@/server/admin-service";
import { AdminClient } from "@/components/admin/AdminClient";

export const metadata: Metadata = { title: "Operations console — OBSIDIA" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (!hasPermission(ctx.user.role, "overview.read")) redirect("/play");

  try {
    const snapshot = await getAdminSnapshot(ctx, { page: 1 });
    return <AdminClient initialSnapshot={snapshot} />;
  } catch (error) {
    console.error("[admin] snapshot failed", error);
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full border border-[rgba(240,112,95,0.4)] bg-[rgba(240,112,95,0.1)]">
          <AlertTriangle size={22} className="text-[var(--danger)]" />
        </span>
        <h1 className="text-2xl">Console data unavailable</h1>
        <p className="text-[13px] text-[var(--muted)]">The operations snapshot failed to load. Reload to try again; no partially applied changes were made.</p>
        <a href="/admin" className="btn btn-sm btn-gold">Reload console</a>
      </main>
    );
  }
}
