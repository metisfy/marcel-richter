import type de from "../../messages/de.json";
import type en from "../../messages/en.json";

/*
 * Reine Typprüfung: Fehlt in messages/en.json ein Schlüssel, den
 * messages/de.json hat, schlägt `npm run typecheck` (und damit die
 * Pipeline) fehl – statt dass auf der englischen Seite ein Text fehlt.
 */
type MustMatch<T extends typeof de> = T;
export type EnglishMessagesComplete = MustMatch<typeof en>;
