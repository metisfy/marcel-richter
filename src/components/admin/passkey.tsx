"use client";

import { useState, useSyncExternalStore, useTransition } from "react";

import { type FormState, passkeyLoginFinish, passkeyLoginStart, passkeyRegistrationFinish, passkeyRegistrationStart } from "@/app/admin/actions";

import { FormMessage } from "./forms";
import { AdminIcon } from "./icons";

/*
 * Browserseite der Passkeys: Optionen vom Server in ArrayBuffer umrechnen,
 * navigator.credentials aufrufen, Antwort als JSON zurück. Keine
 * Sicherheitsentscheidung – die Prüfung liegt auf dem Server
 * (src/lib/admin/passkeys.ts).
 */

function toBuffer(b64url: string): ArrayBuffer {
  const padding = b64url.length % 4 ? "=".repeat(4 - (b64url.length % 4)) : "";
  const raw = atob(b64url.replace(/-/g, "+").replace(/_/g, "/") + padding);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0)).buffer;
}

function toText(buffer: ArrayBuffer): string {
  let bin = "";
  for (const byte of new Uint8Array(buffer)) bin += String.fromCharCode(byte);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

type CredentialRef = { id: string; type?: string; transports?: AuthenticatorTransport[] };

async function createPasskey(optionsJson: string): Promise<string> {
  const options = JSON.parse(optionsJson);
  const credential = (await navigator.credentials.create({
    publicKey: {
      ...options,
      challenge: toBuffer(options.challenge),
      user: { ...options.user, id: toBuffer(options.user.id) },
      excludeCredentials: (options.excludeCredentials ?? []).map((c: CredentialRef) => ({ ...c, id: toBuffer(c.id) })),
    },
  })) as PublicKeyCredential | null;
  if (!credential) throw new Error("Das Gerät hat keinen Passkey geliefert.");
  const response = credential.response as AuthenticatorAttestationResponse;
  return JSON.stringify({
    id: credential.id,
    rawId: toText(credential.rawId),
    type: credential.type,
    clientExtensionResults: credential.getClientExtensionResults(),
    response: {
      clientDataJSON: toText(response.clientDataJSON),
      attestationObject: toText(response.attestationObject),
      transports: response.getTransports?.() ?? [],
    },
  });
}

async function confirmPasskey(optionsJson: string): Promise<string> {
  const options = JSON.parse(optionsJson);
  const credential = (await navigator.credentials.get({
    publicKey: {
      ...options,
      challenge: toBuffer(options.challenge),
      allowCredentials: (options.allowCredentials ?? []).map((c: CredentialRef) => ({ ...c, id: toBuffer(c.id) })),
    },
  })) as PublicKeyCredential | null;
  if (!credential) throw new Error("Das Gerät hat nichts bestätigt.");
  const response = credential.response as AuthenticatorAssertionResponse;
  return JSON.stringify({
    id: credential.id,
    rawId: toText(credential.rawId),
    type: credential.type,
    clientExtensionResults: credential.getClientExtensionResults(),
    response: {
      clientDataJSON: toText(response.clientDataJSON),
      authenticatorData: toText(response.authenticatorData),
      signature: toText(response.signature),
      userHandle: response.userHandle ? toText(response.userHandle) : undefined,
    },
  });
}

function errorText(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError") return "Abgebrochen oder zu lange gewartet. Bitte noch einmal versuchen.";
  if (name === "InvalidStateError") return "Auf diesem Gerät ist für diesen Zugang schon ein Passkey hinterlegt.";
  if (name === "NotSupportedError" || name === "SecurityError") {
    return "Dieser Browser oder diese Adresse lässt keine Passkeys zu. Passkeys brauchen HTTPS mit Domain oder localhost.";
  }
  return error instanceof Error && error.message ? error.message : "Es hat nicht geklappt.";
}

const never = () => () => {};
function usePasskeySupport(): boolean {
  return useSyncExternalStore(never, () => typeof window !== "undefined" && Boolean(window.PublicKeyCredential), () => true);
}

/** Profil → Zweiter Faktor: neuen Passkey anlegen. */
export function AddPasskey() {
  const supported = usePasskeySupport();
  const [name, setName] = useState("");
  const [state, setState] = useState<FormState>({});
  const [pending, startTransition] = useTransition();

  const add = () =>
    startTransition(async () => {
      setState({});
      const start = await passkeyRegistrationStart();
      if (!start.options) return setState({ error: start.error ?? "Es hat nicht geklappt." });
      try {
        const response = await createPasskey(start.options);
        setState(await passkeyRegistrationFinish(response, name));
        setName("");
      } catch (error) {
        setState({ error: errorText(error) });
      }
    });

  if (!supported) return <p className="text-sm text-muted">Dieser Browser kann keine Passkeys.</p>;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <label htmlFor="passkey-name" className="field-label">
            Name für den neuen Passkey
          </label>
          <input
            id="passkey-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="z. B. iPhone, MacBook, YubiKey"
            maxLength={60}
            className="field"
          />
        </div>
        <button type="button" onClick={add} disabled={pending} className="btn btn-primary disabled:opacity-70">
          {pending ? (
            <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : (
            <AdminIcon name="shield" width={17} height={17} />
          )}
          Passkey hinzufügen
        </button>
      </div>
      <FormMessage state={state} />
    </div>
  );
}

/** Anmeldung → Zweiter Faktor: mit Passkey bestätigen. */
export function PasskeyLogin({ target }: { target: string }) {
  const supported = usePasskeySupport();
  const [state, setState] = useState<FormState>({});
  const [pending, startTransition] = useTransition();

  const confirm = () =>
    startTransition(async () => {
      setState({});
      const start = await passkeyLoginStart();
      if (!start.options) return setState({ error: start.error ?? "Es hat nicht geklappt." });
      try {
        const response = await confirmPasskey(start.options);
        // Bei Erfolg leitet die Aktion weiter; zurück kommt nur ein Fehler
        setState(await passkeyLoginFinish(response, target));
      } catch (error) {
        setState({ error: errorText(error) });
      }
    });

  if (!supported) return null;
  return (
    <div className="grid gap-3">
      <button type="button" onClick={confirm} disabled={pending} className="btn btn-primary w-full disabled:opacity-70">
        {pending ? (
          <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
        ) : (
          <AdminIcon name="shield" width={18} height={18} />
        )}
        Mit Passkey bestätigen
      </button>
      <FormMessage state={state} />
    </div>
  );
}
