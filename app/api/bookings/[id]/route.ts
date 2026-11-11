import { formatHour } from "@/lib/catalog";
import { getBooking } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET /api/bookings/{id} — free. Public booking status (no access PIN). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const b = await getBooking(id.toUpperCase());
  if (!b) return Response.json({ error: "Booking not found" }, { status: 404 });
  return Response.json({
    id: b.id,
    status: "confirmed",
    venue: b.venue_name,
    date: b.date,
    time: `${formatHour(b.hour)}–${formatHour((b.hour + 1) % 24)}`,
    paid: { amount: `$${b.amount}.00`, method: b.payment_method, reference: b.payment_ref },
  });
}
