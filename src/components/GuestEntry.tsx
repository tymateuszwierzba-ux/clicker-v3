"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";

export function GuestEntry({ className = "btn btn-gold", label = "Enter as guest" }: { className?: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/guest", { method: "POST" });
      const data = (await response.json()) as { error?: string; redirect?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not start a guest forge.");
      router.push(data.redirect ?? "/play");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <button type="button" className={className} onClick={start} disabled={busy}>
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
        {busy ? "Lighting the forge…" : label}
      </button>
      {error ? (
        <span className="text-[11px] text-[var(--danger)]" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
