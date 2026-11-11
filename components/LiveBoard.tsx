"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";

type FeedItem = {
  id: string;
  emoji: string;
  service: string;
  venue: string;
  date: string;
  time: string;
  amount: string;
  paymentRef: string | null;
  createdAt: string;
};
export type Feed = { stats: { bookings: number; revenue: number }; bookings: FeedItem[] };
type Availability = { date: string; venues: { venue: string; name: string; open: string[] }[] };
export type ServiceTab = { slug: string; name: string; emoji: string; hours: [number, number] };

const EXPLORER = "https://explore.testnet.tempo.xyz/receipt/";

type Ctx = { feed: Feed; fresh: Set<string> };
const FeedContext = createContext<Ctx | null>(null);

/** Polls /api/feed once and shares it with every live widget on the page. */
export function FeedProvider({ initial, children }: { initial: Feed; children: React.ReactNode }) {
  const [feed, setFeed] = useState(initial);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const seen = useRef(new Set(initial.bookings.map((b) => b.id)));

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("/api/feed", { cache: "no-store" });
        if (!r.ok) return;
        const next: Feed = await r.json();
        if (!alive) return;
        const newIds = next.bookings.filter((b) => !seen.current.has(b.id)).map((b) => b.id);
        newIds.forEach((id) => seen.current.add(id));
        if (newIds.length) setFresh(new Set(newIds));
        setFeed(next);
      } catch {}
    };
    const t = setInterval(load, 3000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return <FeedContext.Provider value={{ feed, fresh }}>{children}</FeedContext.Provider>;
}

function useFeed() {
  const ctx = useContext(FeedContext);
  if (!ctx) throw new Error("FeedProvider missing");
  return ctx;
}

function ago(iso: string) {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

function shortRef(ref: string) {
  return ref.length > 18 ? `${ref.slice(0, 10)}…${ref.slice(-6)}` : ref;
}

export function LiveStats() {
  const { feed } = useFeed();
  return (
    <div className="stats">
      <div className="stat">
        <div className="n g">{feed.stats.bookings}</div>
        <div className="l">bookings made by agents</div>
      </div>
      <div className="stat">
        <div className="n">${feed.stats.revenue.toFixed(2)}</div>
        <div className="l">deposits settled via MPP</div>
      </div>
      <div className="stat">
        <div className="n">~1s</div>
        <div className="l">from 402 to confirmed</div>
      </div>
      <div className="stat">
        <div className="n">0</div>
        <div className="l">accounts, apps or card forms</div>
      </div>
    </div>
  );
}

export function LiveBoard({ services, today }: { services: ServiceTab[]; today: string }) {
  const { feed, fresh } = useFeed();
  const [, tick] = useState(0);
  useEffect(() => {
    const c = setInterval(() => tick((n) => n + 1), 10000);
    return () => clearInterval(c);
  }, []);

  return (
    <div className="board">
      <div className="panel">
        <div className="panel-head">
          <h3>Bookings</h3>
          <span className="live-tag">
            <span className="dot" /> live
          </span>
        </div>
        {feed.bookings.length === 0 ? (
          <div className="empty">No bookings yet. The first agent to pay shows up here within a few seconds.</div>
        ) : (
          <ul className="feed">
            {feed.bookings.slice(0, 8).map((b) => (
              <li key={b.id} className={fresh.has(b.id) ? "fresh" : ""}>
                <div className="ico">{b.emoji}</div>
                <div className="what-wrap">
                  <div className="what">{b.venue}</div>
                  <div className="when">
                    {b.date} · {b.time} · {ago(b.createdAt)}
                  </div>
                  {b.paymentRef && (
                    <div className="ref">
                      <a href={`${EXPLORER}${b.paymentRef}`} target="_blank" rel="noreferrer">
                        tx {shortRef(b.paymentRef)} ↗
                      </a>
                    </div>
                  )}
                </div>
                <div className="amt">${Number(b.amount).toFixed(2)}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <SlotGrid services={services} today={today} refreshKey={feed.stats.bookings} />
    </div>
  );
}

function SlotGrid({ services, today, refreshKey }: { services: ServiceTab[]; today: string; refreshKey: number }) {
  const [svc, setSvc] = useState(services[0].slug);
  const [day, setDay] = useState(today);
  const [data, setData] = useState<Availability | null>(null);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const label = i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString("en-IE", { weekday: "short", day: "numeric", timeZone: "UTC" });
    return { iso, label };
  });
  const current = services.find((s) => s.slug === svc)!;

  useEffect(() => {
    let alive = true;
    fetch(`/api/availability?service=${svc}&date=${day}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setData(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [svc, day, refreshKey]);

  const hours: number[] = [];
  for (let h = current.hours[0]; h < current.hours[1]; h++) hours.push(h);
  const nowHour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Dublin", hour: "2-digit", hourCycle: "h23" }).format(new Date()),
  );
  const step = hours.length > 16 ? 6 : 3;

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>Riverside availability</h3>
        <select className="day-select" value={day} onChange={(e) => setDay(e.target.value)} aria-label="Day">
          {days.map((d) => (
            <option key={d.iso} value={d.iso}>
              {d.label}
            </option>
          ))}
        </select>
      </div>
      <div className="tabs" role="group" aria-label="Service">
        {services.map((s) => (
          <button key={s.slug} className="tab" aria-pressed={s.slug === svc} onClick={() => setSvc(s.slug)}>
            {s.emoji} {s.name}
          </button>
        ))}
      </div>
      <div className="slots">
        {data &&
          data.venues.map((v) => {
            const open = new Set(v.open.map((t) => Number(t.slice(0, 2))));
            return (
              <div className="slot-row" key={v.venue}>
                <div className="name">{v.name}</div>
                <div className="cells">
                  {hours.map((h) => {
                    const past = day === today && h <= nowHour;
                    const cls = past ? "cell past" : open.has(h) ? "cell" : "cell taken";
                    return <div key={h} className={cls} title={`${String(h).padStart(2, "0")}:00`} />;
                  })}
                </div>
              </div>
            );
          })}
        {data && (
          <div className="hours-axis">
            {hours.map((h) => (
              <div key={h}>{h % step === 0 ? String(h).padStart(2, "0") : ""}</div>
            ))}
          </div>
        )}
        {!data && <div className="empty">Loading availability…</div>}
      </div>
      <div className="legend">
        <span>
          <i style={{ background: "var(--green-soft)", border: "1px solid rgba(34,229,122,.3)" }} /> open
        </span>
        <span>
          <i style={{ background: "var(--green)" }} /> booked by an agent
        </span>
        <span>
          <i style={{ background: "#151515", border: "1px solid #222" }} /> past
        </span>
      </div>
    </div>
  );
}

export function CopyButton({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      className={`copy${ok ? " ok" : ""}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setOk(true);
          setTimeout(() => setOk(false), 1600);
        } catch {}
      }}
    >
      {ok ? "copied ✓" : "copy"}
    </button>
  );
}
