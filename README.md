# TechLord & Co.

A mobile-first storefront for photo printing & frames, laptop stickers, phone
cases, graphic design, bulk SMS, web development, and custom printing
services — with a cart, Paystack checkout, order tracking, product reviews,
a WhatsApp support button, and an admin dashboard for managing products,
orders, messages, and reviews.

## Files

```
techlord-expert/
├── index.html      ← page structure/markup
├── style.css       ← all styling (mobile + wide-screen)
├── app.js          ← all app logic (products, packages, cart, checkout, Me, shopkeeper, storage)
├── api/catalog.js  ← tiny serverless function that talks to Upstash Redis (speed cache)
├── .gitignore
└── README.md
```

Plain HTML/CSS/JavaScript — no build step, no `npm install` required.

## What's new in this version

- **New layout** — on phones: header with **Me**, search bar under the name,
  *Business Branding Packages* carousel (+ **See all**), categories, products,
  and a bottom bar of **Track · Categories · Store (big, gently animated) · Cart · Shopkeeper**.
  On wide screens the same pieces open out into a roomier layout and the bottom
  bar becomes a floating dock.
- **Me (no account)** — the first purchase creates a **Customer ID** (e.g. `TLC-7K2M9X`).
  *Me* shows that customer's purchase history plus the offers/announcements the shopkeeper posts.
  On another device they enter Customer ID + phone number.
  Each customer is stored in Firestore (`techlord_customers`, document id = Customer ID)
  with name, phone, email, address, payment number, order count and total spent.
  Each order now carries the `customerId`.
- **Packages** — Shopkeeper → **PAK** tab: create/edit/hide/delete packages (name, price,
  what's included, description, images, video link). Saved packages appear on the website
  immediately. Images play as an auto-advancing slideshow (swipe works too). Packages can be
  ordered through the normal cart and Paystack checkout.
- **Offers** — Shopkeeper → **Offers**: post a discount (%) or an announcement, aimed at everyone,
  at customers with *N or more orders* / *GH₵ spent*, or at specific Customer IDs. Eligible
  customers see them under **Me** and can apply discounts at checkout.
- **Layout** — Shopkeeper → **Layout**: choose whether packages or products come first, reorder
  packages, and pin products so they show first.
- **Customers** tab — search customers, copy a Customer ID, or send it by WhatsApp.
- **Speed cache (Upstash Redis)** — see below.

## ⚡ Speed cache with Upstash Redis (optional, ~10 minutes)

Product photos live inside Firestore, which is why the catalogue can take a while to appear.
With the cache, every save you make as shopkeeper also copies a *light* version of the
catalogue (small thumbnails only) into Redis. Visitors read that first and see products and
packages almost immediately; Firestore then loads the full-size photos quietly in the background.
The last snapshot is also kept on each visitor's phone, so repeat visits paint instantly.

1. **Upstash**: create a Redis database (free plan is fine). In its **REST API** section note the
   **URL**, the normal **Token**, and the **Read-Only Token**.
2. **Vercel** (or any host that runs `api/` functions): add three environment variables
   - `UPSTASH_REDIS_REST_URL` = the URL
   - `UPSTASH_REDIS_REST_TOKEN` = the normal token (stays on the server only)
   - `CACHE_SECRET` = any long random text you invent
   then redeploy. *(Netlify/Cloudflare work too, but `api/catalog.js` needs a small wrapper.)*
3. **Optional but fastest**: in `app.js` fill `UPSTASH_REST_URL` and `UPSTASH_READONLY_TOKEN`
   (the **read-only** token is designed to be public). Visitors then read Redis directly.
   If you leave them blank, the app reads through `/api/catalog` instead.
4. Open **Shopkeeper → Settings → Speed cache**, paste the same `CACHE_SECRET`, and tap
   **Save key**. From then on every product/package/price/layout change updates Redis automatically
   (or tap **Refresh cache now**). The key is kept on that device only.

Never put the normal Upstash token in `app.js` — anyone could read it and change your catalogue.
Stock changes made by *customers' purchases* don't update Redis; Firestore fixes the numbers a
second after the page opens.

## ⚡ Set this up before you rely on it — 5 minutes

By default, product/order/review/message data is saved in the browser's
own storage (`localStorage`). That means it now **survives a reload** —
but it only lives on that one device. An edit made on your phone won't
show up on a customer's phone. To fix that for real, connect a free
Firebase project — it takes about 5 minutes and costs nothing at this
scale:

1. Go to **console.firebase.google.com** → **Add project** → give it any
   name → finish the setup wizard (you can skip Google Analytics).
2. In your new project, click **Build → Firestore Database → Create
   database** → choose **Start in test mode** → pick any location → Enable.
   *(Test mode is fine to launch with — see the security note below for
   what to do once you're live.)*
3. Click the **gear icon → Project settings**, scroll to "Your apps",
   click the **`</>`** (web) icon, give the app any nickname, and click
   **Register app**. Firebase will show you a `firebaseConfig` object
   that looks like this:
   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project",
     storageBucket: "your-project.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abc123"
   };
   ```
4. Open `app.js` in this project, find `const FIREBASE_CONFIG = { ... }`
   near the top, and paste your six values in (keep the same field names).
5. Save, commit, and push. Once deployed, every admin edit will appear on
   every device instantly — no reload needed.

These six values are **safe to commit and safe to be public** — Firebase
config isn't a secret, access is controlled by Firestore's own security
rules, not by hiding this object.

### How product images are stored (no billing plan required)

Firebase Cloud Storage requires a billing account even for free-tier use,
so this app doesn't use it. Instead, each photo is resized and
re-compressed right in the browser when you upload it (turning a multi-MB
phone photo into roughly 50–150KB), then saved as text directly inside
that product's own Firestore document — completely free, no card needed.

Each product also gets its **own** Firestore document rather than
sharing one big document with every other product. That matters because
Firestore caps every document at 1MB — splitting products up means that
limit applies per product, not to your whole catalog combined, and it's
also why editing one product doesn't need to rewrite everyone else's data
too. If a photo is still too big after compressing, or a product's
photos add up to too much, you'll get a clear on-screen message telling
you to remove one or use a smaller photo — never a silent failure.

### Securing it before real launch

"Test mode" leaves your database wide open to anyone on the internet for
30 days. Before you go live with real customers, go to **Firestore
Database → Rules** and tighten them — at minimum, something like:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /techlord_store/{doc} {
      allow read: if true;   // anyone can browse products/prices
      allow write: if false; // block direct writes — see note below
    }
    // also used by the app: techlord_products, techlord_packages, techlord_customers
    // (customers hold names/phones — they need real protection before launch)
  }
}
```

With `allow write: if false`, only you (via the Firebase console, or a
backend you control) could edit data directly — which would break the
admin panel's ability to save. A more complete real-world setup adds
proper Firebase Authentication for the admin login instead of the
current plain-JavaScript password check (see below), and scopes write
access to logged-in admins only. This is a good next step to ask about
once the store is live.

## ⚠️ Other things to know before real launch

- **Customer data needs real security rules before launch.** Customer IDs + phone numbers are
  checked in the browser, and (as before) the orders list is readable by the app. Once you move
  past test mode, lock Firestore down and add Firebase Authentication for the shopkeeper.
- **The shopkeeper password check runs in the browser.** It's a screen lock,
  not real security — anyone who opens dev tools can read it in the page
  source. Fine for keeping casual visitors out of the admin panel; not
  enough to rely on alone once real stock/pricing data matters.
- **Paystack payment verification.** The Paystack **public** key
  (`pk_live_...`) in `app.js` is safe there — it's designed for browser
  use. The **secret** key must never go in this repo or any front-end
  file. It belongs only on a server you control, used to verify each
  payment via Paystack's webhook/verify endpoint before an order is
  marked as paid. Without that step, a payment "success" from the browser
  can't be fully trusted. Happy to help build that small backend piece
  next.

## Running it locally

Open `index.html` directly in a browser, or serve the folder with:
```bash
npx serve .
```

## Support widgets

- **WhatsApp button** (bottom-right): opens a chat with the number set in
  `app.js` as `WHATSAPP_NUMBER`. Update it there if the number changes.
- **Help button**: sends a message straight to the admin dashboard's
  Messages tab.

## Sharing a product

Each product in **Shopkeeper → Products** has a **Share** button. It
opens the phone's native share sheet with a plain link back to that exact
product, plus a caption with the name and price — pick WhatsApp, TikTok,
Instagram, or anything else installed. Anyone who taps the link lands in
the app on that exact product, ready to buy. This needs no server
component — it works with a plain deploy, same as everything else in this
repo.

## Default shopkeeper login

The default shopkeeper password is `techlord2026` (set in `app.js` under
`state.adminPassword`, used only the very first time the database has no
password saved yet). Change it immediately after your first deploy via
**Shopkeeper → Settings → Change shopkeeper password**.
