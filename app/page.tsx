import { headers } from "next/headers";
import { CopyButton, FeedProvider, LiveBoard, LiveStats, type Feed } from "@/components/LiveBoard";
import { addDays, CATEGORIES, cityNow, formatHour } from "@/lib/catalog";
import { recentBookings, stats } from "@/lib/db";

export const dynamic = "force-dynamic";

async function initialFeed(): Promise<Feed> {
  try {
    const [rows, s] = await Promise.all([recentBookings(15), stats()]);
    return {
      stats: s,
      bookings: rows.map((b) => ({
        id: b.id,
        emoji: CATEGORIES.find((c) => c.slug === b.category)?.emoji ?? "📍",
        service: b.category,
        venue: b.venue_name,
        date: b.date,
        time: formatHour(b.hour),
        amount: b.amount,
        paymentRef: b.payment_ref,
        createdAt: new Date(b.created_at).toISOString(),
      })),
    };
  } catch {
    return { stats: { bookings: 0, revenue: 0 }, bookings: [] };
  }
}

const TERMINAL: { cls: string; text: string }[] = [
  { cls: "t-user", text: "Book me a tennis court tomorrow at 6pm" },
  { cls: "t-agent", text: "Reading citymeter.vercel.app/llms.txt" },
  { cls: "t-req", text: "GET  /api/availability?service=tennis   200" },
  { cls: "t-dim", text: "     Riverside Park Court 1 · 18:00 is open" },
  { cls: "t-req", text: "POST /api/book/tennis" },
  { cls: "t-402", text: "     402 Payment Required · $4.00 pathUSD" },
  { cls: "t-agent", text: "Paying $4.00 on Tempo…  settled in 0.9s" },
  { cls: "t-201", text: "     201 Created · booking RV-9S6H8M" },
];

export default async function Home() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const base = `${host.startsWith("localhost") ? "http" : "https"}://${host}`;
  const now = cityNow();
  const tomorrow = addDays(now.date, 1);
  const feed = await initialFeed();

  const prompt = `Read ${base}/llms.txt and book me a tennis court tomorrow at 6pm.`;
  const cli = `npx mppx account create --network testnet
npx mppx account fund --network testnet

npx mppx ${base}/api/book/tennis --network testnet \\
  -J '{"venue":"tennis-riverside-1","date":"${tomorrow}","time":"18:00"}'`;

  return (
    <FeedProvider initial={feed}>
      <main>
        {/* ---------- HERO ---------- */}
        <section className="hero">
          <div className="wrap hero-grid">
            <div>
              <span className="pill">
                <b>MPP</b> Live on Tempo testnet <span className="dot" />
              </span>
              <h1>
                Let your AI agent <span className="g">book the city.</span>
              </h1>
              <p className="lede">
                Tennis courts, EV chargers, library rooms and parking, each on its own app today. CityMeter turns them
                into <b>one API that agents can pay</b>: one request, a deposit paid over HTTP, and a confirmed booking
                with an access PIN.
              </p>
              <div className="cta-row">
                <a className="btn btn-green" href="#try">
                  Try it with your agent →
                </a>
                <a className="btn btn-ghost" href="#live">
                  <span className="dot" /> Watch live bookings
                </a>
              </div>
              <div className="hero-note">No signup, no app and no card form. The agent pays per booking.</div>
            </div>

            <div className="term" aria-label="An AI agent booking a tennis court">
              <div className="term-bar">
                <i />
                <i />
                <i />
                <span>agent session</span>
              </div>
              <div className="term-body">
                {TERMINAL.map((l, i) => (
                  <div key={i} className={`term-line ${l.cls}`} style={{ animationDelay: `${0.35 + i * 0.45}s` }}>
                    {l.text}
                  </div>
                ))}
                <div
                  className="term-line t-box"
                  style={{ animationDelay: `${0.35 + TERMINAL.length * 0.45}s` }}
                >
                  ✅ Riverside Park · Court 1{"\n"}Tomorrow 18:00–19:00 · Gate PIN <b>2467</b>
                </div>
                <div className="term-line" style={{ animationDelay: `${0.6 + TERMINAL.length * 0.45}s` }}>
                  <span className="caret" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="strip">
          <div className="wrap">
            <LiveStats />
          </div>
        </div>

        {/* ---------- PROBLEM ---------- */}
        <section className="sec" id="problem">
          <div className="wrap">
            <div className="kicker">The problem</div>
            <h2>
              AI agents can plan your Saturday. <span className="m">They can&rsquo;t book a tennis court.</span>
            </h2>
            <p className="sub">
              Public services sit behind separate apps, logins and card forms, all built for a person tapping on a
              phone. An agent can&rsquo;t sign up, can&rsquo;t pass the checkout, and has no safe way to pay.
            </p>
            <div className="cards-3">
              <div className="card">
                <div className="big">4+</div>
                <h3>Apps for one city</h3>
                <p>Courts, chargers, libraries and parking usually each run their own booking system, account and payment flow.</p>
              </div>
              <div className="card">
                <div className="big">0</div>
                <h3>Ways for an agent to pay</h3>
                <p>Card forms, 3-D Secure and CAPTCHAs are built to stop bots, so the errand stops at the checkout.</p>
              </div>
              <div className="card">
                <div className="big">$</div>
                <h3>No-shows cost cities</h3>
                <p>Free holds get abandoned. A small deposit keeps the slot honest, but only if paying it is effortless.</p>
              </div>
            </div>

            <div className="before-after">
              <div className="ba">
                <h4>Today</h4>
                <ol>
                  <li>Find the council&rsquo;s court-booking site</li>
                  <li>Create an account and verify your email</li>
                  <li>Pick a court from a calendar widget</li>
                  <li>Type your card and pass 3-D Secure</li>
                  <li>Dig the gate code out of a confirmation email</li>
                </ol>
                <div className="total">
                  <span>~6 minutes per booking</span>
                  <span>Agent: ✕</span>
                </div>
              </div>
              <div className="ba after">
                <h4>With CityMeter</h4>
                <ol>
                  <li>&ldquo;Book me a court tomorrow at 6pm&rdquo;</li>
                  <li>The agent sends one HTTP request</li>
                  <li>It pays the $4 deposit automatically with MPP</li>
                  <li>The gate PIN comes back in the response</li>
                </ol>
                <div className="total">
                  <span>~1 second</span>
                  <span>Agent: ✓</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- HOW ---------- */}
        <section className="sec" id="how">
          <div className="wrap">
            <div className="kicker">How it works</div>
            <h2>
              One request. <span className="m">Payment is part of the HTTP exchange.</span>
            </h2>
            <p className="sub">
              CityMeter uses the Machine Payments Protocol (MPP), an open standard from Tempo and Stripe that brings the
              unused HTTP status <span className="mono">402 Payment Required</span> to life.
            </p>
            <div className="flow">
              <div className="step">
                <div className="num">01</div>
                <div className="code">GET /availability</div>
                <h3>Agent checks the slot</h3>
                <p>Free. Invalid or taken slots get a 400 or 409 with alternatives, so it never pays for something it can&rsquo;t have.</p>
              </div>
              <div className="step">
                <div className="num">02</div>
                <div className="code c402">402 · $4.00</div>
                <h3>City quotes the deposit</h3>
                <p>The challenge is tied to that exact court and hour, so the payment can&rsquo;t be replayed for another slot.</p>
              </div>
              <div className="step">
                <div className="num">03</div>
                <div className="code">Authorization: Payment</div>
                <h3>Agent pays and retries</h3>
                <p>pathUSD on Tempo settles in about a second, from the agent&rsquo;s own wallet.</p>
              </div>
              <div className="step">
                <div className="num">04</div>
                <div className="code c201">201 · PIN 2467</div>
                <h3>Booking confirmed</h3>
                <p>The response carries the booking, the gate or charger PIN, a ticket link and a signed Payment-Receipt.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- LIVE ---------- */}
        <section className="sec" id="live">
          <div className="wrap">
            <div className="kicker">Live</div>
            <h2>
              Real agents, real payments. <span className="m">Updated every 3 seconds.</span>
            </h2>
            <p className="sub">
              Each row below is a booking an agent paid for on Tempo testnet. Tap a transaction to see it on-chain.
            </p>
            <LiveBoard
              today={now.date}
              services={CATEGORIES.map((c) => ({ slug: c.slug, name: c.name, emoji: c.emoji, hours: c.hours }))}
            />
          </div>
        </section>

        {/* ---------- PRICING ---------- */}
        <section className="sec" id="services">
          <div className="wrap">
            <div className="kicker">What agents can book</div>
            <h2>
              Four city services. <span className="m">One API.</span>
            </h2>
            <p className="sub">Deposits are per 1-hour slot, bookable up to 14 days ahead. Prices are machine-readable in /openapi.json.</p>
            <div className="services">
              {CATEGORIES.map((c) => (
                <div className="svc" key={c.slug}>
                  <div className="e">{c.emoji}</div>
                  <div className="n">{c.name}</div>
                  <div className="p">
                    ${c.price}
                    <small> / hr</small>
                  </div>
                  <div className="d">{c.blurb}</div>
                  <code>POST /api/book/{c.slug}</code>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- TRY ---------- */}
        <section className="sec" id="try">
          <div className="wrap">
            <div className="kicker">Try it</div>
            <h2>
              Book a court in 30 seconds. <span className="m">From your terminal or your agent.</span>
            </h2>
            <p className="sub">It uses testnet money from a free faucet, so nothing real is spent.</p>
            <div className="try">
              <div className="prompt-card">
                <h3>Ask your coding agent</h3>
                <p>Paste this into Claude Code, Cursor or Codex. The agent reads the docs, checks availability and pays.</p>
                <div className="prompt">{prompt}</div>
                <div>
                  <CopyButton text={prompt} />
                </div>
              </div>
              <div className="codebox">
                <div className="bar">
                  <span>terminal</span>
                  <CopyButton text={cli} />
                </div>
                <pre>
                  <span className="c"># free testnet wallet</span>
                  {"\n"}npx mppx account create --network testnet
                  {"\n"}npx mppx account fund --network testnet
                  {"\n\n"}
                  <span className="c"># book it (mppx pays the 402 for you)</span>
                  {"\n"}
                  <span className="g">npx mppx</span> {base}/api/book/tennis \{"\n"}  --network testnet \{"\n"}  -J &apos;
                  {`{"venue":"tennis-riverside-1","date":"${tomorrow}","time":"18:00"}`}&apos;
                </pre>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- WHY ---------- */}
        <section className="sec">
          <div className="wrap">
            <div className="kicker">Built right</div>
            <h2>
              Safe enough to hand your agent a wallet.
            </h2>
            <p className="sub">The details that make paying per request safe for both the agent and the city.</p>
            <div className="why">
              <div>
                <h4>No paying for nothing</h4>
                <p>Slots are validated before the 402 is sent. A taken or invalid slot never asks for money.</p>
              </div>
              <div>
                <h4>Payment bound to the slot</h4>
                <p>Each challenge is scoped to venue + date + hour, so a credential can&rsquo;t be reused for a different booking.</p>
              </div>
              <div>
                <h4>Race-safe</h4>
                <p>A unique index means two agents can&rsquo;t both win one court. The loser gets their receipt back for a refund.</p>
              </div>
              <div>
                <h4>Replay protection</h4>
                <p>Used credentials are tracked in shared Postgres, so they&rsquo;re rejected on every serverless instance.</p>
              </div>
              <div>
                <h4>PIN only for the payer</h4>
                <p>The public feed never shows access codes. The ticket link is signed with an HMAC key.</p>
              </div>
              <div>
                <h4>Machine-readable</h4>
                <p>/openapi.json with x-payment-info and /llms.txt let agents discover prices without a human.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- FINAL CTA ---------- */}
        <section className="final">
          <div className="wrap">
            <h2>
              Every city service, <span style={{ color: "var(--green)" }}>one request away.</span>
            </h2>
            <p>Riverside is the demo. The same API can sit in front of any city&rsquo;s booking systems.</p>
            <div className="cta-row">
              <a className="btn btn-green" href="#try">
                Book with your agent →
              </a>
              <a className="btn btn-ghost" href="/llms.txt">
                Read llms.txt
              </a>
            </div>
          </div>
        </section>

        <footer className="foot">
          <div className="wrap">
            <span>© 2026 CityMeter · Built for the MPP Hackathon (Tempo × Stripe)</span>
            <span>
              <a href="/openapi.json">OpenAPI</a> · <a href="/llms.txt">llms.txt</a> ·{" "}
              <a href="https://mpp.dev" target="_blank" rel="noreferrer">
                mpp.dev
              </a>
            </span>
          </div>
        </footer>
      </main>
    </FeedProvider>
  );
}
