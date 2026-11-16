import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthFrame } from "@/components/admin/auth-frame";
import { LoginForm } from "@/components/admin/login-form";
import { adminPrefix, currentAdmin, safeTarget, setupComplete } from "@/lib/admin/guard";

export const metadata: Metadata = { title: "Anmelden" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ weiter?: string }> }) {
  const prefix = await adminPrefix();
  if (!setupComplete()) redirect(prefix || "/");
  if (await currentAdmin()) redirect(prefix || "/");
  const { weiter } = await searchParams;

  return (
    <AuthFrame title="Anmelden" lead="Admin-Bereich von marcel-richter">
      <LoginForm target={safeTarget(weiter ?? "/")} />
    </AuthFrame>
  );
}
