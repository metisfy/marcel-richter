import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthFrame } from "@/components/admin/auth-frame";
import { SecondFactorForm } from "@/components/admin/login-form";
import { adminPrefix, safeTarget, setupComplete } from "@/lib/admin/guard";

export const metadata: Metadata = { title: "Zweiter Faktor" };

export default async function SecondFactorPage({ searchParams }: { searchParams: Promise<{ weiter?: string }> }) {
  const prefix = await adminPrefix();
  if (!setupComplete()) redirect(prefix || "/");
  const { weiter } = await searchParams;
  return (
    <AuthFrame title="Zweiter Faktor" lead="Bestätige die Anmeldung mit deinem Telefon">
      <SecondFactorForm target={safeTarget(weiter ?? "/")} />
      <a href={`${prefix}/anmelden`} className="mt-5 inline-block text-sm text-muted hover:text-fg">
        ← Zurück zur Anmeldung
      </a>
    </AuthFrame>
  );
}
