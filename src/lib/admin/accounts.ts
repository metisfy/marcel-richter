import "server-only";

import { ObjectId } from "mongodb";

import { burnPasswordCheck, decrypt, encrypt, hashPassword, verifyPassword } from "./crypto";
import { database } from "./db";
import type { StoredPasskey } from "./passkeys";

/*
 * Admin-Zugänge in der Sammlung `admins`. Passwörter nur als scrypt-Hash,
 * der TOTP-Schlüssel verschlüsselt, Ersatzcodes nur als Hash, von Passkeys
 * nur der öffentliche Schlüssel.
 */

type AdminDoc = {
  _id: ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  active: boolean;
  /** Steigt bei Passwortwechsel und „überall abmelden“ – ältere Sitzungen gelten dann nicht mehr. */
  gen: number;
  createdAt: Date;
  lastLoginAt?: Date;
  totpSecret?: string;
  totpPending?: string;
  totpSince?: Date;
  backupCodes?: string[];
  passkeys?: StoredPasskey[];
};

export type PasskeyInfo = { id: string; name: string; createdAt: Date; lastUsedAt?: Date };

export type Admin = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  gen: number;
  createdAt: Date;
  lastLoginAt?: Date;
  /** Irgendein zweiter Faktor aktiv (App oder Passkey) */
  twoFactor: boolean;
  /** Authenticator-App aktiv */
  totp: boolean;
  totpSince?: Date;
  passkeys: PasskeyInfo[];
  backupCodesLeft: number;
};

export class AccountError extends Error {}

const collection = async () => (await database()).collection<AdminDoc>("admins");

const toAdmin = (doc: AdminDoc): Admin => ({
  id: doc._id.toHexString(),
  name: doc.name,
  email: doc.email,
  active: doc.active,
  gen: doc.gen ?? 0,
  createdAt: doc.createdAt,
  lastLoginAt: doc.lastLoginAt,
  twoFactor: Boolean(doc.totpSecret) || (doc.passkeys?.length ?? 0) > 0,
  totp: Boolean(doc.totpSecret),
  totpSince: doc.totpSince,
  passkeys: (doc.passkeys ?? []).map(({ id, name, createdAt, lastUsedAt }) => ({ id, name, createdAt, lastUsedAt })),
  backupCodesLeft: doc.backupCodes?.length ?? 0,
});

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export const emailValid = (email: string) => /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email) && email.length <= 200;

function objectId(id: string): ObjectId | null {
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}

export async function countAdmins(): Promise<number> {
  return (await collection()).countDocuments();
}

export async function createAdmin(input: { name: string; email: string; password: string }): Promise<Admin> {
  const name = input.name.trim();
  const email = normalizeEmail(input.email);
  if (!name) throw new AccountError("Bitte einen Namen angeben.");
  if (!emailValid(email)) throw new AccountError("Bitte eine gültige E-Mail-Adresse angeben.");
  const doc: Omit<AdminDoc, "_id"> = { name, email, passwordHash: hashPassword(input.password), active: true, gen: 0, createdAt: new Date() };
  try {
    const result = await (await collection()).insertOne(doc as AdminDoc);
    return toAdmin({ ...doc, _id: result.insertedId });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) throw new AccountError("Für diese E-Mail-Adresse gibt es schon einen Zugang.");
    throw error;
  }
}

export async function adminById(id: string): Promise<Admin | null> {
  const _id = objectId(id);
  if (!_id) return null;
  const doc = await (await collection()).findOne({ _id });
  return doc ? toAdmin(doc) : null;
}

/** E-Mail + Passwort prüfen. Unbekannte Adressen kosten gleich viel Zeit. */
export async function authenticate(email: string, password: string): Promise<Admin | null> {
  const doc = await (await collection()).findOne({ email: normalizeEmail(email) });
  if (!doc) {
    burnPasswordCheck(password);
    return null;
  }
  if (!verifyPassword(password, doc.passwordHash) || !doc.active) return null;
  return toAdmin(doc);
}

export async function recordLogin(id: string): Promise<void> {
  const _id = objectId(id);
  if (_id) await (await collection()).updateOne({ _id }, { $set: { lastLoginAt: new Date() } });
}

export async function updateProfile(id: string, input: { name: string; email: string }): Promise<void> {
  const _id = objectId(id);
  if (!_id) throw new AccountError("Zugang nicht gefunden.");
  const name = input.name.trim();
  const email = normalizeEmail(input.email);
  if (!name) throw new AccountError("Bitte einen Namen angeben.");
  if (!emailValid(email)) throw new AccountError("Bitte eine gültige E-Mail-Adresse angeben.");
  try {
    await (await collection()).updateOne({ _id }, { $set: { name, email } });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) throw new AccountError("Diese E-Mail-Adresse gehört schon zu einem anderen Zugang.");
    throw error;
  }
}

/** Neues Passwort; alle anderen Sitzungen werden damit ungültig. Liefert die neue Generation. */
export async function changePassword(id: string, current: string, next: string): Promise<number> {
  const _id = objectId(id);
  const coll = await collection();
  const doc = _id ? await coll.findOne({ _id }) : null;
  if (!doc) throw new AccountError("Zugang nicht gefunden.");
  if (!verifyPassword(current, doc.passwordHash)) throw new AccountError("Das bisherige Passwort stimmt nicht.");
  const gen = (doc.gen ?? 0) + 1;
  await coll.updateOne({ _id: doc._id }, { $set: { passwordHash: hashPassword(next), gen } });
  return gen;
}

/** Alle Sitzungen beenden (auch die eigene). */
export async function bumpGeneration(id: string): Promise<number> {
  const _id = objectId(id);
  if (!_id) throw new AccountError("Zugang nicht gefunden.");
  const doc = await (await collection()).findOneAndUpdate({ _id }, { $inc: { gen: 1 } }, { returnDocument: "after" });
  return doc?.gen ?? 0;
}

/* ------------------------------ Zweiter Faktor ---------------------------- */

/** Passwort-Hash für die Signatur des Zwischenschritts (siehe two-factor-step.ts). */
export async function passwordHashOf(id: string): Promise<string | null> {
  const _id = objectId(id);
  if (!_id) return null;
  const doc = await (await collection()).findOne({ _id }, { projection: { passwordHash: 1 } });
  return doc?.passwordHash ?? null;
}

export async function totpSecretOf(id: string): Promise<{ active: string | null; pending: string | null; backupCodes: string[] }> {
  const _id = objectId(id);
  const doc = _id ? await (await collection()).findOne({ _id }) : null;
  return {
    active: doc?.totpSecret ? decrypt(doc.totpSecret) : null,
    pending: doc?.totpPending ? decrypt(doc.totpPending) : null,
    backupCodes: doc?.backupCodes ?? [],
  };
}

export async function setPendingTotp(id: string, secret: string): Promise<void> {
  const _id = objectId(id);
  if (_id) await (await collection()).updateOne({ _id }, { $set: { totpPending: encrypt(secret) } });
}

export async function activateTotp(id: string, secret: string, backupCodeHashes: string[]): Promise<void> {
  const _id = objectId(id);
  if (!_id) return;
  await (await collection()).updateOne(
    { _id },
    { $set: { totpSecret: encrypt(secret), totpSince: new Date(), backupCodes: backupCodeHashes }, $unset: { totpPending: "" } },
  );
}

export async function activateTotpKeepCodes(id: string, secret: string): Promise<void> {
  const _id = objectId(id);
  if (!_id) return;
  await (await collection()).updateOne({ _id }, { $set: { totpSecret: encrypt(secret), totpSince: new Date() }, $unset: { totpPending: "" } });
}

/** App ausschalten; Ersatzcodes bleiben, solange noch ein Passkey da ist. */
export async function disableTotp(id: string): Promise<void> {
  const _id = objectId(id);
  if (!_id) return;
  const coll = await collection();
  const doc = await coll.findOne({ _id }, { projection: { passkeys: 1 } });
  const unset: Record<string, ""> = { totpSecret: "", totpPending: "", totpSince: "" };
  if (!doc?.passkeys?.length) unset.backupCodes = "";
  await coll.updateOne({ _id }, { $unset: unset });
}

/* --------------------------------- Passkeys ------------------------------- */

export async function passkeysOf(id: string): Promise<StoredPasskey[]> {
  const _id = objectId(id);
  const doc = _id ? await (await collection()).findOne({ _id }, { projection: { passkeys: 1 } }) : null;
  return doc?.passkeys ?? [];
}

export async function addPasskey(id: string, passkey: StoredPasskey): Promise<void> {
  const _id = objectId(id);
  if (_id) await (await collection()).updateOne({ _id }, { $push: { passkeys: passkey } });
}

/** Passkey entfernen; ist danach kein zweiter Faktor mehr da, fallen auch die Ersatzcodes weg. */
export async function removePasskey(id: string, passkeyId: string): Promise<void> {
  const _id = objectId(id);
  if (!_id) return;
  const coll = await collection();
  const doc = await coll.findOneAndUpdate({ _id }, { $pull: { passkeys: { id: passkeyId } } }, { returnDocument: "after" });
  if (doc && !doc.totpSecret && !doc.passkeys?.length) await coll.updateOne({ _id }, { $unset: { backupCodes: "" } });
}

export async function passkeyUsed(id: string, passkeyId: string, counter: number): Promise<void> {
  const _id = objectId(id);
  if (!_id) return;
  await (await collection()).updateOne(
    { _id, "passkeys.id": passkeyId },
    { $set: { "passkeys.$.counter": counter, "passkeys.$.lastUsedAt": new Date() } },
  );
}

export async function replaceBackupCodes(id: string, hashes: string[]): Promise<void> {
  const _id = objectId(id);
  if (_id) await (await collection()).updateOne({ _id }, { $set: { backupCodes: hashes } });
}

export async function verifyAdminPassword(id: string, password: string): Promise<boolean> {
  const hash = await passwordHashOf(id);
  return hash ? verifyPassword(password, hash) : false;
}
