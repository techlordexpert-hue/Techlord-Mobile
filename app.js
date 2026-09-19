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
const DOC_NAMES = ["categories","orders","reviews","messages","settings"]; // products are handled separately, one doc per product

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
      collection: fsMod.collection, getDocs: fsMod.getDocs, onSnapshot: fsMod.onSnapshot
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
async function deleteOneProduct(id){
  if(fbRefs){
    try{ await fbRefs.deleteDoc(fbRefs.doc(fbRefs.db, PRODUCTS_COLLECTION, id)); return; }
    catch(e){ console.error("Firestore product delete failed", e); }
  }
  try{ localStorage.setItem("tle_products", JSON.stringify(state.products.filter(p=>p.id!==id))); }catch(e){}
}

async function loadAll(){
  const [pList, c, o, r, m, s] = await Promise.all([
    loadProductsList(), docGet("categories"), docGet("orders"),
    docGet("reviews"), docGet("messages"), docGet("settings")
  ]);

  state.products = (pList!==undefined) ? pList : DEFAULT_PRODUCTS.slice();
  if(pList===undefined) await seedProducts(state.products);

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

  state.orders = (o!==undefined) ? o : [];
  state.reviews = (r!==undefined) ? r : {};
  state.messages = (m!==undefined) ? m : [];

  state.adminPassword = (s && s.adminPassword) ? s.adminPassword : "techlord2026";
  if(!s) await docSet("settings", {adminPassword: state.adminPassword});
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
    settings: v=>{ if(v && v.adminPassword) state.adminPassword=v.adminPassword; }
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
    renderProducts();
    if(state.adminLoggedIn) renderAdminProducts();
  }, err=>console.error("Realtime listener error on products", err));
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
  document.getElementById("bottomnav").style.display = (id==="view-admin"||id==="view-admin-login") ? "none":"flex";
}
function goHome(){ showView("view-storefront"); setNavActive("home"); renderAll(); }
function openTracking(){ showView("view-tracking"); setNavActive("track"); }
function setNavActive(name){
  document.querySelectorAll("#bottomnav button").forEach(b=>b.classList.toggle("active", b.dataset.nav===name));
}
function scrollToCategories(){
  goHome();
  setTimeout(()=>{ document.getElementById("category-chips").scrollIntoView({behavior:"smooth",block:"start"}); },50);
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

function renderProducts(){
  const grid = document.getElementById("product-grid");
  const q = (document.getElementById("search-input").value||"").toLowerCase().trim();
  let list = state.products.filter(p=>{
    const catOk = state.activeCategory==="All" || p.category===state.activeCategory;
    const qOk = !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
    return catOk && qOk;
  });
  document.getElementById("results-title").textContent = state.activeCategory==="All" ? "All products" : state.activeCategory;
  if(list.length===0){ grid.innerHTML = `<div class="empty-note">No products found here yet.</div>`; return; }
  grid.innerHTML = list.map(p=>{
    const img = (p.images && p.images[0]) ? `<img src="${p.images[0]}" alt="${escapeAttr(p.name)}">` : placeholderIcon();
    const out = p.stock<=0;
    const low = !out && p.stock<=3;
    return `
    <div class="card">
      <div class="card-img" onclick="openProduct('${p.id}')">
        ${img}
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
  const p = state.products.find(x=>x.id===id);
  if(!p) return;
  state.currentProductId=id;
  document.getElementById("pd-title-top").textContent = p.name;
  const revs = state.reviews[id]||[];
  const avg = revs.length ? (revs.reduce((s,r)=>s+r.rating,0)/revs.length).toFixed(1) : null;
  const gallery = (p.images&&p.images.length) ? p.images.map(im=>`<img src="${im}">`).join("") : `<div style="width:140px;height:140px;border-radius:14px;background:var(--blue-pale);display:flex;align-items:center;justify-content:center;flex-shrink:0;">${placeholderIcon()}</div>`;
  const stockClass = p.stock<=0?'out':(p.stock<=3?'low':'ok');
  const stockLabel = p.stock<=0?'Out of stock':(p.stock<=3?`Only ${p.stock} left`:'In stock');
  document.getElementById("product-body").innerHTML = `
    <div class="pd-gallery">${gallery}</div>
    ${p.video ? `<div style="margin-top:10px;"><a class="link-btn" href="${escapeAttr(p.video)}" target="_blank" rel="noopener">▶ Watch product video</a></div>` : ""}
    <div class="pd-price">GH₵${p.price.toFixed(0)}</div>
    <div class="pd-stock ${stockClass}">${stockLabel}</div>
    ${avg?`<div style="margin-top:6px;" class="stars">${'★'.repeat(Math.round(avg))}${'☆'.repeat(5-Math.round(avg))} <span style="color:var(--ink-soft);font-size:12px;">(${avg} · ${revs.length} review${revs.length>1?'s':''})</span></div>`:''}
    <p class="pd-desc">${escapeHtml(p.desc||"")}</p>
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
  if(!state.reviews[productId]) state.reviews[productId]=[];
  state.reviews[productId].push({name, rating:state.ratingPick, comment:text, date:Date.now()});
  await saveReviews();
  showToast("Thanks for your review!");
  openProduct(productId);
}

/* ---------------- Cart ---------------- */
function addToCart(id){
  const p = state.products.find(x=>x.id===id);
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
  const p = state.products.find(x=>x.id===id);
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
  return state.cart.reduce((s,c)=>{ const p=state.products.find(x=>x.id===c.id); return s + (p?p.price*c.qty:0); },0);
}
function openCart(){ renderCart(); openSheet("overlay-cart"); }
function renderCart(){
  const body = document.getElementById("cart-body");
  if(state.cart.length===0){
    body.innerHTML = `<div class="muted-box">Your cart is empty. Browse products and add something you love.</div>`;
    return;
  }
  const rows = state.cart.map(c=>{
    const p = state.products.find(x=>x.id===c.id);
    if(!p) return "";
    const img = (p.images&&p.images[0]) ? `<img src="${p.images[0]}">` : `<div style="width:58px;height:58px;border-radius:10px;background:var(--blue-pale);display:flex;align-items:center;justify-content:center;">${placeholderIcon()}</div>`;
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
function goToCheckout(){
  closeSheet("overlay-cart");
  document.getElementById("co-subtotal").textContent = "GH₵"+cartTotal().toFixed(0);
  document.getElementById("co-total").textContent = "GH₵"+cartTotal().toFixed(0);
  openSheet("overlay-checkout");
}

/* ---------------- Checkout + Paystack ---------------- */
function genOrderId(){ return "TLE-" + Math.floor(10000 + Math.random()*89999); }

function startPaystack(){
  if(state.cart.length===0){ showToast("Your cart is empty"); return; }
  const name=document.getElementById("co-name").value.trim();
  const phone=document.getElementById("co-phone").value.trim();
  const email=document.getElementById("co-email").value.trim();
  const address=document.getElementById("co-address").value.trim();
  const notes=document.getElementById("co-notes").value.trim();
  if(!name||!phone||!address){ showToast("Please fill in your name, phone and delivery location"); return; }
  const useEmail = email || (phone.replace(/\\D/g,'')+"@techlordexpert.customer");
  const total = cartTotal();
  if(total<=0){ showToast("Cart total is invalid"); return; }

  const payBtn = document.getElementById("pay-btn");
  payBtn.disabled=true; payBtn.innerHTML='<span class="spinner"></span> Opening Paystack...';

  if(typeof PaystackPop === "undefined"){
    payBtn.disabled=false; payBtn.textContent="Pay with Paystack";
    showToast("Paystack could not load. Check your connection and try again.");
    return;
  }

  const orderId = genOrderId();
  const handler = PaystackPop.setup({
    key: PUBLIC_PAYSTACK_KEY,
    email: useEmail,
    amount: Math.round(total*100),
    currency: "GHS",
    ref: orderId,
    metadata:{ custom_fields:[{display_name:"Order ID",variable_name:"order_id",value:orderId}] },
    callback: function(response){
      finalizeOrder(orderId, response.reference, name, phone, address, notes);
    },
    onClose: function(){
      payBtn.disabled=false; payBtn.textContent="Pay with Paystack";
    }
  });
  handler.openIframe();
}

async function finalizeOrder(orderId, ref, name, phone, address, notes){
  const items = state.cart.map(c=>{
    const p = state.products.find(x=>x.id===c.id);
    return {productId:c.id, name:p?p.name:"Item", qty:c.qty, price:p?p.price:0};
  });
  const total = cartTotal();
  // reduce stock, then persist each affected product on its own
  const touched = [];
  state.cart.forEach(c=>{
    const p = state.products.find(x=>x.id===c.id);
    if(p){ p.stock = Math.max(0, p.stock - c.qty); touched.push(p); }
  });
  await Promise.all(touched.map(p=>saveOneProduct(p)));

  const order = {
    id: orderId, paystackRef: ref, name, phone, address, notes, items, total,
    status: "processing", createdAt: Date.now()
  };
  state.orders.push(order);
  await saveOrders();
  state.cart = [];
  renderCartBadge();
  renderProducts();

  document.getElementById("pay-btn").disabled=false;
  document.getElementById("pay-btn").textContent="Pay with Paystack";
  closeSheet("overlay-checkout");
  showOrderSuccess(order);
}

function showOrderSuccess(order){
  document.getElementById("track-input").value = order.id;
  openTracking();
  doTrackOrder();
  showToast("Payment received! Order "+order.id+" placed.");
}

/* ---------------- Order tracking ---------------- */
async function doTrackOrder(){
  await refreshSharedData();
  const q = document.getElementById("track-input").value.trim().toLowerCase();
  const box = document.getElementById("track-results");
  if(!q){ box.innerHTML = `<div class="muted-box">Enter your order ID or the phone number you ordered with.</div>`; return; }
  const matches = state.orders.filter(o=> o.id.toLowerCase()===q || o.phone.replace(/\\D/g,'').includes(q.replace(/\\D/g,'')) && q.replace(/\\D/g,'').length>=6 );
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
function openHelp(){ openSheet("overlay-help"); }
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
  document.getElementById("admin-tab-"+tab).style.display="block";
  renderAdminAll();
}
function renderAdminAll(){
  renderAdminOverview();
  renderAdminProducts();
  renderAdminOrders();
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
  const p = state.products.find(x=>x.id===id);
  if(!p) return;
  const num = parseFloat(value);
  if(isNaN(num) || num<0){ showToast("Enter a valid number"); renderAdminProducts(); return; }
  p[field] = num;
  await saveOneProduct(p);
  showToast((field==="price"?"Price":"Stock")+" updated — live on the store now");
  renderProducts();
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
  const p = state.products.find(x=>x.id===id);
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
  const wrap = document.getElementById("ep-image-thumbs");
  wrap.innerHTML = state.pendingImages.map((im,i)=>{
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
    product = state.products.find(x=>x.id===id);
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
  renderAdminProducts(); renderProducts();
}
async function deleteProductConfirm(){
  const id = document.getElementById("ep-id").value;
  if(!id) return;
  if(!confirm("Delete this product? This can't be undone.")) return;
  state.products = state.products.filter(x=>x.id!==id);
  await deleteOneProduct(id);
  closeSheet("overlay-editproduct");
  showToast("Product deleted");
  renderAdminProducts(); renderProducts();
}

/* Builds a direct link straight to one product (customers land on it
   ready to add to cart / buy) and hands it to the phone's native share
   sheet — so posting to WhatsApp status, TikTok, or Instagram is just
   picking the app from the share menu that pops up. */
async function shareProduct(id){
  const p = state.products.find(x=>x.id===id);
  if(!p){ showToast("Save the product first, then you can share it"); return; }
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
        <button class="btn btn-primary" style="flex:1;padding:9px;font-size:12.5px;" onclick="window.open('https://wa.me/${WHATSAPP_NUMBER.startsWith('233')?'':'233'}'+'${m.phone.replace(/\\D/g,'')}','_blank')">Reply on WhatsApp</button>
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
      <div class="li-title" style="margin-bottom:10px;">Change admin password</div>
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
  renderAdminSettings(); renderCategoryChips();
}
async function removeCategory(cat){
  if(!confirm(`Remove "${cat}"? Products in it will stay but the category tab will disappear.`)) return;
  state.categories = state.categories.filter(c=>c!==cat);
  await saveCategories();
  showToast("Category removed");
  renderAdminSettings(); renderCategoryChips();
}

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
      renderCategoryChips(); renderProducts();
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
  renderCategoryChips();
  renderProducts();
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
  let usingFirebase = false;
  try{
    usingFirebase = await initFirebase();
  }catch(e){
    console.error("Firebase failed to start — showing the store without live sync.", e);
    usingFirebase = false;
  }
  try{
    await loadAll();
  }catch(e){
    console.error("Couldn't load store data — falling back to defaults so the page isn't blank.", e);
    if(!state.products || state.products.length===0) state.products = DEFAULT_PRODUCTS.slice();
    if(!state.categories || state.categories.length===0) state.categories = DEFAULT_CATEGORIES.slice();
  }
  safeRenderAll();
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
