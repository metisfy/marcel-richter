"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";

import { Link } from "@/i18n/navigation";
import {
  CONTACT_LIMITS,
  CONTACT_TOPICS,
  type ContactField,
  type ContactFieldError,
  type ContactInput,
  type ContactResult,
  validateContact,
} from "@/lib/contact-shared";

import { ArrowRightIcon, CheckIcon, MailIcon } from "./icons";

type Errors = Partial<Record<ContactField, ContactFieldError>>;
type Problem = "unavailable" | "failed" | "rate" | "network";
type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent"; name: string; email: string }
  | { kind: "problem"; problem: Problem }
  | { kind: "mailto" };

const EMPTY: ContactInput = { name: "", email: "", topic: "", message: "" };
const FIELD_ORDER: ContactField[] = ["name", "email", "topic", "message"];

/**
 * Kontaktformular: prüft schon im Browser, schickt an /api/kontakt und sagt
 * ehrlich, ob die Nachricht angekommen ist. Ist der Mailversand auf dem
 * Server nicht eingerichtet oder schlägt er fehl, öffnet es die fertige
 * Nachricht im E-Mail-Programm – nichts geht verloren.
 *
 * Ohne JavaScript schickt das Formular klassisch an /api/kontakt, die Antwort
 * leitet mit #gesendet bzw. #nicht-gesendet zurück (Meldungen per :target).
 */
export function ContactForm({ email, locale }: { email: string; locale: string }) {
  const t = useTranslations("contact.form");
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const startedAt = useRef(0);
  const [values, setValues] = useState<ContactInput>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState<Partial<Record<ContactField, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [available, setAvailable] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);
  const sentHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    startedAt.current = Date.now();
    let cancelled = false;
    fetch("/api/kontakt", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { available?: boolean } | null) => {
        if (!cancelled && typeof data?.available === "boolean") setAvailable(data.available);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (status.kind === "sent") sentHeading.current?.focus();
  }, [status.kind]);

  const fieldId = (field: ContactField) => `${id}-${field}`;
  const errorId = (field: ContactField) => `${id}-${field}-fehler`;

  const errorText = (field: ContactField, error: ContactFieldError) =>
    t(`errors.${field}.${error}` as Parameters<typeof t>[0], {
      max: field === "name" ? CONTACT_LIMITS.name : field === "email" ? CONTACT_LIMITS.email : CONTACT_LIMITS.message,
      min: CONTACT_LIMITS.messageMin,
    });

  const update = (field: ContactField, value: string) => {
    const next = { ...values, [field]: value };
    setValues(next);
    if (status.kind === "problem" || status.kind === "mailto") setStatus({ kind: "idle" });
    // Nach dem ersten Absenden bzw. Verlassen des Felds sofort neu prüfen
    if (submitted || touched[field]) setErrors((current) => ({ ...current, [field]: validateContact(next)[field] }));
  };

  const blur = (field: ContactField) => {
    if (!values[field].trim() && !submitted) return;
    setTouched((current) => ({ ...current, [field]: true }));
    setErrors((current) => ({ ...current, [field]: validateContact(values)[field] }));
  };

  const topicLabel = (topic: string) =>
    (CONTACT_TOPICS as readonly string[]).includes(topic) ? t(`topics.${topic}` as Parameters<typeof t>[0]) : "";

  const mailText = () => `${values.message.trim()}\n\n${values.name.trim()}\n${values.email.trim()}`;
  const mailHref = () =>
    `mailto:${email}?subject=${encodeURIComponent(t("mailSubject", { topic: topicLabel(values.topic) }))}&body=${encodeURIComponent(mailText())}`;

  const openMail = () => {
    window.location.href = mailHref();
    setStatus({ kind: "mailto" });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(mailText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Zwischenablage gesperrt: Text bleibt im Formular stehen
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status.kind === "sending") return;
    setSubmitted(true);

    const found = validateContact(values);
    setErrors(found);
    const first = FIELD_ORDER.find((field) => found[field]);
    if (first) {
      const target =
        first === "topic"
          ? formRef.current?.querySelector<HTMLInputElement>('input[name="topic"]')
          : document.getElementById(fieldId(first));
      target?.focus();
      return;
    }

    if (available === false) {
      openMail();
      return;
    }

    setStatus({ kind: "sending" });
    const honeypot = (formRef.current?.elements.namedItem("website") as HTMLInputElement | null)?.value ?? "";
    try {
      const response = await fetch("/api/kontakt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...values, website: honeypot, elapsed: Date.now() - startedAt.current, locale }),
      });
      const result = (await response.json().catch(() => null)) as ContactResult | null;
      if (result?.ok) {
        setStatus({ kind: "sent", name: values.name.trim(), email: values.email.trim() });
        setValues(EMPTY);
        setErrors({});
        setTouched({});
        setSubmitted(false);
        return;
      }
      if (result?.reason === "invalid" && result.fields && Object.keys(result.fields).length > 0) {
        setErrors(result.fields);
        setStatus({ kind: "idle" });
        return;
      }
      if (result?.reason === "unavailable") setAvailable(false);
      const problem: Problem =
        result?.reason === "unavailable" || result?.reason === "rate" ? result.reason : "failed";
      setStatus({ kind: "problem", problem });
    } catch {
      setStatus({ kind: "problem", problem: "network" });
    }
  };

  if (status.kind === "sent") {
    return (
      <div role="status" className="py-6 text-center sm:py-10">
        <span aria-hidden="true" className="mx-auto grid size-14 place-items-center rounded-full bg-win-soft text-win">
          <CheckIcon width={26} height={26} strokeWidth={2.5} />
        </span>
        <h3 ref={sentHeading} tabIndex={-1} className="mt-5 text-2xl font-semibold tracking-[-0.01em] focus:outline-none">
          {t("sentTitle", { name: status.name })}
        </h3>
        <p className="mx-auto mt-2 max-w-md text-pretty text-muted">{t("sentText", { email: status.email })}</p>
        <button type="button" className="btn btn-ghost mt-7" onClick={() => setStatus({ kind: "idle" })}>
          {t("sentAgain")}
        </button>
      </div>
    );
  }

  const sending = status.kind === "sending";
  const mailMode = available === false;
  const errorCount = FIELD_ORDER.filter((field) => errors[field]).length;
  const messageLength = values.message.trim().length;

  const fieldError = (field: ContactField) =>
    errors[field] ? (
      <p id={errorId(field)} className="mt-2 text-sm font-medium text-loss">
        {errorText(field, errors[field])}
      </p>
    ) : null;

  return (
    <form
      ref={formRef}
      action="/api/kontakt"
      method="post"
      noValidate
      onSubmit={submit}
      className="grid gap-6"
    >
      {/* Rückmeldung für Besucher ohne JavaScript (Weiterleitung mit #anker) */}
      <p id="gesendet" className="hidden rounded-xl bg-win-soft px-4 py-3 font-medium text-win target:block">
        {t("sentNoJs")}
      </p>
      <p id="nicht-gesendet" className="hidden rounded-xl bg-loss-soft px-4 py-3 font-medium text-loss target:block">
        {t("failedNoJs")}{" "}
        <a href={`mailto:${email}`} className="underline underline-offset-2">
          {email}
        </a>
      </p>

      <input type="hidden" name="locale" value={locale} />

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor={fieldId("name")} className="field-label">
            {t("name")}
          </label>
          <input
            id={fieldId("name")}
            name="name"
            type="text"
            autoComplete="name"
            required
            maxLength={CONTACT_LIMITS.name}
            placeholder={t("namePlaceholder")}
            value={values.name}
            onChange={(event) => update("name", event.target.value)}
            onBlur={() => blur("name")}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? errorId("name") : undefined}
            className="field"
          />
          {fieldError("name")}
        </div>
        <div>
          <label htmlFor={fieldId("email")} className="field-label">
            {t("email")}
          </label>
          <input
            id={fieldId("email")}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            maxLength={CONTACT_LIMITS.email}
            placeholder={t("emailPlaceholder")}
            value={values.email}
            onChange={(event) => update("email", event.target.value)}
            onBlur={() => blur("email")}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? errorId("email") : `${id}-email-hinweis`}
            className="field"
          />
          {fieldError("email") ?? (
            <p id={`${id}-email-hinweis`} className="mt-2 text-sm text-muted">
              {t("emailHint")}
            </p>
          )}
        </div>
      </div>

      <fieldset aria-describedby={errors.topic ? errorId("topic") : undefined}>
        <legend className="field-label">{t("topic")}</legend>
        <div className="flex flex-wrap gap-2.5">
          {CONTACT_TOPICS.map((topic) => (
            <label
              key={topic}
              className="group inline-flex cursor-pointer items-center gap-2.5 rounded-full border border-line bg-bg py-2 pr-4 pl-3 text-[14.5px] font-medium transition-colors select-none hover:bg-surface has-checked:border-accent has-checked:bg-accent-soft has-checked:text-accent has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent-bright"
            >
              <input
                type="radio"
                name="topic"
                value={topic}
                required
                checked={values.topic === topic}
                onChange={(event) => update("topic", event.target.value)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className="size-4 rounded-full border-2 border-line transition-colors group-has-checked:border-accent group-has-checked:bg-accent group-has-checked:shadow-[inset_0_0_0_2px_var(--accent-soft)]"
              />
              {t(`topics.${topic}`)}
            </label>
          ))}
        </div>
        {fieldError("topic")}
      </fieldset>

      <div>
        <div className="flex items-baseline justify-between gap-4">
          <label htmlFor={fieldId("message")} className="field-label">
            {t("message")}
          </label>
          <span
            aria-hidden="true"
            className={`font-mono text-[11.5px] tabular-nums ${messageLength > CONTACT_LIMITS.message ? "text-loss" : "text-muted"}`}
          >
            {t("count", { count: messageLength, max: CONTACT_LIMITS.message })}
          </span>
        </div>
        <textarea
          id={fieldId("message")}
          name="message"
          rows={7}
          required
          maxLength={CONTACT_LIMITS.message + 200}
          placeholder={t("messagePlaceholder")}
          value={values.message}
          onChange={(event) => update("message", event.target.value)}
          onBlur={() => blur("message")}
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={errors.message ? errorId("message") : undefined}
          className="field min-h-40 resize-y"
        />
        {fieldError("message")}
      </div>

      {/* Honeypot: für Menschen unsichtbar, Bots füllen es aus */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor={`${id}-website`}>Website</label>
        <input id={`${id}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      {status.kind === "problem" ? (
        <div role="alert" className="rounded-xl border border-loss/30 bg-loss-soft p-4 sm:p-5">
          <p className="font-semibold text-loss">{t(`${status.problem}Title`)}</p>
          <p className="mt-1 text-[15px] text-fg/80">{t(`${status.problem}Text`)}</p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            {status.problem === "failed" || status.problem === "network" ? (
              <button type="submit" className="btn btn-primary btn-nav">
                {t("retry")}
              </button>
            ) : null}
            <button type="button" onClick={openMail} className="btn btn-ghost btn-nav">
              <MailIcon width={16} height={16} />
              {t("openMail")}
            </button>
            <button type="button" onClick={copy} className="btn btn-ghost btn-nav">
              {copied ? t("copied") : t("copy")}
            </button>
          </div>
        </div>
      ) : null}

      {status.kind === "mailto" ? (
        <div role="status" className="rounded-xl border border-line bg-surface p-4 text-[15px] sm:p-5">
          <p>{t("mailOpened", { email })}</p>
          <div className="mt-3 flex flex-wrap gap-2.5">
            <a href={mailHref()} className="btn btn-ghost btn-nav">
              <MailIcon width={16} height={16} />
              {t("openMail")}
            </a>
            <button type="button" onClick={copy} className="btn btn-ghost btn-nav">
              {copied ? t("copied") : t("copy")}
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2 sm:order-last sm:items-end">
          <button type="submit" disabled={sending} aria-disabled={sending} className="btn btn-primary shrink-0 disabled:opacity-70">
            {sending ? (
              <>
                <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                {t("sending")}
              </>
            ) : (
              <>
                {mailMode ? t("submitMail") : t("submit")}
                <ArrowRightIcon width={17} height={17} />
              </>
            )}
          </button>
          {submitted && errorCount > 0 ? (
            <p role="alert" className="text-sm font-medium text-loss sm:max-w-60 sm:text-right">
              {t("summary")}
            </p>
          ) : mailMode && status.kind !== "mailto" ? (
            <p className="text-sm text-muted sm:max-w-64 sm:text-right">{t("mailModeNote")}</p>
          ) : null}
        </div>
        <p className="max-w-sm text-sm text-pretty text-muted sm:pt-1.5">
          {t.rich("privacy", {
            link: (chunks) => (
              <Link href="/datenschutz" className="text-accent underline-offset-2 hover:underline">
                {chunks}
              </Link>
            ),
          })}
        </p>
      </div>
    </form>
  );
}
