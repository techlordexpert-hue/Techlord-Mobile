/* TechLord & Co. — speed-cache endpoint (Vercel serverless function)

   GET  /api/catalog  -> returns the cached catalogue snapshot from Upstash Redis
   POST /api/catalog  -> the shopkeeper dashboard saves a fresh snapshot (needs the cache key)

   Environment variables (Vercel -> Project -> Settings -> Environment Variables):
     UPSTASH_REDIS_REST_URL     from the Upstash console (REST API section)
     UPSTASH_REDIS_REST_TOKEN   the normal/full token — stays on the server, never in app.js
     CACHE_SECRET               any long random text you invent; paste the same text into
                                Shopkeeper -> Settings -> Speed cache on your phone/laptop
*/
const KEY = "tl:catalog";

async function redis(command) {
  const r = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + process.env.UPSTASH_REDIS_REST_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  if (!r.ok) throw new Error("Upstash responded " + r.status);
  return (await r.json()).result;
}

module.exports = async function handler(req, res) {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return res.status(503).json({ error: "Upstash is not configured on the server yet." });
  }
  try {
    if (req.method === "GET") {
      const snap = await redis(["GET", KEY]);
      if (!snap) return res.status(204).end();
      res.setHeader("Content-Type", "application/json");
      // let Vercel's edge hold it for a few seconds — still feels instant after a save
      res.setHeader("Cache-Control", "public, s-maxage=5, stale-while-revalidate=60");
      return res.status(200).send(snap);
    }

    if (req.method === "POST") {
      const secret = process.env.CACHE_SECRET;
      if (!secret || req.headers["x-cache-secret"] !== secret) {
        return res.status(401).json({ error: "Wrong or missing cache key." });
      }
      const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
      const parsed = JSON.parse(body);
      if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.products)) {
        return res.status(400).json({ error: "That doesn't look like a catalogue snapshot." });
      }
      await redis(["SET", KEY, body]);
      return res.status(200).json({ ok: true, products: parsed.products.length, bytes: body.length });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).end();
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Cache error" });
  }
};
