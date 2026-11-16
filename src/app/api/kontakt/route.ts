import { hasLocale } from "next-intl";

import { routing } from "@/i18n/routing";
import { clientIp, mailConfig, sameOrigin, sendContactMail, takeContactSlot } from "@/lib/contact";
import { type ContactResult, isContactTopic, validateContact } from "@/lib/contact-shared";

/*
 * Kontaktformular (src/components/contact-form.tsx).
 *
 * GET  /api/kontakt → { available }  Ist der Mailversand eingerichtet?
 * POST /api/kontakt                  Nachricht zustellen
 *
 * POST nimmt JSON (Formular mit JavaScript) und klassische Formulardaten
 * (ohne JavaScript, Antwort dann als Weiterleitung zurück zur Seite).
 *
 * Schutz gegen Spam: verstecktes Feld „website“ (Honeypot), Mindest-
 * Ausfüllzeit, Herkunftsprüfung und eine Bremse je IP (src/lib/contact.ts).
 */

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };
const MAX_BODY = 20_000;
/** Schneller als 3 Sekunden füllt kein Mensch das Formular aus. */
const MIN_FILL_MS = 3_000;

export function GET() {
  return Response.json({ available: mailConfig() !== null }, { headers: NO_STORE });
}

type Payload = {
  name: string;
  email: string;
  topic: string;
  message: string;
  website: string;
  elapsed?: number;
  locale: string;
};

const text = (value: unknown) => (typeof value === "string" ? value : "");

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const isForm = contentType.includes("application/x-www-form-urlencoded");
  if (!isJson && !isForm) return Response.json({ ok: false, reason: "invalid" }, { status: 415, headers: NO_STORE });

  if (!sameOrigin(request.headers)) {
    return Response.json({ ok: false, reason: "invalid" }, { status: 403, headers: NO_STORE });
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY) return Response.json({ ok: false, reason: "invalid" }, { status: 413, headers: NO_STORE });

  let payload: Payload;
  try {
    if (isJson) {
      const body = JSON.parse(raw) as Record<string, unknown>;
      payload = {
        name: text(body.name),
        email: text(body.email),
        topic: text(body.topic),
        message: text(body.message),
        website: text(body.website),
        elapsed: typeof body.elapsed === "number" ? body.elapsed : undefined,
        locale: text(body.locale),
      };
    } else {
      const form = new URLSearchParams(raw);
      payload = {
        name: form.get("name") ?? "",
        email: form.get("email") ?? "",
        topic: form.get("topic") ?? "",
        message: form.get("message") ?? "",
        website: form.get("website") ?? "",
        locale: form.get("locale") ?? "",
      };
    }
  } catch {
    return Response.json({ ok: false, reason: "invalid" }, { status: 400, headers: NO_STORE });
  }

  const locale = hasLocale(routing.locales, payload.locale) ? payload.locale : routing.defaultLocale;
  const respond = (result: ContactResult, status: number) => {
    if (isJson) return Response.json(result, { status, headers: NO_STORE });
    // Ohne JavaScript: zurück zur Kontaktseite, die per #anker die Meldung zeigt
    const page = locale === "de" ? "/kontakt" : "/en/contact";
    return new Response(null, { status: 303, headers: { location: `${page}#${result.ok ? "gesendet" : "nicht-gesendet"}`, ...NO_STORE } });
  };

  // Bots füllen das versteckte Feld aus oder schicken sofort ab. Sie bekommen
  // eine normale Erfolgsmeldung, damit sie es nicht anders versuchen.
  if (payload.website.trim() !== "" || (payload.elapsed !== undefined && payload.elapsed < MIN_FILL_MS)) {
    console.info("[kontakt] Spam verworfen");
    return respond({ ok: true }, 200);
  }

  const fields = validateContact(payload);
  if (Object.keys(fields).length > 0 || !isContactTopic(payload.topic)) {
    return respond({ ok: false, reason: "invalid", fields }, 422);
  }

  const config = mailConfig();
  if (!config) {
    console.warn("[kontakt] Mailversand nicht eingerichtet (SMTP_HOST/SMTP_USER fehlen) – Nachricht nicht zugestellt");
    return respond({ ok: false, reason: "unavailable" }, 503);
  }

  if (!takeContactSlot(clientIp(request.headers))) {
    return respond({ ok: false, reason: "rate" }, 429);
  }

  try {
    await sendContactMail(config, {
      name: payload.name.trim(),
      email: payload.email.trim(),
      topic: payload.topic,
      message: payload.message,
      locale,
    });
  } catch (error) {
    // Nur die technische Ursache, keine Formularinhalte im Log.
    console.error(`[kontakt] Versand fehlgeschlagen: ${error instanceof Error ? error.message : "unbekannt"}`);
    return respond({ ok: false, reason: "failed" }, 502);
  }

  return respond({ ok: true }, 200);
}
