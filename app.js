/* ============================================================
   TechLord & Co. — storefront + admin
   Data layer: Firebase Firestore (real, synced across all devices),
   with a localStorage fallback if Firebase isn't configured yet.
   ============================================================ */

const PUBLIC_PAYSTACK_KEY = "pk_live_e81e6a7c861963103869a7310dd19821f476bad7";
// NOTE: the secret key is intentionally NEVER placed in this file.
// It must live only on a secure backend server for verifying payments.

const WHATSAPP_NUMBER = "233544667931"; // 054 466 7931 in international format
const CONTACT_LINE = "054 466 7931 & 050 444 0199";

/* ---- Upstash Redis "speed cache" (see README) ----
   The shopkeeper's saves push a light copy of the catalogue to Redis; every visitor
   reads it first, so products + packages show instantly while Firestore loads
   the full data in the background.
   Only the READ-ONLY token ever goes here — it is safe in a browser. The full
   token lives on the server (api/catalog.js), never in this file. */
const UPSTASH_REST_URL = "";          // e.g. "https://eu1-xxxx.upstash.io"
const UPSTASH_READONLY_TOKEN = "";    // Upstash console -> "Read-Only Token"
const CATALOG_API = "/api/catalog";   // serverless function (writes; also a read fallback)
const CATALOG_KEY = "tl:catalog";

const DEFAULT_CATEGORIES = [
  "Photo Printing & Frames",
  "Laptop Stickers",
  "Phone Cases",
  "Computer Accessories",
  "Graphic Designing",
  "Bulk SMS",
  "Web Development",
  "Custom Printing Services",
  "Others"
];

const DEFAULT_PRODUCTS = [
  {id:"p1",name:"A4 Photo Print",category:"Photo Printing & Frames",price:50,stock:40,images:[],video:"",desc:"High quality A4 sized print of your favourite photo, ready to frame or gift."},
  {id:"p2",name:"A3 Photo Print",category:"Photo Printing & Frames",price:90,stock:35,images:[],video:"",desc:"Bigger A3 print for a bolder wall statement."},
  {id:"p3",name:"15 x 19 Print",category:"Photo Printing & Frames",price:130,stock:25,images:[],video:"",desc:"15 x 19 premium photo print."},
  {id:"p4",name:"16 x 20 Print",category:"Photo Printing & Frames",price:160,stock:25,images:[],video:"",desc:"16 x 20 premium photo print."},
  {id:"p5",name:"19 x 23 Print",category:"Photo Printing & Frames",price:190,stock:20,images:[],video:"",desc:"19 x 23 premium photo print."},
  {id:"p6",name:"20 x 24 Print",category:"Photo Printing & Frames",price:220,stock:20,images:[],video:"",desc:"20 x 24 premium photo print."},
  {id:"p7",name:"20 x 30 Print",category:"Photo Printing & Frames",price:280,stock:15,images:[],video:"",desc:"20 x 30 large premium photo print."},
  {id:"p8",name:"23 x 32 Print",category:"Photo Printing & Frames",price:330,stock:12,images:[],video:"",desc:"23 x 32 large premium photo print."},
  {id:"p9",name:"24 x 36 Print",category:"Photo Printing & Frames",price:400,stock:10,images:[],video:"",desc:"24 x 36 extra-large statement print."},
  {id:"p10",name:"Table Top Frame",category:"Photo Printing & Frames",price:80,stock:30,images:[],video:"",desc:"Elegant table top frame for your desk or shelf."},
  {id:"p11",name:"Frameless Frame",category:"Photo Printing & Frames",price:120,stock:20,images:[],video:"",desc:"Modern frameless display for a clean, floating look."},
  {id:"p12",name:"Citation Frame",category:"Photo Printing & Frames",price:150,stock:18,images:[],video:"",desc:"Beautifully finished frame for certificates, awards and citations."},
  {id:"p13",name:"Interior Decor Frame",category:"Photo Printing & Frames",price:180,stock:15,images:[],video:"",desc:"Statement frame for interior decor pieces."},
  {id:"p14",name:"Laptop Sticker — Back Only",category:"Laptop Stickers",price:60,stock:40,images:[],video:"",desc:"Custom sticker skin for the back of your laptop only."},
  {id:"p15",name:"Laptop Sticker — Keyboard & Back",category:"Laptop Stickers",price:90,stock:30,images:[],video:"",desc:"Custom sticker covering the keyboard area and back panel."},
  {id:"p16",name:"Laptop Sticker — Full Body",category:"Laptop Stickers",price:130,stock:25,images:[],video:"",desc:"Full-body custom laptop skin, back, keyboard deck and edges."},
  {id:"p17",name:"Custom Phone Case",category:"Phone Cases",price:70,stock:35,images:[],video:"",desc:"Personalised phone case printed with your chosen photo or design."},
  {id:"p18",name:"Logo & Brand Design",category:"Graphic Designing",price:150,stock:999,images:[],video:"",desc:"Professional logo and brand identity design service."},
  {id:"p19",name:"Flyer / Poster Design",category:"Graphic Designing",price:80,stock:999,images:[],video:"",desc:"Eye-catching flyer or poster design for your business or event."},
  {id:"p20",name:"Bulk SMS — 500 Units",category:"Bulk SMS",price:60,stock:999,images:[],video:"",desc:"Send 500 SMS units to your customers or contacts, fast and reliable."},
  {id:"p21",name:"Bulk SMS — 2000 Units",category:"Bulk SMS",price:200,stock:999,images:[],video:"",desc:"Send 2000 SMS units — great for larger campaigns and announcements."},
  {id:"p22",name:"Business Website (Starter)",category:"Web Development",price:1500,stock:999,images:[],video:"",desc:"A clean, mobile-friendly website to showcase your business online."},
  {id:"p23",name:"E-commerce Website",category:"Web Development",price:3500,stock:999,images:[],video:"",desc:"Full online store with cart, checkout and admin panel — like this one."},
  {id:"p24",name:"Custom T-Shirt Printing",category:"Custom Printing Services",price:45,stock:999,images:[],video:"",desc:"Print your design or photo on a quality T-shirt."},
  {id:"p25",name:"Custom Mug Printing",category:"Custom Printing Services",price:35,stock:999,images:[],video:"",desc:"Personalised mug printing — great for gifts."}
];

let state = {
  products: [],
  packages: [],
  customers: [],
  offers: [],
  layout: {sectionOrder:["packages","products"], packageOrder:[], productPins:[]},
  me: null,            // the customer recognised on this device (no account — just a Customer ID)
  phoneCust: null,     // customer found from the phone typed at checkout
  checkoutOfferId: "",
  fullLoaded: false, restLoaded: false,
  categories: DEFAULT_CATEGORIES.slice(),
  orders: [],
  reviews: {},
  messages: [],
  adminPassword: "techlord2026",
  activeCategory: "All",
  cart: [],
  currentProductId: null,
  ratingPick: 0,
  adminLoggedIn: false,
  adminTab: "overview",
  pendingImages: [],
  pollTimer: null
};

/* ============================================================
   Storage layer — real, permanent storage.

   HOW THIS WORKS:
   - If FIREBASE_CONFIG below is filled in, all data (products, orders,
     reviews, messages, admin password) is saved to Firebase Firestore.
     Firestore pushes live updates to every open device instantly —
     this is what makes admin edits appear on customers' phones without
     anyone refreshing.
   - If FIREBASE_CONFIG is left empty, the app automatically falls back
     to the browser's localStorage. That means data now SURVIVES a
     reload (it no longer vanishes), but it only lives on that one
     device/browser — it will not appear on anyone else's phone.

   See README.md for the 5-minute steps to create a free Firebase
   project and fill in FIREBASE_CONFIG.
   ============================================================ */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAx5naMKpyrf62NZc8UOcVhEx0NR868T30",
  authDomain: "techlord-27aba.firebaseapp.com",
  projectId: "techlord-27aba",
  storageBucket: "techlord-27aba.firebasestorage.app",
  messagingSenderId: "194728495785",
  appId: "1:194728495785:web:1ebca39bd234170b57b7b8"
};
const STORE_COLLECTION = "techlord_store";
const PRODUCTS_COLLECTION = "techlord_products";
const PACKAGES_COLLECTION = "techlord_packages";
const CUSTOMERS_COLLECTION = "techlord_customers";
const DOC_NAMES = ["categories","orders","reviews","messages","settings","offers","layout"]; // products are handled separately, one doc per product

let fbRefs = null; // {db, doc, getDoc, setDoc, deleteDoc, collection, getDocs, onSnapshot} once Firebase is ready

function firebaseConfigured(){
  return !!(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId);
}
async function initFirebase(){
  if(!firebaseConfigured()) return false;
  try{
    const appMod = await import("https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js");
    const fsMod = await import("https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js");
    const app = appMod.initializeApp(FIREBASE_CONFIG);
    const db = fsMod.getFirestore(app);
    fbRefs = {
      db, doc: fsMod.doc, getDoc: fsMod.getDoc, setDoc: fsMod.setDoc, deleteDoc: fsMod.deleteDoc,
      collection: fsMod.collection, getDocs: fsMod.getDocs, onSnapshot: fsMod.onSnapshot,
      query: fsMod.query, where: fsMod.where, limit: fsMod.limit
    };
    return true;
  }catch(e){
    console.error("Firebase failed to initialise — falling back to this device's local storage only.", e);
    fbRefs = null;
    return false;
  }
}

/* docGet/docSet — used for the small, non-image collections
   (categories, orders, reviews, messages, settings) */
async function docGet(name){
  if(fbRefs){
    try{
      const snap = await fbRefs.getDoc(fbRefs.doc(fbRefs.db, STORE_COLLECTION, name));
      return snap.exists() ? snap.data().value : undefined;
    }catch(e){ console.error("Firestore read failed for", name, e); }
  }
  try{
    const raw = localStorage.getItem("tle_"+name);
    return raw===null ? undefined : JSON.parse(raw);
  }catch(e){ return undefined; }
}
async function docSet(name, value){
  if(fbRefs){
    try{ await fbRefs.setDoc(fbRefs.doc(fbRefs.db, STORE_COLLECTION, name), {value}); return; }
    catch(e){ console.error("Firestore write failed for", name, e); }
  }
  try{ localStorage.setItem("tle_"+name, JSON.stringify(value)); }catch(e){ /* storage full or blocked */ }
}

/* Products get their OWN Firestore document per product (not one shared
   array). This matters because each product carries its own images —
   splitting them out means Firestore's 1MB-per-document limit applies
   per product instead of to your whole catalog combined, and editing
   one product no longer has to rewrite every other product too. */
function stripId(p){ const {id, ...rest} = p; return rest; }

async function loadProductsList(){
  if(fbRefs){
    try{
      const snap = await fbRefs.getDocs(fbRefs.collection(fbRefs.db, PRODUCTS_COLLECTION));
      const list = [];
      snap.forEach(d=> list.push({ id: d.id, ...d.data() }));
      return list.length ? list : undefined;
    }catch(e){ console.error("Firestore product list read failed", e); }
  }
  try{
    const raw = localStorage.getItem("tle_products");
    return raw===null ? undefined : JSON.parse(raw);
  }catch(e){ return undefined; }
}
async function seedProducts(list){
  if(fbRefs){
    try{ await Promise.all(list.map(p=> fbRefs.setDoc(fbRefs.doc(fbRefs.db, PRODUCTS_COLLECTION, p.id), stripId(p)))); return; }
    catch(e){ console.error("Firestore product seed failed", e); }
  }
  try{ localStorage.setItem("tle_products", JSON.stringify(list)); }catch(e){}
}
async function saveOneProduct(product){
  if(fbRefs){
    await fbRefs.setDoc(fbRefs.doc(fbRefs.db, PRODUCTS_COLLECTION, product.id), stripId(product));
    return;
  }
  const idx = state.products.findIndex(p=>p.id===product.id);
  if(idx>=0) state.products[idx]=product; else state.products.push(product);
  try{ localStorage.setItem("tle_products", JSON.stringify(state.products)); }catch(e){}
}
/* Stock-only write: merges just the stock field, so a customer's purchase can
   never overwrite a product's photos or description. */
async function saveStockOnly(p){
  if(fbRefs){
    try{ await fbRefs.setDoc(fbRefs.doc(fbRefs.db, PRODUCTS_COLLECTION, p.id), {stock:p.stock}, {merge:true}); return; }
    catch(e){ console.error("Stock write failed", e); }
  }
  await saveOneProduct(p);
}
async function deleteOneProduct(id){
  if(fbRefs){
    try{ await fbRefs.deleteDoc(fbRefs.doc(fbRefs.db, PRODUCTS_COLLECTION, id)); return; }
    catch(e){ console.error("Firestore product delete failed", e); }
  }
  try{ localStorage.setItem("tle_products", JSON.stringify(state.products.filter(p=>p.id!==id))); }catch(e){}
}

async function loadCatalog(){
  const [pList, kList, c, l] = await Promise.all([loadProductsList(), loadPackagesList(), docGet("categories"), docGet("layout")]);

  state.products = (pList!==undefined) ? pList : DEFAULT_PRODUCTS.slice();
  if(pList===undefined) await seedProducts(state.products);
  state.packages = kList || [];
  state.layout = normLayout(l);

  state.categories = (c!==undefined) ? c : DEFAULT_CATEGORIES.slice();
  if(c===undefined){
    await docSet("categories", state.categories);
  }else{
    // Your store's category list was already saved from before, so new
    // categories added to the code (Computer Accessories, Others) never
    // reached it automatically. This patches them in, once, on load.
    const mustHave = ["Computer Accessories","Others"];
    let changed = false;
    mustHave.forEach(cat=>{
      if(!state.categories.includes(cat)){ state.categories.push(cat); changed = true; }
    });
    if(changed) await docSet("categories", state.categories);
  }
  state.fullLoaded = true;
}
async function loadRest(){
  const [o, r, m, s, of] = await Promise.all([docGet("orders"), docGet("reviews"), docGet("messages"), docGet("settings"), docGet("offers")]);
  state.orders = (o!==undefined) ? o : [];
  state.reviews = (r!==undefined) ? r : {};
  state.messages = (m!==undefined) ? m : [];
  state.offers = (of!==undefined && of) ? of : [];
  state.adminPassword = (s && s.adminPassword) ? s.adminPassword : "techlord2026";
  if(!s) await docSet("settings", {adminPassword: state.adminPassword});
  state.restLoaded = true;
}
async function loadAll(){ await Promise.all([loadCatalog(), loadRest()]); }

function normLayout(v){
  return {
    sectionOrder: (v && v.sectionOrder && v.sectionOrder.length===2) ? v.sectionOrder : ["packages","products"],
    packageOrder: (v && v.packageOrder) || [],
    productPins: (v && v.productPins) || []
  };
}
/* Waits until orders/reviews/messages are loaded, so a save can never
   overwrite them with a half-empty list. */
let fullPromise = null;
function ensureFull(){
  if(state.restLoaded && state.fullLoaded) return Promise.resolve();
  if(!fullPromise) fullPromise = refreshSharedData().finally(()=>{ fullPromise=null; });
  return fullPromise;
}
async function saveCategories(){ await docSet("categories", state.categories); }
async function saveOrders(){ await docSet("orders", state.orders); }
async function saveReviews(){ await docSet("reviews", state.reviews); }
async function saveMessages(){ await docSet("messages", state.messages); }
async function saveAdminPassword(){ await docSet("settings", {adminPassword: state.adminPassword}); }

/* Live sync: when Firebase is configured, every device gets pushed
   updates the instant another device saves a change — no polling. */
function subscribeRealtime(){
  const map = {
    categories: v=>{ state.categories=v; renderCategoryChips(); if(state.adminLoggedIn) renderAdminSettings(); },
    orders: v=>{ state.orders=v; if(state.adminLoggedIn) renderAdminOrders(); },
    reviews: v=>{ state.reviews=v; if(state.adminLoggedIn) renderAdminReviews(); if(state.currentProductId) openProduct(state.currentProductId); },
    messages: v=>{ state.messages=v; if(state.adminLoggedIn){ renderAdminMessages(); updateMessageBadge(); } },
    settings: v=>{ if(v && v.adminPassword) state.adminPassword=v.adminPassword; },
    offers: v=>{ state.offers=v||[]; if(state.adminLoggedIn) renderAdminOffers(); refreshMeIfOpen(); },
    layout: v=>{ state.layout=normLayout(v); applyLayout(); renderPackages(); renderProducts(); if(state.adminLoggedIn) renderAdminLayout(); }
  };
  DOC_NAMES.forEach(name=>{
    fbRefs.onSnapshot(fbRefs.doc(fbRefs.db, STORE_COLLECTION, name), snap=>{
      if(!snap.exists()) return;
      const v = snap.data().value;
      if(map[name]) map[name](v);
    }, err=>console.error("Realtime listener error on", name, err));
  });
  fbRefs.onSnapshot(fbRefs.collection(fbRefs.db, PRODUCTS_COLLECTION), snapshot=>{
    const list = [];
    snapshot.forEach(d=> list.push({ id: d.id, ...d.data() }));
    state.products = list;
    state.fullLoaded = true;
    renderProducts();
    if(state.adminLoggedIn){ renderAdminProducts(); renderAdminLayout(); }
  }, err=>console.error("Realtime listener error on products", err));
  fbRefs.onSnapshot(fbRefs.collection(fbRefs.db, PACKAGES_COLLECTION), snapshot=>{
    const list = [];
    snapshot.forEach(d=> list.push(pkgFromDoc(d.id, d.data())));
    state.packages = list;
    renderPackages();
    if(state.adminLoggedIn){ renderAdminPackages(); renderAdminLayout(); }
  }, err=>console.error("Realtime listener error on packages", err));
}


/* ---------------- Toast ---------------- */
let toastTimer=null;
function showToast(msg){
  const t=document.getElementById("toast");
  t.textContent=msg; t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>t.classList.remove("show"),2200);
}

/* ---------------- Navigation ---------------- */
function showView(id){
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  const inAdmin = (id==="view-admin"||id==="view-admin-login");
  document.getElementById("bottomnav").style.display = inAdmin ? "none":"flex";
  document.querySelector(".floaters").style.display = inAdmin ? "none":"flex";
  window.scrollTo({top:0});
}
function goHome(scrollTop){ showView("view-storefront"); setNavActive("home"); renderAll(); if(scrollTop) window.scrollTo({top:0,behavior:"smooth"}); }
function openTracking(){ showView("view-tracking"); setNavActive("track"); }
function openPackages(){ showView("view-packages"); setNavActive("home"); renderPackages(); }
function scrollPackages(dir){ const t=document.getElementById("pk-track"); t.scrollBy({left:dir*t.clientWidth*0.8,behavior:"smooth"}); }
function setNavActive(name){
  document.querySelectorAll("#bottomnav button").forEach(b=>b.classList.toggle("active", b.dataset.nav===name));
}
function scrollToCategories(){
  goHome();
  setTimeout(()=>{
    const el=document.getElementById("category-chips");
    const top=el.getBoundingClientRect().top + window.scrollY - (document.querySelector(".topbar").offsetHeight+6);
    window.scrollTo({top,behavior:"smooth"});
  },50);
}

/* ---------------- Sheets ---------------- */
function openSheet(id){ document.getElementById(id).classList.add("show"); }
function closeSheet(id){ document.getElementById(id).classList.remove("show"); }

/* ---------------- Render: categories + products ---------------- */
function renderCategoryChips(){
  const wrap = document.getElementById("category-chips");
  const cats = ["All", ...state.categories];
  wrap.innerHTML = cats.map(c=>`<button class="chip ${c===state.activeCategory?'active':''}" onclick="selectCategory('${escapeAttr(c)}')">${escapeHtml(c)}</button>`).join("");
}
function selectCategory(c){ state.activeCategory=c; renderCategoryChips(); renderProducts(); }

function productImg(p){
  const src = p.thumb || (p.images && p.images[0]);
  return src ? `<img src="${src}" alt="${escapeAttr(p.name)}" decoding="async" loading="lazy" onload="this.classList.add('loaded')">` : placeholderIcon();
}
function renderProducts(){
  const grid = document.getElementById("product-grid");
  const q = (document.getElementById("search-input").value||"").toLowerCase().trim();
  const pins = state.layout.productPins;
  let list = state.products.filter(p=>{
    const catOk = state.activeCategory==="All" || p.category===state.activeCategory;
    const qOk = !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
    return catOk && qOk;
  });
  // pinned products first, in the order the shopkeeper chose
  list = list.map((p,i)=>({p,i,pin:pins.indexOf(p.id)})).sort((a,b)=>{
    if(a.pin>=0 && b.pin>=0) return a.pin-b.pin;
    if(a.pin>=0) return -1; if(b.pin>=0) return 1; return a.i-b.i;
  }).map(x=>x.p);
  document.getElementById("results-title").textContent = state.activeCategory==="All" ? "All products" : state.activeCategory;
  if(list.length===0){ grid.innerHTML = `<div class="empty-note">No products found here yet.</div>`; return; }
  grid.innerHTML = list.map(p=>{
    const out = p.stock<=0;
    const low = !out && p.stock<=3;
    return `
    <div class="card">
      <div class="card-img" onclick="openProduct('${p.id}')">
        ${productImg(p)}
        ${out?'<span class="stock-flag">Out of stock</span>':(low?'<span class="stock-flag" style="background:var(--orange)">Low stock</span>':'')}
        <span class="cat-flag">${escapeHtml(p.category)}</span>
      </div>
      <div class="card-body">
        <div class="card-title" onclick="openProduct('${p.id}')">${escapeHtml(p.name)}</div>
        <div class="card-price">GH₵${p.price.toFixed(0)}</div>
        <div class="card-actions">
          <button class="icon-mini" onclick="openProduct('${p.id}')" aria-label="View">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <button class="add-btn" ${out?'disabled':''} onclick="addToCart('${p.id}')">${out?'Sold out':'+ Add'}</button>
        </div>
      </div>
    </div>`;
  }).join("");
}
function placeholderIcon(){
  return `<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="#9AAAE8" stroke-width="1.6"><rect x="3" y="4" width="18" height="15" rx="2"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M3 16l5-5 4 4 3-3 6 6"/></svg>`;
}

/* ---------------- Product detail ---------------- */
function openProduct(id){
  const p = findItem(id);
  if(!p) return;
  state.currentProductId=id;
  document.getElementById("pd-title-top").textContent = p.name;
  const revs = state.reviews[id]||[];
  const avg = revs.length ? (revs.reduce((s,r)=>s+r.rating,0)/revs.length).toFixed(1) : null;
  const imgs = itemImages(p);
  const gallery = imgs.length ? imgs.map(im=>`<img src="${im}">`).join("") : `<div style="width:140px;height:140px;border-radius:14px;background:var(--blue-pale);display:flex;align-items:center;justify-content:center;flex-shrink:0;">${placeholderIcon()}</div>`;
  const stockClass = p.stock<=0?'out':(p.stock<=3?'low':'ok');
  const stockLabel = p.kind==='package' ? 'Business branding package' : (p.stock<=0?'Out of stock':(p.stock<=3?`Only ${p.stock} left`:'In stock'));
  document.getElementById("product-body").innerHTML = `
    <div class="pd-gallery">${gallery}</div>
    ${p.video ? `<div style="margin-top:10px;"><a class="link-btn" href="${escapeAttr(p.video)}" target="_blank" rel="noopener">▶ Watch product video</a></div>` : ""}
    <div class="pd-price">GH₵${p.price.toFixed(0)}</div>
    <div class="pd-stock ${stockClass}">${stockLabel}</div>
    ${avg?`<div style="margin-top:6px;" class="stars">${'★'.repeat(Math.round(avg))}${'☆'.repeat(5-Math.round(avg))} <span style="color:var(--ink-soft);font-size:12px;">(${avg} · ${revs.length} review${revs.length>1?'s':''})</span></div>`:''}
    <p class="pd-desc">${escapeHtml(p.desc||"")}</p>
    ${(p.includes&&p.includes.length)?`<ul class="pd-includes">${p.includes.map(i=>`<li>${escapeHtml(i)}</li>`).join("")}</ul>`:""}
    <button class="btn btn-primary btn-block" ${p.stock<=0?'disabled':''} onclick="addToCart('${p.id}');closeSheet('overlay-product')">${p.stock<=0?'Sold out':'Add to cart'}</button>

    <div class="tab-row">
      <button class="tab-btn active" id="tb-reviews" onclick="setPdTab('reviews')">Reviews (${revs.length})</button>
      <button class="tab-btn" id="tb-write" onclick="setPdTab('write')">Write a review</button>
    </div>
    <div id="pd-panel-reviews">
      ${revs.length===0?'<p style="color:var(--ink-soft);font-size:13px;">No reviews yet — be the first to share your experience.</p>':revs.slice().reverse().map(r=>`
        <div class="review">
          <div class="review-top"><span class="nm">${escapeHtml(r.name)}</span><span class="stars">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</span></div>
          <p>${escapeHtml(r.comment)}</p>
        </div>`).join("")}
    </div>
    <div id="pd-panel-write" style="display:none;">
      <div class="field"><label>Your name</label><input id="rv-name" placeholder="Your name"></div>
      <div class="field">
        <label>Your rating</label>
        <div class="star-pick" id="rv-stars">
          <span data-v="1">&#9733;</span><span data-v="2">&#9733;</span><span data-v="3">&#9733;</span><span data-v="4">&#9733;</span><span data-v="5">&#9733;</span>
        </div>
      </div>
      <div class="field"><label>Your review</label><textarea id="rv-text" placeholder="What did you think of this product?"></textarea></div>
      <button class="btn btn-primary btn-block" onclick="submitReviewInline('${p.id}')">Submit review</button>
    </div>
  `;
  bindStarPicker();
  openSheet("overlay-product");
}
function setPdTab(which){
  document.getElementById("tb-reviews").classList.toggle("active", which==="reviews");
  document.getElementById("tb-write").classList.toggle("active", which==="write");
  document.getElementById("pd-panel-reviews").style.display = which==="reviews" ? "block":"none";
  document.getElementById("pd-panel-write").style.display = which==="write" ? "block":"none";
}
function bindStarPicker(){
  state.ratingPick=0;
  const stars=document.querySelectorAll("#rv-stars span");
  stars.forEach(s=>{
    s.onclick=()=>{
      state.ratingPick=parseInt(s.dataset.v);
      stars.forEach(x=>x.classList.toggle("on", parseInt(x.dataset.v)<=state.ratingPick));
    };
  });
}
async function submitReviewInline(productId){
  const name=document.getElementById("rv-name").value.trim();
  const text=document.getElementById("rv-text").value.trim();
  if(!name||!text||state.ratingPick===0){ showToast("Please add your name, a rating and a comment"); return; }
  await ensureFull();
  if(!state.reviews[productId]) state.reviews[productId]=[];
  state.reviews[productId].push({name, rating:state.ratingPick, comment:text, date:Date.now()});
  await saveReviews();
  showToast("Thanks for your review!");
  openProduct(productId);
}

/* ---------------- Cart ---------------- */
function addToCart(id){
  const p = findItem(id);
  if(!p || p.stock<=0) return;
  const existing = state.cart.find(c=>c.id===id);
  const inCartQty = existing ? existing.qty : 0;
  if(inCartQty+1 > p.stock){ showToast("No more stock available"); return; }
  if(existing){ existing.qty+=1; } else { state.cart.push({id, qty:1}); }
  renderCartBadge();
  showToast(`${p.name} added to cart`);
}
function changeQty(id, delta){
  const item = state.cart.find(c=>c.id===id);
  const p = findItem(id);
  if(!item) return;
  item.qty += delta;
  if(item.qty<=0){ state.cart = state.cart.filter(c=>c.id!==id); }
  else if(p && item.qty>p.stock){ item.qty=p.stock; showToast("That's all the stock we have"); }
  renderCartBadge(); renderCart();
}
function removeFromCart(id){ state.cart = state.cart.filter(c=>c.id!==id); renderCartBadge(); renderCart(); }
function renderCartBadge(){
  const count = state.cart.reduce((s,c)=>s+c.qty,0);
  const badge = document.getElementById("cart-badge");
  if(count>0){ badge.style.display="flex"; badge.textContent=count; } else { badge.style.display="none"; }
}
function cartTotal(){
  return state.cart.reduce((s,c)=>{ const p=findItem(c.id); return s + (p?p.price*c.qty:0); },0);
}
function openCart(){ renderCart(); openSheet("overlay-cart"); }
function renderCart(){
  const body = document.getElementById("cart-body");
  if(state.cart.length===0){
    body.innerHTML = `<div class="muted-box">Your cart is empty. Browse products and add something you love.</div>`;
    return;
  }
  const rows = state.cart.map(c=>{
    const p = findItem(c.id);
    if(!p) return "";
    const img = itemThumb(p) ? `<img src="${itemThumb(p)}">` : `<div style="width:58px;height:58px;border-radius:10px;background:var(--blue-pale);display:flex;align-items:center;justify-content:center;">${placeholderIcon()}</div>`;
    return `
    <div class="cart-item">
      ${img}
      <div class="cart-item-info">
        <div class="name">${escapeHtml(p.name)}</div>
        <div class="sub">GH₵${p.price.toFixed(0)} each</div>
        <div class="qty-ctrl">
          <button onclick="changeQty('${p.id}',-1)">−</button>
          <span>${c.qty}</span>
          <button onclick="changeQty('${p.id}',1)">+</button>
          <span class="rm" style="margin-left:10px;cursor:pointer;" onclick="removeFromCart('${p.id}')">Remove</span>
        </div>
      </div>
      <div style="font-weight:800;font-size:13px;">GH₵${(p.price*c.qty).toFixed(0)}</div>
    </div>`;
  }).join("");
  const total = cartTotal();
  body.innerHTML = rows + `
    <div style="padding-top:14px;">
      <div class="cart-summary-row total"><span>Total</span><span>GH₵${total.toFixed(0)}</span></div>
    </div>
    <button class="btn btn-primary btn-block" style="margin-top:6px;" onclick="goToCheckout()">Proceed to checkout</button>
  `;
}
async function goToCheckout(){
  closeSheet("overlay-cart");
  await ensureFull();            // never check out against half-loaded data
  state.checkoutOfferId = "";
  state.phoneCust = null;
  if(state.me){
    const f={ "co-name":state.me.name,"co-phone":state.me.phone,"co-email":state.me.email||"","co-address":state.me.address||"","co-paynum":state.me.payNumber||"" };
    Object.keys(f).forEach(id=>{ const el=document.getElementById(id); if(el && !el.value) el.value=f[id]; });
  }
  refreshCheckoutOffers();
  openSheet("overlay-checkout");
}

/* ---------------- Checkout + Paystack ---------------- */
function genOrderId(){ return "TLE-" + Math.floor(10000 + Math.random()*89999); }

function startPaystack(){
  if(state.cart.length===0){ showToast("Your cart is empty"); return; }
  const name=document.getElementById("co-name").value.trim();
  const phone=document.getElementById("co-phone").value.trim();
  let email=document.getElementById("co-email").value.trim();
  const address=document.getElementById("co-address").value.trim();
  const notes=document.getElementById("co-notes").value.trim();
  const payNumber=document.getElementById("co-paynum").value.trim();
  if(!name||!phone||!address){ showToast("Please fill in your name, phone and delivery location"); return; }

  // A malformed email can cause Paystack to silently reject/stall the
  // authorization step, so validate it rather than trust it blindly.
  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if(email && !emailLooksValid){ showToast("That email address doesn't look right — check it or leave it blank"); return; }
  const useEmail = emailLooksValid ? email : (phone.replace(/\D/g,'')+"@techlordexpert.customer");

  const total = checkoutTotal();
  if(total<=0){ showToast("Cart total is invalid"); return; }

  const payBtn = document.getElementById("pay-btn");
  payBtn.disabled=true; payBtn.innerHTML='<span class="spinner"></span> Opening Paystack...';

  if(typeof PaystackPop === "undefined"){
    payBtn.disabled=false; payBtn.textContent="Pay with Paystack";
    showToast("Paystack could not load. Check your connection and try again.");
    return;
  }

  const orderId = genOrderId();
  const amountPesewas = Math.round(total*100);
  console.log("[Paystack] starting checkout", { orderId, amountPesewas, currency:"GHS", email:useEmail });

  try{
    const handler = PaystackPop.setup({
      key: PUBLIC_PAYSTACK_KEY,
      email: useEmail,
      amount: amountPesewas,
      currency: "GHS",
      ref: orderId,
      // Explicitly listing every Ghana-relevant channel, rather than relying
      // on the account's default channel settings, so the popup reliably
      // offers card, mobile money, bank and USSD instead of silently
      // defaulting to something that may not be fully enabled.
      channels: ["card","mobile_money","bank","ussd","bank_transfer"],
      metadata:{ custom_fields:[{display_name:"Order ID",variable_name:"order_id",value:orderId}] },
      callback: function(response){
        console.log("[Paystack] payment callback fired", response);
        finalizeOrder(orderId, response.reference, {name, phone, email, address, notes, payNumber});
      },
      onClose: function(){
        console.log("[Paystack] popup closed without completing payment", { orderId });
        payBtn.disabled=false; payBtn.textContent="Pay with Paystack";
      }
    });
    handler.openIframe();
  }catch(e){
    console.error("[Paystack] setup/openIframe threw an error", e);
    payBtn.disabled=false; payBtn.textContent="Pay with Paystack";
    showToast("Couldn't open Paystack — please try again in a moment");
  }
}

async function finalizeOrder(orderId, ref, form){
  await ensureFull();
  const items = state.cart.map(c=>{
    const p = findItem(c.id);
    return {productId:c.id, name:p?p.name:"Item", qty:c.qty, price:p?p.price:0, kind:(p&&p.kind==="package")?"package":"product"};
  });
  const subtotal = cartTotal();
  const disc = currentDiscount();
  const total = Math.max(0, subtotal - disc.amount);

  // reduce stock on real products only (packages are unlimited)
  const touched = [];
  state.cart.forEach(c=>{
    const p = state.products.find(x=>x.id===c.id);
    if(p){ p.stock = Math.max(0, p.stock - c.qty); touched.push(p); }
  });
  await Promise.all(touched.map(p=>saveStockOnly(p)));

  // find (or create) this customer — phone number is how repeat buyers are recognised
  const cust = await upsertCustomerFromOrder(form, total, disc.offer);

  const order = {
    id: orderId, paystackRef: ref, customerId: cust.id,
    name: form.name, phone: form.phone, email: form.email||"", payNumber: form.payNumber||form.phone,
    address: form.address, notes: form.notes, items, subtotal, total,
    discount: disc.amount>0 ? {offerId:disc.offer.id, title:disc.offer.title, percent:disc.offer.percent, amount:disc.amount} : null,
    status: "processing", createdAt: Date.now()
  };
  const freshOrders = await docGet("orders");           // re-read so we never overwrite someone else's order
  if(freshOrders!==undefined) state.orders = freshOrders;
  state.orders.push(order);
  await saveOrders();
  state.cart = [];
  state.checkoutOfferId = "";
  renderCartBadge();
  renderProducts();

  document.getElementById("pay-btn").disabled=false;
  document.getElementById("pay-btn").textContent="Pay with Paystack";
  closeSheet("overlay-checkout");
  showOrderSuccess(order, cust);
}

function showOrderSuccess(order, cust){
  document.getElementById("track-input").value = order.id;
  document.getElementById("success-body").innerHTML = `
    <div style="width:62px;height:62px;border-radius:50%;background:#DAF6E4;color:var(--ok);display:flex;align-items:center;justify-content:center;margin:0 auto 12px;font-size:30px;font-weight:800;">&#10003;</div>
    <h3 style="margin:0 0 4px;font-size:20px;">Payment received!</h3>
    <p style="margin:0 0 14px;color:var(--ink-soft);font-size:13px;">Order <b>${order.id}</b> is being processed.</p>
    <div class="me-card" style="text-align:left;">
      <div style="font-size:12px;color:#DCE4FF;">Your Customer ID — keep it, it unlocks your purchase history, discounts and updates under <b>Me</b>.</div>
      <div class="cid-box"><div><small>Customer ID</small><b>${cust.id}</b></div><button class="cid-copy" onclick="copyText('${cust.id}')">Copy</button></div>
    </div>
    <button class="btn btn-primary btn-block" style="margin-top:14px;" onclick="closeSheet('overlay-success');openTracking();doTrackOrder();">Track this order</button>
    <button class="btn btn-outline btn-block" style="margin-top:8px;" onclick="closeSheet('overlay-success');openMe();">View my history</button>`;
  openSheet("overlay-success");
  showToast("Order "+order.id+" placed!");
}

/* ---------------- Order tracking ---------------- */
async function doTrackOrder(){
  await refreshSharedData();
  const q = document.getElementById("track-input").value.trim().toLowerCase();
  const box = document.getElementById("track-results");
  if(!q){ box.innerHTML = `<div class="muted-box">Enter your order ID or the phone number you ordered with.</div>`; return; }
  const matches = state.orders.filter(o=> o.id.toLowerCase()===q || (o.customerId||'').toLowerCase()===q || o.phone.replace(/\D/g,'').includes(q.replace(/\D/g,'')) && q.replace(/\D/g,'').length>=6 );
  if(matches.length===0){ box.innerHTML = `<div class="muted-box">We couldn't find an order matching that. Double-check the ID or phone number.</div>`; return; }
  box.innerHTML = matches.slice().reverse().map(o=>`
    <div class="list-row" style="align-items:flex-start;flex-direction:column;">
      <div style="display:flex;justify-content:space-between;width:100%;align-items:center;">
        <div class="li-title">${o.id}</div>
        <span class="status-pill status-${o.status}">${statusLabel(o.status)}</span>
      </div>
      <div class="li-sub" style="margin:6px 0 8px;">${new Date(o.createdAt).toLocaleString()} · GH₵${o.total.toFixed(0)}</div>
      <div style="font-size:12.5px;color:var(--ink-soft);width:100%;">
        ${o.items.map(it=>`${it.qty} × ${escapeHtml(it.name)}`).join("<br>")}
      </div>
    </div>
  `).join("");
}
function statusLabel(s){
  return {pending:"Pending",processing:"Processing",shipped:"Out for delivery",completed:"Completed",cancelled:"Cancelled"}[s]||s;
}

/* ---------------- Help / Contact ---------------- */
function openHelp(){
  if(state.me){ const n=document.getElementById("hp-name"), p=document.getElementById("hp-phone"); if(!n.value) n.value=state.me.name; if(!p.value) p.value=state.me.phone; }
  openSheet("overlay-help");
}
function openWhatsApp(){
  const msg = encodeURIComponent("Hi TechLord & Co., I'd like to ask about your products/services.");
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, "_blank");
}
async function submitHelp(){
  const name=document.getElementById("hp-name").value.trim();
  const phone=document.getElementById("hp-phone").value.trim();
  const orderId=document.getElementById("hp-order").value.trim();
  const msg=document.getElementById("hp-msg").value.trim();
  if(!name||!phone||!msg){ showToast("Please fill in your name, phone and message"); return; }
  await ensureFull();
  state.messages.push({id:"MSG-"+Date.now(), name, phone, orderId, message:msg, read:false, createdAt:Date.now()});
  await saveMessages();
  document.getElementById("hp-name").value="";
  document.getElementById("hp-phone").value="";
  document.getElementById("hp-order").value="";
  document.getElementById("hp-msg").value="";
  closeSheet("overlay-help");
  showToast("Message sent! We'll get back to you soon.");
  renderHelpBadge();
}
function renderHelpBadge(){
  const unread = state.messages.filter(m=>!m.read).length;
  const b = document.getElementById("help-badge");
  // this badge on the storefront simply hints support is active; real unread count is for admin only
  b.style.display = "none";
}

/* ---------------- Admin: login ---------------- */
function openAdminEntry(){
  if(state.adminLoggedIn){ showView("view-admin"); renderAdminAll(); }
  else { showView("view-admin-login"); document.getElementById("admin-pw-input").value=""; document.getElementById("admin-login-error").textContent=""; }
}
function toggleAdminPwVisibility(){
  const inp = document.getElementById("admin-pw-input");
  inp.type = inp.type==="password" ? "text":"password";
}
async function doAdminLogin(){
  await refreshSharedData();
  loadAllCustomers().then(()=>{ if(state.adminLoggedIn) renderAdminCustomers(); });
  const val = document.getElementById("admin-pw-input").value;
  if(val === state.adminPassword){
    state.adminLoggedIn = true;
    showView("view-admin");
    renderAdminAll();
  }else{
    document.getElementById("admin-login-error").textContent = "Incorrect password. Try again.";
  }
}
function adminLogout(){ state.adminLoggedIn=false; showView("view-storefront"); setNavActive("home"); }

/* ---------------- Admin tabs ---------------- */
function setAdminTab(tab){
  state.adminTab = tab;
  document.querySelectorAll(".atab").forEach(b=>b.classList.toggle("active", b.dataset.tab===tab));
  document.querySelectorAll(".admin-tab-content").forEach(el=>el.style.display="none");
  document.getElementById("admin-tab-"+tab).style.display="";   // CSS decides block/grid
  if(tab==="customers"||tab==="overview") loadAllCustomers().then(()=>{ renderAdminCustomers(); renderAdminOverview(); });
  renderAdminAll();
}
function renderAdminAll(){
  renderAdminOverview();
  renderAdminProducts();
  renderAdminPackages();
  renderAdminOrders();
  renderAdminCustomers();
  renderAdminOffers();
  renderAdminLayout();
  renderAdminMessages();
  renderAdminReviews();
  renderAdminSettings();
  updateMessageBadge();
}
function updateMessageBadge(){
  const unread = state.messages.filter(m=>!m.read).length;
  const tabBadge = document.getElementById("msg-tab-badge");
  if(unread>0){ tabBadge.style.display="flex"; tabBadge.textContent=unread; } else { tabBadge.style.display="none"; }
}

function renderAdminOverview(){
  const el = document.getElementById("admin-tab-overview");
  const totalOrders = state.orders.length;
  const revenue = state.orders.reduce((s,o)=>s+o.total,0);
  const lowStock = state.products.filter(p=>p.stock<=3 && p.stock>0).length;
  const outStock = state.products.filter(p=>p.stock<=0).length;
  const unread = state.messages.filter(m=>!m.read).length;
  el.innerHTML = `
    <div class="stat-grid" style="padding:0 0 4px;">
      <div class="stat-box"><div class="num">${totalOrders}</div><div class="lbl">Total orders</div></div>
      <div class="stat-box"><div class="num">GH₵${revenue.toFixed(0)}</div><div class="lbl">Revenue collected</div></div>
      <div class="stat-box"><div class="num">${lowStock}</div><div class="lbl">Low stock items</div></div>
      <div class="stat-box"><div class="num">${outStock}</div><div class="lbl">Out of stock</div></div>
      <div class="stat-box"><div class="num">${state.customers.length}</div><div class="lbl">Customers</div></div>
      <div class="stat-box"><div class="num">${state.packages.filter(k=>k.published!==false).length}</div><div class="lbl">Live packages</div></div>
    </div>
    <div style="margin-top:6px;">
      <div class="list-row">
        <div class="li-info"><div class="li-title">Unread messages</div><div class="li-sub">Customer questions waiting for a reply</div></div>
        ${unread>0?`<span class="status-pill status-pending">${unread} new</span>`:`<span class="status-pill status-completed">All clear</span>`}
      </div>
    </div>
    <div class="note-inline">This dashboard updates products, orders, reviews and messages instantly for every device viewing the store — nothing to refresh manually.</div>
  `;
}

function renderAdminProducts(){
  renderProductManagerInto("admin-tab-products");
  renderProductManagerInto("settings-product-manager");
}
function renderProductManagerInto(containerId){
  const el = document.getElementById(containerId);
  if(!el) return;
  let html = `<button class="btn btn-primary btn-block" onclick="openAddProduct()" style="margin-bottom:14px;">+ Add new product</button>`;
  html += state.categories.map(cat=>{
    const items = state.products.filter(p=>p.category===cat);
    if(items.length===0) return "";
    return `<div style="font-size:12px;font-weight:800;color:var(--ink-soft);margin:14px 0 8px;text-transform:uppercase;letter-spacing:0.4px;">${escapeHtml(cat)}</div>` +
      items.map(p=>{
        const img = (p.images&&p.images[0]) ? `<img src="${p.images[0]}">` : `<div style="width:52px;height:52px;border-radius:10px;background:var(--blue-pale);display:flex;align-items:center;justify-content:center;">${placeholderIcon()}</div>`;
        return `
        <div class="admin-product-row">
          ${img}
          <div style="flex:1;min-width:0;">
            <div class="li-title">${escapeHtml(p.name)}</div>
            <div class="mini-edit-row">
              <div style="flex:1;">
                <label>Price (GH₵)</label>
                <input type="number" value="${p.price}" onchange="quickUpdate('${p.id}','price',this.value)">
              </div>
              <div style="flex:1;">
                <label>Stock</label>
                <input type="number" value="${p.stock}" onchange="quickUpdate('${p.id}','stock',this.value)">
              </div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
              <button class="link-btn" onclick="openEditProduct('${p.id}')">Edit details, images &amp; video &rarr;</button>
              <button class="link-btn" style="display:flex;align-items:center;gap:4px;" onclick="shareProduct('${p.id}')">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path stroke-linecap="round" d="M8.6 10.5l6.8-3.9M8.6 13.5l6.8 3.9"/></svg>
                Share
              </button>
            </div>
          </div>
        </div>`;
      }).join("");
  }).join("");
  el.innerHTML = html;
}
async function quickUpdate(id, field, value){
  const p = findItem(id);
  if(!p) return;
  const num = parseFloat(value);
  if(isNaN(num) || num<0){ showToast("Enter a valid number"); renderAdminProducts(); return; }
  p[field] = num;
  await saveOneProduct(p);
  showToast((field==="price"?"Price":"Stock")+" updated — live on the store now");
  renderProducts(); queueCachePush();
}

function openAddProduct(){
  document.getElementById("ep-title").textContent="Add product";
  document.getElementById("ep-id").value="";
  document.getElementById("ep-name").value="";
  document.getElementById("ep-price").value="";
  document.getElementById("ep-stock").value="";
  document.getElementById("ep-desc").value="";
  document.getElementById("ep-video").value="";
  state.pendingImages=[];
  renderCategorySelect();
  renderImageThumbs();
  document.getElementById("ep-share-btn").style.display="none";
  document.getElementById("ep-delete-btn").style.display="none";
  openSheet("overlay-editproduct");
}
function openEditProduct(id){
  const p = findItem(id);
  if(!p) return;
  document.getElementById("ep-title").textContent="Edit product";
  document.getElementById("ep-id").value=id;
  document.getElementById("ep-name").value=p.name;
  document.getElementById("ep-price").value=p.price;
  document.getElementById("ep-stock").value=p.stock;
  document.getElementById("ep-desc").value=p.desc||"";
  document.getElementById("ep-video").value=p.video||"";
  state.pendingImages = (p.images||[]).slice();
  renderCategorySelect(p.category);
  renderImageThumbs();
  document.getElementById("ep-share-btn").style.display="block";
  document.getElementById("ep-delete-btn").style.display="block";
  openSheet("overlay-editproduct");
}
function renderCategorySelect(selected){
  const sel = document.getElementById("ep-category");
  sel.innerHTML = state.categories.map(c=>`<option value="${escapeAttr(c)}" ${c===selected?'selected':''}>${escapeHtml(c)}</option>`).join("");
}
function renderImageThumbs(){
  const html = state.pendingImages.map((im,i)=>{
    if(im==="UPLOADING"){
      return `<div style="width:44px;height:44px;border-radius:8px;background:var(--blue-pale);display:flex;align-items:center;justify-content:center;">
        <span class="spinner" style="border-color:rgba(21,43,158,0.25);border-top-color:var(--blue-deep);"></span>
      </div>`;
    }
    return `
    <div style="position:relative;">
      <img class="th" src="${im}">
      <div class="thumb-x" onclick="removePendingImage(${i})">&#10005;</div>
    </div>`;
  }).join("");
  ["ep-image-thumbs","pk-image-thumbs"].forEach(id=>{ const w=document.getElementById(id); if(w) w.innerHTML=html; });
}
function removePendingImage(i){ state.pendingImages.splice(i,1); renderImageThumbs(); }

/* Shrinks a photo before it's stored: resizes it down and re-encodes as
   a JPEG, so a multi-MB phone photo becomes ~50–150KB instead. This is
   what makes storing images as text inside Firestore actually safe. */
function compressImageFile(file, maxDim=1000, quality=0.72){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onerror = ()=>reject(new Error("read failed"));
    reader.onload = ()=>{
      const img = new Image();
      img.onerror = ()=>reject(new Error("decode failed"));
      img.onload = ()=>{
        let {width, height} = img;
        if(width>height && width>maxDim){ height=Math.round(height*maxDim/width); width=maxDim; }
        else if(height>=width && height>maxDim){ width=Math.round(width*maxDim/height); height=maxDim; }
        const canvas = document.createElement("canvas");
        canvas.width=width; canvas.height=height;
        canvas.getContext("2d").drawImage(img,0,0,width,height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
function approxBytesOfDataUrl(dataUrl){
  return Math.ceil((dataUrl||"").length * 0.75); // base64 is ~33% bigger than the raw bytes
}
const MAX_IMAGE_BYTES = 220*1024;     // per-image ceiling after compression
const MAX_TOTAL_IMAGE_BYTES = 850*1024; // safe budget per product, under Firestore's 1MB doc limit

async function handleImageUpload(ev){
  const files = Array.from(ev.target.files||[]);
  ev.target.value="";
  for(const file of files){
    if(!file.type.startsWith("image/")){ showToast(file.name+" isn't an image"); continue; }
    const idx = state.pendingImages.push("UPLOADING") - 1;
    renderImageThumbs();
    try{
      let dataUrl = await compressImageFile(file, 1000, 0.72);
      // If it's still large (very busy/high-detail photo), compress harder once more.
      if(approxBytesOfDataUrl(dataUrl) > MAX_IMAGE_BYTES){
        dataUrl = await compressImageFile(file, 700, 0.55);
      }
      if(approxBytesOfDataUrl(dataUrl) > MAX_IMAGE_BYTES){
        state.pendingImages.splice(idx,1);
        showToast(file.name+" is still too large even after compressing — try a simpler or smaller photo");
        renderImageThumbs();
        continue;
      }
      const currentTotal = state.pendingImages.reduce((s,im)=> s + (im==="UPLOADING"?0:approxBytesOfDataUrl(im)), 0);
      if(currentTotal + approxBytesOfDataUrl(dataUrl) > MAX_TOTAL_IMAGE_BYTES){
        state.pendingImages.splice(idx,1);
        showToast("This product's photos are getting too large together — remove one before adding another");
        renderImageThumbs();
        continue;
      }
      state.pendingImages[idx] = dataUrl;
    }catch(e){
      console.error("Image processing failed", e);
      state.pendingImages.splice(idx,1);
      showToast("Couldn't process "+file.name);
    }
    renderImageThumbs();
  }
}
async function saveProduct(){
  const id = document.getElementById("ep-id").value;
  const name = document.getElementById("ep-name").value.trim();
  const category = document.getElementById("ep-category").value;
  const price = parseFloat(document.getElementById("ep-price").value);
  const stock = parseInt(document.getElementById("ep-stock").value);
  const desc = document.getElementById("ep-desc").value.trim();
  const video = document.getElementById("ep-video").value.trim();
  if(!name || isNaN(price) || price<0 || isNaN(stock) || stock<0){
    showToast("Please fill in a valid name, price and stock"); return;
  }
  if(state.pendingImages.includes("UPLOADING")){
    showToast("Please wait for the image(s) to finish processing"); return;
  }
  let product;
  if(id){
    product = findItem(id);
    Object.assign(product, {name, category, price, stock, desc, video, images: state.pendingImages.slice()});
  }else{
    product = { id:"p"+Date.now(), name, category, price, stock, desc, video, images: state.pendingImages.slice() };
    state.products.push(product);
  }
  try{
    await saveOneProduct(product);
  }catch(e){
    console.error(e);
    showToast("Couldn't save — try removing a photo and saving again");
    return;
  }
  closeSheet("overlay-editproduct");
  showToast("Product saved — live on the store now");
  renderAdminProducts(); renderProducts(); queueCachePush();
}
async function deleteProductConfirm(){
  const id = document.getElementById("ep-id").value;
  if(!id) return;
  if(!confirm("Delete this product? This can't be undone.")) return;
  state.products = state.products.filter(x=>x.id!==id);
  await deleteOneProduct(id);
  closeSheet("overlay-editproduct");
  showToast("Product deleted");
  renderAdminProducts(); renderProducts(); queueCachePush();
}

/* Builds a direct link straight to one product (customers land on it
   ready to add to cart / buy) and hands it to the phone's native share
   sheet — so posting to WhatsApp status, TikTok, or Instagram is just
   picking the app from the share menu that pops up. */
async function shareProduct(id){
  const p = findItem(id);
  if(!p){ showToast("Save the product first, then you can share it"); return; }
  // Plain link back to this exact product — no photo attached, no preview
  // page, no server component needed. Works with a plain deploy.
  const shareUrl = `${location.origin}${location.pathname}?product=${encodeURIComponent(id)}`;
  const shareText = `Check out ${p.name} — GH₵${p.price.toFixed(0)} on TechLord & Co.!`;
  if(navigator.share){
    try{ await navigator.share({ title: p.name, text: shareText, url: shareUrl }); }
    catch(e){ /* user closed the share sheet — nothing to do */ }
    return;
  }
  try{
    await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
    showToast("Link copied! Paste it into your WhatsApp status, TikTok or Instagram caption");
  }catch(e){
    showToast("Couldn't copy automatically — link: "+shareUrl);
  }
}

function renderAdminOrders(){
  const el = document.getElementById("admin-tab-orders");
  if(state.orders.length===0){ el.innerHTML = `<div class="muted-box">No orders yet.</div>`; return; }
  el.innerHTML = state.orders.slice().reverse().map(o=>`
    <div class="list-row" style="flex-direction:column;align-items:flex-start;">
      <div style="display:flex;justify-content:space-between;width:100%;align-items:center;">
        <div class="li-title">${o.id} — ${escapeHtml(o.name)}</div>
        <span class="status-pill status-${o.status}">${statusLabel(o.status)}</span>
      </div>
      <div class="li-sub">${o.phone} · ${escapeHtml(o.address)} · ${new Date(o.createdAt).toLocaleString()}</div>
      <div style="font-size:12.5px;color:var(--ink-soft);margin:6px 0;">${o.items.map(it=>`${it.qty} × ${escapeHtml(it.name)}`).join(", ")}</div>
      <div style="font-weight:800;font-size:14px;margin-bottom:8px;">GH₵${o.total.toFixed(0)}</div>
      <select style="width:100%;padding:9px;border-radius:9px;border:1.5px solid var(--line);font-size:13px;" onchange="updateOrderStatus('${o.id}',this.value)">
        ${["pending","processing","shipped","completed","cancelled"].map(s=>`<option value="${s}" ${s===o.status?'selected':''}>${statusLabel(s)}</option>`).join("")}
      </select>
    </div>
  `).join("");
}
async function updateOrderStatus(id, status){
  const o = state.orders.find(x=>x.id===id);
  if(!o) return;
  o.status = status;
  await saveOrders();
  showToast("Order "+id+" marked "+statusLabel(status));
  renderAdminOrders();
}

function renderAdminMessages(){
  const el = document.getElementById("admin-tab-messages");
  if(state.messages.length===0){ el.innerHTML = `<div class="muted-box">No messages yet.</div>`; return; }
  el.innerHTML = state.messages.slice().reverse().map(m=>`
    <div class="list-row" style="flex-direction:column;align-items:flex-start;">
      <div style="display:flex;justify-content:space-between;width:100%;align-items:center;">
        <div class="li-title">${escapeHtml(m.name)} ${m.orderId?('· '+escapeHtml(m.orderId)):''}</div>
        ${m.read?'<span class="status-pill status-completed">Read</span>':'<span class="status-pill status-pending">New</span>'}
      </div>
      <div class="li-sub">${escapeHtml(m.phone)} · ${new Date(m.createdAt).toLocaleString()}</div>
      <div style="font-size:13px;margin:8px 0;">${escapeHtml(m.message)}</div>
      <div style="display:flex;gap:8px;width:100%;">
        ${!m.read?`<button class="btn btn-outline" style="flex:1;padding:9px;font-size:12.5px;" onclick="markMessageRead('${m.id}')">Mark as read</button>`:''}
        <button class="btn btn-primary" style="flex:1;padding:9px;font-size:12.5px;" onclick="window.open('https://wa.me/${WHATSAPP_NUMBER.startsWith('233')?'':'233'}'+'${m.phone.replace(/\D/g,'')}','_blank')">Reply on WhatsApp</button>
      </div>
    </div>
  `).join("");
}
async function markMessageRead(id){
  const m = state.messages.find(x=>x.id===id);
  if(!m) return;
  m.read=true;
  await saveMessages();
  renderAdminMessages(); updateMessageBadge();
}

function renderAdminReviews(){
  const el = document.getElementById("admin-tab-reviews");
  let rows=[];
  Object.keys(state.reviews).forEach(pid=>{
    const p = state.products.find(x=>x.id===pid);
    (state.reviews[pid]||[]).forEach((r,idx)=>{
      rows.push({pid, idx, productName:p?p.name:"(deleted product)", ...r});
    });
  });
  if(rows.length===0){ el.innerHTML = `<div class="muted-box">No reviews yet.</div>`; return; }
  rows.sort((a,b)=>b.date-a.date);
  el.innerHTML = rows.map(r=>`
    <div class="list-row" style="flex-direction:column;align-items:flex-start;">
      <div style="display:flex;justify-content:space-between;width:100%;">
        <div class="li-title">${escapeHtml(r.productName)}</div>
        <span class="stars">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</span>
      </div>
      <div class="li-sub">${escapeHtml(r.name)} · ${new Date(r.date).toLocaleDateString()}</div>
      <div style="font-size:13px;margin:8px 0;">${escapeHtml(r.comment)}</div>
      <button class="btn btn-danger" style="align-self:flex-end;padding:7px 14px;font-size:12px;" onclick="deleteReview('${r.pid}',${r.idx})">Remove</button>
    </div>
  `).join("");
}
async function deleteReview(pid, idx){
  if(!state.reviews[pid]) return;
  state.reviews[pid].splice(idx,1);
  await saveReviews();
  showToast("Review removed");
  renderAdminReviews();
}

function renderAdminSettings(){
  const el = document.getElementById("admin-tab-settings");
  el.innerHTML = `
    <div class="list-row" style="flex-direction:column;align-items:stretch;">
      <div class="li-title" style="margin-bottom:6px;">Manage products</div>
      <div class="li-sub" style="margin-bottom:12px;">Edit price, stock, description, images and video for anything already on the store, or add a brand new item.</div>
      <div id="settings-product-manager"></div>
    </div>
    <div class="list-row" style="flex-direction:column;align-items:stretch;margin-top:14px;">
      <div class="li-title" style="margin-bottom:10px;">Change shopkeeper password</div>
      <div class="field"><label>Current password</label><input type="password" id="cp-current"></div>
      <div class="field"><label>New password</label><input type="password" id="cp-new"></div>
      <div class="field"><label>Confirm new password</label><input type="password" id="cp-confirm"></div>
      <button class="btn btn-primary btn-block" onclick="changeAdminPassword()">Update password</button>
      <div class="admin-error" id="cp-error"></div>
    </div>
    <div class="list-row" style="flex-direction:column;align-items:stretch;margin-top:14px;">
      <div class="li-title" style="margin-bottom:6px;">Store categories</div>
      <div class="li-sub" style="margin-bottom:10px;">Add a category and it appears instantly on the storefront.</div>
      <div style="display:flex;gap:8px;">
        <input id="new-cat-input" placeholder="e.g. Wedding Packages" style="flex:1;padding:11px;border-radius:11px;border:1.5px solid var(--line);">
        <button class="btn btn-primary" style="padding:11px 16px;" onclick="addCategory()">Add</button>
      </div>
      <div class="thumb-row" style="margin-top:12px;flex-wrap:wrap;">
        ${state.categories.map(c=>`<span class="chip" style="display:flex;align-items:center;gap:6px;">${escapeHtml(c)}<span style="cursor:pointer;color:var(--red);font-weight:800;" onclick="removeCategory('${escapeAttr(c)}')">&#10005;</span></span>`).join("")}
      </div>
    </div>
    <div class="note-inline" style="margin-top:14px;">
      Payments use your Paystack public key only (safe for the browser). For a real launch, connect a small backend server that holds your Paystack secret key and verifies each payment via webhook before an order is confirmed — this prevents anyone from faking a "successful" payment from the browser.
    </div>
  `;
  renderProductManagerInto("settings-product-manager");
  el.insertAdjacentHTML("beforeend", cacheCardHtml());
}
async function changeAdminPassword(){
  const cur=document.getElementById("cp-current").value;
  const nw=document.getElementById("cp-new").value;
  const cf=document.getElementById("cp-confirm").value;
  const err=document.getElementById("cp-error");
  err.textContent="";
  if(cur!==state.adminPassword){ err.textContent="Current password is incorrect."; return; }
  if(nw.length<6){ err.textContent="New password must be at least 6 characters."; return; }
  if(nw!==cf){ err.textContent="New passwords don't match."; return; }
  state.adminPassword = nw;
  await saveAdminPassword();
  document.getElementById("cp-current").value="";
  document.getElementById("cp-new").value="";
  document.getElementById("cp-confirm").value="";
  showToast("Password updated");
}
async function addCategory(){
  const inp=document.getElementById("new-cat-input");
  const val=inp.value.trim();
  if(!val){ return; }
  if(state.categories.includes(val)){ showToast("That category already exists"); return; }
  state.categories.push(val);
  await saveCategories();
  inp.value="";
  showToast("Category added");
  renderAdminSettings(); renderCategoryChips(); queueCachePush();
}
async function removeCategory(cat){
  if(!confirm(`Remove "${cat}"? Products in it will stay but the category tab will disappear.`)) return;
  state.categories = state.categories.filter(c=>c!==cat);
  await saveCategories();
  showToast("Category removed");
  renderAdminSettings(); renderCategoryChips(); queueCachePush();
}

/* ============================================================
   ITEM HELPERS (products + packages share the cart & detail sheet)
   ============================================================ */
function findItem(id){ return state.products.find(x=>x.id===id) || state.packages.find(x=>x.id===id); }
function itemImages(p){
  if(p.images && p.images.length) return p.images;
  if(p.thumbs && p.thumbs.length) return p.thumbs;
  return p.thumb ? [p.thumb] : [];
}
function itemThumb(p){ return p.thumb || (p.images && p.images[0]) || (p.thumbs && p.thumbs[0]) || ""; }
async function copyText(t){
  try{ await navigator.clipboard.writeText(t); showToast("Copied: "+t); }
  catch(e){ showToast("Copy failed — your ID is "+t); }
}
function waNumber(ph){
  const d=String(ph||"").replace(/\D/g,"");
  return d.startsWith("233") ? d : (d.startsWith("0") ? "233"+d.slice(1) : "233"+d);
}

/* ============================================================
   PACKAGES (Business Branding Packages) — one Firestore doc each
   ============================================================ */
function pkgFromDoc(id, d){ return {id, ...d, kind:"package", stock:999, includes:d.includes||[], images:d.images||[]}; }
async function loadPackagesList(){
  if(fbRefs){
    try{
      const snap = await fbRefs.getDocs(fbRefs.collection(fbRefs.db, PACKAGES_COLLECTION));
      const list=[]; snap.forEach(d=> list.push(pkgFromDoc(d.id, d.data())));
      return list;
    }catch(e){ console.error("Firestore package list read failed", e); }
  }
  try{ const raw=localStorage.getItem("tle_packages"); return raw ? JSON.parse(raw).map(k=>pkgFromDoc(k.id,k)) : []; }
  catch(e){ return []; }
}
async function saveOnePackage(k){
  const {id, kind, stock, ...rest} = k;
  if(fbRefs){ await fbRefs.setDoc(fbRefs.doc(fbRefs.db, PACKAGES_COLLECTION, id), rest); return; }
  if(!state.packages.some(x=>x.id===id)) state.packages.push(k);
  try{ localStorage.setItem("tle_packages", JSON.stringify(state.packages)); }catch(e){}
}
async function deleteOnePackage(id){
  if(fbRefs){ try{ await fbRefs.deleteDoc(fbRefs.doc(fbRefs.db, PACKAGES_COLLECTION, id)); return; }catch(e){ console.error(e); } }
  try{ localStorage.setItem("tle_packages", JSON.stringify(state.packages)); }catch(e){}
}

/* Packages in the order the shopkeeper chose (Layout tab); unlisted ones go last. */
function sortedPackages(includeHidden){
  const ord = state.layout.packageOrder;
  let l = state.packages.slice();
  if(!includeHidden) l = l.filter(k=>k.published!==false);
  return l.map((k,i)=>({k,i,o:ord.indexOf(k.id)})).sort((a,b)=>{
    if(a.o>=0 && b.o>=0) return a.o-b.o;
    if(a.o>=0) return -1; if(b.o>=0) return 1;
    return (a.k.createdAt||0)-(b.k.createdAt||0) || a.i-b.i;
  }).map(x=>x.k);
}
function applyLayout(){
  const o = state.layout.sectionOrder;
  const pk=document.getElementById("sec-packages"), pr=document.getElementById("sec-products");
  if(pk) pk.style.order = o.indexOf("packages");
  if(pr) pr.style.order = o.indexOf("products");
}

/* ---------- slideshow: auto-plays, and swipes (touch or mouse) ---------- */
function slideshowHtml(imgs){
  if(!imgs.length) return `<div class="slides" data-n="0"><div class="ph">${placeholderIcon()}</div></div>`;
  return `<div class="slides" data-n="${imgs.length}" data-i="0">
    ${imgs.map((im,i)=>`<img src="${im}" class="${i===0?'on':''}" alt="" draggable="false" decoding="async" ${i>0?'loading="lazy"':''}>`).join("")}
    ${imgs.length>1?`<div class="dots">${imgs.map((_,i)=>`<i class="${i===0?'on':''}"></i>`).join("")}</div>`:""}
  </div>`;
}
function goSlide(el, i){
  const n=+el.dataset.n; if(n<2) return;
  i=((i%n)+n)%n; el.dataset.i=i;
  el.querySelectorAll("img").forEach((m,k)=>m.classList.toggle("on",k===i));
  el.querySelectorAll(".dots i").forEach((d,k)=>d.classList.toggle("on",k===i));
}
let slideObs=null;
function observeSlides(){
  const els=document.querySelectorAll(".slides[data-n]");
  if(!("IntersectionObserver" in window)){ els.forEach(e=>e.dataset.vis="1"); return; }
  if(!slideObs) slideObs=new IntersectionObserver(es=>es.forEach(e=>{
    e.target.dataset.vis = e.isIntersecting ? "1":"0";
    if(e.isIntersecting && !e.target.dataset.next) e.target.dataset.next = Date.now()+2500+Math.random()*1500;
  }),{threshold:0.4});
  els.forEach(el=>{ if(+el.dataset.n>1) slideObs.observe(el); });
}
const prefersReducedMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
setInterval(()=>{
  if(prefersReducedMotion || document.hidden) return;
  const now=Date.now();
  document.querySelectorAll('.slides[data-vis="1"]').forEach(el=>{
    if(now < (+el.dataset.next||0)) return;
    if(now-(+el.dataset.hold||0) < 6000) return;      // the visitor just swiped — leave it alone
    goSlide(el, (+el.dataset.i)+1);
    el.dataset.next = now+3600+Math.random()*1200;     // slightly different rhythm per card
  });
},700);
let swipe=null; window.__swiped=false;
document.addEventListener("pointerdown",e=>{
  const el=e.target.closest && e.target.closest(".slides[data-n]");
  swipe = el ? {el,x:e.clientX,y:e.clientY} : null;
});
document.addEventListener("pointerup",e=>{
  if(!swipe) return;
  const dx=e.clientX-swipe.x, dy=e.clientY-swipe.y, el=swipe.el; swipe=null;
  if(Math.abs(dx)>35 && Math.abs(dx)>Math.abs(dy) && +el.dataset.n>1){
    goSlide(el, +el.dataset.i+(dx<0?1:-1));
    el.dataset.hold=Date.now();
    window.__swiped=true; setTimeout(()=>{ window.__swiped=false; },80);
  }
});
document.addEventListener("pointercancel",()=>{ swipe=null; });

function pkCardHtml(k){
  return `
  <article class="pk-card">
    <div class="pk-media" onclick="if(!window.__swiped)openProduct('${k.id}')">${slideshowHtml(itemImages(k))}</div>
    <div class="pk-info">
      <div class="pk-name">${escapeHtml(k.name)}</div>
      <div class="pk-row">
        <div class="pk-price">GH₵${(+k.price).toFixed(0)}</div>
        <button class="pk-order" onclick="addToCart('${k.id}');openCart()">Order</button>
      </div>
    </div>
  </article>`;
}
let pkSignature="";
function renderPackages(){
  const track=document.getElementById("pk-track"); if(!track) return;
  const list=sortedPackages(false);
  document.getElementById("sec-packages").style.display = list.length ? "" : "none";
  // don't rebuild (and restart the slideshows) if nothing visible changed
  const sig=JSON.stringify(list.map(k=>[k.id,k.name,k.price,itemImages(k).length]));
  if(sig===pkSignature) return;
  pkSignature=sig;
  const html=list.map(pkCardHtml).join("");
  const fresh = !state.pkAnimated && list.length>0; if(fresh) state.pkAnimated=true;
  track.innerHTML = fresh ? html.replace(/class="pk-card"/g,'class="pk-card fresh"') : html;
  document.getElementById("pk-all").innerHTML = list.length ? html : `<div class="empty-note">No packages yet.</div>`;
  observeSlides();
}

/* ============================================================
   SPEED CACHE — Upstash Redis
   Shopkeeper saves -> light snapshot (small thumbnails) -> /api/catalog -> Redis.
   Visitors read the snapshot first (instant), Firestore fills in the rest.
   ============================================================ */
function applySnapshot(s){
  if(!s || state.fullLoaded) return;      // real data already here — never go backwards
  state.products = s.products || [];
  state.packages = (s.packages||[]).map(p=>({...p, kind:"package", stock:999}));
  if(s.categories) state.categories = s.categories;
  if(s.layout) state.layout = normLayout(s.layout);
  applyLayout(); renderCategoryChips(); renderProducts(); renderPackages();
}
async function fetchCatalogSnapshot(){
  try{
    let txt=null;
    if(UPSTASH_REST_URL && UPSTASH_READONLY_TOKEN){
      const r=await fetch(UPSTASH_REST_URL.replace(/\/$/,"")+"/get/"+CATALOG_KEY,{headers:{Authorization:"Bearer "+UPSTASH_READONLY_TOKEN}});
      if(r.ok){ const j=await r.json(); txt=j.result; }
    }else if(CATALOG_API){
      const r=await fetch(CATALOG_API); if(r.ok) txt=await r.text();
    }
    if(!txt) return null;
    const snap=JSON.parse(txt);
    if(!snap || snap.v!==1) return null;
    try{ localStorage.setItem("tle_snapshot", txt); }catch(e){}
    return snap;
  }catch(e){ return null; }
}
function makeThumb(dataUrl, maxDim, quality){
  return new Promise(res=>{
    const img=new Image();
    img.onload=()=>{
      const sc=Math.min(1, maxDim/Math.max(img.width,img.height));
      const c=document.createElement("canvas"); c.width=Math.round(img.width*sc); c.height=Math.round(img.height*sc);
      c.getContext("2d").drawImage(img,0,0,c.width,c.height);
      res(c.toDataURL("image/jpeg",quality));
    };
    img.onerror=()=>res("");
    img.src=dataUrl;
  });
}
async function buildCatalogSnapshot(){
  const products=[];
  for(const p of state.products){
    const thumb = (p.images&&p.images[0]) ? await makeThumb(p.images[0],360,0.6) : (p.thumb||"");
    products.push({id:p.id,name:p.name,category:p.category,price:p.price,stock:p.stock,desc:p.desc||"",video:p.video||"",thumb});
  }
  const packages=[];
  for(const k of state.packages){
    const full=(k.images&&k.images.length);
    const src = full ? k.images : (k.thumbs||[]);
    const thumbs=[];
    for(const im of src.slice(0,6)) thumbs.push(full ? await makeThumb(im,640,0.62) : im);
    packages.push({id:k.id,name:k.name,price:k.price,desc:k.desc||"",includes:k.includes||[],video:k.video||"",published:k.published!==false,createdAt:k.createdAt||0,thumbs});
  }
  return {v:1, ts:Date.now(), categories:state.categories, layout:state.layout, products, packages};
}
function cacheSecret(){ try{ return localStorage.getItem("tle_cache_secret")||""; }catch(e){ return ""; } }
let cacheTimer=null;
function queueCachePush(){ if(!cacheSecret()) return; clearTimeout(cacheTimer); cacheTimer=setTimeout(()=>pushCatalogCache(false),1500); }
function setCacheStatus(msg){ state.cacheStatus=msg; const el=document.getElementById("cache-status"); if(el) el.textContent=msg; }
async function pushCatalogCache(manual){
  const secret=cacheSecret();
  if(!secret){ if(manual) showToast("Paste your cache key in Settings first"); return false; }
  if(!state.fullLoaded){ if(manual) showToast("Still loading — try again in a moment"); return false; }
  try{
    setCacheStatus("Updating speed cache…");
    const snap=await buildCatalogSnapshot();
    const r=await fetch(CATALOG_API,{method:"POST",headers:{"Content-Type":"application/json","x-cache-secret":secret},body:JSON.stringify(snap)});
    if(!r.ok) throw new Error("HTTP "+r.status);
    setCacheStatus("Speed cache updated at "+new Date().toLocaleTimeString());
    if(manual) showToast("Speed cache updated");
    return true;
  }catch(e){
    console.error("Cache update failed", e);
    setCacheStatus("Cache update failed — the store still works, just without the speed boost");
    if(manual) showToast("Cache update failed — check the key and the Vercel setup");
    return false;
  }
}
function cacheCardHtml(){
  return `
  <div class="list-row" style="flex-direction:column;align-items:stretch;margin-top:14px;">
    <div class="li-title" style="margin-bottom:6px;">Speed cache (Upstash Redis)</div>
    <div class="li-sub" style="margin-bottom:10px;">Every product, package, price and layout change you save is copied to Redis automatically, so the store opens instantly for visitors. Paste the cache key you set on the server (it stays on this device only).</div>
    <div class="field"><label>Cache key</label><input type="password" id="cache-secret" value="${escapeAttr(cacheSecret())}" placeholder="Same value as CACHE_SECRET on the server"></div>
    <div style="display:flex;gap:8px;">
      <button class="btn btn-outline" style="flex:1;padding:11px;" onclick="saveCacheSecret()">Save key</button>
      <button class="btn btn-primary" style="flex:1;padding:11px;" onclick="pushCatalogCache(true)">Refresh cache now</button>
    </div>
    <div class="note-inline" id="cache-status">${escapeHtml(state.cacheStatus||(cacheSecret()?"Key saved on this device.":"Not connected yet."))}</div>
  </div>`;
}
function saveCacheSecret(){
  const v=document.getElementById("cache-secret").value.trim();
  try{ localStorage.setItem("tle_cache_secret", v); }catch(e){}
  showToast(v ? "Cache key saved" : "Cache key removed");
  if(v) pushCatalogCache(true);
}

/* ============================================================
   CUSTOMERS — no sign-up. A Customer ID is created at the first purchase.
   Document id = Customer ID (the primary key), phone is how repeat buyers are recognised.
   ============================================================ */
function phoneKey(ph){ return String(ph||"").replace(/\D/g,"").slice(-9); }
function genCustomerId(){
  const A="ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let t="";
  for(let i=0;i<6;i++) t+=A[Math.floor(Math.random()*A.length)];
  return "TLC-"+t;
}
function localCustomers(){ try{ return JSON.parse(localStorage.getItem("tle_customers")||"[]"); }catch(e){ return []; } }
async function getCustomer(id){
  if(!/^[A-Za-z0-9-]{4,24}$/.test(id||"")) return null;
  if(fbRefs){
    try{ const sn=await fbRefs.getDoc(fbRefs.doc(fbRefs.db, CUSTOMERS_COLLECTION, id)); return sn.exists()?{id:sn.id,...sn.data()}:null; }
    catch(e){ console.error("Customer read failed", e); }
  }
  return localCustomers().find(c=>c.id===id)||null;
}
async function findCustomerByPhone(phone){
  const k=phoneKey(phone); if(k.length<9) return null;
  if(fbRefs){
    try{
      const q=fbRefs.query(fbRefs.collection(fbRefs.db, CUSTOMERS_COLLECTION), fbRefs.where("phoneKey","==",k), fbRefs.limit(1));
      const sn=await fbRefs.getDocs(q); let c=null; sn.forEach(d=>{ c={id:d.id,...d.data()}; }); return c;
    }catch(e){ console.error("Customer lookup failed", e); }
  }
  return localCustomers().find(c=>c.phoneKey===k)||null;
}
async function saveCustomer(c){
  if(fbRefs){ await fbRefs.setDoc(fbRefs.doc(fbRefs.db, CUSTOMERS_COLLECTION, c.id), stripId(c)); return; }
  const l=localCustomers().filter(x=>x.id!==c.id); l.push(c);
  try{ localStorage.setItem("tle_customers", JSON.stringify(l)); }catch(e){}
}
async function upsertCustomerFromOrder(form, total, offer){
  let c = null;
  if(state.me && phoneKey(state.me.phone)===phoneKey(form.phone)) c = await getCustomer(state.me.id);
  if(!c) c = await findCustomerByPhone(form.phone);
  if(!c){
    let id; do{ id=genCustomerId(); }while(await getCustomer(id));
    c={id, createdAt:Date.now(), orderCount:0, totalSpent:0};
  }
  Object.assign(c,{
    name:form.name, phone:form.phone, phoneKey:phoneKey(form.phone),
    email:form.email||c.email||"", address:form.address,
    payNumber:form.payNumber||c.payNumber||form.phone,
    lastOrderAt:Date.now(), orderCount:(c.orderCount||0)+1, totalSpent:(c.totalSpent||0)+total
  });
  await saveCustomer(c);
  rememberMe(c);
  return c;
}
function rememberMe(c){
  state.me=c;
  try{ localStorage.setItem("tle_customer_id", c.id); }catch(e){}
  updateMeDot();
}
async function restoreMe(){
  let id=""; try{ id=localStorage.getItem("tle_customer_id")||""; }catch(e){}
  if(!id) return;
  const c=await getCustomer(id);
  if(c){ state.me=c; updateMeDot(); }
}
async function loadAllCustomers(){
  if(fbRefs){
    try{ const sn=await fbRefs.getDocs(fbRefs.collection(fbRefs.db, CUSTOMERS_COLLECTION)); const l=[]; sn.forEach(d=>l.push({id:d.id,...d.data()})); state.customers=l; return; }
    catch(e){ console.error("Customer list failed", e); }
  }
  state.customers=localCustomers();
}

/* ============================================================
   OFFERS / ANNOUNCEMENTS — posted by the shopkeeper, matched to purchase history
   ============================================================ */
function offerEligible(o, c){
  if(!o || o.active===false) return false;
  if(o.expiresAt && Date.now()>o.expiresAt) return false;
  const ids=(o.ids||"").split(/[\s,]+/).filter(Boolean).map(x=>x.toUpperCase());
  const needsCust = ids.length>0 || (o.minOrders>0) || (o.minSpent>0);
  if(!needsCust) return true;
  if(!c) return false;
  if(ids.length && !ids.includes(c.id.toUpperCase())) return false;
  if((c.orderCount||0) < (o.minOrders||0)) return false;
  if((c.totalSpent||0) < (o.minSpent||0)) return false;
  return true;
}
function audienceText(o){
  const bits=[]; const ids=(o.ids||"").trim();
  if(ids) bits.push("Customer IDs: "+ids);
  if(o.minOrders>0) bits.push(o.minOrders+"+ orders");
  if(o.minSpent>0) bits.push("GH₵"+o.minSpent+"+ spent");
  return bits.length ? bits.join(" · ") : "Everyone";
}
function currentOffers(c){ return state.offers.filter(o=>offerEligible(o,c)).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)); }
function updateMeDot(){ const d=document.getElementById("me-dot"); if(d) d.style.display = (state.me && currentOffers(state.me).length) ? "block":"none"; }

/* ---- checkout side ---- */
function checkoutCust(){ return state.phoneCust || state.me; }
function currentDiscount(){
  const o=state.offers.find(x=>x.id===state.checkoutOfferId);
  if(!o || !(o.percent>0) || !offerEligible(o,checkoutCust())) return {amount:0,offer:null};
  return {amount:Math.round(cartTotal()*Math.min(o.percent,90)/100), offer:o};
}
function checkoutTotal(){ return Math.max(0, cartTotal()-currentDiscount().amount); }
function updateCheckoutTotals(){
  const d=currentDiscount();
  document.getElementById("co-subtotal").textContent="GH₵"+cartTotal().toFixed(0);
  document.getElementById("co-discount-row").style.display = d.amount>0 ? "flex":"none";
  document.getElementById("co-discount").textContent="-GH₵"+d.amount.toFixed(0);
  document.getElementById("co-total").textContent="GH₵"+checkoutTotal().toFixed(0);
}
function refreshCheckoutOffers(){
  const list=currentOffers(checkoutCust()).filter(o=>o.percent>0);
  const wrap=document.getElementById("co-offer-wrap"), sel=document.getElementById("co-offer");
  if(!list.length){ wrap.style.display="none"; state.checkoutOfferId=""; }
  else{
    wrap.style.display="";
    if(!list.some(o=>o.id===state.checkoutOfferId)) state.checkoutOfferId="";
    sel.innerHTML=`<option value="">Don't apply an offer</option>`+list.map(o=>`<option value="${o.id}" ${o.id===state.checkoutOfferId?"selected":""}>${escapeHtml(o.title)} — ${o.percent}% off</option>`).join("");
  }
  updateCheckoutTotals();
}
function pickCheckoutOffer(v){ state.checkoutOfferId=v; updateCheckoutTotals(); }
async function lookupPhoneForOffers(){
  state.phoneCust = await findCustomerByPhone(document.getElementById("co-phone").value);
  refreshCheckoutOffers();
}

/* ============================================================
   ME — purchase history, Customer ID, offers & updates
   ============================================================ */
function myOrders(){ return state.me ? state.orders.filter(o=>o.customerId===state.me.id).sort((a,b)=>b.createdAt-a.createdAt) : []; }
async function openMe(){
  showView("view-me"); setNavActive("none"); renderMe();
  try{
    await loadRest();
    if(state.me){ const c=await getCustomer(state.me.id); if(c) state.me=c; }
  }catch(e){}
  renderMe(); updateMeDot();
}
function refreshMeIfOpen(){ updateMeDot(); if(document.getElementById("view-me").classList.contains("active")) renderMe(); }
function offerCardHtml(o){
  const isNote = !(o.percent>0);
  return `<div class="offer-card">
    <div class="offer-pct ${isNote?'note':''}">${isNote?'NEWS':o.percent+'%'}</div>
    <div style="flex:1;min-width:0;">
      <h4>${escapeHtml(o.title)}</h4>
      <p>${escapeHtml(o.message||"")}</p>
      <div class="meta">${isNote?'Update':'Apply it at checkout'}${o.expiresAt?' · until '+new Date(o.expiresAt).toLocaleDateString():''}</div>
    </div>
  </div>`;
}
function setMeTab(t){ state.meTab=t; renderMe(); }
function renderMe(){
  const el=document.getElementById("me-body"); if(!el) return;
  if(!state.me){
    const pub=currentOffers(null);
    el.innerHTML=`
      <div class="me-card">
        <div class="me-top"><div class="me-avatar">?</div><div><div class="me-name">Welcome</div><div class="me-sub">No sign-up needed</div></div></div>
        <p style="font-size:13px;line-height:1.55;margin:12px 0 0;color:#EAF0FF;">Make a purchase and you'll get a <b>Customer ID</b> automatically. It unlocks your purchase history, discounts and updates from the shopkeeper.</p>
      </div>
      <div class="list-row" style="flex-direction:column;align-items:stretch;margin-top:14px;">
        <div class="li-title" style="margin-bottom:10px;">Already bought from us?</div>
        <div class="field"><label>Customer ID</label><input id="me-id" placeholder="TLC-XXXXXX" autocapitalize="characters"></div>
        <div class="field"><label>Phone number you ordered with</label><input id="me-phone" placeholder="054..."></div>
        <button class="btn btn-primary btn-block" onclick="signInMe()">Show my history</button>
        <div class="admin-error" id="me-error"></div>
      </div>
      ${pub.length?`<div class="sub-title">Open to everyone right now</div>${pub.map(offerCardHtml).join("")}`:""}`;
    return;
  }
  const c=state.me, orders=myOrders(), tab=state.meTab||"offers", offers=currentOffers(c);
  el.innerHTML=`
    <div class="me-card">
      <div class="me-top">
        <div class="me-avatar">${escapeHtml((c.name||"?").trim().charAt(0).toUpperCase())}</div>
        <div><div class="me-name">${escapeHtml(c.name)}</div><div class="me-sub">${escapeHtml(c.phone)} · customer since ${new Date(c.createdAt||Date.now()).toLocaleDateString()}</div></div>
      </div>
      <div class="cid-box"><div><small>Your Customer ID</small><b>${c.id}</b></div><button class="cid-copy" onclick="copyText('${c.id}')">Copy</button></div>
    </div>
    <div class="stat-grid" style="padding:12px 0 0;">
      <div class="stat-box"><div class="num">${c.orderCount||0}</div><div class="lbl">Orders</div></div>
      <div class="stat-box"><div class="num">GH₵${(c.totalSpent||0).toFixed(0)}</div><div class="lbl">Total spent</div></div>
    </div>
    <div class="tab-row" style="margin-top:18px;">
      <button class="tab-btn ${tab==='offers'?'active':''}" onclick="setMeTab('offers')">Offers &amp; updates (${offers.length})</button>
      <button class="tab-btn ${tab==='history'?'active':''}" onclick="setMeTab('history')">History (${orders.length})</button>
    </div>
    ${tab==='offers' ? (offers.length ? offers.map(offerCardHtml).join("") : `<div class="muted-box">No offers right now. Keep shopping — the shopkeeper posts rewards based on your purchases.</div>`)
    : (orders.length ? orders.map(o=>`
      <div class="list-row" style="align-items:flex-start;flex-direction:column;">
        <div style="display:flex;justify-content:space-between;width:100%;align-items:center;">
          <div class="li-title">${o.id}</div><span class="status-pill status-${o.status}">${statusLabel(o.status)}</span>
        </div>
        <div class="li-sub" style="margin:6px 0 8px;">${new Date(o.createdAt).toLocaleString()} · GH₵${o.total.toFixed(0)}${o.discount?` · saved GH₵${o.discount.amount}`:''}</div>
        <div style="font-size:12.5px;color:var(--ink-soft);width:100%;">${o.items.map(it=>`${it.qty} × ${escapeHtml(it.name)}`).join("<br>")}</div>
      </div>`).join("") : `<div class="muted-box">No purchases found on this ID yet.</div>`)}
    <button class="link-btn" style="display:block;margin:18px auto 0;" onclick="forgetMe()">Not you? Use a different Customer ID</button>`;
}
async function signInMe(){
  const id=document.getElementById("me-id").value.trim().toUpperCase();
  const ph=document.getElementById("me-phone").value;
  const err=document.getElementById("me-error"); err.textContent="";
  const c=await getCustomer(id);
  if(!c || phoneKey(ph)!==c.phoneKey){ err.textContent="We couldn't match that Customer ID with that phone number."; return; }
  rememberMe(c); state.meTab="history"; renderMe();
}
function forgetMe(){
  state.me=null; try{ localStorage.removeItem("tle_customer_id"); }catch(e){}
  updateMeDot(); renderMe();
}

/* ============================================================
   SHOPKEEPER: PAK tab (packages)
   ============================================================ */
function renderAdminPackages(){
  const el=document.getElementById("admin-tab-pak"); if(!el) return;
  const list=sortedPackages(true);
  let html=`<button class="btn btn-primary btn-block" onclick="openAddPackage()" style="margin-bottom:14px;">+ New package</button>`;
  if(!list.length) html+=`<div class="muted-box">No packages yet. Create one and it appears on the website straight away.</div>`;
  html+=list.map(k=>{
    const t=itemThumb(k);
    const img=t?`<img src="${t}">`:`<div style="width:52px;height:52px;border-radius:10px;background:var(--blue-pale);display:flex;align-items:center;justify-content:center;">${placeholderIcon()}</div>`;
    const live=k.published!==false;
    return `<div class="admin-product-row">${img}
      <div style="flex:1;min-width:0;">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;"><div class="li-title">${escapeHtml(k.name)}</div><span class="status-pill ${live?'status-completed':'status-pending'}">${live?'Live':'Hidden'}</span></div>
        <div class="li-sub">GH₵${(+k.price).toFixed(0)} · ${itemImages(k).length} image${itemImages(k).length===1?'':'s'}</div>
        <div style="display:flex;justify-content:space-between;margin-top:8px;">
          <button class="link-btn" onclick="openEditPackage('${k.id}')">Edit details &amp; images &rarr;</button>
          <button class="link-btn" onclick="togglePackage('${k.id}')">${live?'Hide':'Publish'}</button>
        </div>
      </div></div>`;
  }).join("");
  el.innerHTML=html;
}
function openAddPackage(){
  document.getElementById("pk-title").textContent="New package";
  ["pk-id","pk-name","pk-price","pk-includes","pk-desc","pk-video"].forEach(i=>document.getElementById(i).value="");
  document.getElementById("pk-published").value="1";
  state.pendingImages=[]; renderImageThumbs();
  document.getElementById("pk-delete-btn").style.display="none";
  openSheet("overlay-editpackage");
}
function openEditPackage(id){
  const k=state.packages.find(x=>x.id===id); if(!k) return;
  document.getElementById("pk-title").textContent="Edit package";
  document.getElementById("pk-id").value=id;
  document.getElementById("pk-name").value=k.name;
  document.getElementById("pk-price").value=k.price;
  document.getElementById("pk-includes").value=(k.includes||[]).join("\n");
  document.getElementById("pk-desc").value=k.desc||"";
  document.getElementById("pk-video").value=k.video||"";
  document.getElementById("pk-published").value=k.published===false?"0":"1";
  state.pendingImages=(k.images||[]).slice(); renderImageThumbs();
  document.getElementById("pk-delete-btn").style.display="block";
  openSheet("overlay-editpackage");
}
async function savePackage(){
  const id=document.getElementById("pk-id").value;
  const name=document.getElementById("pk-name").value.trim();
  const price=parseFloat(document.getElementById("pk-price").value);
  if(!name || isNaN(price) || price<0){ showToast("Please fill in a valid name and price"); return; }
  if(state.pendingImages.includes("UPLOADING")){ showToast("Please wait for the image(s) to finish processing"); return; }
  const data={
    name, price,
    includes: document.getElementById("pk-includes").value.split("\n").map(x=>x.trim()).filter(Boolean),
    desc: document.getElementById("pk-desc").value.trim(),
    video: document.getElementById("pk-video").value.trim(),
    published: document.getElementById("pk-published").value==="1",
    images: state.pendingImages.slice()
  };
  let k=id ? state.packages.find(x=>x.id===id) : null;
  const isNew=!k;
  if(k) Object.assign(k,data); else k={id:"pk"+Date.now(), kind:"package", stock:999, createdAt:Date.now(), ...data};
  try{ await saveOnePackage(k); }
  catch(e){ console.error(e); showToast("Couldn't save — try removing a photo and saving again"); return; }
  if(!state.packages.some(x=>x.id===k.id)) state.packages.push(k);
  if(isNew){ state.layout.packageOrder=state.layout.packageOrder.filter(x=>x!==k.id).concat(k.id); await docSet("layout", state.layout); }
  closeSheet("overlay-editpackage");
  showToast(data.published ? "Package saved — live on the website now" : "Package saved as hidden");
  renderAdminPackages(); renderAdminLayout(); renderPackages(); queueCachePush();
}
async function togglePackage(id){
  const k=state.packages.find(x=>x.id===id); if(!k) return;
  k.published = (k.published===false);
  await saveOnePackage(k);
  showToast(k.published ? "Package is live" : "Package hidden from the website");
  renderAdminPackages(); renderPackages(); queueCachePush();
}
async function deletePackageConfirm(){
  const id=document.getElementById("pk-id").value; if(!id) return;
  if(!confirm("Delete this package? This can't be undone.")) return;
  state.packages=state.packages.filter(x=>x.id!==id);
  state.layout.packageOrder=state.layout.packageOrder.filter(x=>x!==id);
  await deleteOnePackage(id); await docSet("layout", state.layout);
  closeSheet("overlay-editpackage"); showToast("Package deleted");
  renderAdminPackages(); renderAdminLayout(); renderPackages(); queueCachePush();
}

/* ============================================================
   SHOPKEEPER: Customers, Offers, Layout
   ============================================================ */
function renderAdminCustomers(){
  const el=document.getElementById("admin-tab-customers"); if(!el) return;
  if(!el.querySelector("#cust-list")){
    el.innerHTML=`<input id="cust-q" placeholder="Search name, phone or Customer ID" oninput="renderCustomerList()" style="width:100%;padding:12px 14px;border-radius:12px;border:1.5px solid var(--line);margin-bottom:12px;font-size:13.5px;"><div id="cust-list"></div>`;
  }
  renderCustomerList();
}
function renderCustomerList(){
  const box=document.getElementById("cust-list"); if(!box) return;
  const q=(document.getElementById("cust-q").value||"").toLowerCase().trim();
  const list=state.customers.filter(c=>!q||[c.name,c.phone,c.id].some(v=>String(v||"").toLowerCase().includes(q)))
    .sort((a,b)=>(b.lastOrderAt||0)-(a.lastOrderAt||0));
  if(!list.length){ box.innerHTML=`<div class="muted-box">${state.customers.length?"No match.":"Customers appear here after their first purchase."}</div>`; return; }
  box.innerHTML=list.map(c=>`
    <div class="list-row" style="flex-direction:column;align-items:stretch;">
      <div style="display:flex;justify-content:space-between;gap:8px;"><div class="li-title">${escapeHtml(c.name)}</div><b style="font-size:12.5px;color:var(--blue-deep);letter-spacing:.5px;">${c.id}</b></div>
      <div class="li-sub">${escapeHtml(c.phone)}${c.payNumber&&c.payNumber!==c.phone?' · pays from '+escapeHtml(c.payNumber):''}${c.email?' · '+escapeHtml(c.email):''}</div>
      <div class="li-sub">${c.orderCount||0} order${(c.orderCount||0)===1?'':'s'} · GH₵${(c.totalSpent||0).toFixed(0)} spent · last ${c.lastOrderAt?new Date(c.lastOrderAt).toLocaleDateString():'—'}</div>
      <div style="display:flex;gap:8px;margin-top:8px;">
        <button class="btn btn-outline" style="flex:1;padding:9px;font-size:12.5px;" onclick="copyText('${c.id}')">Copy ID</button>
        <button class="btn btn-primary" style="flex:1;padding:9px;font-size:12.5px;" onclick="window.open('https://wa.me/${waNumber(c.phone)}?text='+encodeURIComponent('Hi ${escapeAttr(c.name).replace(/'/g,'')}, your TechLord & Co. Customer ID is ${c.id}. Use it under Me on our store to see your history and offers.'),'_blank')">WhatsApp</button>
      </div>
    </div>`).join("");
}

function renderAdminOffers(){
  const el=document.getElementById("admin-tab-offers"); if(!el) return;
  let html=`<button class="btn btn-primary btn-block" onclick="openAddOffer()" style="margin-bottom:14px;">+ New offer / announcement</button>`;
  if(!state.offers.length) html+=`<div class="muted-box">Post a discount for loyal customers, or an announcement everyone sees under Me.</div>`;
  html+=state.offers.slice().sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).map(o=>{
    const expired=o.expiresAt && Date.now()>o.expiresAt;
    const status = expired ? ['Expired','status-cancelled'] : (o.active===false ? ['Paused','status-pending'] : ['Active','status-completed']);
    return `<div class="list-row" style="flex-direction:column;align-items:stretch;">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;"><div class="li-title">${escapeHtml(o.title)} ${o.percent>0?'· '+o.percent+'% off':'· announcement'}</div><span class="status-pill ${status[1]}">${status[0]}</span></div>
      <div class="li-sub">${escapeHtml(o.message||"")}</div>
      <div class="li-sub">For: ${escapeHtml(audienceText(o))}${o.expiresAt?' · ends '+new Date(o.expiresAt).toLocaleDateString():''}</div>
      <div style="display:flex;justify-content:space-between;margin-top:8px;">
        <button class="link-btn" onclick="openEditOffer('${o.id}')">Edit &rarr;</button>
        <button class="link-btn" onclick="toggleOffer('${o.id}')">${o.active===false?'Resume':'Pause'}</button>
      </div></div>`;
  }).join("");
  el.innerHTML=html;
}
function dateInputValue(ms){ if(!ms) return ""; const d=new Date(ms), p=n=>String(n).padStart(2,"0"); return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate()); }
function fillOfferForm(o){
  o=o||{};
  document.getElementById("of-id").value=o.id||"";
  document.getElementById("of-title-in").value=o.title||"";
  document.getElementById("of-msg").value=o.message||"";
  document.getElementById("of-percent").value=o.percent||"";
  document.getElementById("of-minorders").value=o.minOrders||"";
  document.getElementById("of-minspent").value=o.minSpent||"";
  document.getElementById("of-ids").value=o.ids||"";
  document.getElementById("of-expires").value=dateInputValue(o.expiresAt);
  document.getElementById("of-active").value=o.active===false?"0":"1";
  document.getElementById("of-delete-btn").style.display=o.id?"block":"none";
  openSheet("overlay-editoffer");
}
function openAddOffer(){ document.getElementById("of-title").textContent="New offer / announcement"; fillOfferForm(null); }
function openEditOffer(id){ const o=state.offers.find(x=>x.id===id); if(!o) return; document.getElementById("of-title").textContent="Edit"; fillOfferForm(o); }
async function saveOffer(){
  const title=document.getElementById("of-title-in").value.trim();
  if(!title){ showToast("Please give it a title"); return; }
  const pct=Math.max(0,Math.min(90,parseFloat(document.getElementById("of-percent").value)||0));
  const exp=document.getElementById("of-expires").value;
  const id=document.getElementById("of-id").value;
  const data={
    title, message:document.getElementById("of-msg").value.trim(), percent:pct,
    minOrders:parseInt(document.getElementById("of-minorders").value)||0,
    minSpent:parseFloat(document.getElementById("of-minspent").value)||0,
    ids:document.getElementById("of-ids").value.trim(),
    expiresAt: exp ? new Date(exp+"T23:59:59").getTime() : 0,
    active: document.getElementById("of-active").value==="1"
  };
  await ensureFull();
  const existing=state.offers.find(x=>x.id===id);
  if(existing) Object.assign(existing,data); else state.offers.push({id:"of"+Date.now(), createdAt:Date.now(), ...data});
  await docSet("offers", state.offers);
  closeSheet("overlay-editoffer"); showToast("Saved — customers see it under Me");
  renderAdminOffers();
}
async function toggleOffer(id){
  const o=state.offers.find(x=>x.id===id); if(!o) return;
  o.active = (o.active===false); await docSet("offers", state.offers);
  renderAdminOffers(); showToast(o.active?"Offer resumed":"Offer paused");
}
async function deleteOfferConfirm(){
  const id=document.getElementById("of-id").value; if(!id||!confirm("Delete this? This can't be undone.")) return;
  state.offers=state.offers.filter(x=>x.id!==id); await docSet("offers", state.offers);
  closeSheet("overlay-editoffer"); renderAdminOffers(); showToast("Deleted");
}

/* ---- Layout: what shows first, package order, pinned products ---- */
function renderAdminLayout(){
  const el=document.getElementById("admin-tab-layout"); if(!el) return;
  const pkFirst=state.layout.sectionOrder[0]==="packages";
  const pk=sortedPackages(true), pins=state.layout.productPins;
  const row=(kind,id,name,i,n,extra)=>`<div class="list-row" style="padding:9px 12px;"><div class="li-info"><div class="li-title">${escapeHtml(name)}</div>${extra?`<div class="li-sub">${extra}</div>`:""}</div>
    <div class="order-btns"><button ${i===0?'disabled':''} onclick="moveItem('${kind}','${id}',-1)" aria-label="Move up">&#9650;</button><button ${i===n-1?'disabled':''} onclick="moveItem('${kind}','${id}',1)" aria-label="Move down">&#9660;</button>${kind==='pin'?`<button onclick="unpinProduct('${id}')" aria-label="Unpin" style="color:var(--red);">&#10005;</button>`:''}</div></div>`;
  const unpinned=state.products.filter(p=>!pins.includes(p.id));
  el.innerHTML=`
    <div class="sub-title" style="margin-top:0;">What shows first on the home page</div>
    <div class="seg"><button class="${pkFirst?'on':''}" onclick="setSectionOrder('packages')">Packages first</button><button class="${pkFirst?'':'on'}" onclick="setSectionOrder('products')">Products first</button></div>
    <div class="sub-title">Package order — top one shows first</div>
    ${pk.length?pk.map((k,i)=>row('pk',k.id,k.name,i,pk.length,k.published===false?'Hidden — not on the website':'')).join(""):`<div class="muted-box">No packages yet.</div>`}
    <div class="sub-title">Pinned products — shown first in the product list</div>
    ${pins.length?pins.map((id,i)=>{ const p=state.products.find(x=>x.id===id); return p?row('pin',id,p.name,i,pins.length,''):''; }).join(""):`<div class="muted-box">Nothing pinned. Products appear in their normal order.</div>`}
    <div style="display:flex;gap:8px;margin-top:10px;">
      <select id="pin-pick" style="flex:1;padding:11px;border-radius:11px;border:1.5px solid var(--line);font-size:13px;">${unpinned.map(p=>`<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("")}</select>
      <button class="btn btn-primary" style="padding:11px 18px;" onclick="pinProduct(document.getElementById('pin-pick').value)">Pin</button>
    </div>`;
}
async function saveLayout(msg){
  await docSet("layout", state.layout);
  applyLayout(); renderPackages(); renderProducts(); renderAdminLayout(); queueCachePush();
  showToast(msg||"Home layout saved — live now");
}
function setSectionOrder(first){ state.layout.sectionOrder = first==="packages" ? ["packages","products"] : ["products","packages"]; saveLayout(); }
function moveItem(kind,id,dir){
  const arr = kind==="pk" ? sortedPackages(true).map(k=>k.id) : state.layout.productPins.slice();
  const i=arr.indexOf(id), j=i+dir; if(i<0||j<0||j>=arr.length) return;
  [arr[i],arr[j]]=[arr[j],arr[i]];
  if(kind==="pk") state.layout.packageOrder=arr; else state.layout.productPins=arr;
  saveLayout();
}
function pinProduct(id){ if(!id||state.layout.productPins.includes(id)) return; state.layout.productPins.push(id); saveLayout("Pinned — it now shows first"); }
function unpinProduct(id){ state.layout.productPins=state.layout.productPins.filter(x=>x!==id); saveLayout("Unpinned"); }

/* ---------------- Utility ---------------- */
function escapeHtml(str){
  return String(str||"").replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
}
function escapeAttr(str){ return escapeHtml(str).replace(/`/g,"&#96;"); }

/* ---------------- Sync across devices ---------------- */
async function refreshSharedData(){
  await loadAll();
}
function startPolling(){
  if(state.pollTimer) clearInterval(state.pollTimer);
  state.pollTimer = setInterval(async ()=>{
    await refreshSharedData();
    if(document.getElementById("view-storefront").classList.contains("active")){
      renderCategoryChips(); renderProducts(); renderPackages();
    }
    if(document.getElementById("view-admin").classList.contains("active")){
      renderAdminAll();
    }
    if(document.getElementById("view-tracking").classList.contains("active")){
      // don't overwrite results unless user searched already
    }
  }, 6000);
}

/* ---------------- Init ---------------- */
function renderAll(){
  applyLayout();
  renderCategoryChips();
  renderProducts();
  renderPackages();
  renderCartBadge();
}
let didFirstRender = false;
function safeRenderAll(){
  didFirstRender = true;
  renderAll();
  openSharedProductFromURL();
}
function openSharedProductFromURL(){
  try{
    const pid = new URLSearchParams(location.search).get("product");
    if(pid && state.products.some(p=>p.id===pid)) openProduct(pid);
  }catch(e){ /* ignore malformed URLs */ }
}
(async function init(){
  applyLayout();
  // 1) instant paint from the last speed-cache snapshot this device saw
  try{ const raw=localStorage.getItem("tle_snapshot"); if(raw) applySnapshot(JSON.parse(raw)); }catch(e){}
  // 2) in parallel, ask Redis for the newest snapshot (usually tens of milliseconds)
  fetchCatalogSnapshot().then(snap=>{ if(snap) applySnapshot(snap); });
  // 3) meanwhile Firestore connects and loads the FULL catalogue (all photos)
  let usingFirebase = false;
  try{
    usingFirebase = await initFirebase();
  }catch(e){
    console.error("Firebase failed to start — showing the store without live sync.", e);
    usingFirebase = false;
  }
  try{
    await loadCatalog();
  }catch(e){
    console.error("Couldn't load store data — falling back to defaults so the page isn't blank.", e);
    if(!state.products || state.products.length===0) state.products = DEFAULT_PRODUCTS.slice();
    if(!state.categories || state.categories.length===0) state.categories = DEFAULT_CATEGORIES.slice();
    state.fullLoaded = true;
  }
  safeRenderAll();
  try{ await loadRest(); }catch(e){ console.error("Couldn't load orders/messages yet", e); }
  restoreMe();
  try{
    if(usingFirebase) subscribeRealtime(); // instant cross-device updates, no polling needed
    else startPolling(); // same-device fallback so multiple open tabs stay in sync
  }catch(e){
    console.error("Realtime sync failed to start — falling back to periodic refresh.", e);
    startPolling();
  }
})();
// Absolute last resort: if something above still leaves the page stuck on
// loading placeholders after 8 seconds, force real content to appear.
setTimeout(()=>{
  if(!didFirstRender){
    console.error("Store took too long to load — forcing a render with defaults.");
    if(!state.products || state.products.length===0) state.products = DEFAULT_PRODUCTS.slice();
    if(!state.categories || state.categories.length===0) state.categories = DEFAULT_CATEGORIES.slice();
    safeRenderAll();
  }
}, 8000);
