import { calendarResponse } from "@/lib/ical-response";

// Calendar subscription (English). See src/app/spielplan.ics/route.ts.
export const dynamic = "force-static";
export const revalidate = 300;

export function GET() {
  return calendarResponse("en", "fixtures.ics");
}
