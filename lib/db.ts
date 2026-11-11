import { randomInt } from "node:crypto";
import { Pool } from "pg";
import type { ValidSlot } from "./catalog";

const globalForPool = globalThis as unknown as { citymeterPool?: Pool };

export const pool =
  globalForPool.citymeterPool ??
  new Pool({
    connectionString: process.env.NEON_POSTGRES_CONNECTION_STRING ?? process.env.DATABASE_URL,
    max: 5,
    ssl: { rejectUnauthorized: false },
  });
globalForPool.citymeterPool = pool;

let ready: Promise<void> | undefined;

/** Creates the bookings table on first use. */
export function ensureSchema() {
  ready ??= pool
    .query(
      `CREATE TABLE IF NOT EXISTS bookings (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        venue_id TEXT NOT NULL,
        venue_name TEXT NOT NULL,
        date DATE NOT NULL,
        hour SMALLINT NOT NULL,
        name TEXT NOT NULL,
        pin TEXT NOT NULL,
        amount TEXT NOT NULL,
        payment_ref TEXT,
        payment_method TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (venue_id, date, hour)
      )`,
    )
    .then(() => undefined)
    .catch((e) => {
      ready = undefined;
      throw e;
    });
  return ready;
}

export type Booking = {
  id: string;
  category: string;
  venue_id: string;
  venue_name: string;
  date: string;
  hour: number;
  name: string;
  pin: string;
  amount: string;
  payment_ref: string | null;
  payment_method: string | null;
  created_at: string;
};

const SELECT = `SELECT id, category, venue_id, venue_name, to_char(date, 'YYYY-MM-DD') AS date, hour, name, pin, amount,
  payment_ref, payment_method, created_at FROM bookings`;

/** Hours already taken for the given venues on a date. */
export async function takenHours(venueIds: string[], date: string) {
  await ensureSchema();
  const { rows } = await pool.query<{ venue_id: string; hour: number }>(
    `SELECT venue_id, hour FROM bookings WHERE venue_id = ANY($1) AND date = $2`,
    [venueIds, date],
  );
  const map = new Map<string, Set<number>>();
  for (const r of rows) {
    if (!map.has(r.venue_id)) map.set(r.venue_id, new Set());
    map.get(r.venue_id)!.add(r.hour);
  }
  return map;
}

export async function isTaken(venueId: string, date: string, hour: number) {
  await ensureSchema();
  const { rowCount } = await pool.query(`SELECT 1 FROM bookings WHERE venue_id = $1 AND date = $2 AND hour = $3`, [
    venueId,
    date,
    hour,
  ]);
  return (rowCount ?? 0) > 0;
}

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function bookingId() {
  let s = "";
  for (let i = 0; i < 6; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return `RV-${s}`;
}

/** Inserts the booking. Returns null if the slot was taken in the meantime. */
export async function createBooking(slot: ValidSlot): Promise<Booking | null> {
  await ensureSchema();
  const { rows } = await pool.query<Booking>(
    `INSERT INTO bookings (id, category, venue_id, venue_name, date, hour, name, pin, amount)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (venue_id, date, hour) DO NOTHING
     RETURNING id, category, venue_id, venue_name, to_char(date, 'YYYY-MM-DD') AS date, hour, name, pin, amount,
       payment_ref, payment_method, created_at`,
    [
      bookingId(),
      slot.category.slug,
      slot.venue.id,
      slot.venue.name,
      slot.date,
      slot.hour,
      slot.name,
      String(randomInt(1000, 10000)),
      slot.category.price,
    ],
  );
  return rows[0] ?? null;
}

export async function attachPayment(id: string, ref: string | undefined, method: string | undefined) {
  await pool.query(`UPDATE bookings SET payment_ref = $2, payment_method = $3 WHERE id = $1`, [id, ref ?? null, method ?? null]);
}

export async function getBooking(id: string) {
  await ensureSchema();
  const { rows } = await pool.query<Booking>(`${SELECT} WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function recentBookings(limit = 20) {
  await ensureSchema();
  const { rows } = await pool.query<Booking>(`${SELECT} ORDER BY created_at DESC LIMIT $1`, [limit]);
  return rows;
}

export async function stats() {
  await ensureSchema();
  const { rows } = await pool.query<{ count: string; total: string | null }>(
    `SELECT count(*)::text AS count, sum(amount::numeric)::text AS total FROM bookings`,
  );
  return { bookings: Number(rows[0].count), revenue: Number(rows[0].total ?? 0) };
}
