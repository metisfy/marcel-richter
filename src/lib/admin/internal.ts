import "server-only";

import { createHmac } from "node:crypto";

import { appSecret } from "./storage";

/** Kennung für Aufrufe des Servers an sich selbst (src/app/api/intern/*), abgeleitet aus dem App-Geheimnis. */
export function internalToken(): string {
  return createHmac("sha256", appSecret()).update("neu-erzeugen").digest("hex");
}
