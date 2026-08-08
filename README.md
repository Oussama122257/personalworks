# Zeem Marketplace ⚡

Full-stack marketplace for Algeria (58 wilayas) built with **Next.js 15 (App Router)**,
**TypeScript**, **Tailwind CSS**, **Shadcn/ui**, **Prisma + PostgreSQL**,
**NextAuth.js v5**, **Zustand**, **TanStack Query**, **Pusher** (realtime) and
**@react-pdf/renderer** (invoices).

All data lives in PostgreSQL — every API route reads/writes through Prisma.

## Quick start

```bash
# 1. Install
npm install

# 2. Configure — edit .env.local (DATABASE_URL, AUTH_SECRET at minimum)
openssl rand -base64 32   # → AUTH_SECRET

# 3. Create the schema and seed (58 wilayas, communes, shipping rates, users)
npm run db:push
npm run db:seed

# 4. Run
npm run dev
```

## Seeded accounts

| Role | Email | Password |
|---|---|---|
| Admin | `admin@zeem.dz` | `ZeemAdmin123` |
| Seller | `seller@zeem.dz` | `ZeemDemo123` |
| Wilaya manager (Alger, 16) | `manager@zeem.dz` | `ZeemDemo123` |
| Accountant | `accountant@zeem.dz` | `ZeemDemo123` |
| Delivery agent (Alger, 16) | `agent@zeem.dz` | `ZeemDemo123` |
| Buyer | `buyer@zeem.dz` | `ZeemDemo123` |

A demo store (« Boutique El Djazaïr », approved, wilaya 16) with 5 products is
seeded so the storefront works immediately.

## Architecture

- `prisma/schema.prisma` — 15 models: Profile, Wilaya, Commune, Store, Product,
  ProductVariant, Order, Shipment, Transaction, ShippingRate, LoyaltyPoints,
  PointsTransaction, AuditLog, Review, DeliveryLocationUpdate.
- `src/lib/auth.ts` — NextAuth v5 (JWT sessions): credentials (email/phone +
  password, bcrypt) and Google OAuth (auto-enabled when `GOOGLE_CLIENT_*` are
  set). The user's `role` is read from `Profile` at login and attached to the
  session.
- `src/middleware.ts` — role-based access control on `/dashboard/*`
  (admin/seller/manager/accountant/agent each locked to their own area, buyers
  redirected to `/`).
- `src/lib/fulfillment.ts` — COD settlement in one DB transaction: commission
  split (80% platform owner / 20% wilaya manager), seller payout + store balance
  credit, loyalty points (1 pt / 100 DZD), audit log.
- `src/lib/store.ts` — Zustand stores (session + cart), hydrated from
  `/api/auth/session`; `src/app/providers.tsx` — TanStack Query provider.
- `src/lib/realtime.ts` + `src/hooks/useRealtime.ts` — Pusher broadcasting
  (orders channel for admin, `store-{id}` for sellers, `agent-{id}` for agents).
  No-ops gracefully when Pusher isn't configured.
- `src/lib/pixel.ts` — server-side Meta Pixel (Conversions API) `Purchase`
  events on fast orders. No-ops when unset.
- `POST /api/upload` — image uploads to `public/uploads` (swap for S3/UploadThing
  in production).

## Core API routes

| Route | Access | Purpose |
|---|---|---|
| `POST /api/orders/fast` | public | COD checkout: creates Order + Shipment, decrements stock atomically, fires Meta Pixel + realtime |
| `PUT /api/shipments/[id]/deliver` | agent | COD collected → commission split + payout + loyalty points |
| `PUT /api/shipments/[id]/fail` | agent | failed delivery with reason |
| `GET /api/products/search?q=&wilayaCode=` | public | case-insensitive search, wilaya filter |
| `GET /api/admin/stats` | admin | GMV, orders, top stores, month-over-month growth |
| `GET /api/wilayas` | public | 58 wilayas + communes |
| `GET/POST/PUT/DELETE /api/seller/products*` | seller | product & variant management |
| `GET/PUT /api/seller/store` | seller | shipping settings (ZEEM_DEFAULT vs custom) |
| `GET /api/manager/stores` + `PUT …/[id]` | manager | seller approvals |
| `GET /api/accountant/reconciliation` | accountant | COD reconciliation |
| `GET /api/accountant/payouts?format=csv` | accountant | bulk payout CSV |
| `POST /api/admin/force-update` | admin | god-mode edits (audited) |

## Deployment notes

- Set a real `AUTH_SECRET` and `DATABASE_URL`; add Google/Pusher/Meta keys as needed.
- Use `prisma migrate deploy` in production instead of `db push`.
- `public/uploads` storage is ephemeral on serverless hosts — plug in S3/UploadThing.
