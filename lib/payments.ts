import { createHmac } from "node:crypto";
import { Mppx, Store, tempo } from "mppx/server";
import { pool } from "./db";

/** The city's wallet that receives booking deposits (Tempo testnet). */
export const RECIPIENT = (process.env.CITY_WALLET_ADDRESS ?? "0xDDd8FEFE0B7b3632cfDB0b1285987f963266cA16") as `0x${string}`;

/** pathUSD on Tempo testnet (Moderato). */
export const PATH_USD = "0x20c0000000000000000000000000000000000000" as const;

const globalForMppx = globalThis as unknown as { citymeterMppx?: ReturnType<typeof create> };

function create() {
  return Mppx.create({
    methods: [
      tempo.charge({
        currency: PATH_USD,
        recipient: RECIPIENT,
        testnet: true,
        // Shared replay protection across serverless instances.
        store: Store.postgres(pool),
      }),
    ],
    secretKey: process.env.MPP_SECRET_KEY!,
    // On Vercel the default realm is the per-deployment hostname; pin it to the public domain.
    ...(process.env.MPP_REALM ? { realm: process.env.MPP_REALM } : {}),
  });
}

export const mppx = (globalForMppx.citymeterMppx ??= create());

/** Signs a booking id so only the payer (who got the link) can see the access PIN. */
export function ticketKey(id: string) {
  return createHmac("sha256", process.env.MPP_SECRET_KEY ?? "dev").update(`ticket:${id}`).digest("base64url").slice(0, 16);
}

export function baseUrl(req: Request) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}
