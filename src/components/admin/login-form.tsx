"use client";

import { login, verifySecondFactor } from "@/app/admin/actions";

import { ActionForm, Field, SubmitButton } from "./forms";

export function LoginForm({ target }: { target: string }) {
  return (
    <ActionForm action={login}>
      <input type="hidden" name="weiter" value={target} />
      <Field label="E-Mail-Adresse" name="email" type="email" autoComplete="username" required autoFocus />
      <Field label="Passwort" name="password" type="password" autoComplete="current-password" required />
      <SubmitButton pendingText="Prüfe …">Anmelden</SubmitButton>
    </ActionForm>
  );
}

export function SecondFactorForm({ target }: { target: string }) {
  return (
    <ActionForm action={verifySecondFactor}>
      <input type="hidden" name="weiter" value={target} />
      <Field
        label="Code aus der Authenticator-App"
        name="code"
        autoComplete="one-time-code"
        inputMode="text"
        placeholder="123 456"
        hint="Ohne Telefon: einen der Ersatzcodes (XXXX-XXXX) eingeben."
        required
        autoFocus
      />
      <SubmitButton pendingText="Prüfe …">Bestätigen</SubmitButton>
    </ActionForm>
  );
}
