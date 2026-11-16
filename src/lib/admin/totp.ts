import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import qrcode from "qrcode-generator";

import { hashPassword, verifyPassword } from "./crypto";

/*
 * Zweiter Faktor (aus t-orga übernommen):
 * - TOTP nach RFC 6238 für Authenticator-Apps und den iCloud-Schlüsselbund.
 *   SHA1, 6 Stellen, 30 s – das einzige, was alle Apps beherrschen.
 * - QR-Code als SVG auf dem eigenen Server – nie über einen fremden Dienst,
 *   das hieße den Schlüssel im Klartext weitergeben.
 * - Ersatzcodes für den Fall, dass das Telefon fehlt; gespeichert nur als
 *   Hash, jeder gilt einmal.
 */

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(data: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of data) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(text: string): Buffer {
  const clean = text.toUpperCase().replace(/[\s-]/g, "").replace(/=+$/, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const index = BASE32.indexOf(char);
    if (index < 0) throw new Error("Ungültiger Schlüssel.");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

const STEP_SECONDS = 30;
const DIGITS = 6;

export function newTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

function codeFor(secret: string, counter: number): string {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const hash = createHmac("sha1", base32Decode(secret)).update(buffer).digest();
  const offset = hash[hash.length - 1] & 0x0f;
  const number =
    ((hash[offset] & 0x7f) << 24) | ((hash[offset + 1] & 0xff) << 16) | ((hash[offset + 2] & 0xff) << 8) | (hash[offset + 3] & 0xff);
  return (number % 10 ** DIGITS).toString().padStart(DIGITS, "0");
}

/** Toleranz: voriger, aktueller und nächster Code. */
export function verifyTotp(secret: string, input: string): boolean {
  const digits = input.replace(/\D/g, "");
  if (digits.length !== DIGITS) return false;
  const now = Math.floor(Date.now() / 1000 / STEP_SECONDS);
  for (let delta = -1; delta <= 1; delta++) {
    let expected: string;
    try {
      expected = codeFor(secret, now + delta);
    } catch {
      return false;
    }
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(digits))) return true;
  }
  return false;
}

export function otpauthUrl(secret: string, account: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({ secret, issuer, algorithm: "SHA1", digits: String(DIGITS), period: String(STEP_SECONDS) });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** In Vierergruppen zum Abtippen, wenn die Kamera streikt. */
export function readableSecret(secret: string): string {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}

export function qrSvg(text: string): string {
  const code = qrcode(0, "M");
  code.addData(text);
  code.make();
  const cells = code.getModuleCount();
  const margin = 2;
  const size = cells + margin * 2;
  let path = "";
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      if (code.isDark(y, x)) path += `M${x + margin},${y + margin}h1v1h-1z`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
}

/* -------------------------------- Ersatzcodes ----------------------------- */

const BACKUP_COUNT = 8;
const BACKUP_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function newBackupCodes(): { plain: string[]; hashes: string[] } {
  const plain = Array.from({ length: BACKUP_COUNT }, () => {
    const bytes = randomBytes(8);
    let code = "";
    for (let i = 0; i < 8; i++) {
      if (i === 4) code += "-";
      code += BACKUP_CHARS[bytes[i] % BACKUP_CHARS.length];
    }
    return code;
  });
  return { plain, hashes: plain.map(hashPassword) };
}

/** Liefert die verbleibenden Hashes oder `null`, wenn kein Code passt. */
export function redeemBackupCode(hashes: string[], input: string): string[] | null {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (raw.length !== 8) return null;
  const code = `${raw.slice(0, 4)}-${raw.slice(4)}`;
  const index = hashes.findIndex((hash) => verifyPassword(code, hash));
  return index < 0 ? null : hashes.filter((_, i) => i !== index);
}
