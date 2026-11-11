import { Receipt } from "mppx";
import { formatHour, getCategory, prettyDate, validateRequest, type ValidSlot } from "@/lib/catalog";
import { attachPayment, createBooking, isTaken, takenHours } from "@/lib/db";
import { baseUrl, mppx, ticketKey } from "@/lib/payments";

export const dynamic = "force-dynamic";

const json = (data: unknown, status = 200) => Response.json(data, { status });

/**
 * POST /api/book/{service}  body: {"venue": "...", "date": "YYYY-MM-DD", "time": "HH:00", "name"?: "..."}
 *
 * 1. Free pre-flight: the slot is validated and checked BEFORE any payment is requested,
 *    so an agent never pays for a slot that doesn't exist or is already taken.
 * 2. 402 challenge for the deposit, scoped to that exact venue + slot.
 * 3. Paid retry → booking is written and the confirmation (with access PIN) is returned with a Payment-Receipt.
 */
export async function POST(req: Request, ctx: { params: Promise<{ service: string }> }) {
  const { service } = await ctx.params;
  const category = getCategory(service);
  if (!category) return json({ error: `Unknown service "${service}"`, see: "/api/services" }, 404);

  const raw = (await req.clone().text()).trim();
  let body: unknown;
  const hasCredential = /^Payment\s/i.test(req.headers.get("authorization") ?? "");
  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      // Unpaid non-JSON probes just get the price quote; a paid retry must send JSON.
      if (hasCredential) return json({ error: "Body must be JSON" }, 400);
    }
  }

  // A probe with no booking fields at all (scanners, `curl -X POST`) gets the generic 402 price quote.
  // Anything that does try to book is validated for free before money is requested.
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : undefined;
  const triesToBook = !!b && ["venue", "date", "time"].some((k) => k in b);

  let slot: ValidSlot | undefined;
  if (triesToBook || hasCredential) {
    const v = validateRequest(service, body);
    if ("error" in v) return json({ error: v.error, help: "/llms.txt" }, 400);
    slot = v.slot;
    if (await isTaken(slot.venue.id, slot.date, slot.hour)) {
      return json({ error: "That slot is already booked", alternatives: await alternatives(slot) }, 409);
    }
  }

  const result = await mppx.charge({
    amount: category.price,
    // Kept ASCII: it travels in the WWW-Authenticate header.
    description: ascii(
      slot
        ? `${slot.venue.name}, ${prettyDate(slot.date)} ${formatHour(slot.hour)} (${CITY_LABEL})`
        : `${category.name} deposit, ${category.unit} (${CITY_LABEL})`,
    ),
    // Binds the payment to this exact slot, so a credential can't be replayed for a different booking.
    scope: slot ? `${slot.venue.id}@${slot.date}T${slot.hour}` : `${category.slug}`,
  })(req);

  if (result.status === 402) return result.challenge;
  if (!slot) return json({ error: "Missing booking details" }, 400);

  const booking = await createBooking(slot);
  if (!booking) {
    // Lost a race to another payer between pre-flight and payment.
    return result.withReceipt(
      json(
        {
          error: "Someone booked this slot while your payment was settling. Your receipt is attached; contact the city desk with it for a refund.",
          alternatives: await alternatives(slot),
        },
        409,
      ),
    );
  }

  const base = baseUrl(req);
  const response = result.withReceipt(
    json(
      {
        status: "confirmed",
        booking: {
          id: booking.id,
          service: category.name,
          venue: booking.venue_name,
          venueId: booking.venue_id,
          date: booking.date,
          time: `${formatHour(booking.hour)}–${formatHour((booking.hour + 1) % 24)}`,
          timezone: "Europe/Dublin",
          name: booking.name,
          accessPin: booking.pin,
          deposit: `$${category.price}.00`,
          ticket: `${base}/b/${booking.id}?k=${ticketKey(booking.id)}`,
        },
        instructions: accessInstructions(category.slug, booking.pin),
      },
      201,
    ),
  );

  try {
    const receipt = Receipt.fromResponse(response);
    await attachPayment(booking.id, receipt.reference, receipt.method);
  } catch {
    // Receipt bookkeeping is best-effort; the booking itself is confirmed.
  }
  return response;
}

const CITY_LABEL = "Riverside City";

const ascii = (s: string) =>
  s
    .replace(/·/g, "-")
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();

function accessInstructions(slug: string, pin: string) {
  switch (slug) {
    case "tennis":
      return `Enter PIN ${pin} on the court gate keypad. Floodlights switch on automatically for your hour.`;
    case "ev-charger":
      return `Tap "Reserved" on the charger screen and enter PIN ${pin}. The bay is held for 15 minutes after your start time.`;
    case "library-room":
      return `Show your booking ID at the front desk or enter PIN ${pin} on the room door.`;
    default:
      return `Enter PIN ${pin} on the bay sign; it will show "Reserved" for your hour.`;
  }
}

async function alternatives(slot: ValidSlot) {
  const taken = await takenHours(
    slot.category.venues.map((v) => v.id),
    slot.date,
  );
  const sameTime = slot.category.venues
    .filter((v) => !taken.get(v.id)?.has(slot.hour))
    .map((v) => ({ venue: v.id, name: v.name, date: slot.date, time: formatHour(slot.hour) }));
  const sameVenue: { venue: string; date: string; time: string }[] = [];
  for (let h = slot.hour + 1; h < slot.category.hours[1] && sameVenue.length < 3; h++) {
    if (!taken.get(slot.venue.id)?.has(h)) sameVenue.push({ venue: slot.venue.id, date: slot.date, time: formatHour(h) });
  }
  return { sameTimeOtherVenues: sameTime, laterAtSameVenue: sameVenue };
}
