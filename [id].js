// This is the link people actually share (e.g. via the admin panel's
// Share button). When WhatsApp/TikTok/Instagram fetch this URL to build a
// preview card, they read the og:* tags below and show the product's photo,
// name and price — no download, just a preview, exactly like sharing a
// TikTok video link. A real visitor who taps the link is redirected into
// the app on that exact product within a fraction of a second.

const PROJECT_ID = "techlord-27aba"; // matches FIREBASE_CONFIG.projectId in app.js

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[m]));
}
// Firestore's REST API returns numbers as either {integerValue:"50"} (a
// numeric string) or {doubleValue:12.5} (an actual number) — handle both.
function firestoreNumber(field) {
  if (!field) return undefined;
  if (field.integerValue !== undefined) return Number(field.integerValue);
  if (field.doubleValue !== undefined) return Number(field.doubleValue);
  return undefined;
}

module.exports = async (req, res) => {
  const { id } = req.query;
  const origin = `https://${req.headers.host}`;
  const targetUrl = `${origin}/?product=${encodeURIComponent(id || "")}`;

  let name = "TechLord & Co.";
  let priceLine = "";
  let hasImage = false;

  try {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/techlord_products/${encodeURIComponent(id)}`;
    const r = await fetch(url);
    if (r.ok) {
      const data = await r.json();
      const f = data.fields || {};
      if (f.name && f.name.stringValue) name = f.name.stringValue;
      const priceNum = firestoreNumber(f.price);
      if (priceNum !== undefined) priceLine = `GH₵${priceNum.toFixed(0)} — `;
      const values = f.images && f.images.arrayValue && f.images.arrayValue.values;
      hasImage = !!(values && values.length);
    } else {
      console.error("share: Firestore fetch not ok", r.status, await r.text());
    }
  } catch (e) {
    console.error("share page error", e);
  }

  const imageUrl = hasImage ? `${origin}/api/product-image/${encodeURIComponent(id)}` : `${origin}/favicon.png`;
  const title = `${priceLine}${name}`;
  const description = "Tap to view and order on TechLord & Co.";

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${escapeHtml(title)}</title>
<meta property="og:type" content="product">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="${imageUrl}">
<meta property="og:image:secure_url" content="${imageUrl}">
<meta property="og:url" content="${targetUrl}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${imageUrl}">
<meta http-equiv="refresh" content="0;url=${targetUrl}">
<script>location.replace(${JSON.stringify(targetUrl)});</script>
</head>
<body>Redirecting to ${escapeHtml(name)}&hellip;</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
};
