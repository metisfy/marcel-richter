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

export function SecondFactorForm({ target, withApp }: { target: string; withApp: boolean }) {
  return (
    <ActionForm action={verifySecondFactor}>
      <input type="hidden" name="weiter" value={target} />
      <Field
        label={withApp ? "Code aus der Authenticator-App" : "Ersatzcode"}
        name="code"
        autoComplete="one-time-code"
        inputMode="text"
        placeholder={withApp ? "123 456" : "XXXX-XXXX"}
        hint={withApp ? "Ohne Telefon: einen der Ersatzcodes (XXXX-XXXX) eingeben." : "Nur falls der Passkey gerade nicht greifbar ist."}
        required
        autoFocus={withApp}
      />
      <SubmitButton variant={withApp ? "primary" : "ghost"} pendingText="Prüfe …">
        Bestätigen
      </SubmitButton>
    </ActionForm>
  );
}
