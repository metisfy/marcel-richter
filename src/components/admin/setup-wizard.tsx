"use client";

import { useState } from "react";

import { setupAdmin, setupDatabase } from "@/app/admin/actions";

import { Checkbox, Field, FormMessage, PendingScope, SubmitButton, useFormAction } from "./forms";

/**
 * Der einmalige Einrichtungsassistent (wie bei t-orga):
 *   0. Einrichtungsschlüssel – steht am Ende von start.sh und im Container-Log
 *   1. MongoDB verbinden (prüfen, dann speichern)
 *   2. Eigenen Zugang anlegen – danach ist man angemeldet und der Assistent
 *      verschließt sich für immer (Markierung auf dem Volume).
 */
export function SetupWizard({
  step,
  persistent,
  defaults,
}: {
  step: 1 | 2;
  persistent: boolean | null;
  defaults: { name: string; email: string };
}) {
  const [key, setKey] = useState("");
  const db = useFormAction(setupDatabase);
  const account = useFormAction(setupAdmin);

  const steps = ["Datenbank verbinden", "Zugang anlegen"];

  return (
    <div className="mx-auto w-full max-w-2xl">
      <p className="eyebrow">Einmalige Einrichtung</p>
      <h1 className="mt-3 text-[clamp(1.75rem,1.3rem+1.6vw,2.5rem)] leading-tight font-semibold tracking-[-0.02em]">
        Admin-Bereich einrichten
      </h1>
      <p className="mt-3 text-muted">
        Zwei Schritte, danach ist dieser Assistent für immer zu. Zugangsdaten landen verschlüsselt auf dem Volume des Servers –
        nie im Code oder Image.
      </p>

      <ol className="mt-8 grid grid-cols-2 gap-3">
        {steps.map((label, index) => {
          const number = index + 1;
          const state = number < step ? "done" : number === step ? "current" : "open";
          return (
            <li
              key={label}
              aria-current={state === "current" ? "step" : undefined}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-[15px] font-medium ${
                state === "current" ? "border-accent bg-accent-soft text-accent" : "border-line text-muted"
              }`}
            >
              <span
                className={`grid size-7 shrink-0 place-items-center rounded-full font-mono text-[13px] ${
                  state === "done" ? "bg-win-soft text-win" : state === "current" ? "bg-accent text-white" : "bg-surface"
                }`}
              >
                {state === "done" ? "✓" : number}
              </span>
              {label}
            </li>
          );
        })}
      </ol>

      {persistent === false ? (
        <p role="alert" className="mt-6 rounded-xl bg-loss-soft px-4 py-3 text-[15px] font-medium text-loss">
          Achtung: /app/data liegt nicht auf einem Volume. Die Einrichtung wäre beim nächsten Deployment weg. Bitte zuerst die
          aktuelle docker-compose.yml und start.sh auf den Server legen und ./start.sh ausführen.
        </p>
      ) : null}

      <section className="card mt-6 p-6 shadow-soft sm:p-8">
        <label htmlFor="schluessel" className="field-label">
          Einrichtungsschlüssel
        </label>
        <input
          id="schluessel"
          value={key}
          onChange={(event) => setKey(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder="xxxx-xxxx-xxxx-xxxx"
          className="field font-mono"
          aria-describedby="schluessel-hinweis"
        />
        <p id="schluessel-hinweis" className="mt-2 text-sm text-muted">
          Steht am Ende von <code className="font-mono">./start.sh</code> und im Protokoll:{" "}
          <code className="font-mono">docker logs marcel-richter</code>
        </p>

        <hr className="my-7 border-line" />

        {step === 1 ? (
          <PendingScope pending={db.pending}>
            <form key="datenbank" onSubmit={db.onSubmit} className="grid gap-5">
              <input type="hidden" name="schluessel" value={key} />
              <div>
                <h2 className="text-lg font-semibold">1. MongoDB verbinden</h2>
                <p className="mt-1 text-[15px] text-muted">
                  Eine eigene Datenbank für die Website (z. B. <code className="font-mono">marcel_richter</code>) mit einem
                  Benutzer, der darin lesen und schreiben darf.
                </p>
              </div>
              <div className="grid gap-5 sm:grid-cols-[1fr_120px]">
                <Field label="Server" name="host" placeholder="10.250.1.20 oder mongo.example.com" required />
                <Field label="Port" name="port" defaultValue={27017} inputMode="numeric" />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Benutzer" name="user" autoComplete="off" />
                <Field label="Passwort" name="password" type="password" autoComplete="new-password" />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Datenbank" name="database" defaultValue="marcel_richter" required />
                <Field label="Auth-Datenbank" name="authSource" placeholder="admin" hint="Leer lassen = Standard des Servers" />
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                <Checkbox label="TLS verwenden" name="tls" />
                <Checkbox label="SRV-Adresse (mongodb+srv, z. B. Atlas)" name="srv" />
              </div>
              <div className="flex flex-wrap gap-3">
                <SubmitButton name="intent" value="save">
                  Speichern und weiter
                </SubmitButton>
                <SubmitButton name="intent" value="test" variant="ghost">
                  Nur prüfen
                </SubmitButton>
              </div>
              <FormMessage state={db.state} />
            </form>
          </PendingScope>
        ) : (
          <PendingScope pending={account.pending}>
            <form key="zugang" onSubmit={account.onSubmit} className="grid gap-5">
              <input type="hidden" name="schluessel" value={key} />
              <div>
                <h2 className="text-lg font-semibold">2. Deinen Zugang anlegen</h2>
                <p className="mt-1 text-[15px] text-muted">
                  Mindestens 12 Zeichen, Groß- und Kleinbuchstaben und eine Ziffer. Einen zweiten Faktor kannst du danach unter
                  Einstellungen einschalten.
                </p>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Name" name="name" defaultValue={defaults.name} autoComplete="name" required />
                <Field
                  label="E-Mail-Adresse"
                  name="email"
                  type="email"
                  defaultValue={defaults.email}
                  autoComplete="username"
                  required
                />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Passwort" name="password" type="password" autoComplete="new-password" required />
                <Field label="Passwort wiederholen" name="repeat" type="password" autoComplete="new-password" required />
              </div>
              <div>
                <SubmitButton>Zugang anlegen und anmelden</SubmitButton>
              </div>
              <FormMessage state={account.state} />
            </form>
          </PendingScope>
        )}
      </section>
    </div>
  );
}
