import { CATEGORIES, formatHour } from "@/lib/catalog";
import { recentBookings, stats } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET /api/feed — free. Live activity for the dashboard. Names and PINs are not exposed. */
export async function GET() {
  const [rows, s] = await Promise.all([recentBookings(15), stats()]);
  return Response.json({
    stats: s,
    bookings: rows.map((b) => {
      const c = CATEGORIES.find((c) => c.slug === b.category);
      return {
        id: b.id,
        emoji: c?.emoji ?? "📍",
        service: c?.name ?? b.category,
        venue: b.venue_name,
        date: b.date,
        time: formatHour(b.hour),
        amount: b.amount,
        paymentRef: b.payment_ref,
        createdAt: b.created_at,
      };
    }),
  });
}
