// The city's bookable public services. Prices are deposits in USD (paid in pathUSD on Tempo testnet).

export const CITY = "Riverside";
export const TIMEZONE = "Europe/Dublin";
export const BOOKING_WINDOW_DAYS = 14;

export type Category = {
  slug: string;
  name: string;
  emoji: string;
  /** Deposit per 1-hour slot, in USD as a decimal string (mppx amount format). */
  price: string;
  unit: string;
  /** Bookable hours, local time: [open, close) */
  hours: [number, number];
  blurb: string;
  venues: Venue[];
};

export type Venue = { id: string; name: string; area: string };

export const CATEGORIES: Category[] = [
  {
    slug: "tennis",
    name: "Tennis courts",
    emoji: "🎾",
    price: "4",
    unit: "per court-hour",
    hours: [7, 22],
    blurb: "Floodlit public hard courts. Booking includes the gate PIN.",
    venues: [
      { id: "tennis-riverside-1", name: "Riverside Park · Court 1", area: "Riverside Park" },
      { id: "tennis-riverside-2", name: "Riverside Park · Court 2", area: "Riverside Park" },
      { id: "tennis-harbour", name: "Harbour Green · Court A", area: "Harbour" },
    ],
  },
  {
    slug: "ev-charger",
    name: "EV chargers",
    emoji: "⚡",
    price: "2",
    unit: "per hour reserved",
    hours: [0, 24],
    blurb: "22 kW council chargers. Booking unlocks the bay with the PIN.",
    venues: [
      { id: "ev-quay-a", name: "Quay Street · Charger A", area: "City Centre" },
      { id: "ev-quay-b", name: "Quay Street · Charger B", area: "City Centre" },
      { id: "ev-library", name: "Central Library car park · Charger 1", area: "Northside" },
    ],
  },
  {
    slug: "library-room",
    name: "Library study rooms",
    emoji: "📚",
    price: "1",
    unit: "per room-hour",
    hours: [9, 21],
    blurb: "Quiet rooms for 1–6 people with a screen and whiteboard.",
    venues: [
      { id: "lib-central-1", name: "Central Library · Room 1 (4 seats)", area: "Northside" },
      { id: "lib-central-2", name: "Central Library · Room 2 (6 seats)", area: "Northside" },
      { id: "lib-maker", name: "Central Library · Maker Lab (3D printer)", area: "Northside" },
    ],
  },
  {
    slug: "parking",
    name: "Parking bays",
    emoji: "🅿️",
    price: "3",
    unit: "per bay-hour",
    hours: [7, 23],
    blurb: "Reserved on-street bays with a sign that shows your plate.",
    venues: [
      { id: "park-market-1", name: "Market Square · Bay 1", area: "City Centre" },
      { id: "park-market-2", name: "Market Square · Bay 2", area: "City Centre" },
      { id: "park-stadium", name: "Stadium Road · Accessible Bay", area: "Southside" },
    ],
  },
];

export function getCategory(slug: string) {
  return CATEGORIES.find((c) => c.slug === slug);
}

export function getVenue(id: string) {
  for (const c of CATEGORIES) {
    const v = c.venues.find((v) => v.id === id);
    if (v) return { category: c, venue: v };
  }
  return undefined;
}

// ---------- time helpers (city-local) ----------

/** Today's date (YYYY-MM-DD) and current hour in the city's timezone. */
export function cityNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

export function addDays(date: string, n: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function formatHour(h: number) {
  return `${String(h).padStart(2, "0")}:00`;
}

export function prettyDate(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-IE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export type BookingRequest = { venue: string; date: string; time: string; name?: string };

export type ValidSlot = { category: Category; venue: Venue; date: string; hour: number; name: string };

/** Validates a booking request against the catalogue and booking window. Returns an error message or a slot. */
export function validateRequest(categorySlug: string, body: unknown): { error: string } | { slot: ValidSlot } {
  const category = getCategory(categorySlug);
  if (!category) return { error: `Unknown service "${categorySlug}"` };
  if (!body || typeof body !== "object") return { error: "Send a JSON body: {venue, date, time}" };
  const b = body as Record<string, unknown>;

  const venue = category.venues.find((v) => v.id === b.venue);
  if (!venue) {
    return { error: `Unknown venue for ${category.slug}. Use one of: ${category.venues.map((v) => v.id).join(", ")}` };
  }

  const date = String(b.date ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: 'date must be "YYYY-MM-DD"' };

  const m = String(b.time ?? "").match(/^(\d{1,2})(?::00)?$/);
  if (!m) return { error: 'time must be on the hour, e.g. "10:00"' };
  const hour = Number(m[1]);
  if (hour < category.hours[0] || hour >= category.hours[1]) {
    return { error: `${category.name} are bookable ${formatHour(category.hours[0])}–${formatHour(category.hours[1] % 24 || 24)}` };
  }

  const now = cityNow();
  const last = addDays(now.date, BOOKING_WINDOW_DAYS - 1);
  if (date < now.date || (date === now.date && hour <= now.hour)) return { error: "That slot is in the past" };
  if (date > last) return { error: `Bookings open ${BOOKING_WINDOW_DAYS} days ahead (latest ${last})` };

  const name = typeof b.name === "string" ? b.name.trim().slice(0, 60) : "";
  return { slot: { category, venue, date, hour, name: name || "Agent booking" } };
}
