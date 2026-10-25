/* ============================================================
   TechLord & Co. — storefront + shopkeeper dashboard
   Data layer: Upstash Redis, reached only through the /api/store function
   (see api/store.js). The browser holds no database key.
   ============================================================ */

const PUBLIC_PAYSTACK_KEY = "pk_live_e81e6a7c861963103869a7310dd19821f476bad7";
// NOTE: the secret key is intentionally NEVER placed in this file.
// It must live only on a secure backend server for verifying payments.

const WHATSAPP_NUMBER = "233544667931"; // 054 466 7931 in international format
const CONTACT_LINE = "054 466 7931 & 050 444 0199";

let state = {
  products: [],
  packages: [],
  customers: [],
  offers: [],
  layout: {sectionOrder:["packages","products"], packageOrder:[], productPins:[]},
  me: null,            // the customer recognised on this device (no account — just a Customer ID)
  phoneCust: null,     // customer found from the phone typed at checkout
  checkoutOfferId: "",
  fullLoaded: false,
  categories: [],
  catalogTs: 0,
  itemCache: {},       // full photos + reviews, fetched when a product is opened
  checkoutOffers: [],
  meData: null,
  orders: [],
  reviews: {},
  messages: [],
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
   DATA LAYER — Upstash Redis, reached only through /api/store.
   The browser never holds a database key. Public data comes from the
   catalogue endpoint; customer and shopkeeper data need the right ID/password.
   ============================================================ */
const API = "/api/store";
function adminToken(){ try{ return localStorage.getItem("tle_admin_token")||""; }catch(e){ return ""; } }
function authHeaders(){ const t=adminToken(); return t ? {"x-admin-token":t} : {}; }
async function api(a, body){
  let r;
  try{ r = await fetch(API,{method:"POST",headers:{"Content-Type":"application/json",...authHeaders()},body:JSON.stringify({...(body||{}),a})}); }
  catch(e){ throw Object.assign(new Error("You seem to be offline — check your connection."),{status:0}); }
  let j={}; try{ j=await r.json(); }catch(e){}
  if(r.status===401 && j.expired) adminSessionExpired();
  if(!r.ok) throw Object.assign(new Error(j.error||("Something went wrong ("+r.status+")")),{status:r.status});
  return j;
}
async function getApi(q){
  const r = await fetch(API+"?"+q,{headers:authHeaders()});
  if(!r.ok) throw Object.assign(new Error("HTTP "+r.status),{status:r.status});
  return r.json();
}
function normLayout(v){
  return {
    sectionOrder: (v && v.sectionOrder && v.sectionOrder.length===2) ? v.sectionOrder : ["packages","products"],
    packageOrder: (v && v.packageOrder) || [],
    productPins: (v && v.productPins) || []
  };
}
const pkgNorm = k=>({...k, kind:"package", stock:999});

/* The public catalogue: light product + package data (small thumbnails only). */
function applyCatalog(snap){
  if(!snap || snap.v!==2) return false;
  if(state.fullLoaded && snap.ts===state.catalogTs) return false;
  state.catalogTs = snap.ts;
  state.products = snap.products || [];
  state.categories = snap.categories || [];
  state.layout = normLayout(snap.layout);
  if(!state.adminLoggedIn){            // the shopkeeper's own copy (incl. hidden packages) takes priority
    state.packages = (snap.packages||[]).map(pkgNorm);
    state.offers = snap.offers || [];
  }
  state.fullLoaded = true;
  applyLayout(); renderCategoryChips(); renderProducts(); renderPackages();
  return true;
}
async function loadCatalog(){
  const snap = await getApi("r=catalog");
  if(applyCatalog(snap)){ try{ localStorage.setItem("tle_snapshot", JSON.stringify(snap)); }catch(e){} }
}
/* Full photos + reviews for one product/package, fetched when it is opened. */
async function loadItem(id, fresh){
  if(!fresh && state.itemCache[id]) return state.itemCache[id];
  const j = await getApi("r=item&id="+encodeURIComponent(id)+(fresh ? "&t="+Date.now() : "&v="+state.catalogTs));
  state.itemCache[id] = j;
  return j;
}
/* Everything the shopkeeper needs (orders, customers, messages...). Returns true if anything changed. */
async function loadAdminData(){
  const d = await api("adminData");
  const sig = JSON.stringify(d);
  if(sig===state.adminSig) return false;
  state.adminSig = sig;
  state.catalogTs = d.ts; state.fullLoaded = true;
  state.products = d.products; state.packages = d.packages.map(pkgNorm); state.categories = d.categories;
  state.layout = normLayout(d.layout); state.offers = d.offers;
  state.orders = d.orders; state.customers = d.customers; state.messages = d.messages; state.reviews = d.reviews;
  return true;
}
function adminSessionExpired(){
  if(!state.adminLoggedIn) return;
  try{ localStorage.removeItem("tle_admin_token"); }catch(e){}
  state.adminLoggedIn=false; state.adminSig="";
  showView("view-admin-login"); showToast("Your shopkeeper session ended — please log in again");
}
function showLoadError(){
  if(state.products.length) return;
  document.getElementById("product-grid").innerHTML = `<div class="empty-note">We couldn't load the store. Check your connection.<br><br><button class="btn btn-primary" onclick="location.reload()">Try again</button></div>`;
  document.getElementById("category-chips").innerHTML = "";
}

/* Keeps every open device fresh without a database connection: a light check every
   15 seconds while the page is visible (and immediately when you come back to it). */
let pollBusy=false;
async function pollNow(){
  if(pollBusy || document.hidden) return; pollBusy=true;
  try{
    if(state.adminLoggedIn){ if(await loadAdminData()) renderAdminAll(); }
    else await loadCatalog();
  }catch(e){ /* offline — try again next time */ }
  pollBusy=false;
}
function startPolling(){
  setInterval(pollNow, 15000);
  document.addEventListener("visibilitychange", pollNow);
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
  const det = state.itemCache[id];
  const revs = (det && det.reviews) || [];
  const avg = revs.length ? (revs.reduce((s,r)=>s+r.rating,0)/revs.length).toFixed(1) : null;
  const imgs = (det && det.images && det.images.length) ? det.images : itemImages(p);
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
      ${revs.length===0?`<p style="color:var(--ink-soft);font-size:13px;">${det?"No reviews yet — be the first to share your experience.":"Loading reviews…"}</p>`:revs.slice().reverse().map(r=>`
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
  if(!det) loadItem(id).then(()=>{
    if(state.currentProductId===id && document.getElementById("overlay-product").classList.contains("show")) openProduct(id);
  }).catch(()=>{});
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
  try{
    const j = await api("review",{pid:productId, name, rating:state.ratingPick, comment:text});
    state.itemCache[productId] = {...(state.itemCache[productId]||{images:[]}), reviews:j.reviews};
    showToast("Thanks for your review!");
    openProduct(productId);
  }catch(e){ showToast(e.message); }
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
  state.checkoutOfferId = "";
  state.checkoutOffers = state.offers.filter(o=>o.percent>0).map(o=>({id:o.id,title:o.title,percent:o.percent}));
  if(state.me){
    const f={ "co-name":state.me.name,"co-phone":state.me.phone,"co-email":state.me.email||"","co-address":state.me.address||"","co-paynum":state.me.payNumber||"" };
    Object.keys(f).forEach(id=>{ const el=document.getElementById(id); if(el && !el.value) el.value=f[id]; });
  }
  refreshCheckoutOffers();
  openSheet("overlay-checkout");
  if(document.getElementById("co-phone").value) lookupPhoneForOffers();
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
  // The money has been taken, so this must never get lost: keep a copy on the device until the
  // server confirms (it will retry on the next visit), and de-duplicate by Paystack reference.
  const payload = {orderId, ref, form, items: state.cart.map(c=>({id:c.id,qty:c.qty})), offerId: state.checkoutOfferId};
  try{ localStorage.setItem("tle_pending_order", JSON.stringify(payload)); }catch(e){}
  let res=null, lastErr=null;
  for(let i=0;i<3 && !res;i++){
    try{ res = await api("order", payload); }
    catch(e){ lastErr=e; if(e.status && e.status<500) break; await new Promise(r=>setTimeout(r,1200*(i+1))); }
  }
  const btn=document.getElementById("pay-btn");
  btn.disabled=false; btn.textContent="Pay with Paystack";
  if(!res){
    closeSheet("overlay-checkout");
    showToast("Payment received, but we couldn't record the order yet. Keep this page open — we'll retry. Reference: "+ref);
    return;
  }
  completeOrder(res);
}
async function completeOrder(res){
  try{ localStorage.removeItem("tle_pending_order"); }catch(e){}
  state.cart = []; state.checkoutOfferId = "";
  rememberMe(res.customer, res.order.phone);
  renderCartBadge();
  closeSheet("overlay-checkout");
  showOrderSuccess(res.order, res.customer);
  try{ await loadCatalog(); }catch(e){}          // fresh stock levels
}
async function retryPendingOrder(){
  let p=null; try{ p=JSON.parse(localStorage.getItem("tle_pending_order")||"null"); }catch(e){}
  if(!p) return;
  try{ completeOrder(await api("order", p)); }catch(e){ if(e.status && e.status<500) { try{ localStorage.removeItem("tle_pending_order"); }catch(x){} } }
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
  const q = document.getElementById("track-input").value.trim();
  const box = document.getElementById("track-results");
  if(!q){ box.innerHTML = `<div class="muted-box">Enter your order ID or the phone number you ordered with.</div>`; return; }
  box.innerHTML = `<div class="muted-box">Looking…</div>`;
  let orders=[];
  try{ orders = (await api("track",{q})).orders; }
  catch(e){ box.innerHTML = `<div class="muted-box">${escapeHtml(e.message)}</div>`; return; }
  if(orders.length===0){ box.innerHTML = `<div class="muted-box">We couldn't find an order matching that. Double-check the ID or phone number.</div>`; return; }
  box.innerHTML = orders.map(o=>`
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
  try{ await api("help",{name, phone, orderId, message:msg}); }
  catch(e){ showToast(e.message); return; }
  ["hp-name","hp-phone","hp-order","hp-msg"].forEach(id=>document.getElementById(id).value="");
  closeSheet("overlay-help");
  showToast("Message sent! We'll get back to you soon.");
}
function renderHelpBadge(){
  const unread = state.messages.filter(m=>!m.read).length;
  const b = document.getElementById("help-badge");
  // this badge on the storefront simply hints support is active; real unread count is for admin only
  b.style.display = "none";
}

/* ---------------- Admin: login ---------------- */
async function openAdminEntry(){
  if(!state.adminLoggedIn && adminToken()){
    try{ await loadAdminData(); state.adminLoggedIn=true; }
    catch(e){ try{ localStorage.removeItem("tle_admin_token"); }catch(x){} }
  }
  if(state.adminLoggedIn){ showView("view-admin"); renderAdminAll(); autoThumbs(); }
  else { showView("view-admin-login"); document.getElementById("admin-pw-input").value=""; document.getElementById("admin-login-error").textContent=""; }
}
function toggleAdminPwVisibility(){
  const inp = document.getElementById("admin-pw-input");
  inp.type = inp.type==="password" ? "text":"password";
}
async function doAdminLogin(){
  const err=document.getElementById("admin-login-error"); err.textContent="";
  try{
    const j = await api("login",{password:document.getElementById("admin-pw-input").value});
    try{ localStorage.setItem("tle_admin_token", j.token); }catch(e){}
    await loadAdminData();
    state.adminLoggedIn = true;
    showView("view-admin"); renderAdminAll(); autoThumbs();
  }catch(e){ err.textContent = e.message; }
}
function adminLogout(){
  api("logout",{token:adminToken()}).catch(()=>{});
  try{ localStorage.removeItem("tle_admin_token"); }catch(e){}
  state.adminLoggedIn=false; state.adminSig="";
  state.catalogTs=0; loadCatalog().catch(()=>{});     // back to the public view of the catalogue
  showView("view-storefront"); setNavActive("home");
}

/* ---------------- Admin tabs ---------------- */
function setAdminTab(tab){
  state.adminTab = tab;
  document.querySelectorAll(".atab").forEach(b=>b.classList.toggle("active", b.dataset.tab===tab));
  document.querySelectorAll(".admin-tab-content").forEach(el=>el.style.display="none");
  document.getElementById("admin-tab-"+tab).style.display="";   // CSS decides block/grid
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
        const img = itemThumb(p) ? `<img src="${itemThumb(p)}">` : `<div style="width:52px;height:52px;border-radius:10px;background:var(--blue-pale);display:flex;align-items:center;justify-content:center;">${placeholderIcon()}</div>`;
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
  try{ Object.assign(p, (await api("quickUpdate",{id, field, value:num})).product); }
  catch(e){ showToast(e.message); renderAdminProducts(); return; }
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
async function openEditProduct(id){
  const p = state.products.find(x=>x.id===id);
  if(!p) return;
  let images=[];
  try{ images = (await loadItem(id,true)).images||[]; }catch(e){ showToast("Couldn't load this product's photos — try again"); return; }
  document.getElementById("ep-title").textContent="Edit product";
  document.getElementById("ep-id").value=id;
  document.getElementById("ep-name").value=p.name;
  document.getElementById("ep-price").value=p.price;
  document.getElementById("ep-stock").value=p.stock;
  document.getElementById("ep-desc").value=p.desc||"";
  document.getElementById("ep-video").value=p.video||"";
  state.pendingImages = images.slice();
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
   what keeps each save small and the store quick. */
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
const MAX_IMAGE_BYTES = 400*1024;     // per-image ceiling after compression
const MAX_TOTAL_IMAGE_BYTES = 2200*1024; // per product/package — keeps each save under the host's 4.5MB request limit

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
  const images = state.pendingImages.slice();
  try{
    const thumb = images[0] ? await makeThumb(images[0], 360, 0.6) : "";      // small copy for fast grids
    const saved = (await api("saveProduct",{product:{id, name, category, price, stock, desc, video, images, thumb}})).product;
    const i = state.products.findIndex(x=>x.id===saved.id);
    if(i>=0) state.products[i]=saved; else state.products.push(saved);
    delete state.itemCache[saved.id];
  }catch(e){
    console.error(e);
    showToast(e.message || "Couldn't save — try removing a photo and saving again");
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
  try{ state.layout = normLayout((await api("deleteProduct",{id})).layout); }
  catch(e){ showToast(e.message); return; }
  state.products = state.products.filter(x=>x.id!==id);
  closeSheet("overlay-editproduct");
  showToast("Product deleted");
  renderAdminProducts(); renderProducts(); renderAdminLayout();
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
      <div style="font-weight:800;font-size:14px;margin-bottom:${(o.flags&&o.flags.length)?'4':'8'}px;">GH₵${o.total.toFixed(0)}${o.discount?` <span style="font-weight:600;font-size:11.5px;color:var(--ok);">(offer: ${escapeHtml(o.discount.title)}, −GH₵${o.discount.amount})</span>`:''}${o.customerId?` <span style="font-weight:600;font-size:11.5px;color:var(--ink-soft);">· ${o.customerId}</span>`:''}</div>
      ${(o.flags&&o.flags.length)?`<div style="font-size:11.5px;color:var(--orange);font-weight:700;margin-bottom:8px;">⚠ ${o.flags.map(escapeHtml).join(" · ")}</div>`:''}
      <select style="width:100%;padding:9px;border-radius:9px;border:1.5px solid var(--line);font-size:13px;" onchange="updateOrderStatus('${o.id}',this.value)">
        ${["pending","processing","shipped","completed","cancelled"].map(s=>`<option value="${s}" ${s===o.status?'selected':''}>${statusLabel(s)}</option>`).join("")}
      </select>
    </div>
  `).join("");
}
async function updateOrderStatus(id, status){
  const o = state.orders.find(x=>x.id===id);
  if(!o) return;
  try{ await api("orderStatus",{id, status}); }catch(e){ showToast(e.message); renderAdminOrders(); return; }
  o.status = status;
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
  try{ await api("msgRead",{id}); }catch(e){ showToast(e.message); return; }
  m.read=true;
  renderAdminMessages(); updateMessageBadge();
}

function renderAdminReviews(){
  const el = document.getElementById("admin-tab-reviews");
  let rows=[];
  Object.keys(state.reviews).forEach(pid=>{
    const p = findItem(pid);
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
  try{ await api("reviewDelete",{pid, idx}); }catch(e){ showToast(e.message); return; }
  state.reviews[pid].splice(idx,1);
  delete state.itemCache[pid];
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
}
async function changeAdminPassword(){
  const cur=document.getElementById("cp-current").value;
  const nw=document.getElementById("cp-new").value;
  const cf=document.getElementById("cp-confirm").value;
  const err=document.getElementById("cp-error");
  err.textContent="";
  if(nw!==cf){ err.textContent="New passwords don't match."; return; }
  try{ await api("changePassword",{current:cur, next:nw}); }
  catch(e){ err.textContent=e.message; return; }
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
  const next = state.categories.concat(val);
  try{ await api("saveCategories",{categories:next}); }catch(e){ showToast(e.message); return; }
  state.categories = next;
  inp.value="";
  showToast("Category added");
  renderAdminSettings(); renderCategoryChips();
}
async function removeCategory(cat){
  if(!confirm(`Remove "${cat}"? Products in it will stay but the category tab will disappear.`)) return;
  const next = state.categories.filter(c=>c!==cat);
  try{ await api("saveCategories",{categories:next}); }catch(e){ showToast(e.message); return; }
  state.categories = next;
  showToast("Category removed");
  renderAdminSettings(); renderCategoryChips();
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
   PACKAGES (Business Branding Packages)
   ============================================================ */
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
function rememberMe(c, phone){
  state.me=c;
  try{ localStorage.setItem("tle_me", JSON.stringify({id:c.id, phone:phone||c.phone})); }catch(e){}
  loadMe(c.id, phone||c.phone).catch(()=>{});
}
function savedMe(){ try{ return JSON.parse(localStorage.getItem("tle_me")||"null"); }catch(e){ return null; } }
async function loadMe(id, phone){
  const j = await api("me",{id, phone});
  state.me=j.customer; state.meData=j;
  updateMeDot(); refreshMeIfOpen();
  return j;
}
async function restoreMe(){
  const m=savedMe(); if(!m) return;
  try{ await loadMe(m.id, m.phone); }
  catch(e){ if(e.status===401) forgetMe(true); }
}
/* ============================================================
   OFFERS / ANNOUNCEMENTS — posted by the shopkeeper, matched to purchase history
   ============================================================ */
function audienceText(o){
  const bits=[]; const ids=(o.ids||"").trim();
  if(ids) bits.push("Customer IDs: "+ids);
  if(o.minOrders>0) bits.push(o.minOrders+"+ orders");
  if(o.minSpent>0) bits.push("GH₵"+o.minSpent+"+ spent");
  return bits.length ? bits.join(" · ") : "Everyone";
}
function currentOffers(c){ return state.meData ? state.meData.offers : []; }
function updateMeDot(){ const d=document.getElementById("me-dot"); if(d) d.style.display = (state.meData && state.meData.offers.some(o=>o.percent>0)) ? "block":"none"; }

/* ---- checkout side ---- */
function currentDiscount(){
  const o=state.checkoutOffers.find(x=>x.id===state.checkoutOfferId);
  if(!o || !(o.percent>0)) return {amount:0,offer:null};
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
  const list=state.checkoutOffers;
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
  try{
    const j = await api("offersFor",{phone:document.getElementById("co-phone").value});
    state.checkoutOffers = j.offers;
    refreshCheckoutOffers();
  }catch(e){ /* keep the public offers */ }
}

/* ============================================================
   ME — purchase history, Customer ID, offers & updates
   ============================================================ */
async function openMe(){
  showView("view-me"); setNavActive("none"); renderMe();
  const m=savedMe();
  if(m){ try{ await loadMe(m.id, m.phone); }catch(e){ if(e.status===401) forgetMe(true); } }
  renderMe();
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
    const pub=state.offers;
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
  const c=state.me, orders=state.meData?state.meData.orders:[], tab=state.meTab||"offers", offers=state.meData?state.meData.offers:[];
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
  try{
    await loadMe(id, ph);
    try{ localStorage.setItem("tle_me", JSON.stringify({id, phone:ph})); }catch(e){}
    state.meTab="history"; renderMe();
  }catch(e){
    err.textContent = e.status===401 ? "We couldn't match that Customer ID with that phone number." : e.message;
  }
}
function forgetMe(silent){
  state.me=null; state.meData=null; try{ localStorage.removeItem("tle_me"); }catch(e){}
  updateMeDot(); if(!silent) renderMe();
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
async function openEditPackage(id){
  const k=state.packages.find(x=>x.id===id); if(!k) return;
  let images=[];
  try{ images=(await loadItem(id,true)).images||[]; }catch(e){ showToast("Couldn't load this package's photos — try again"); return; }
  document.getElementById("pk-title").textContent="Edit package";
  document.getElementById("pk-id").value=id;
  document.getElementById("pk-name").value=k.name;
  document.getElementById("pk-price").value=k.price;
  document.getElementById("pk-includes").value=(k.includes||[]).join("\n");
  document.getElementById("pk-desc").value=k.desc||"";
  document.getElementById("pk-video").value=k.video||"";
  document.getElementById("pk-published").value=k.published===false?"0":"1";
  state.pendingImages=images.slice(); renderImageThumbs();
  document.getElementById("pk-delete-btn").style.display="block";
  openSheet("overlay-editpackage");
}
async function savePackage(){
  const id=document.getElementById("pk-id").value;
  const name=document.getElementById("pk-name").value.trim();
  const price=parseFloat(document.getElementById("pk-price").value);
  if(!name || isNaN(price) || price<0){ showToast("Please fill in a valid name and price"); return; }
  if(state.pendingImages.includes("UPLOADING")){ showToast("Please wait for the image(s) to finish processing"); return; }
  const images=state.pendingImages.slice();
  const published=document.getElementById("pk-published").value==="1";
  try{
    const thumbs=[]; for(const im of images.slice(0,6)){ const t=await makeThumb(im,640,0.62); if(t) thumbs.push(t); }
    const old=state.packages.find(x=>x.id===id);
    const res=await api("savePackage",{pkg:{
      id, name, price, images, thumbs, published, createdAt: old?old.createdAt:undefined,
      includes: document.getElementById("pk-includes").value.split("\n").map(x=>x.trim()).filter(Boolean),
      desc: document.getElementById("pk-desc").value.trim(), video: document.getElementById("pk-video").value.trim()
    }});
    const k=pkgNorm(res.pkg), i=state.packages.findIndex(x=>x.id===k.id);
    if(i>=0) state.packages[i]=k; else state.packages.push(k);
    state.layout=normLayout(res.layout); delete state.itemCache[k.id];
  }catch(e){ console.error(e); showToast(e.message || "Couldn't save — try removing a photo and saving again"); return; }
  closeSheet("overlay-editpackage");
  showToast(published ? "Package saved — live on the website now" : "Package saved as hidden");
  renderAdminPackages(); renderAdminLayout(); renderPackages();
}
async function togglePackage(id){
  const k=state.packages.find(x=>x.id===id); if(!k) return;
  try{ Object.assign(k, pkgNorm((await api("togglePackage",{id})).pkg)); }catch(e){ showToast(e.message); return; }
  showToast(k.published ? "Package is live" : "Package hidden from the website");
  renderAdminPackages(); renderPackages();
}
async function deletePackageConfirm(){
  const id=document.getElementById("pk-id").value; if(!id) return;
  if(!confirm("Delete this package? This can't be undone.")) return;
  try{ state.layout=normLayout((await api("deletePackage",{id})).layout); }catch(e){ showToast(e.message); return; }
  state.packages=state.packages.filter(x=>x.id!==id);
  closeSheet("overlay-editpackage"); showToast("Package deleted");
  renderAdminPackages(); renderAdminLayout(); renderPackages();
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
  const next=state.offers.map(o=>({...o}));
  const existing=next.find(x=>x.id===id);
  if(existing) Object.assign(existing,data); else next.push({id:"of"+Date.now(), createdAt:Date.now(), ...data});
  if(!(await persistOffers(next))) return;
  closeSheet("overlay-editoffer"); showToast("Saved — customers see it under Me");
}
async function persistOffers(next){
  try{ await api("saveOffers",{offers:next}); }catch(e){ showToast(e.message); return false; }
  state.offers=next; renderAdminOffers(); return true;
}
async function toggleOffer(id){
  const next=state.offers.map(o=>o.id===id?{...o,active:o.active===false}:{...o});
  if(await persistOffers(next)) showToast(next.find(o=>o.id===id).active?"Offer resumed":"Offer paused");
}
async function deleteOfferConfirm(){
  const id=document.getElementById("of-id").value; if(!id||!confirm("Delete this? This can't be undone.")) return;
  if(await persistOffers(state.offers.filter(x=>x.id!==id))){ closeSheet("overlay-editoffer"); showToast("Deleted"); }
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
  try{ await api("saveLayout",{layout:state.layout}); }catch(e){ showToast(e.message); return; }
  applyLayout(); renderPackages(); renderProducts(); renderAdminLayout();
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

/* Photos migrated from the old database have no small thumbnail yet — build them once, quietly,
   the first time the shopkeeper opens the dashboard. */
async function autoThumbs(){
  if(state.thumbRun) return;
  const needP=state.products.filter(p=>p.imgCount>0 && !p.thumb), needK=state.packages.filter(k=>k.imgCount>0 && !(k.thumbs&&k.thumbs.length));
  if(!needP.length && !needK.length) return;
  state.thumbRun=true; showToast("Preparing photo thumbnails ("+(needP.length+needK.length)+")…");
  try{
    for(const p of needP){
      const im=((await loadItem(p.id,true)).images||[])[0]; if(!im) continue;
      const t=await makeThumb(im,360,0.6); if(!t) continue;
      await api("setThumb",{id:p.id, thumb:t}); p.thumb=t;
    }
    for(const k of needK){
      const ims=((await loadItem(k.id,true)).images||[]).slice(0,6); const thumbs=[];
      for(const im of ims){ const t=await makeThumb(im,640,0.62); if(t) thumbs.push(t); }
      if(!thumbs.length) continue;
      await api("setThumb",{id:k.id, thumbs}); k.thumbs=thumbs;
    }
    showToast("Thumbnails ready — the store will now open faster");
  }catch(e){ console.error("Thumbnail build failed", e); }
  state.thumbRun=false; renderProducts(); renderPackages(); if(state.adminLoggedIn) renderAdminAll();
}

/* ---------------- Utility ---------------- */
function escapeHtml(str){
  return String(str||"").replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
}
function escapeAttr(str){ return escapeHtml(str).replace(/`/g,"&#96;"); }

/* ---------------- Sync across devices ---------------- */
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
  // 1) instant paint from the last catalogue this device saw
  try{ const raw=localStorage.getItem("tle_snapshot"); if(raw){ applyCatalog(JSON.parse(raw)); safeRenderAll(); } }catch(e){}
  // 2) the newest catalogue from Redis
  try{ await loadCatalog(); }
  catch(e){ console.error("Couldn't load the store", e); showLoadError(); }
  safeRenderAll();
  restoreMe(); retryPendingOrder(); startPolling();
})();
