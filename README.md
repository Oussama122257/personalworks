# Zeem Marketplace ⚡

Full-stack marketplace for Algeria (58 wilayas) built with **Next.js 15 (App Router)**,
**TypeScript**, **Tailwind CSS**, **Shadcn/ui**, **Prisma + PostgreSQL**,
**NextAuth.js v5**, **Zustand**, **TanStack Query**, **Pusher** (realtime) and
**@react-pdf/renderer** (invoices).

All data lives in PostgreSQL — every API route reads/writes through Prisma.

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Generate Prisma Client
npx prisma generate

# 3. Create the migration and apply to database
npx prisma migrate dev --name init

# 4. Run the seed script to populate Wilayas and Admin
npx prisma db seed

# 5. Start the development server
npm run dev
```

Before step 3, point `DATABASE_URL` at your PostgreSQL instance. It appears in
**two** files and both must match:

| File | Read by | Contains |
|---|---|---|
| `.env` | the Prisma CLI (`migrate`, `db seed`, `studio`) | `DATABASE_URL` only |
| `.env.local` | the Next.js app | `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, optional keys |

Generate a real secret with `openssl rand -base64 32` and put it in
`NEXTAUTH_SECRET`.

### After seeding

The seed creates the geography and **one** account:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@zeem.dz` | `ZeemAdmin123` |

Sign in as the admin, then create staff (wilaya managers, delivery agents,
accountants) from the admin dashboard's **Nouveau membre** button, which posts to
`POST /api/admin/users`. Sellers self-register at `/login` → *Inscription* →
*Vendeur*; their store starts inactive and a wilaya manager approves it before
they can publish products.

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
