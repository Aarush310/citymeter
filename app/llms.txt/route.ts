import { BOOKING_WINDOW_DAYS, CATEGORIES, cityNow, formatHour } from "@/lib/catalog";
import { baseUrl } from "@/lib/payments";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const base = baseUrl(req);
  const today = cityNow().date;
  const lines = [
    "# CityMeter",
    "",
    "> Book Riverside's public city services (tennis courts, EV chargers, library study rooms, parking bays) in one HTTP request. You pay the deposit with MPP (Machine Payments Protocol) and get a confirmed booking, an access PIN and a Payment-Receipt back. You don't need an account, an app or a card form.",
    "",
    "## What you can buy",
    ...CATEGORIES.map(
      (c) =>
        `- ${c.name}: $${c.price}.00 deposit ${c.unit}, bookable ${formatHour(c.hours[0])}–${formatHour(c.hours[1] % 24)}. POST ${base}/api/book/${c.slug}`,
    ),
    "",
    "## Payment",
    "- Protocol: MPP (HTTP 402 + WWW-Authenticate: Payment). Method: tempo, intent: charge.",
    "- Network: Tempo testnet. Currency: pathUSD. Prices are listed above and in /openapi.json (x-payment-info).",
    "- Calling a booking route without payment returns 402 with the price. Pay and retry the same request.",
    "",
    "## How to book (3 steps)",
    `1. GET ${base}/api/services lists the services, venue ids, hours and deposits (free).`,
    `2. GET ${base}/api/availability?service=tennis&date=${today} shows the open hours per venue (free).`,
    `3. POST ${base}/api/book/tennis with JSON {"venue":"tennis-riverside-1","date":"${today}","time":"18:00","name":"Sam"}.`,
    "   CityMeter checks the slot for free first: 400 means bad input and 409 means taken (alternatives included). No payment is taken in either case.",
    "   If the slot is free, you get 402. Pay it and retry; the response is 201 with booking.id, booking.accessPin and booking.ticket.",
    "",
    "Example with the mppx CLI:",
    `  npx mppx ${base}/api/book/tennis --network testnet -J '{"venue":"tennis-riverside-1","date":"${today}","time":"18:00"}'`,
    "",
    "## Rules",
    `- 1-hour slots, on the hour, city-local time (Europe/Dublin), up to ${BOOKING_WINDOW_DAYS} days ahead.`,
    "- Each payment is bound to the exact venue + slot it was quoted for.",
    "- Deposits are non-refundable in this demo. If you lose a race for a slot after paying, the 409 response includes your receipt for a refund.",
    "",
    "## Links",
    `- OpenAPI: ${base}/openapi.json`,
    `- Booking status: GET ${base}/api/bookings/{id}`,
    `- Live board: ${base}/`,
    "",
  ];
  return new Response(lines.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
