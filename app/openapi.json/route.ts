import { generate } from "mppx/discovery";
import { addDays, BOOKING_WINDOW_DAYS, CATEGORIES, cityNow, formatHour } from "@/lib/catalog";
import { baseUrl, mppx, PATH_USD, RECIPIENT } from "@/lib/payments";

export const dynamic = "force-dynamic";

const bookingBody = (slug: string, example: string, exDate: string, exTime: string) => ({
  required: true,
  content: {
    "application/json": {
      schema: {
        type: "object",
        required: ["venue", "date", "time"],
        properties: {
          venue: { type: "string", description: "Venue id from GET /api/services", example },
          date: { type: "string", format: "date", description: "City-local date, YYYY-MM-DD, up to 14 days ahead", example: exDate },
          time: { type: "string", pattern: "^\\d{2}:00$", description: "Start of the 1-hour slot, e.g. 10:00", example: exTime },
          name: { type: "string", maxLength: 60, description: "Name on the booking (optional)", example: "Sam" },
        },
      },
    },
  },
  description: `Book one 1-hour ${slug} slot`,
});

const confirmation = {
  description: "Booking confirmed. Includes the access PIN and a Payment-Receipt header.",
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: {
          status: { type: "string", const: "confirmed" },
          booking: {
            type: "object",
            properties: {
              id: { type: "string" },
              service: { type: "string" },
              venue: { type: "string" },
              venueId: { type: "string" },
              date: { type: "string", format: "date" },
              time: { type: "string" },
              timezone: { type: "string" },
              name: { type: "string" },
              accessPin: { type: "string" },
              deposit: { type: "string" },
              ticket: { type: "string", format: "uri" },
            },
          },
          instructions: { type: "string" },
        },
      },
    },
  },
};

export function GET(req: Request) {
  const base = baseUrl(req);
  // Examples point at a real, far-out, late slot so example-driven clients get a genuine 402 quote.
  const exDate = addDays(cityNow().date, BOOKING_WINDOW_DAYS - 1);
  const doc = generate(
    { methods: mppx.methods, realm: new URL(base).host },
    {
      info: { title: "CityMeter: book Riverside city services", version: "1.0.0" },
      serviceInfo: {
        categories: ["booking", "city-services", "mobility"],
        docs: { homepage: base, llms: `${base}/llms.txt`, apiReference: `${base}/openapi.json` },
      },
      routes: CATEGORIES.map((c) => ({
        method: "post",
        path: `/api/book/${c.slug}`,
        intent: "charge",
        summary: `Book ${c.name.toLowerCase()} ($${c.price} deposit ${c.unit})`,
        options: {
          amount: c.price,
          currency: PATH_USD,
          decimals: 6,
          recipient: RECIPIENT,
          description: `${c.name} deposit, ${c.unit} (Riverside City)`,
        },
        requestBody: bookingBody(c.slug, c.venues[0].id, exDate, formatHour(c.hours[1] - 1)),
      })),
    },
  ) as { paths: Record<string, Record<string, Record<string, unknown>>> } & Record<string, unknown>;

  // Richer responses for the paid routes.
  for (const c of CATEGORIES) {
    const op = doc.paths[`/api/book/${c.slug}`].post;
    op.operationId = `book_${c.slug.replace(/-/g, "_")}`;
    op.responses = {
      "201": confirmation,
      "400": { description: "Invalid booking request (no payment taken)" },
      "402": { description: "Payment Required: pay the deposit with MPP and retry" },
      "409": { description: "Slot already booked (no payment taken); alternatives included" },
    };
  }

  // Free discovery routes.
  doc.paths["/api/services"] = {
    get: { operationId: "list_services", summary: "List bookable services, venues, hours and deposits (free)", responses: { "200": { description: "Service catalogue" } } },
  };
  doc.paths["/api/availability"] = {
    get: {
      operationId: "get_availability",
      summary: "Open 1-hour slots per venue for a service and date (free)",
      parameters: [
        { name: "service", in: "query", required: true, schema: { type: "string", enum: CATEGORIES.map((c) => c.slug) } },
        { name: "date", in: "query", required: false, schema: { type: "string", format: "date" } },
      ],
      responses: { "200": { description: "Availability" } },
    },
  };
  doc.paths["/api/bookings/{id}"] = {
    get: {
      operationId: "get_booking",
      summary: "Look up a booking's status and payment reference (free)",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: { "200": { description: "Booking" }, "404": { description: "Not found" } },
    },
  };

  return Response.json(doc, { headers: { "Access-Control-Allow-Origin": "*" } });
}
