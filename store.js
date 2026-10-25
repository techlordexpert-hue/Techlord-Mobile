/* TechLord & Co. — the store's backend. Upstash Redis is the only database.

   The browser never talks to Redis. Everything goes through this one function, which
   holds the secret Redis token and decides who may read or change what.

   Environment variables (Vercel -> Project -> Settings -> Environment Variables):
     UPSTASH_REDIS_REST_URL     from the Upstash console (REST API section)
     UPSTASH_REDIS_REST_TOKEN   the normal (read/write) token — server only
     ADMIN_PASSWORD             (optional) first shopkeeper password; default "techlord2026".
                                Once changed inside the app, the app's password wins.
     PAYSTACK_SECRET_KEY        (recommended) lets the server verify each payment with Paystack
                                before an order is recorded.
*/
const crypto = require("crypto");
const { CATEGORIES, PRODUCTS } = require("../lib/defaults");

/* ------------------------------ Redis ------------------------------ */
async function pipe(cmds) {
  const r = await fetch(process.env.UPSTASH_REDIS_REST_URL.replace(/\/$/, "") + "/pipeline", {
    method: "POST",
    headers: { Authorization: "Bearer " + process.env.UPSTASH_REDIS_REST_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(cmds),
  });
  if (!r.ok) throw new Error("Upstash " + r.status);
  return (await r.json()).map((o) => { if (o.error) throw new Error(o.error); return o.result; });
}
const one = async (...c) => (await pipe([c]))[0];
const obj = (flat) => { const o = {}; for (let i = 0; i < (flat || []).length; i += 2) o[flat[i]] = flat[i + 1]; return o; };
const J = (s) => { try { return JSON.parse(s); } catch (e) { return null; } };
const vals = (flat) => Object.values(obj(flat)).map(J).filter(Boolean);
const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
const str = (v, max) => String(v == null ? "" : v).trim().slice(0, max);

/* ------------------------------ helpers ------------------------------ */
const phoneKey = (ph) => String(ph || "").replace(/\D/g, "").slice(-9);
const idNum = (id) => parseInt(String(id).replace(/\D/g, ""), 10) || 0;
function genCid() { const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; const b = crypto.randomBytes(6); let t = ""; for (const x of b) t += A[x % A.length]; return "TLC-" + t; }
function normLayout(v) {
  return {
    sectionOrder: v && Array.isArray(v.sectionOrder) && v.sectionOrder.length === 2 ? v.sectionOrder : ["packages", "products"],
    packageOrder: (v && Array.isArray(v.packageOrder) && v.packageOrder) || [],
    productPins: (v && Array.isArray(v.productPins) && v.productPins) || [],
  };
}
function offerEligible(o, c) {
  if (!o || o.active === false) return false;
  if (o.expiresAt && Date.now() > o.expiresAt) return false;
  const ids = String(o.ids || "").split(/[\s,]+/).filter(Boolean).map((x) => x.toUpperCase());
  if (!(ids.length || o.minOrders > 0 || o.minSpent > 0)) return true;
  if (!c) return false;
  if (ids.length && !ids.includes(String(c.id).toUpperCase())) return false;
  return (c.orderCount || 0) >= (o.minOrders || 0) && (c.totalSpent || 0) >= (o.minSpent || 0);
}
const bump = () => ["SET", "tl:ts", String(Date.now())];
async function limit(key, max, secs) {
  const [n] = await pipe([["INCR", key], ["EXPIRE", key, secs, "NX"]]);
  return n <= max;
}

/* ------------------------------ auth ------------------------------ */
const hashPw = (pw, salt) => crypto.scryptSync(pw, salt, 32).toString("hex");
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
async function checkPassword(pw) {
  const rec = J(await one("GET", "tl:admin"));
  if (rec) return same(hashPw(pw, rec.salt), rec.hash);
  return same(pw, process.env.ADMIN_PASSWORD || "techlord2026");
}
async function isAdmin(req) {
  const t = req.headers["x-admin-token"];
  return !!(t && /^[a-f0-9]{48}$/.test(t) && (await one("GET", "tl:sess:" + t)));
}

/* ------------------------------ catalogue ------------------------------ */
const liteProduct = (p) => ({
  id: p.id, name: str(p.name, 120), category: str(p.category, 80), price: num(p.price), stock: Math.max(0, Math.floor(num(p.stock))),
  desc: str(p.desc, 2000), video: str(p.video, 500), thumb: p.thumb || "", imgCount: p.imgCount || 0,
});
const litePackage = (k) => ({
  id: k.id, name: str(k.name, 120), price: num(k.price), desc: str(k.desc, 3000),
  includes: (k.includes || []).map((x) => str(x, 160)).filter(Boolean).slice(0, 30), video: str(k.video, 500),
  published: k.published !== false, createdAt: k.createdAt || Date.now(), thumbs: (k.thumbs || []).slice(0, 6), imgCount: k.imgCount || 0,
});
async function ensureSeed() {
  if (await one("GET", "tl:seeded")) return;
  if (!(await one("SET", "tl:seeded", "1", "NX"))) return;
  const cmds = PRODUCTS.map((p) => ["HSET", "tl:plite", p.id, JSON.stringify(liteProduct(p))]);
  cmds.push(["SET", "tl:cats", JSON.stringify(CATEGORIES)], bump());
  await pipe(cmds);
}
async function catalog(admin) {
  const read = () => pipe([
    ["HGETALL", "tl:plite"], ["HGETALL", "tl:pklite"], ["GET", "tl:cats"], ["GET", "tl:layout"], ["GET", "tl:offers"], ["GET", "tl:ts"], ["GET", "tl:seeded"],
  ]);
  let r = await read();
  if (!r[6]) { await ensureSeed(); r = await read(); }       // very first visit ever: load the starter catalogue
  const [pl, kl, cats, lay, offs, ts] = r;
  const offers = J(offs) || [];
  return {
    v: 2, ts: +ts || 0,
    categories: J(cats) || CATEGORIES,
    layout: normLayout(J(lay)),
    products: vals(pl).sort((a, b) => idNum(a.id) - idNum(b.id)),
    packages: vals(kl).filter((k) => admin || k.published !== false),
    offers: admin ? offers : offers.filter((o) => o.active !== false && offerEligible(o, null)),
  };
}

/* ------------------------------ public actions ------------------------------ */
async function getItem(id, admin) {
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(id || "")) return null;
  const isPkg = id.startsWith("pk");
  const [full, lite, revs] = await pipe([
    ["HGET", isPkg ? "tl:pkfull" : "tl:pfull", id], ["HGET", isPkg ? "tl:pklite" : "tl:plite", id], ["HGET", "tl:rev", id],
  ]);
  const l = J(lite); if (!l) return null;
  if (isPkg && l.published === false && !admin) return null;
  return { images: (J(full) || {}).images || [], reviews: J(revs) || [] };
}

async function createOrder(b) {
  const f = b.form || {};
  const name = str(f.name, 80), phone = str(f.phone, 30), address = str(f.address, 200);
  if (!name || phoneKey(phone).length < 9 || !address) return [400, { error: "Name, a valid phone number and delivery location are required." }];
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email || "") ? str(f.email, 120) : "";
  const reqItems = (Array.isArray(b.items) ? b.items : []).slice(0, 60).map((i) => ({ id: str(i.id, 40), qty: Math.max(1, Math.min(99, Math.floor(num(i.qty, 1)))) }));
  if (!reqItems.length) return [400, { error: "Your cart is empty." }];

  // optional but strongly recommended: confirm with Paystack that the money really arrived
  const ref = str(b.ref || b.orderId, 80);
  let verified = null, paid = null;
  if (process.env.PAYSTACK_SECRET_KEY) {
    try {
      const r = await fetch("https://api.paystack.co/transaction/verify/" + encodeURIComponent(ref), { headers: { Authorization: "Bearer " + process.env.PAYSTACK_SECRET_KEY } });
      const j = await r.json();
      verified = !!(j.status && j.data && j.data.status === "success");
      if (verified) paid = j.data.amount / 100;
    } catch (e) { verified = null; }
    if (verified === false) return [402, { error: "Paystack has not confirmed this payment." }];
  }

  const prev = ref ? await one("GET", "tl:ref:" + ref) : null;
  if (prev) {
    const po = J(await one("HGET", "tl:orders", prev));
    if (po) return [200, { order: po, customer: J(await one("HGET", "tl:cust", po.customerId)) }];
  }

  const pl = await pipe([["HMGET", "tl:plite", ...reqItems.map((i) => i.id)], ["HMGET", "tl:pklite", ...reqItems.map((i) => i.id)]]);
  const lines = [], stockWrites = [];
  reqItems.forEach((i, k) => {
    const p = J(pl[0][k]), pk = J(pl[1][k]);
    if (p) {
      const take = Math.min(i.qty, p.stock);               // never sell below zero (the customer has already paid — admin sees the flag)
      lines.push({ productId: i.id, name: p.name, qty: i.qty, price: p.price, kind: "product", short: take < i.qty });
      p.stock = Math.max(0, p.stock - i.qty); stockWrites.push(["HSET", "tl:plite", i.id, JSON.stringify(p)]);
    } else if (pk && pk.published !== false) lines.push({ productId: i.id, name: pk.name, qty: i.qty, price: pk.price, kind: "package" });
  });
  if (!lines.length) return [400, { error: "Those items are no longer available." }];
  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);

  // customer = the phone number; created on the very first purchase
  const pkey = phoneKey(phone);
  let cid = await one("HGET", "tl:cphone", pkey);
  let cust = cid ? J(await one("HGET", "tl:cust", cid)) : null;
  const before = cust ? { ...cust } : null;
  if (!cust) {
    do { cid = genCid(); } while (!(await one("HSETNX", "tl:cust", cid, "{}")));
    cust = { id: cid, createdAt: Date.now(), orderCount: 0, totalSpent: 0 };
  }

  let discount = null;
  if (b.offerId) {
    const o = (J(await one("GET", "tl:offers")) || []).find((x) => x.id === b.offerId);
    if (o && o.percent > 0 && offerEligible(o, before)) {
      const amount = Math.round(subtotal * Math.min(o.percent, 90) / 100);
      discount = { offerId: o.id, title: o.title, percent: o.percent, amount };
    }
  }
  const total = Math.max(0, subtotal - (discount ? discount.amount : 0));

  // order id: keep the customer's one unless it collides
  let oid = /^TLE-\d{5}$/.test(b.orderId || "") ? b.orderId : "TLE-" + Math.floor(10000 + Math.random() * 89999);
  while (!(await one("HSETNX", "tl:orders", oid, "{}"))) oid = "TLE-" + Math.floor(10000 + Math.random() * 89999);

  const flags = [];
  if (paid != null && Math.abs(paid - total) > 1) flags.push("Paid GH₵" + paid + " but the total was GH₵" + total);
  if (lines.some((l) => l.short)) flags.push("Stock ran short on some items");
  if (verified === null) flags.push("Payment not verified with Paystack");
  const order = {
    id: oid, paystackRef: ref, customerId: cust.id, name, phone, email, payNumber: str(f.payNumber, 40) || phone, address,
    notes: str(f.notes, 500), items: lines.map(({ short, ...l }) => l), subtotal, total, discount, status: "processing",
    createdAt: Date.now(), verified: verified === true, flags,
  };
  Object.assign(cust, { name, phone, phoneKey: pkey, email: email || cust.email || "", address, payNumber: order.payNumber,
    lastOrderAt: order.createdAt, orderCount: (cust.orderCount || 0) + 1, totalSpent: (cust.totalSpent || 0) + total });
  await pipe([
    ["HSET", "tl:orders", oid, JSON.stringify(order)], ["SADD", "tl:cord:" + cust.id, oid],
    ["HSET", "tl:cust", cust.id, JSON.stringify(cust)], ["HSET", "tl:cphone", pkey, cust.id], ...stockWrites,
    ...(ref ? [["SET", "tl:ref:" + ref, oid]] : []), bump(),
  ]);
  return [200, { order, customer: cust }];
}

async function ordersOf(cid) {
  const ids = await one("SMEMBERS", "tl:cord:" + cid);
  if (!ids || !ids.length) return [];
  return (await one("HMGET", "tl:orders", ...ids)).map(J).filter(Boolean).sort((a, b) => b.createdAt - a.createdAt);
}
async function customerByPhone(phone) {
  const k = phoneKey(phone); if (k.length < 9) return null;
  const cid = await one("HGET", "tl:cphone", k);
  return cid ? J(await one("HGET", "tl:cust", cid)) : null;
}

async function publicAction(a, b, ip) {
  switch (a) {
    case "order": return createOrder(b);
    case "offersFor": {
      const c = await customerByPhone(b.phone);
      const offers = (J(await one("GET", "tl:offers")) || []).filter((o) => o.percent > 0 && offerEligible(o, c));
      return [200, { offers: offers.map((o) => ({ id: o.id, title: o.title, percent: o.percent })) }];
    }
    case "me": {
      if (!(await limit("tl:rl:me:" + ip, 40, 900))) return [429, { error: "Too many attempts. Try again in a few minutes." }];
      const id = str(b.id, 24).toUpperCase();
      const c = /^[A-Z0-9-]{4,24}$/.test(id) ? J(await one("HGET", "tl:cust", id)) : null;
      if (!c || phoneKey(b.phone) !== c.phoneKey) return [401, { error: "no match" }];
      const offers = (J(await one("GET", "tl:offers")) || []).filter((o) => offerEligible(o, c)).sort((x, y) => (y.createdAt || 0) - (x.createdAt || 0));
      return [200, { customer: c, orders: await ordersOf(c.id), offers }];
    }
    case "track": {
      const q = str(b.q, 40); let orders = [];
      if (/^TLE-\d+$/i.test(q)) { const o = J(await one("HGET", "tl:orders", q.toUpperCase())); if (o) orders = [o]; }
      else { const c = await customerByPhone(q); if (c) orders = await ordersOf(c.id); }
      return [200, { orders: orders.map((o) => ({ id: o.id, status: o.status, createdAt: o.createdAt, total: o.total, items: o.items.map((i) => ({ name: i.name, qty: i.qty })) })) }];
    }
    case "help": {
      if (!(await limit("tl:rl:help:" + ip, 10, 3600))) return [429, { error: "Too many messages. Please try later or use WhatsApp." }];
      const name = str(b.name, 80), phone = str(b.phone, 30), message = str(b.message, 1500);
      if (!name || !phone || !message) return [400, { error: "Missing details" }];
      const m = { id: "MSG-" + Date.now(), name, phone, orderId: str(b.orderId, 30), message, read: false, createdAt: Date.now() };
      await one("HSET", "tl:msgs", m.id, JSON.stringify(m));
      return [200, { ok: true }];
    }
    case "review": {
      if (!(await limit("tl:rl:rev:" + ip, 10, 3600))) return [429, { error: "Too many reviews. Please try later." }];
      const id = str(b.pid, 40), item = await getItem(id, false);
      const rating = Math.floor(num(b.rating)), name = str(b.name, 60), comment = str(b.comment, 800);
      if (!item || !name || !comment || rating < 1 || rating > 5) return [400, { error: "Invalid review" }];
      const list = item.reviews; list.push({ name, rating, comment, date: Date.now() });
      await one("HSET", "tl:rev", id, JSON.stringify(list.slice(-200)));
      return [200, { reviews: list }];
    }
    case "login": {
      if (!(await limit("tl:rl:login:" + ip, 8, 900))) return [429, { error: "Too many attempts. Wait 15 minutes." }];
      if (!(await checkPassword(String(b.password || "")))) return [401, { error: "Incorrect password. Try again." }];
      const token = crypto.randomBytes(24).toString("hex");
      await one("SET", "tl:sess:" + token, "1", "EX", 43200);
      return [200, { token }];
    }
  }
  return null;
}

/* ------------------------------ shopkeeper actions ------------------------------ */
async function adminData() {
  const [orders, custs, msgs, revs] = await pipe([["HGETALL", "tl:orders"], ["HGETALL", "tl:cust"], ["HGETALL", "tl:msgs"], ["HGETALL", "tl:rev"]]);
  const reviews = {}; Object.entries(obj(revs)).forEach(([k, v]) => { reviews[k] = J(v) || []; });
  return {
    ...(await catalog(true)),
    orders: vals(orders).sort((a, b) => a.createdAt - b.createdAt),
    customers: vals(custs).filter((c) => c.name), messages: vals(msgs).sort((a, b) => a.createdAt - b.createdAt), reviews,
  };
}
const imgsOk = (arr) => Array.isArray(arr) && arr.length <= 10 && arr.every((x) => typeof x === "string" && x.startsWith("data:image/") && x.length < 900000);
const thumbOk = (t) => typeof t === "string" && (t === "" || (t.startsWith("data:image/") && t.length < 120000));

async function adminAction(a, b) {
  switch (a) {
    case "adminData": return [200, await adminData()];
    case "saveProduct": {
      const p = b.product || {};
      if (!str(p.name, 120) || num(p.price, -1) < 0 || num(p.stock, -1) < 0 || !imgsOk(p.images || []) || !thumbOk(p.thumb || "")) return [400, { error: "Invalid product" }];
      const id = /^p[A-Za-z0-9_-]{1,30}$/.test(p.id || "") ? p.id : "p" + Date.now();
      const lite = liteProduct({ ...p, id, imgCount: (p.images || []).length });
      await pipe([["HSET", "tl:plite", id, JSON.stringify(lite)], ["HSET", "tl:pfull", id, JSON.stringify({ images: p.images || [] })], bump()]);
      return [200, { product: lite }];
    }
    case "quickUpdate": {
      const p = J(await one("HGET", "tl:plite", str(b.id, 40)));
      if (!p || !["price", "stock"].includes(b.field) || num(b.value, -1) < 0) return [400, { error: "Invalid" }];
      p[b.field] = b.field === "stock" ? Math.floor(num(b.value)) : num(b.value);
      await pipe([["HSET", "tl:plite", p.id, JSON.stringify(p)], bump()]);
      return [200, { product: p }];
    }
    case "deleteProduct": {
      const id = str(b.id, 40), lay = normLayout(J(await one("GET", "tl:layout")));
      lay.productPins = lay.productPins.filter((x) => x !== id);
      await pipe([["HDEL", "tl:plite", id], ["HDEL", "tl:pfull", id], ["SET", "tl:layout", JSON.stringify(lay)], bump()]);
      return [200, { layout: lay }];
    }
    case "savePackage": {
      const k = b.pkg || {};
      if (!str(k.name, 120) || num(k.price, -1) < 0 || !imgsOk(k.images || []) || !(k.thumbs || []).every(thumbOk)) return [400, { error: "Invalid package" }];
      let id = /^pk[A-Za-z0-9_-]{1,30}$/.test(k.id || "") ? k.id : "";
      const isNew = !id; if (isNew) id = "pk" + Date.now();
      const lite = litePackage({ ...k, id, imgCount: (k.images || []).length });
      const cmds = [["HSET", "tl:pklite", id, JSON.stringify(lite)], ["HSET", "tl:pkfull", id, JSON.stringify({ images: k.images || [] })], bump()];
      let lay = normLayout(J(await one("GET", "tl:layout")));
      if (isNew) { lay.packageOrder.push(id); cmds.push(["SET", "tl:layout", JSON.stringify(lay)]); }
      await pipe(cmds);
      return [200, { pkg: lite, layout: lay }];
    }
    case "togglePackage": {
      const k = J(await one("HGET", "tl:pklite", str(b.id, 40))); if (!k) return [404, { error: "Not found" }];
      k.published = k.published === false;
      await pipe([["HSET", "tl:pklite", k.id, JSON.stringify(k)], bump()]);
      return [200, { pkg: k }];
    }
    case "deletePackage": {
      const id = str(b.id, 40), lay = normLayout(J(await one("GET", "tl:layout")));
      lay.packageOrder = lay.packageOrder.filter((x) => x !== id);
      await pipe([["HDEL", "tl:pklite", id], ["HDEL", "tl:pkfull", id], ["SET", "tl:layout", JSON.stringify(lay)], bump()]);
      return [200, { layout: lay }];
    }
    case "setThumb": {          // used to (re)build thumbnails for photos that came across in the migration
      const isPkg = String(b.id).startsWith("pk"), key = isPkg ? "tl:pklite" : "tl:plite";
      const l = J(await one("HGET", key, str(b.id, 40)));
      if (!l || !(isPkg ? (b.thumbs || []).every(thumbOk) : thumbOk(b.thumb || ""))) return [400, { error: "Invalid" }];
      if (isPkg) l.thumbs = (b.thumbs || []).slice(0, 6); else l.thumb = b.thumb || "";
      await pipe([["HSET", key, l.id, JSON.stringify(l)], bump()]);
      return [200, { ok: true }];
    }
    case "saveCategories": {
      if (!Array.isArray(b.categories)) return [400, { error: "Invalid" }];
      await pipe([["SET", "tl:cats", JSON.stringify(b.categories.map((x) => str(x, 80)).filter(Boolean))], bump()]);
      return [200, { ok: true }];
    }
    case "saveLayout": await pipe([["SET", "tl:layout", JSON.stringify(normLayout(b.layout))], bump()]); return [200, { ok: true }];
    case "saveOffers": {
      if (!Array.isArray(b.offers)) return [400, { error: "Invalid" }];
      const offers = b.offers.slice(0, 100).map((o) => ({
        id: str(o.id, 30), title: str(o.title, 120), message: str(o.message, 600), percent: Math.max(0, Math.min(90, num(o.percent))),
        minOrders: Math.max(0, Math.floor(num(o.minOrders))), minSpent: Math.max(0, num(o.minSpent)), ids: str(o.ids, 600),
        expiresAt: num(o.expiresAt), active: o.active !== false, createdAt: num(o.createdAt, Date.now()),
      }));
      await pipe([["SET", "tl:offers", JSON.stringify(offers)], bump()]);
      return [200, { ok: true }];
    }
    case "orderStatus": {
      const o = J(await one("HGET", "tl:orders", str(b.id, 20)));
      if (!o || !["pending", "processing", "shipped", "completed", "cancelled"].includes(b.status)) return [400, { error: "Invalid" }];
      o.status = b.status; await one("HSET", "tl:orders", o.id, JSON.stringify(o)); return [200, { ok: true }];
    }
    case "msgRead": {
      const m = J(await one("HGET", "tl:msgs", str(b.id, 30))); if (!m) return [404, { error: "Not found" }];
      m.read = true; await one("HSET", "tl:msgs", m.id, JSON.stringify(m)); return [200, { ok: true }];
    }
    case "reviewDelete": {
      const pid = str(b.pid, 40), list = J(await one("HGET", "tl:rev", pid)) || [];
      list.splice(Math.floor(num(b.idx, -1)), 1); await one("HSET", "tl:rev", pid, JSON.stringify(list)); return [200, { ok: true }];
    }
    case "changePassword": {
      const next = String(b.next || "");
      if (!(await checkPassword(String(b.current || "")))) return [401, { error: "Current password is incorrect." }];
      if (next.length < 6) return [400, { error: "New password must be at least 6 characters." }];
      const salt = crypto.randomBytes(16).toString("hex");
      await one("SET", "tl:admin", JSON.stringify({ salt, hash: hashPw(next, salt) })); return [200, { ok: true }];
    }
    case "logout": await one("DEL", "tl:sess:" + String(b.token || "")); return [200, { ok: true }];
    case "import": return importData(b);
  }
  return null;
}

/* One-time migration from the old Firestore store — see scripts/migrate-from-firestore.js */
async function importData(b) {
  const s = b.section, it = b.item, val = b.value;
  switch (s) {
    case "wipe": {
      const keys = await one("KEYS", "tl:cord:*");
      await pipe([["DEL", "tl:plite", "tl:pfull", "tl:pklite", "tl:pkfull", "tl:cust", "tl:cphone", "tl:orders", "tl:msgs", "tl:rev", "tl:cats", "tl:layout", "tl:offers", ...(keys || [])]]);
      return [200, { ok: true }];
    }
    case "products": await pipe([["HSET", "tl:plite", it.id, JSON.stringify(liteProduct({ ...it, imgCount: (it.images || []).length }))], ["HSET", "tl:pfull", it.id, JSON.stringify({ images: it.images || [] })]]); break;
    case "packages": await pipe([["HSET", "tl:pklite", it.id, JSON.stringify(litePackage({ ...it, imgCount: (it.images || []).length }))], ["HSET", "tl:pkfull", it.id, JSON.stringify({ images: it.images || [] })]]); break;
    case "customers": await pipe([["HSET", "tl:cust", it.id, JSON.stringify(it)], ["HSET", "tl:cphone", it.phoneKey || phoneKey(it.phone), it.id]]); break;
    case "orders": await one("HSET", "tl:orders", it.id, JSON.stringify(it)); break;
    case "categories": await one("SET", "tl:cats", JSON.stringify(val)); break;
    case "offers": await one("SET", "tl:offers", JSON.stringify(val)); break;
    case "layout": await one("SET", "tl:layout", JSON.stringify(normLayout(val))); break;
    case "reviews": await pipe(Object.entries(val || {}).map(([k, v]) => ["HSET", "tl:rev", k, JSON.stringify(v)])); break;
    case "messages": await pipe((val || []).map((m) => ["HSET", "tl:msgs", m.id, JSON.stringify(m)])); break;
    case "finish": {
      // give every past buyer a Customer ID (grouped by phone) and index their orders
      const orders = vals(await one("HGETALL", "tl:orders")).sort((a, b) => a.createdAt - b.createdAt);
      const custs = {}; vals(await one("HGETALL", "tl:cust")).forEach((c) => { if (c.name) custs[c.id] = c; });
      const byPhone = {}; Object.values(custs).forEach((c) => { c.orderCount = 0; c.totalSpent = 0; byPhone[c.phoneKey || phoneKey(c.phone)] = c; });
      const cmds = []; let created = 0;
      for (const o of orders) {
        const pk = phoneKey(o.phone);
        let c = (o.customerId && custs[o.customerId]) || byPhone[pk];
        if (!c) { c = { id: genCid(), createdAt: o.createdAt, orderCount: 0, totalSpent: 0, name: o.name, phone: o.phone, phoneKey: pk, email: o.email || "", address: o.address, payNumber: o.payNumber || o.phone }; custs[c.id] = c; byPhone[pk] = c; created++; }
        if (o.customerId !== c.id) { o.customerId = c.id; cmds.push(["HSET", "tl:orders", o.id, JSON.stringify(o)]); }
        c.orderCount = (c.orderCount || 0) + 1; c.totalSpent = (c.totalSpent || 0) + (o.total || 0); c.lastOrderAt = Math.max(c.lastOrderAt || 0, o.createdAt);
        cmds.push(["SADD", "tl:cord:" + c.id, o.id]);
      }
      Object.values(custs).forEach((c) => { cmds.push(["HSET", "tl:cust", c.id, JSON.stringify(c)], ["HSET", "tl:cphone", c.phoneKey || phoneKey(c.phone), c.id]); });
      cmds.push(["SET", "tl:seeded", "1"], bump());
      await pipe(cmds);
      return [200, { ok: true, customersCreated: created, orders: orders.length }];
    }
    default: return [400, { error: "Unknown section" }];
  }
  return [200, { ok: true }];
}

/* ------------------------------ entry point ------------------------------ */
module.exports = async function handler(req, res) {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return res.status(503).json({ error: "Upstash is not configured on the server yet." });
  }
  const ip = String(req.headers["x-forwarded-for"] || "local").split(",")[0].trim();
  try {
    if (req.method === "GET") {
      const r = (req.query && req.query.r) || "";
      if (r === "catalog") {
        res.setHeader("Cache-Control", "public, s-maxage=3, stale-while-revalidate=20");
        return res.status(200).json(await catalog(false));
      }
      if (r === "item") {
        const admin = await isAdmin(req);
        const it = await getItem(String(req.query.id || ""), admin);
        if (!it) return res.status(404).json({ error: "Not found" });
        res.setHeader("Cache-Control", admin ? "no-store" : "public, s-maxage=20, stale-while-revalidate=120");
        return res.status(200).json(it);
      }
      return res.status(400).json({ error: "Unknown request" });
    }
    if (req.method !== "POST") { res.setHeader("Allow", "GET, POST"); return res.status(405).end(); }
    const b = typeof req.body === "string" ? J(req.body) || {} : req.body || {};
    const a = String(b.a || "");
    let out = await publicAction(a, b, ip);
    if (!out) {
      if (!(await isAdmin(req))) return res.status(401).json({ error: "Please log in again.", expired: true });
      out = await adminAction(a, b);
    }
    if (!out) return res.status(400).json({ error: "Unknown action" });
    res.setHeader("Cache-Control", "no-store");
    return res.status(out[0]).json(out[1]);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
};
