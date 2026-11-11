import QRCode from "qrcode";
import { notFound } from "next/navigation";
import { CATEGORIES, formatHour, prettyDate } from "@/lib/catalog";
import { getBooking } from "@/lib/db";
import { ticketKey } from "@/lib/payments";

export const dynamic = "force-dynamic";

export default async function Ticket({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ k?: string }>;
}) {
  const { id } = await params;
  const { k } = await searchParams;
  const b = await getBooking(id.toUpperCase());
  if (!b) notFound();

  const owner = k === ticketKey(b.id);
  const cat = CATEGORIES.find((c) => c.slug === b.category);
  const qr = owner ? await QRCode.toString(`CITYMETER:${b.id}:${b.pin}`, { type: "svg", margin: 1 }) : null;

  return (
    <main className="ticket-page">
      <div className="ticket">
        <div className="head">
          <div className="s">
            {cat?.emoji} {cat?.name} · Riverside City
          </div>
          <div className="v">{b.venue_name}</div>
        </div>
        <div className="body">
          <div className="row">
            <span className="k">When</span>
            <span className="v">
              {prettyDate(b.date)}, {formatHour(b.hour)}–{formatHour((b.hour + 1) % 24)}
            </span>
          </div>
          <div className="row">
            <span className="k">Booking</span>
            <span className="v">{b.id}</span>
          </div>
          {owner && (
            <div className="row">
              <span className="k">Name</span>
              <span className="v">{b.name}</span>
            </div>
          )}
          <div className="row">
            <span className="k">Deposit</span>
            <span className="v">${Number(b.amount).toFixed(2)} paid via MPP ({b.payment_method ?? "tempo"})</span>
          </div>
          {b.payment_ref && (
            <div className="row">
              <span className="k">Payment ref</span>
              <span className="v" style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}>
                {b.payment_ref}
              </span>
            </div>
          )}
          {owner ? (
            <>
              <div className="pin">
                <div style={{ fontSize: 13, color: "var(--muted)" }}>Access PIN</div>
                <div className="d">{b.pin}</div>
              </div>
              <div className="qr" dangerouslySetInnerHTML={{ __html: qr! }} />
            </>
          ) : (
            <div className="empty">This booking is confirmed. Only the payer&rsquo;s ticket link shows the access PIN.</div>
          )}
        </div>
      </div>
      <a className="back" href="/">← CityMeter live board</a>
    </main>
  );
}
