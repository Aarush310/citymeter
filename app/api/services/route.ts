import { BOOKING_WINDOW_DAYS, CATEGORIES, CITY, formatHour, TIMEZONE } from "@/lib/catalog";

export const dynamic = "force-static";

/** GET /api/services — free. Everything an agent needs to plan a booking. */
export function GET() {
  return Response.json({
    city: CITY,
    timezone: TIMEZONE,
    bookingWindowDays: BOOKING_WINDOW_DAYS,
    payment: { protocol: "MPP", method: "tempo", network: "testnet", currency: "pathUSD" },
    services: CATEGORIES.map((c) => ({
      service: c.slug,
      name: c.name,
      deposit: `$${c.price}.00 ${c.unit}`,
      amount: c.price,
      hours: `${formatHour(c.hours[0])}–${formatHour(c.hours[1] % 24)}`,
      description: c.blurb,
      book: `POST /api/book/${c.slug}`,
      availability: `GET /api/availability?service=${c.slug}&date=YYYY-MM-DD`,
      venues: c.venues,
    })),
  });
}
