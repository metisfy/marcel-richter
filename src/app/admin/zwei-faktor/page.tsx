import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthFrame } from "@/components/admin/auth-frame";
import { SecondFactorForm } from "@/components/admin/login-form";
import { PasskeyLogin } from "@/components/admin/passkey";
import { passkeysOf, passwordHashOf, totpSecretOf } from "@/lib/admin/accounts";
import { adminPrefix, readTwoFactorStep, safeTarget, setupComplete } from "@/lib/admin/guard";

export const metadata: Metadata = { title: "Zweiter Faktor" };

export default async function SecondFactorPage({ searchParams }: { searchParams: Promise<{ weiter?: string }> }) {
  const prefix = await adminPrefix();
  if (!setupComplete()) redirect(prefix || "/");
  const id = await readTwoFactorStep(passwordHashOf).catch(() => null);
  if (!id) redirect(`${prefix}/anmelden`);
  const [passkeys, totp] = await Promise.all([passkeysOf(id).catch(() => []), totpSecretOf(id).catch(() => null)]);
  const target = safeTarget((await searchParams).weiter ?? "/");

  return (
    <AuthFrame title="Zweiter Faktor" lead="Bestätige, dass du es bist">
      <div className="grid gap-6">
        {passkeys.length ? <PasskeyLogin target={target} /> : null}
        {passkeys.length ? (
          <p className="flex items-center gap-3 text-xs text-muted uppercase before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
            {totp?.active ? "oder Code" : "oder Ersatzcode"}
          </p>
        ) : null}
        <SecondFactorForm target={target} withApp={Boolean(totp?.active)} />
      </div>
      <a href={`${prefix}/anmelden`} className="mt-5 inline-block text-sm text-muted hover:text-fg">
        ← Zurück zur Anmeldung
      </a>
    </AuthFrame>
  );
}
