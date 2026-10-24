import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getAuthContext, isStaff } from "@/lib/auth";
import { AuthForm } from "@/components/AuthForm";
import { AuthFrame } from "@/components/AuthFrame";

export const metadata: Metadata = { title: "Sign in — OBSIDIA" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const ctx = await getAuthContext();
  if (ctx) redirect(isStaff(ctx.user.role) ? "/admin" : "/play");
  return (
    <AuthFrame
      title="Return to the forge."
      subtitle="Your sparks, companions, achievements and rank are stored against this session on our server. Nothing important lives in your browser."
    >
      <AuthForm mode="login" />
    </AuthFrame>
  );
}
