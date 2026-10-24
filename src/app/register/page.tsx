import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getAuthContext, isStaff } from "@/lib/auth";
import { AuthForm } from "@/components/AuthForm";
import { AuthFrame } from "@/components/AuthFrame";

export const metadata: Metadata = { title: "Create account — OBSIDIA" };
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const ctx = await getAuthContext();
  if (ctx) redirect(isStaff(ctx.user.role) ? "/admin" : "/play");
  return (
    <AuthFrame
      title="Claim a forge."
      subtitle="One account, one ledger. If you started as a guest and you are still signed in, submitting this form upgrades that same forge — progress included — instead of creating a duplicate."
    >
      <AuthForm mode="register" />
    </AuthFrame>
  );
}
