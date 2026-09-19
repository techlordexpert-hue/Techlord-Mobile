# TechLord & Co.

A mobile-first storefront for photo printing & frames, laptop stickers, phone
cases, graphic design, bulk SMS, web development, and custom printing
services — with a cart, Paystack checkout, order tracking, product reviews,
a WhatsApp support button, and an admin dashboard for managing products,
orders, messages, and reviews.

## Files

```
techlord-expert/
├── index.html   ← page structure/markup
├── style.css    ← all styling
├── app.js       ← all app logic (products, cart, checkout, admin, storage)
├── .gitignore
└── README.md
```

Plain HTML/CSS/JavaScript — no build step, no `npm install` required.

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

- **The admin password check runs in the browser.** It's a screen lock,
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

## Sharing a product (rich preview, like sharing a TikTok link)

Each product in **Admin → Products/Settings** has a **Share** button. It
opens the phone's native share sheet with a special link
(`/api/share?id=<product-id>`) — when that link is posted to WhatsApp
Status, TikTok, or Instagram, those apps fetch the link and build a
preview card showing the product's actual photo, name, and price (no file
is attached or downloadable — it's a preview, the same way sharing a
TikTok video link shows a thumbnail). Anyone who taps it lands straight in
the app on that exact product, ready to buy.

This is powered by two small serverless functions that sit directly in
`api/` — `api/share.js` (builds the preview page) and
`api/product-image.js` (serves the product's stored photo as a real image
URL, since preview cards can't read the base64 image data straight out of
Firestore). **Vercel runs these automatically** — no extra setup, just
make sure both files end up inside a top-level `api` folder in your repo
(not loose at the repo root, and not nested any deeper than that one
folder).

Two things worth knowing:
- These functions read straight from Firestore, so they only work once
  deployed on Vercel with your real Firebase project connected — they
  won't work in a quick local preview or in Claude's own preview link.
- If you ever swap to a different Firebase project, update `PROJECT_ID`
  at the top of both files in `api/` to match.

## Default admin login

The default admin password is `techlord2026` (set in `app.js` under
`state.adminPassword`, used only the very first time the database has no
password saved yet). Change it immediately after your first deploy via
**Admin → Settings → Change admin password**.
