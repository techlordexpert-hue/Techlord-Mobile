#!/usr/bin/env node
/* One-time move of your existing store data from Firestore into Redis (through your own /api/store).

   Run it ONCE, after you've deployed the new version (so /api/store is live), from any computer with Node 18+:

     node scripts/migrate-from-firestore.js --site https://YOUR-SITE.vercel.app --password YOUR_SHOPKEEPER_PASSWORD

   Options:
     --project techlord-27aba   Firebase project id (this is already the default for your store)
     --wipe                     empty the Redis store first (use if you already tried things in the new version)

   What it copies: products (with photos), packages, categories, orders, reviews, messages, offers,
   layout and customers. Past buyers who never had a Customer ID get one (grouped by phone number),
   so they can use Me straight away. It only READS Firestore (which must still be readable — your
   current test-mode rules allow that). Nothing in Firestore is changed or deleted.
   After the copy, open the Shopkeeper dashboard once: it builds the small thumbnails automatically. */
const arg = (n, d) => { const i = process.argv.indexOf("--" + n); return i > -1 ? (process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : true) : d; };
const SITE = String(arg("site", "")).replace(/\/$/, ""), PASSWORD = arg("password", "");
const PROJECT = arg("project", "techlord-27aba"), WIPE = !!arg("wipe", false);
const FS = String(arg("firestore", "https://firestore.googleapis.com/v1")).replace(/\/$/, "");
if (!SITE || !PASSWORD) { console.error("Usage: node scripts/migrate-from-firestore.js --site https://your-site --password YOUR_PASSWORD [--wipe]"); process.exit(1); }

function dec(v) {
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return Date.parse(v.timestampValue);
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(dec);
  if ("mapValue" in v) return decFields(v.mapValue.fields || {});
  return null;
}
const decFields = (f) => Object.fromEntries(Object.entries(f || {}).map(([k, v]) => [k, dec(v)]));
const base = `${FS}/projects/${PROJECT}/databases/(default)/documents`;

async function listCollection(name) {
  const out = []; let token = "";
  do {
    const r = await fetch(`${base}/${name}?pageSize=100${token ? "&pageToken=" + encodeURIComponent(token) : ""}`);
    if (r.status === 404) return out;
    if (!r.ok) throw new Error(`Firestore ${name}: HTTP ${r.status} (is it still readable?)`);
    const j = await r.json();
    (j.documents || []).forEach((d) => out.push({ id: d.name.split("/").pop(), ...decFields(d.fields) }));
    token = j.nextPageToken || "";
  } while (token);
  return out;
}
async function storeDoc(name) {
  const r = await fetch(`${base}/techlord_store/${name}`);
  if (r.status === 404) return undefined;
  if (!r.ok) throw new Error(`Firestore ${name}: HTTP ${r.status}`);
  return decFields((await r.json()).fields).value;
}

let TOKEN = "";
async function post(body) {
  const r = await fetch(SITE + "/api/store", { method: "POST", headers: { "Content-Type": "application/json", ...(TOKEN ? { "x-admin-token": TOKEN } : {}) }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${body.a}${body.section ? "/" + body.section : ""}: ${j.error || r.status}`);
  return j;
}
const imp = (section, extra) => post({ a: "import", section, ...extra });

(async () => {
  console.log("Logging in to", SITE);
  TOKEN = (await post({ a: "login", password: PASSWORD })).token;
  if (WIPE) { console.log("Emptying the Redis store first…"); await imp("wipe"); }

  for (const [coll, section] of [["techlord_products", "products"], ["techlord_packages", "packages"], ["techlord_customers", "customers"]]) {
    const docs = await listCollection(coll); let n = 0;
    for (const d of docs) { await imp(section, { item: d }); n++; process.stdout.write(`\r${section}: ${n}/${docs.length}   `); }
    console.log(`\r${section}: ${n} copied        `);
  }
  const orders = (await storeDoc("orders")) || [];
  for (const o of orders) await imp("orders", { item: o });
  console.log(`orders: ${orders.length} copied`);
  const cats = await storeDoc("categories"); if (cats) await imp("categories", { value: cats });
  const offers = await storeDoc("offers"); if (offers) await imp("offers", { value: offers });
  const layout = await storeDoc("layout"); if (layout) await imp("layout", { value: layout });
  const reviews = (await storeDoc("reviews")) || {}; await imp("reviews", { value: reviews });
  const messages = (await storeDoc("messages")) || []; await imp("messages", { value: messages });
  console.log(`categories, offers, layout, ${Object.keys(reviews).length} reviewed items, ${messages.length} messages copied`);

  const fin = await imp("finish");
  console.log(`\nDone. ${fin.orders} orders linked to customers; ${fin.customersCreated} past buyers were given a new Customer ID.`);
  console.log("Next: open the site, log in as shopkeeper once so photo thumbnails are built. You can then stop using Firebase.");
})().catch((e) => { console.error("\nMigration stopped:", e.message); process.exit(1); });
