"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2, LockKeyhole } from "lucide-react";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (mode === "register" && !/^[A-Za-z0-9_]{3,16}$/.test(username)) {
      setError("Callsign must be 3–16 characters: letters, numbers or underscore.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "login" ? { email, password } : { email, password, username }),
      });
      const data = (await response.json()) as { error?: string; redirect?: string };
      if (!response.ok) throw new Error(data.error ?? "Request failed.");
      router.push(data.redirect ?? "/play");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {mode === "register" ? (
        <div>
          <label htmlFor="username" className="label">Callsign</label>
          <input
            id="username"
            className="field mt-1.5"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Emberwright"
            autoComplete="username"
            minLength={3}
            maxLength={16}
            required
            aria-describedby="username-help"
          />
          <p id="username-help" className="mt-1 text-[10.5px] text-[var(--dim)]">Public name on leaderboards. 3–16 characters, letters, numbers, underscore.</p>
        </div>
      ) : null}
      <div>
        <label htmlFor="email" className="label">Email</label>
        <input
          id="email"
          className="field mt-1.5"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@forge.gg"
          autoComplete="email"
          required
        />
      </div>
      <div>
        <label htmlFor="password" className="label">Password</label>
        <div className="relative mt-1.5">
          <input
            id="password"
            className="field pr-11"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={mode === "register" ? "At least 8 characters" : "Your password"}
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            minLength={8}
            required
          />
          <button
            type="button"
            className="btn btn-ghost btn-xs absolute right-1 top-1/2 -translate-y-1/2"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        {mode === "register" ? (
          <p className="mt-1 flex items-center gap-1 text-[10.5px] text-[var(--dim)]">
            <LockKeyhole size={10} /> Hashed with scrypt + per-user salt. Never stored in plain text.
          </p>
        ) : null}
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-[rgba(240,112,95,0.4)] bg-[rgba(240,112,95,0.09)] px-3 py-2 text-[12px] text-[#ffbcb0]" role="alert">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <button type="submit" className="btn btn-gold btn-block" disabled={busy}>
        {busy ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
        {busy ? "Working…" : mode === "login" ? "Enter the forge" : "Create account"}
      </button>

      <p className="text-center text-[12px] text-[var(--muted)]">
        {mode === "login" ? (
          <>
            New here?{" "}
            <Link href="/register" className="text-[var(--gold)] hover:underline">
              Claim a forge
            </Link>
          </>
        ) : (
          <>
            Already forging?{" "}
            <Link href="/login" className="text-[var(--gold)] hover:underline">
              Sign in
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
