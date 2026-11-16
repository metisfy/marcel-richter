/**
 * Regeln des Kontaktformulars, die Browser und Server gleichermaßen prüfen.
 * Ohne `server-only`, weil das Formular (Client) sie ebenfalls braucht.
 */

export const CONTACT_TOPICS = ["project", "volleyball", "other"] as const;
export type ContactTopic = (typeof CONTACT_TOPICS)[number];

export const CONTACT_LIMITS = {
  nameMin: 2,
  name: 100,
  email: 200,
  messageMin: 10,
  message: 4000,
} as const;

export type ContactField = "name" | "email" | "topic" | "message";
export type ContactFieldError = "required" | "tooShort" | "tooLong" | "invalidEmail";

export type ContactInput = {
  name: string;
  email: string;
  topic: string;
  message: string;
};

// Bewusst schlicht: ein @, kein Leerzeichen, ein Punkt in der Domain.
// Ob es die Adresse gibt, zeigt erst die Antwort.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export function isContactTopic(value: string): value is ContactTopic {
  return (CONTACT_TOPICS as readonly string[]).includes(value);
}

/** Prüft die Eingaben und liefert je Feld höchstens einen Fehler. */
export function validateContact(input: ContactInput): Partial<Record<ContactField, ContactFieldError>> {
  const errors: Partial<Record<ContactField, ContactFieldError>> = {};
  const name = input.name.trim();
  const email = input.email.trim();
  const message = input.message.trim();

  if (!name) errors.name = "required";
  else if (name.length < CONTACT_LIMITS.nameMin) errors.name = "tooShort";
  else if (name.length > CONTACT_LIMITS.name) errors.name = "tooLong";

  if (!email) errors.email = "required";
  else if (email.length > CONTACT_LIMITS.email) errors.email = "tooLong";
  else if (!EMAIL_PATTERN.test(email)) errors.email = "invalidEmail";

  if (!isContactTopic(input.topic)) errors.topic = "required";

  if (!message) errors.message = "required";
  else if (message.length < CONTACT_LIMITS.messageMin) errors.message = "tooShort";
  else if (message.length > CONTACT_LIMITS.message) errors.message = "tooLong";

  return errors;
}

/** Antwort von POST /api/kontakt */
export type ContactResult =
  | { ok: true }
  | {
      ok: false;
      /**
       * invalid:     Eingaben fehlerhaft (siehe fields)
       * rate:        zu viele Nachrichten in kurzer Zeit
       * unavailable: Mailversand auf dem Server nicht eingerichtet
       * failed:      Mailserver hat die Nachricht nicht angenommen
       */
      reason: "invalid" | "rate" | "unavailable" | "failed";
      fields?: Partial<Record<ContactField, ContactFieldError>>;
    };
