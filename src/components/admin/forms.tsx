"use client";

import { createContext, type FormEvent, type ReactNode, startTransition, useActionState, useContext, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

import type { FormState } from "@/app/admin/actions";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

/** Läuft gerade eine Aktion des umgebenden Formulars? (für SubmitButton) */
const PendingContext = createContext(false);

/**
 * Server-Aktion über onSubmit statt über das action-Attribut: React leert
 * Formulare nach einer Aktion sonst automatisch – nach einem Fehler wären alle
 * Eingaben weg (und Pflichtfelder blockierten das erneute Absenden still).
 */
export function useFormAction(action: Action) {
  const [state, dispatch, pending] = useActionState(action, {});
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const data = new FormData(event.currentTarget, submitter);
    startTransition(() => dispatch(data));
  };
  return { state, pending, onSubmit };
}

export function PendingScope({ pending, children }: { pending: boolean; children: ReactNode }) {
  return <PendingContext value={pending}>{children}</PendingContext>;
}

/**
 * Formular für eine Server-Aktion mit Rückmeldung (Fehler, Erfolg und – beim
 * zweiten Faktor – einmalig angezeigte Ersatzcodes). `resetOnSuccess` leert
 * es nach Erfolg (Passwortfelder).
 */
export function ActionForm({
  action,
  children,
  className = "grid gap-5",
  resetOnSuccess = false,
}: {
  action: Action;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const { state, pending, onSubmit } = useFormAction(action);
  return (
    <PendingScope pending={pending}>
      <form onSubmit={onSubmit} className={className} key={resetOnSuccess && state.success ? state.success : undefined}>
        {children}
        <FormMessage state={state} />
      </form>
    </PendingScope>
  );
}

export function FormMessage({ state }: { state: FormState }) {
  if (!state.error && !state.success) return null;
  return (
    <div role={state.error ? "alert" : "status"} className="grid gap-3">
      <p
        className={`rounded-xl px-4 py-3 text-[15px] font-medium ${state.error ? "bg-loss-soft text-loss" : "bg-win-soft text-win"}`}
      >
        {state.error ?? state.success}
      </p>
      {state.codes ? <BackupCodes codes={state.codes} /> : null}
    </div>
  );
}

function BackupCodes({ codes }: { codes: string[] }) {
  const [copied, setCopied] = useState(false);
  const [done, setDone] = useState(false);
  const router = useRouter();
  if (done) return null;
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-[15px] font-semibold">Ersatzcodes – jetzt sicher aufbewahren</p>
      <p className="mt-1 text-sm text-muted">
        Jeder Code gilt einmal, falls das Telefon nicht greifbar ist. Sie werden nur jetzt angezeigt.
      </p>
      <ul className="mt-3 grid grid-cols-2 gap-2 font-mono text-[15px] tabular-nums sm:grid-cols-4">
        {codes.map((code) => (
          <li key={code} className="rounded-lg border border-line bg-bg px-3 py-2 text-center">
            {code}
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="btn btn-ghost btn-nav mt-3"
        onClick={() => navigator.clipboard.writeText(codes.join("\n")).then(() => setCopied(true), () => {})}
      >
        {copied ? "Kopiert" : "Alle kopieren"}
      </button>
      <button
        type="button"
        className="btn btn-primary btn-nav mt-3 ml-2"
        onClick={() => {
          setDone(true);
          router.refresh();
        }}
      >
        Notiert
      </button>
    </div>
  );
}

export function SubmitButton({
  children,
  variant = "primary",
  name,
  value,
  pendingText = "Einen Moment …",
  small = false,
}: {
  children: ReactNode;
  variant?: "primary" | "ghost" | "danger";
  name?: string;
  value?: string;
  pendingText?: string;
  small?: boolean;
}) {
  const scoped = useContext(PendingContext);
  const status = useFormStatus();
  const pending = scoped || status.pending;
  const style = variant === "primary" ? "btn-primary" : variant === "danger" ? "btn-ghost text-loss" : "btn-ghost";
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={`btn ${style} ${small ? "btn-nav" : ""} disabled:opacity-70`}
    >
      {pending ? (
        <>
          <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
          {pendingText}
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function Field({
  label,
  name,
  type = "text",
  defaultValue,
  placeholder,
  autoComplete,
  hint,
  required = false,
  inputMode,
  autoFocus,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | number;
  placeholder?: string;
  autoComplete?: string;
  hint?: string;
  required?: boolean;
  inputMode?: "numeric" | "email" | "text";
  autoFocus?: boolean;
}) {
  const id = `feld-${name}`;
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        inputMode={inputMode}
        autoFocus={autoFocus}
        spellCheck={type === "email" ? false : undefined}
        autoCapitalize={type === "email" || type === "password" ? "none" : undefined}
        aria-describedby={hint ? `${id}-hinweis` : undefined}
        className="field"
      />
      {hint ? (
        <p id={`${id}-hinweis`} className="mt-2 text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Checkbox({ label, name, defaultChecked }: { label: string; name: string; defaultChecked?: boolean }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2.5 text-[15px]">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="size-4 accent-[var(--accent)]" />
      {label}
    </label>
  );
}

/** Knopf, der eine Server-Aktion ohne Formularfelder auslöst – optional mit Rückfrage. */
export function ActionButton({
  action,
  children,
  confirm,
  variant = "ghost",
}: {
  action: () => Promise<void>;
  children: ReactNode;
  confirm?: string;
  variant?: "primary" | "ghost" | "danger";
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
    >
      <SubmitButton variant={variant} small>
        {children}
      </SubmitButton>
    </form>
  );
}
