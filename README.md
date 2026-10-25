# TechLord & Co.

A mobile-first online store for photo printing & frames, laptop stickers, phone cases, graphic
design, bulk SMS, web development and custom printing — with business branding packages, cart,
Paystack checkout, order tracking, product reviews, customer history (**Me**), offers, a WhatsApp
help button and a **Shopkeeper** dashboard.

**Upstash Redis is the only database.** There is no Firebase/Firestore any more.

## Files

```
techlord-expert/
├── index.html                       page structure
├── style.css                        all styling (phone + wide screen)
├── app.js                           the storefront + shopkeeper dashboard (runs in the browser)
├── api/store.js                     the backend: the ONLY thing that talks to Redis
├── lib/defaults.js                  starter products, loaded into Redis once on first run
├── scripts/migrate-from-firestore.js   one-time copy of your old Firestore data into Redis
└── README.md
```

## Why there is a small backend

Redis can't be opened directly from a customer's phone: whoever could read the key could read every
order, phone number and the shopkeeper password. So the browser only ever calls `/api/store`, which
holds the secret Redis token on the server and decides who may see what:

| Who | Can do |
|---|---|
| **Anyone** | read the catalogue, packages, public offers; place an order; track an order by order ID or phone number; send a help message; write a review |
| **A customer** (Customer ID + the phone they ordered with) | see their own history, offers and updates under **Me** |
| **The shopkeeper** (password → 12-hour session) | everything else: products, packages, orders, customers, offers, layout, messages, reviews, settings |

The shopkeeper password is now checked on the **server** (stored hashed, with login attempts limited).
Prices, stock and discounts are recomputed on the server at checkout, so they can't be tampered with
from the browser.

## Setup (about 10 minutes)

1. **Upstash**: create a Redis database (the free plan is fine). In its **REST API** section copy the
   **URL** and the normal **Token** (not the read-only one).
2. **Vercel**: import this folder as a project. Under *Settings → Environment Variables* add:

   | Name | Value |
   |---|---|
   | `UPSTASH_REDIS_REST_URL` | the URL from step 1 |
   | `UPSTASH_REDIS_REST_TOKEN` | the Token from step 1 |
   | `PAYSTACK_SECRET_KEY` | your Paystack **secret** key (`sk_live_…`) — strongly recommended; the server then confirms each payment with Paystack before recording an order, and flags any amount mismatch. Server only — never put it in `app.js`. |
   | `ADMIN_PASSWORD` | *(optional)* your first shopkeeper password. If you skip it, the first password is `techlord2026` — change it straight away in **Shopkeeper → Settings**. |

   Then deploy. The first visit loads the starter catalogue into Redis automatically.
3. **Moving from the old Firestore version** (only if you have existing data) — see below.

Local testing: `npm i -g vercel`, then `vercel dev` in this folder (with the same environment variables).
Opening `index.html` directly no longer works because the backend isn't running.

### Moving your existing data from Firestore (once)

After the new version is deployed, on any computer with Node 18+:

```bash
node scripts/migrate-from-firestore.js --site https://YOUR-SITE.vercel.app --password YOUR_SHOPKEEPER_PASSWORD
```

Add `--wipe` first if you already created test products in the new version and want a clean copy.
It copies products (with photos), packages, categories, orders, reviews, messages, offers, layout and
customers. Past buyers who never had a Customer ID get one automatically (grouped by phone number).
It only *reads* Firestore — nothing there is changed. It needs Firestore to still be readable, so run
it **before** you switch Firestore off. Afterwards, log in once as shopkeeper: the small photo
thumbnails are built automatically (a few seconds), and from then on the store opens fast.

## What's in the app

- **Home (phone):** header with **Me**, search under the name, *Business Branding Packages* carousel
  (+ **See all**), categories, products, and a bottom bar of **Track · Categories · Store · Cart · Shopkeeper**.
  Wide screens get a roomier layout and the bottom bar becomes a floating dock.
- **Packages:** images auto-play as a slideshow; swipe works too. Order them through the normal cart.
- **Me (no account):** the first purchase creates a Customer ID like `TLC-7K2M9X` (tied to the phone
  number). On another device, enter the ID and the phone number. Shows history, offers and updates.
- **Shopkeeper dashboard:** Overview · Products · **PAK** (packages) · Orders · Customers · Offers · Layout · Messages · Reviews · Settings.
  - *Layout*: packages-first or products-first, package order, pinned products.
  - *Offers*: percentage discounts or announcements, aimed at everyone, at customers with N+ orders or
    GH₵ spent, or specific Customer IDs. Eligible customers can apply discounts at checkout.
  - *Orders*: shows the Customer ID, any offer used, and a ⚠ warning if payment wasn't verified, the
    amount didn't match, or stock ran short.

## How it stays fast

- Photos are stored once at full size (shown when a product/package is opened) and once as a **small
  thumbnail** (used by the home page grid and the package slideshows). The catalogue the home page
  loads contains thumbnails only, so it's small.
- The catalogue is cached for a few seconds at the edge, and the last copy is kept on each visitor's
  phone, so repeat visits paint instantly while the newest copy loads.
- Open pages re-check for changes every 15 seconds (and when you return to the tab). A shopkeeper change
  reaches visitors within a few seconds — there is no live socket any more.
- If a customer pays but their connection drops before the order is recorded, the order is kept on
  their phone and recorded automatically next time they open the store. A retry never creates a
  duplicate (orders are de-duplicated by Paystack reference).

**Redis usage:** a catalogue load is about 7 Redis commands. The Upstash free plan includes 500K
commands/month, which is plenty for a small shop; check the Upstash console if traffic grows.

## Before real launch

- Set `PAYSTACK_SECRET_KEY` so payments are verified server-side.
- Change the shopkeeper password (or set `ADMIN_PASSWORD`) and keep it strong.
- Tracking by phone number shows an order's status, date, total and items (never address or phone)
  to anyone who knows that number — the same as before.
- Photos are stored inside Redis. That's fine for a shop this size; if you ever hold hundreds of
  high-resolution photos, move them to an image host.

## Support widgets

- **WhatsApp button** (bottom-right): opens a chat with `WHATSAPP_NUMBER` in `app.js`.
- **Help button**: sends a message straight to **Shopkeeper → Messages** (limited to 10 per visitor per hour).
- Each product's **Share** button (Shopkeeper → Products → Edit) creates a link straight to that product.
