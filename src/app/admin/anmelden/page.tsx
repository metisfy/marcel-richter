import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthFrame } from "@/components/admin/auth-frame";
import { LoginForm } from "@/components/admin/login-form";
import { adminPrefix, currentAdmin, safeTarget, setupComplete } from "@/lib/admin/guard";

export const metadata: Metadata = { title: "Anmelden" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ weiter?: string; bestehend?: string }> }) {
  const prefix = await adminPrefix();
  if (!setupComplete()) redirect(prefix || "/");
  if (await currentAdmin()) redirect(prefix || "/");
  const { weiter, bestehend } = await searchParams;

  return (
    <AuthFrame title="Anmelden" lead="Admin-Bereich von marcel-richter">
      {bestehend ? (
        <p role="status" className="mb-5 rounded-xl bg-win-soft px-4 py-3 text-[15px] font-medium text-win">
          Datenbank verbunden – dein bestehender Zugang ist wieder da. Bitte mit deinem bisherigen Passwort anmelden.
        </p>
      ) : null}
      <LoginForm target={safeTarget(weiter ?? "/")} />
    </AuthFrame>
  );
}
