import { calendarResponse } from "@/lib/ical-response";

// Kalender-Abo (Deutsch). Statisch, alle fünf Minuten im Hintergrund neu
// erzeugt – die BVV-Daten selbst kommen aus dem Fetch-Cache (src/lib/season.ts).
export const dynamic = "force-static";
export const revalidate = 300;

export function GET() {
  return calendarResponse("de", "spielplan.ics");
}
