"use server";

import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";
import { revalidatePath, updateTag } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  AccountError,
  activateTotp,
  activateTotpKeepCodes,
  addPasskey,
  adminById,
  authenticate,
  bumpGeneration,
  changePassword,
  countAdmins,
  createAdmin,
  disableTotp,
  passkeysOf,
  passkeyUsed,
  passwordHashOf,
  recordLogin,
  removePasskey,
  replaceBackupCodes,
  setPendingTotp,
  totpSecretOf,
  updateProfile,
  verifyAdminPassword,
} from "@/lib/admin/accounts";
import { passwordProblem } from "@/lib/admin/crypto";
import { type ConnectionInput, databaseConfigured, describeError, saveConnection, testConnection } from "@/lib/admin/db";
import {
  adminForAction,
  adminPrefix,
  clearTwoFactorStep,
  clientKey,
  loginBlocked,
  loginFailed,
  loginSucceeded,
  readTwoFactorStep,
  safeTarget,
  setTwoFactorStep,
  setupComplete,
  signIn,
  signOut,
} from "@/lib/admin/guard";
import { deleteMailSettings, mailSettingsFromDatabase, saveMailSettings } from "@/lib/admin/mail-settings";
import { deleteMessage, setRead } from "@/lib/admin/messages";
import { authenticationOptions, passkeyEnvironment, registrationOptions, verifyAuthentication, verifyRegistration } from "@/lib/admin/passkeys";
import { finishWizard, setupKeyMatches, wizardDone } from "@/lib/admin/storage";
import { newBackupCodes, newTotpSecret, redeemBackupCode, verifyTotp } from "@/lib/admin/totp";
import { sendTestMail } from "@/lib/contact";
import { getSite } from "@/lib/content";

export type FormState = { error?: string; success?: string; codes?: string[] };

const text = (fd: FormData, name: string) => {
  const value = fd.get(name);
  return typeof value === "string" ? value : "";
};

function failure(error: unknown, fallback: string): FormState {
  if (error instanceof AccountError) return { error: error.message };
  if (error instanceof Error && /ECONNREFUSED|ServerSelection|timed out|getaddrinfo|Datenbank/i.test(error.message)) {
    return { error: "Die Datenbank antwortet nicht. Bitte später erneut versuchen." };
  }
  return { error: error instanceof Error ? error.message : fallback };
}

/* ---------------------------- Einrichtungsassistent ----------------------- */

/** Jede Aktion prüft den Schlüssel und verweigert sich nach der Einrichtung. */
function wizardLocked(fd: FormData): string | null {
  if (wizardDone()) return "Die Einrichtung ist bereits abgeschlossen.";
  if (!setupKeyMatches(text(fd, "schluessel"))) {
    return "Der Einrichtungsschlüssel stimmt nicht. Er steht am Ende von start.sh und im Protokoll des Containers (docker logs marcel-richter).";
  }
  return null;
}

function connectionFrom(fd: FormData): ConnectionInput {
  return {
    host: text(fd, "host"),
    port: Number(text(fd, "port")) || 27017,
    user: text(fd, "user"),
    password: text(fd, "password") || undefined,
    database: text(fd, "database"),
    authSource: text(fd, "authSource") || undefined,
    tls: fd.get("tls") === "on",
    srv: fd.get("srv") === "on",
  };
}

export async function setupDatabase(_: FormState, fd: FormData): Promise<FormState> {
  const locked = wizardLocked(fd);
  if (locked) return { error: locked };
  const input = connectionFrom(fd);
  if (!input.host.trim() || !input.database.trim()) return { error: "Server und Datenbankname sind Pflicht." };

  const result = await testConnection(input);
  if (!result.ok) return { error: `Verbindung fehlgeschlagen: ${result.error}` };
  const message = `Verbindung steht (${result.ms} ms), Lesen und Schreiben klappt.`;
  if (text(fd, "intent") === "test") return { success: message };

  try {
    await saveConnection(input);
  } catch (error) {
    return failure(error, "Die Verbindung ließ sich nicht speichern.");
  }

  // Liegt in der Datenbank schon ein Zugang (z. B. nach verlorenem Volume oder
  // --einrichtung-zuruecksetzen), ist die Einrichtung damit fertig: anmelden statt neu anlegen.
  let existing = 0;
  try {
    existing = await countAdmins();
  } catch {
    existing = 0;
  }
  if (existing > 0) {
    try {
      finishWizard();
    } catch (error) {
      return failure(error, "Die Einrichtung ließ sich nicht abschließen.");
    }
    revalidatePath("/admin", "layout");
    redirect(`${await adminPrefix()}/anmelden?bestehend=1`);
  }

  revalidatePath("/admin", "layout");
  return { success: `${message} Gespeichert.` };
}

export async function setupAdmin(_: FormState, fd: FormData): Promise<FormState> {
  const locked = wizardLocked(fd);
  if (locked) return { error: locked };
  if (!databaseConfigured()) return { error: "Bitte zuerst die Datenbank verbinden." };

  try {
    if ((await countAdmins()) > 0) return { error: "Es gibt bereits einen Zugang. Bitte anmelden." };
  } catch (error) {
    return { error: `Die Datenbank antwortet nicht: ${describeError(error)}` };
  }

  const password = text(fd, "password");
  if (password !== text(fd, "repeat")) return { error: "Die beiden Passwörter stimmen nicht überein." };
  const problem = passwordProblem(password);
  if (problem) return { error: problem };

  let admin;
  try {
    admin = await createAdmin({ name: text(fd, "name"), email: text(fd, "email"), password });
    finishWizard();
  } catch (error) {
    return failure(error, "Der Zugang ließ sich nicht anlegen.");
  }

  await signIn(admin);
  await recordLogin(admin.id);
  revalidatePath("/admin", "layout");
  redirect((await adminPrefix()) || "/");
}

/* --------------------------------- Anmeldung ------------------------------ */

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  if (!setupComplete()) return { error: "Der Admin-Bereich ist noch nicht eingerichtet." };
  const email = text(fd, "email");
  const password = text(fd, "password");
  if (!email || !password) return { error: "Bitte E-Mail-Adresse und Passwort eingeben." };

  const ip = await clientKey();
  if (loginBlocked(ip, email)) return { error: "Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen." };

  let admin;
  try {
    admin = await authenticate(email, password);
  } catch (error) {
    return failure(error, "Die Anmeldung ist fehlgeschlagen.");
  }
  if (!admin) {
    loginFailed(ip, email);
    return { error: "E-Mail-Adresse oder Passwort stimmen nicht." };
  }
  loginSucceeded(email);

  const prefix = await adminPrefix();
  const target = safeTarget(text(fd, "weiter"));
  if (admin.twoFactor) {
    const hash = await passwordHashOf(admin.id);
    if (!hash) return { error: "Die Anmeldung ist fehlgeschlagen." };
    await setTwoFactorStep(admin.id, hash);
    redirect(`${prefix}/zwei-faktor${target !== "/" ? `?weiter=${encodeURIComponent(target)}` : ""}`);
  }

  await signIn(admin);
  await recordLogin(admin.id);
  redirect(target === "/" ? prefix || "/" : `${prefix}${target}`);
}

export async function verifySecondFactor(_: FormState, fd: FormData): Promise<FormState> {
  const id = await readTwoFactorStep(passwordHashOf);
  if (!id) return { error: "Die Anmeldung ist abgelaufen. Bitte noch einmal mit Passwort anmelden." };

  const ip = await clientKey();
  if (loginBlocked(ip, `2fa:${id}`)) return { error: "Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen." };

  const code = text(fd, "code").trim();
  const { active, unreadable, backupCodes } = await totpSecretOf(id);
  let ok = false;
  if (/^\d[\d\s]{5,7}$/.test(code)) {
    if (unreadable) {
      return {
        error:
          "Der Schlüssel der Authenticator-App wurde mit einem früheren App-Geheimnis gespeichert und ist nicht mehr lesbar (Daten-Volume verloren). Bitte einen Ersatzcode oder Passkey verwenden – danach die App unter Mein Profil neu einrichten.",
      };
    }
    ok = Boolean(active && verifyTotp(active, code));
  } else {
    const remaining = redeemBackupCode(backupCodes, code);
    if (remaining) {
      await replaceBackupCodes(id, remaining);
      ok = true;
    }
  }
  if (!ok) {
    loginFailed(ip, `2fa:${id}`);
    return { error: "Der Code stimmt nicht. Bitte den aktuellen Code aus der App oder einen Ersatzcode eingeben." };
  }

  const admin = await adminById(id);
  if (!admin?.active) return { error: "Die Anmeldung ist fehlgeschlagen." };
  await clearTwoFactorStep();
  await signIn(admin);
  await recordLogin(admin.id);
  const prefix = await adminPrefix();
  const target = safeTarget(text(fd, "weiter"));
  redirect(target === "/" ? prefix || "/" : `${prefix}${target}`);
}

export async function logout(): Promise<void> {
  await signOut();
  redirect(`${await adminPrefix()}/anmelden`);
}

export async function logoutEverywhere(): Promise<void> {
  const admin = await adminForAction();
  await bumpGeneration(admin.id);
  await signOut();
  redirect(`${await adminPrefix()}/anmelden`);
}

/* ---------------------------------- Konto --------------------------------- */

export async function saveProfile(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await adminForAction();
  try {
    await updateProfile(admin.id, { name: text(fd, "name"), email: text(fd, "email") });
  } catch (error) {
    return failure(error, "Die Daten ließen sich nicht speichern.");
  }
  revalidatePath("/admin", "layout");
  return { success: "Gespeichert." };
}

export async function savePassword(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await adminForAction();
  const next = text(fd, "next");
  if (next !== text(fd, "repeat")) return { error: "Die beiden neuen Passwörter stimmen nicht überein." };
  const problem = passwordProblem(next);
  if (problem) return { error: problem };
  try {
    const gen = await changePassword(admin.id, text(fd, "current"), next);
    // Andere Sitzungen sind jetzt ungültig, diese bekommt ein neues Cookie
    await signIn({ id: admin.id, gen });
  } catch (error) {
    return failure(error, "Das Passwort ließ sich nicht ändern.");
  }
  return { success: "Das Passwort ist geändert. Andere angemeldete Geräte sind abgemeldet." };
}

/* ------------------------------ Zweiter Faktor ---------------------------- */

export async function startTwoFactor(): Promise<void> {
  const admin = await adminForAction();
  await setPendingTotp(admin.id, newTotpSecret());
  revalidatePath("/admin/einstellungen");
}

export async function confirmTwoFactor(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await adminForAction();
  const { pending } = await totpSecretOf(admin.id);
  if (!pending) return { error: "Bitte die Einrichtung neu starten." };
  if (!verifyTotp(pending, text(fd, "code"))) return { error: "Der Code stimmt nicht. Uhrzeit des Telefons prüfen und den aktuellen Code eingeben." };
  // Ersatzcodes gibt es nur einmal je Zugang – hat ein Passkey sie schon erzeugt, bleiben sie
  if (admin.backupCodesLeft > 0) {
    await activateTotpKeepCodes(admin.id, pending);
    revalidatePath("/admin", "layout");
    return { success: "Die Authenticator-App ist eingeschaltet." };
  }
  const codes = newBackupCodes();
  await activateTotp(admin.id, pending, codes.hashes);
  // Bewusst ohne revalidatePath: Die Seite soll erst neu laden, wenn die
  // Ersatzcodes notiert sind („Notiert“ unter den Codes) – sonst wären sie weg.
  return { success: "Die Authenticator-App ist eingeschaltet.", codes: codes.plain };
}

export async function turnOffTwoFactor(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await adminForAction();
  if (!(await verifyAdminPassword(admin.id, text(fd, "password")))) return { error: "Das Passwort stimmt nicht." };
  await disableTotp(admin.id);
  revalidatePath("/admin", "layout");
  return { success: "Die Authenticator-App ist ausgeschaltet." };
}

export async function renewBackupCodes(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await adminForAction();
  if (!(await verifyAdminPassword(admin.id, text(fd, "password")))) return { error: "Das Passwort stimmt nicht." };
  const codes = newBackupCodes();
  await replaceBackupCodes(admin.id, codes.hashes);
  return { success: "Neue Ersatzcodes – die alten gelten nicht mehr.", codes: codes.plain };
}

/* --------------------------------- Passkeys ------------------------------- */

const NO_PASSKEY_HOST =
  "Passkeys gehen nur über HTTPS mit Domain (https://admin.<domain>) oder über localhost – nicht über die Server-IP.";

export async function passkeyRegistrationStart(): Promise<{ options?: string; error?: string }> {
  const admin = await adminForAction();
  const env = passkeyEnvironment(await headers());
  if (!env) return { error: NO_PASSKEY_HOST };
  const options = await registrationOptions(env, admin, await passkeysOf(admin.id));
  return { options: JSON.stringify(options) };
}

export async function passkeyRegistrationFinish(responseJson: string, name: string): Promise<FormState> {
  const admin = await adminForAction();
  const env = passkeyEnvironment(await headers());
  if (!env) return { error: NO_PASSKEY_HOST };
  let response: RegistrationResponseJSON;
  try {
    response = JSON.parse(responseJson) as RegistrationResponseJSON;
  } catch {
    return { error: "Die Antwort des Geräts war unlesbar." };
  }
  const verified = await verifyRegistration(env, admin.id, response);
  if (!verified) return { error: "Der Passkey ließ sich nicht bestätigen. Bitte noch einmal versuchen." };
  await addPasskey(admin.id, { ...verified, name: name.trim().slice(0, 60) || "Passkey", createdAt: new Date() });

  if (admin.backupCodesLeft === 0) {
    const codes = newBackupCodes();
    await replaceBackupCodes(admin.id, codes.hashes);
    // Ohne revalidatePath, bis die Ersatzcodes notiert sind (siehe confirmTwoFactor)
    return { success: "Passkey angelegt – ab jetzt fragt die Anmeldung danach.", codes: codes.plain };
  }
  revalidatePath("/admin", "layout");
  return { success: "Passkey angelegt." };
}

export async function deletePasskey(passkeyId: string): Promise<void> {
  const admin = await adminForAction();
  await removePasskey(admin.id, passkeyId);
  revalidatePath("/admin", "layout");
}

/** Anmeldung, Schritt 2: Aufgabe für den Passkey holen. */
export async function passkeyLoginStart(): Promise<{ options?: string; error?: string }> {
  const id = await readTwoFactorStep(passwordHashOf);
  if (!id) return { error: "Die Anmeldung ist abgelaufen. Bitte noch einmal mit Passwort anmelden." };
  const env = passkeyEnvironment(await headers());
  if (!env) return { error: NO_PASSKEY_HOST };
  const passkeys = await passkeysOf(id);
  if (passkeys.length === 0) return { error: "Für diesen Zugang ist kein Passkey hinterlegt." };
  return { options: JSON.stringify(await authenticationOptions(env, id, passkeys)) };
}

export async function passkeyLoginFinish(responseJson: string, weiter: string): Promise<FormState> {
  const id = await readTwoFactorStep(passwordHashOf);
  if (!id) return { error: "Die Anmeldung ist abgelaufen. Bitte noch einmal mit Passwort anmelden." };
  const env = passkeyEnvironment(await headers());
  if (!env) return { error: NO_PASSKEY_HOST };
  const ip = await clientKey();
  if (loginBlocked(ip, `2fa:${id}`)) return { error: "Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen." };

  let response: AuthenticationResponseJSON;
  try {
    response = JSON.parse(responseJson) as AuthenticationResponseJSON;
  } catch {
    return { error: "Die Antwort des Geräts war unlesbar." };
  }
  const passkey = (await passkeysOf(id)).find((entry) => entry.id === response.id);
  const result = passkey ? await verifyAuthentication(env, id, response, passkey) : null;
  if (!passkey || !result) {
    loginFailed(ip, `2fa:${id}`);
    return { error: "Der Passkey wurde nicht angenommen. Bitte noch einmal versuchen oder einen Code eingeben." };
  }
  await passkeyUsed(id, passkey.id, result.counter);

  const admin = await adminById(id);
  if (!admin?.active) return { error: "Die Anmeldung ist fehlgeschlagen." };
  await clearTwoFactorStep();
  await signIn(admin);
  await recordLogin(admin.id);
  const prefix = await adminPrefix();
  const target = safeTarget(weiter);
  redirect(target === "/" ? prefix || "/" : `${prefix}${target}`);
}

/* -------------------------------- Spielbetrieb ---------------------------- */

/** Spielplan, Tabelle und Spielberichte sofort neu beim BVV abrufen. */
export async function refreshSeasonData(): Promise<FormState> {
  await adminForAction();
  // Abrufe beim BVV tragen das Tag „bvv“ (src/lib/season.ts); die öffentlichen Seiten erzeugen sich neu
  updateTag("bvv");
  revalidatePath("/", "layout");
  return { success: "Neu abgerufen – die Website zeigt ab sofort den aktuellen Stand." };
}

/* --------------------------------- Mailversand ---------------------------- */

function smtpFrom(fd: FormData) {
  const port = Number(text(fd, "port")) || 587;
  return {
    host: text(fd, "host").trim(),
    port,
    user: text(fd, "user").trim() || undefined,
    password: text(fd, "password") || undefined,
    from: text(fd, "from").trim(),
    to: text(fd, "to").trim() || undefined,
  };
}

export async function saveMail(_: FormState, fd: FormData): Promise<FormState> {
  await adminForAction();
  const input = smtpFrom(fd);
  if (!input.host || !input.from) return { error: "Mailserver und Absenderadresse sind Pflicht." };
  const keepPassword = !input.password && fd.get("clearPassword") !== "on";

  // Vor dem Speichern eine Testmail – so wird nie ein kaputter Zugang aktiv
  let password = input.password;
  if (keepPassword) password = (await mailSettingsFromDatabase())?.password;
  try {
    await sendTestMail({ ...input, password, to: input.to || getSite("de").email });
  } catch (error) {
    return { error: `Testmail fehlgeschlagen, nichts gespeichert: ${error instanceof Error ? error.message : "unbekannt"}` };
  }
  try {
    await saveMailSettings({ ...input, keepPassword });
  } catch (error) {
    return failure(error, "Die Einstellungen ließen sich nicht speichern.");
  }
  revalidatePath("/admin", "layout");
  return { success: `Gespeichert. Eine Testmail ist an ${input.to || getSite("de").email} unterwegs.` };
}

export async function removeMail(): Promise<void> {
  await adminForAction();
  await deleteMailSettings();
  revalidatePath("/admin", "layout");
}

/* --------------------------------- Nachrichten ---------------------------- */

export async function markMessage(id: string, read: boolean): Promise<void> {
  await adminForAction();
  await setRead(id, read);
  revalidatePath("/admin", "layout");
}

export async function removeMessage(id: string): Promise<void> {
  await adminForAction();
  await deleteMessage(id);
  revalidatePath("/admin", "layout");
}

/* --------------------------------- Datenbank ------------------------------ */

export async function checkDatabase(): Promise<FormState> {
  await adminForAction();
  const result = await testConnection();
  return result.ok ? { success: `Verbindung steht (${result.ms} ms).` } : { error: result.error };
}
