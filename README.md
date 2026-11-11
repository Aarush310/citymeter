# CityMeter

**City services that your AI agent can book and pay for in one HTTP request.**

🔗 **Live:** https://citymeter.vercel.app · [llms.txt](https://citymeter.vercel.app/llms.txt) · [openapi.json](https://citymeter.vercel.app/openapi.json)

Built for the [MPP Hackathon](https://mpp-hackathon.vercel.app/) (Tempo × Stripe) with **Stripe Projects**, **mppx**, **Neon** and **Vercel**.

---

## The problem

Every public service has its own booking system: tennis courts, EV chargers, library rooms and parking each have a different app, account, card form and confirmation email. A person can deal with that, slowly. An AI agent can't. So "book me a tennis court Saturday at 10" is still a job you do yourself.

## The idea

CityMeter puts a city's bookable services behind **one MPP-priced API**. An agent:

1. **Reads** `/llms.txt` or `/openapi.json` to learn what's bookable and what it costs
2. **Checks** availability for free
3. **Books** with one `POST`. The city replies `402 Payment Required` with the deposit, the agent pays in pathUSD on Tempo, and it retries the same request
4. **Gets back** a confirmed booking, a gate or charger **access PIN**, a ticket link and a `Payment-Receipt`

There's no account, app or card form, and payment takes about a second.

| Service | Deposit | Route |
|---|---|---|
| 🎾 Tennis courts | $4 per court-hour | `POST /api/book/tennis` |
| ⚡ EV chargers | $2 per hour reserved | `POST /api/book/ev-charger` |
| 📚 Library study rooms | $1 per room-hour | `POST /api/book/library-room` |
| 🅿️ Parking bays | $3 per bay-hour | `POST /api/book/parking` |

Riverside is a fictional city. The venues, PINs and gates are simulated, but **the payments are real MPP transactions on Tempo testnet**.

## Try it

```bash
# a testnet wallet with free funds
npx mppx account create --network testnet
npx mppx account fund --network testnet

# what's open tomorrow (free)
curl "https://citymeter.vercel.app/api/availability?service=tennis&date=YYYY-MM-DD"

# book it. mppx pays the 402 and retries automatically
npx mppx https://citymeter.vercel.app/api/book/tennis --network testnet \
  -J '{"venue":"tennis-riverside-1","date":"YYYY-MM-DD","time":"18:00","name":"Sam"}'
```

Or ask a coding agent: *"Read https://citymeter.vercel.app/llms.txt and book me a tennis court tomorrow at 6pm."*

Then watch the booking show up on the [live board](https://citymeter.vercel.app).

## Design decisions

- **You never pay for a slot you can't have.** The slot is validated and checked *before* the 402 is issued. A bad request gets a free `400`, and a taken slot gets a free `409` with alternatives (other courts at the same time, later hours on the same court).
- **Each payment covers one slot.** Every challenge has an mppx `scope` of `venue@date+hour`, so a credential paid for Court 1 at 18:00 can't be replayed to book Court 2.
- **Race-safe.** A unique index on `(venue, date, hour)` means two agents paying for the same slot at the same moment can't both get it. The loser gets a `409` with their receipt attached, so they can ask for a refund.
- **Replay protection works across serverless instances.** mppx uses the same Neon Postgres (`Store.postgres`) as the bookings, so a used credential is rejected by every Vercel instance.
- **The PIN only goes to the payer.** The public feed and `/api/bookings/{id}` never show it. The ticket link carries an HMAC key.
- **The realm is pinned** to the public hostname with `MPP_REALM`, so challenges say `citymeter.vercel.app` rather than Vercel's per-deployment URL.

## Validation

```
npx mppx validate https://citymeter.vercel.app --body '<per-route booking bodies>'
→ passed: 92, failed: 0, warnings: 0
npx mppx discover validate https://citymeter.vercel.app/openapi.json
→ Discovery document is valid.
```

## Stack (set up with Stripe Projects)

| Layer | Provider | Set up with |
|---|---|---|
| Database (bookings + mppx replay store) | Neon Postgres | `stripe projects add neon/postgres` |
| Hosting | Vercel | `stripe projects add vercel/project` |
| MPP receipt signing key | Stripe Projects variable | `stripe projects variables set mpp-secret --env-key MPP_SECRET_KEY` |
| Payments | MPP · Tempo testnet · pathUSD | [`mppx`](https://github.com/wevm/mppx) |
| App | Next.js 16 (App Router) | |

## Run locally

```bash
stripe projects env --pull     # writes .env (never committed)
npm install
npm run build && npx next start -p 3100
npx mppx validate http://localhost:3100 --body '{"/api/book/tennis":{"venue":"tennis-harbour","date":"YYYY-MM-DD","time":"10:00"}}'
```

Environment: `MPP_SECRET_KEY`, `NEON_POSTGRES_CONNECTION_STRING`, optional `CITY_WALLET_ADDRESS` (the recipient), and `MPP_REALM` (the public hostname) in production.

## API

| Method | Path | Cost |
|---|---|---|
| GET | `/api/services` | free |
| GET | `/api/availability?service=&date=` | free |
| POST | `/api/book/{tennis,ev-charger,library-room,parking}` | MPP deposit |
| GET | `/api/bookings/{id}` | free |
| GET | `/openapi.json`, `/llms.txt` | free |

## What's next

- Stripe card payments through a Shared Payment Token, alongside Tempo, so agents with a card-backed wallet can pay too
- Cancellations with an automatic refund before a cutoff
- An adapter layer, so real council booking systems can sit behind the same API
