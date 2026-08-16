# Zeem Marketplace ⚡

Full-stack marketplace for Algeria (58 wilayas) built with **Next.js 15 (App Router)**,
**TypeScript**, **Tailwind CSS**, **Shadcn/ui**, **Prisma + PostgreSQL**,
**NextAuth.js v5**, **Zustand**, **TanStack Query**, **Pusher** (realtime) and
**@react-pdf/renderer** (invoices).

All data lives in PostgreSQL — every API route reads/writes through Prisma.

## Local setup

Requires **Node 20+** (Next 15 needs `^18.18 || >=20`) and **PostgreSQL 14+**.

### 1. Start PostgreSQL

**macOS (Homebrew):**

```bash
brew install postgresql@16
brew services start postgresql@16
```

If `psql` is not found, add it to your PATH:

```bash
echo 'export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc
```

To run it in a dedicated terminal tab with live logs instead of as a
background service, stop the service first (both would fight for port 5432):

```bash
brew services stop postgresql@16
postgres -D "$(brew --prefix)/var/postgresql@16"     # Ctrl+C to stop
```

**Linux:** `sudo service postgresql start`.

### 2. Create the role and database

> **macOS gotcha:** Homebrew does not create a `postgres` user — it creates a
> superuser named after your macOS account, with no password. The committed
> `DATABASE_URL` expects `postgres:password`, so without this step you get
> `role "postgres" does not exist`.

```bash
createuser -s postgres
psql -d postgres -c "ALTER USER postgres PASSWORD 'password';"
createdb -O postgres zeem_db
```

Alternatively, keep your own account and edit **both** `.env` and `.env.local`
to `postgresql://YOUR_MAC_USERNAME@localhost:5432/zeem_db`, then `createdb zeem_db`.

### 3. Install dependencies

```bash
npm install     # postinstall runs `prisma generate` for you
```

### 4. Configure environment

`DATABASE_URL` appears in **two** files and both must match — Prisma's CLI reads
`.env`, Next.js reads `.env.local`:

| File | Read by | Contains |
|---|---|---|
| `.env` | Prisma CLI (`migrate`, `db seed`, `studio`) | `DATABASE_URL`, `DIRECT_URL` |
| `.env.local` | the Next.js app | `DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, optional keys |

`DIRECT_URL` is the non-pooled connection used by migrations. On a local
PostgreSQL keep it identical to `DATABASE_URL`; see the Neon section for when
the two differ.

Generate a real auth secret and paste it into `NEXTAUTH_SECRET` in `.env.local`
— the committed placeholder will not work:

```bash
openssl rand -base64 32
```

### 5. Create the schema and seed

```bash
npx prisma migrate deploy    # applies the committed migrations
npm run db:seed              # 58 wilayas, 163 communes, 174 shipping rates, admin
```

Use `migrate deploy`, not `migrate dev` — the migrations already exist, and
`dev` may offer to reset your database.

### 6. Run

```bash
npm run dev                  # http://localhost:3000
```

A typical layout is three terminal tabs: PostgreSQL, `npm run dev`, and
`npx prisma studio` (a database browser on `localhost:5555`).

### Using Neon instead of a local PostgreSQL

Neon is hosted Postgres, so you skip steps 1 and 2 entirely — nothing runs on
your machine and no `createdb` is needed. Only the connection strings change.

1. Create a project at [neon.tech](https://neon.tech). On the dashboard's
   **Connection Details** panel, copy **both** strings:
   - the **pooled** one (host contains `-pooler`) → `DATABASE_URL`
   - the **direct / unpooled** one (no `-pooler`) → `DIRECT_URL`

2. Put them in **both** `.env` and `.env.local`:

```
DATABASE_URL="postgresql://USER:PASSWORD@ep-xxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require"
DIRECT_URL="postgresql://USER:PASSWORD@ep-xxx.REGION.aws.neon.tech/neondb?sslmode=require"
```

3. Then the normal steps — no local database required:

```bash
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

**Why two URLs.** Neon's pooler runs PgBouncer in transaction mode, which
breaks the advisory locks and prepared statements `prisma migrate` depends on.
The schema declares `directUrl`, so migrations use the direct connection while
the running app uses the pooled one. Pointing `DIRECT_URL` at the `-pooler`
host produces confusing migration failures — `npm run db:check` detects and
reports exactly that.

Keep `?sslmode=require`; Neon refuses plaintext connections. If your password
contains `@ : / ?` or `#`, URL-encode it.

Neon free-tier projects suspend after a few minutes idle, so the first request
after a pause takes a second or two while the compute wakes.

### Verifying

```bash
npm run db:check
```

This checks the whole chain in the order it actually breaks: `.env` and
`.env.local` agreeing on `DATABASE_URL`, the database being reachable,
migrations applied, seed data present, and finally whether the admin password
really validates against the stored hash. It reads `.env.local` — the same file
Next.js uses — so it tests the database the app will actually query.

### Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `role "postgres" does not exist` | Step 2 was skipped — see the macOS gotcha above. |
| `Environment variable not found: DATABASE_URL` | Running a Prisma command without `.env` present. |
| `Can't reach database server at localhost:5432` | PostgreSQL is not running: `brew services start postgresql@16`. |
| `postmaster.pid already exists` / `address already in use` | An instance is already running — usually the brew service. Stop it, or skip the foreground tab. |
| `Identifiants invalides` at login | Run `npm run db:check` — it names the cause. Most often `.env` and `.env.local` point at different databases, so the seed populated one and the app reads the other. |
| Env change seems ignored | Next.js reads env vars only at startup. Stop the dev server (Ctrl+C) and run `npm run dev` again. |
| `Environment variable not found: DIRECT_URL` | Add `DIRECT_URL` to `.env` — same value as `DATABASE_URL` locally. |
| Migration hangs or errors on Neon/Supabase | `DIRECT_URL` is pointing at the pooled host. Use the unpooled string. |

### Logins created by the seed

| Role | Email | Password |
|---|---|---|
| Admin | `admin@zeem.dz` | `ZeemAdmin123` |
| Wilaya Manager (Alger, 16) | `manager@zeem.dz` | `ZeemDemo123` |
| Seller | `seller@zeem.dz` | `ZeemDemo123` |
| Delivery Agent (Alger, 16) | `agent@zeem.dz` | `ZeemDemo123` |
| Accountant | `accountant@zeem.dz` | `ZeemDemo123` |
| ERP Manager | `erp@zeem.dz` | `ZeemDemo123` |
| Logistics Manager | `logistics@zeem.dz` | `ZeemDemo123` |
| Customer Support | `support@zeem.dz` | `ZeemDemo123` |
| Buyer | `buyer@zeem.dz` | `ZeemDemo123` |

Sign in with the email **or** the phone number — the form accepts either.

The seed also creates an approved demo store (« Boutique El Djazaïr », Alger)
with four published products, so the storefront is populated and the full
order → delivery → commission flow works immediately.

**Before going to production, delete the demo block in `prisma/seed.ts`** —
it is marked with a comment — and change the admin password.

Additional staff can be created from the admin dashboard's **Nouveau membre**
button. Sellers self-register at `/login` → *Inscription* → *Vendeur*; their
store starts inactive and a wilaya manager approves it before they can publish.

## Database layer

`prisma/schema.prisma` — 15 models: Profile, Wilaya, Commune, Store, Product,
ProductVariant, Order, OrderItem, Shipment, Transaction, ShippingRate,
LoyaltyPoints, PointsTransaction, AuditLog, Review, DeliveryLocationUpdate,
plus 9 enums (Role, OrderStatus, CheckoutType, ShipmentStatus, TransType,
TransStatus, PointsType, ReviewStatus).

Seeded data: 58 wilayas, 163 communes, 174 shipping rates (3 couriers ×
58 wilayas, priced by remoteness: 250 DZD base, 400 for semi-remote, 1200 for
desert wilayas).

`src/lib/fulfillment.ts` holds the critical COD money logic. `completeDelivery()`
runs in a single Prisma transaction:

1. marks the shipment `DELIVERED_COD_COLLECTED` with the collected amount, agent
   and GPS breadcrumb;
2. flips the order to `DELIVERED` once every shipment on it is delivered;
3. splits `totalAmount × store.commissionRate / 100` into 80% `COMMISSION_OWNER`
   and 20% `COMMISSION_MANAGER` (both `PAID`), plus a `PAYOUT` row (`PENDING`)
   of `totalAmount − commission − shippingFee`;
4. credits the store balance;
5. awards the buyer 1 loyalty point per 100 DZD (registered buyers only).

## The nine actors

| Actor | Route | What it does |
|---|---|---|
| Super Admin | `/dashboard/admin` | Pulse KPIs (GMV, ventes, vendeurs, refus COD), 30-day Revenue-vs-Orders chart, top-10 store and product leaderboards, per-wilaya density map, audit feed, God Mode overrides |
| Wilaya Manager | `/dashboard/manager` | Regional KPIs, seller approval queue (approve/reject with reason + notification), commune heatmap, 2% commission tracker with payout request |
| Seller | `/dashboard/seller` | 30-day KPIs, critical-stock alert bar, fulfillment queue, product wizard (auto-SKU + AI description), encrypted courier keys with Test Connection, finance tab |
| Buyer | `/`, `/profile`, `/track/[ref]` | Storefront, fast checkout, multi-store cart with loyalty redemption, live map tracking with masked agent number, order history and points ledger |
| Accountant | `/dashboard/accountant` | Treasury (COD, commissions, 19% VAT, payables), COD reconciliation with >0.5% variance flags, date-ranged payout CSV, per-seller PDF invoices |
| ERP Manager | `/dashboard/erp` | Transactional CSV import/export, drag-and-drop category tree, attribute dictionary |
| Logistics Manager | `/dashboard/logistics` | Courier status board, 58×3 shipping matrix with bulk row apply, agent performance, smart assignment |
| Delivery Agent | `/dashboard/agent` | Mobile-first PWA: today's takings, pickups and deliveries, GPS ping toggle, COD collection, 3-attempt failure policy |
| Support Agent | `/dashboard/support` | Ticket queue, right-side detail drawer with order context, threaded replies with quick replies, escalation sweep |

**Roles added to the schema:** the original `Role` enum had seven values for
nine actors, so `LOGISTICS_MANAGER` and `SUPPORT` were added — without them
those two actors had no way to sign in.

## Settings & customization

Each actor has a settings page; every value is stored in PostgreSQL and read
back at request time, so a saved change takes effect immediately.

| Actor | Settings route |
|---|---|
| Super Admin | `/dashboard/admin/settings` |
| Wilaya Manager | `/dashboard/manager/settings` |
| Seller | `/dashboard/seller/settings` |
| Buyer | `/profile/settings` |
| Accountant | `/dashboard/accountant/settings` |
| ERP Manager | `/dashboard/erp/settings` |
| Logistics Manager | `/dashboard/logistics/settings` |
| Delivery Agent | `/dashboard/agent/settings` |
| Customer Support | `/dashboard/support/settings` |

Storage: `SystemSetting` (one JSON row per group, with typed defaults in
`src/lib/settings.ts` so a fresh install works before anything is saved),
`UserPreferences` (per-user), `EmailTemplate`, `Address`, `CannedResponse`,
`Courier`, `WilayaSettings` and `LoginEvent`.

**Settings that change behaviour, not just state:**

- Owner/manager commission split drives `completeDelivery()`; the API rejects a
  split that doesn't total 100%, since anything else silently loses money.
- Platform name and theme colours feed the page title, favicon and CSS tokens.
- Maintenance mode redirects everyone except admins to `/maintenance`.
- Guest-checkout and loyalty flags gate the checkout and points logic.
- Free-shipping thresholds (store override, then platform default) and the
  wilaya manager's regional surcharge both price real orders.
- Max delivery attempts drives the agent's retry-to-return policy.
- VAT rate and COD tolerance drive reconciliation and invoices.
- ERP delimiter, auto-publish, export columns and filename pattern drive
  import/export.
- Support keywords auto-escalate matching tickets to URGENT; auto-assign
  routes them round-robin or least-busy.

**Security notes.** Courier and seller API credentials are AES-encrypted at
rest and only ever returned masked (`••••2345`). Two-factor uses TOTP
(`otplib`) with a QR code. Sessions are JWTs, so there is no server-side
session list to enumerate — "sign out everywhere" bumps
`Profile.sessionsValidFrom` and the JWT callback rejects older tokens, which
genuinely revokes every session; the page shows login history instead of a
per-device kill switch. Phone changes require an SMS OTP.

**Template editing** is HTML source with a live preview pane, not a rich-text
toolbar — no WYSIWYG editor dependency ships with the app.

## Scheduled jobs

Next.js ships no scheduler, so two endpoints need an external trigger (Vercel
Cron, GitHub Actions, or any cron hitting the URL). Both also run manually from
their dashboard, and both accept the `x-cron-secret` header matching
`CRON_SECRET`:

- `POST /api/logistics/courier-health` — every ~5 min; pings each courier API
  and deactivates shipping rates for one that is down.
- `POST /api/support/escalate` — hourly; flags tickets left OPEN beyond
  `SUPPORT_ESCALATION_HOURS` (24 by default), writes an audit entry and
  notifies admins.

## Integrations that degrade gracefully

None of these are required to run the app; each reports its real state rather
than faking success:

| Integration | Without configuration |
|---|---|
| Email / SMS (`EMAIL_*`, `SMS_*`) | Message is logged server-side and reported as **undelivered** |
| OpenAI (`OPENAI_API_KEY`) | AI description falls back to a template; the response says `generated: false` |
| Courier APIs (`*_API_URL`) | Test Connection and health checks report **not configured**, never "connected" |
| Pusher (`PUSHER_*`) | Realtime broadcasts are no-ops; dashboards still refresh on their own |
| Meta Pixel (`META_*`) | Purchase events are logged, not sent |

## API routes

| Route | Access | Purpose |
|---|---|---|
| `POST /api/orders/fast` | public | COD checkout: Order + OrderItem + Shipment, atomic stock decrement, Meta Pixel + realtime |
| `PUT /api/shipments/[id]/deliver` | AGENT | COD collected → commission split, payout, loyalty points |
| `PUT /api/shipments/[id]/fail` | AGENT | failed delivery with reason |
| `GET /api/products/search?q=&wilayaCode=` | public | case-insensitive search, wilaya filter |
| `GET /api/admin/stats` | ADMIN | GMV, orders, top stores, month-over-month growth |
| `POST /api/admin/users` | ADMIN | create staff accounts |
| `POST /api/admin/force-update` | ADMIN | god-mode edits (reason mandatory, audited) |
| `GET /api/wilayas` | public | 58 wilayas + communes |
| `GET/POST/PUT/DELETE /api/seller/products*` | SELLER | product & variant management |
| `GET/PUT /api/seller/store` | SELLER | delivery provider settings |
| `GET /api/manager/stores` + `PUT …/[id]` | WILAYA_MANAGER | seller approvals |
| `GET /api/accountant/reconciliation` | ACCOUNTANT | COD reconciliation |
| `GET /api/accountant/payouts?format=csv` | ACCOUNTANT | bulk payout CSV |

## Auth & access control

NextAuth v5 with JWT sessions: credentials (email **or** phone + bcrypt
password) and Google OAuth (auto-enabled when `GOOGLE_CLIENT_*` are set). The
role is read from `Profile` at login and attached to the session, so
`src/middleware.ts` can enforce `/dashboard/*` access at the edge without a
database round-trip. Each role is locked to its own area; buyers are redirected
to the storefront.

## Deployment notes

- Use `prisma migrate deploy` in production instead of `migrate dev`.
- `public/uploads` is ephemeral on serverless hosts — plug in S3/UploadThing.
- Store `customApiKey` / `customApiSecret` encrypted at rest before going live.
