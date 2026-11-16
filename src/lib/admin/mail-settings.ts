import "server-only";

import { decrypt, encrypt } from "./crypto";
import { database } from "./db";

/*
 * Mailversand fürs Kontaktformular, im Admin-Bereich eingerichtet und in der
 * Datenbank gespeichert (Passwort verschlüsselt mit dem App-Geheimnis).
 * Sind SMTP_* als Umgebungsvariablen gesetzt, haben diese Vorrang.
 */

export type SmtpSettings = {
  host: string;
  port: number;
  user?: string;
  password?: string;
  from: string;
  to?: string;
};

type SettingsDoc = {
  _id: string;
  host: string;
  port: number;
  user?: string;
  passwordEncrypted?: string;
  from: string;
  to?: string;
  changedAt: Date;
};

const DOC_ID = "mailversand";
const collection = async () => (await database()).collection<SettingsDoc>("einstellungen");

export async function storedMailSettings(): Promise<(Omit<SmtpSettings, "password"> & { passwordSet: boolean; changedAt: Date }) | null> {
  const doc = await (await collection()).findOne({ _id: DOC_ID });
  if (!doc) return null;
  return { host: doc.host, port: doc.port, user: doc.user, from: doc.from, to: doc.to, passwordSet: Boolean(doc.passwordEncrypted), changedAt: doc.changedAt };
}

/** Gespeicherte Einstellungen mit entschlüsseltem Passwort – nur für den Versand. */
export async function mailSettingsFromDatabase(): Promise<SmtpSettings | null> {
  const doc = await (await collection()).findOne({ _id: DOC_ID });
  if (!doc?.host || !doc.from) return null;
  const password = doc.passwordEncrypted ? decrypt(doc.passwordEncrypted) : undefined;
  if (password === null) return null;
  return { host: doc.host, port: doc.port, user: doc.user, password, from: doc.from, to: doc.to };
}

export async function saveMailSettings(input: SmtpSettings & { keepPassword: boolean }): Promise<void> {
  const coll = await collection();
  const before = await coll.findOne({ _id: DOC_ID });
  const passwordEncrypted = input.keepPassword ? before?.passwordEncrypted : input.password ? encrypt(input.password) : undefined;
  await coll.replaceOne(
    { _id: DOC_ID },
    {
      host: input.host.trim(),
      port: input.port,
      user: input.user?.trim() || undefined,
      passwordEncrypted,
      from: input.from.trim(),
      to: input.to?.trim() || undefined,
      changedAt: new Date(),
    },
    { upsert: true },
  );
}

export async function deleteMailSettings(): Promise<void> {
  await (await collection()).deleteOne({ _id: DOC_ID });
}
