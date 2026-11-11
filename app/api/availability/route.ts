import { addDays, BOOKING_WINDOW_DAYS, cityNow, formatHour, getCategory } from "@/lib/catalog";
import { takenHours } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET /api/availability?service=tennis&date=YYYY-MM-DD — free. Open 1-hour slots per venue. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const service = url.searchParams.get("service") ?? "";
  const category = getCategory(service);
  if (!category) return Response.json({ error: "service is required", see: "/api/services" }, { status: 400 });

  const now = cityNow();
  const date = url.searchParams.get("date") ?? now.date;
  const last = addDays(now.date, BOOKING_WINDOW_DAYS - 1);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < now.date || date > last) {
    return Response.json({ error: `date must be between ${now.date} and ${last}` }, { status: 400 });
  }

  const taken = await takenHours(
    category.venues.map((v) => v.id),
    date,
  );
  const venues = category.venues.map((v) => {
    const open: string[] = [];
    for (let h = category.hours[0]; h < category.hours[1]; h++) {
      if (date === now.date && h <= now.hour) continue;
      if (!taken.get(v.id)?.has(h)) open.push(formatHour(h));
    }
    return { venue: v.id, name: v.name, area: v.area, open };
  });

  return Response.json({
    service: category.slug,
    date,
    deposit: `$${category.price}.00 ${category.unit}`,
    venues,
    book: {
      method: "POST",
      url: `/api/book/${category.slug}`,
      body: { venue: venues[0].venue, date, time: venues[0].open[0] ?? "10:00" },
    },
  });
}
