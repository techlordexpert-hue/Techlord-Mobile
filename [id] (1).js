// Serves a product's photo as a real, fetchable image URL.
// Link-preview crawlers (WhatsApp, TikTok, Instagram, etc.) can't read the
// base64 image data stored in Firestore directly — og:image tags need an
// actual https:// URL. This function fetches the product from Firestore,
// decodes its stored base64 photo, and returns it as a normal image
// response, so it works exactly like any other hosted image.

const PROJECT_ID = "techlord-27aba"; // matches FIREBASE_CONFIG.projectId in app.js

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id) { res.status(400).send("Missing product id"); return; }

  try {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/techlord_products/${encodeURIComponent(id)}`;
    const r = await fetch(url);
    if (!r.ok) { res.status(404).send("Product not found"); return; }
    const data = await r.json();

    const imagesField = data.fields && data.fields.images;
    const values = imagesField && imagesField.arrayValue && imagesField.arrayValue.values;
    const firstImage = values && values.length ? values[0].stringValue : null;
    if (!firstImage) { res.status(404).send("No image on this product"); return; }

    const match = /^data:([^;]+);base64,(.*)$/.exec(firstImage);
    if (!match) { res.status(404).send("Image data not in the expected format"); return; }

    const buffer = Buffer.from(match[2], "base64");
    res.setHeader("Content-Type", match[1]);
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.status(200).send(buffer);
  } catch (e) {
    console.error("product-image error", e);
    res.status(500).send("Couldn't load image");
  }
}
