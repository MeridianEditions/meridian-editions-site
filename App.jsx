import React, { useState, useMemo, useEffect } from "react";
import { ShoppingBag, X, Plus, Minus, ArrowRight, Check, Loader } from "lucide-react";

/* ============================================================
   MERIDIAN EDITIONS — HEADLESS SHOPIFY STOREFRONT
   Custom design (this file) + Shopify commerce + Prodigi fulfillment.

   HOW IT WORKS
   • Browsing, gallery, product picker = this React site (your look).
   • Cart + checkout = Shopify (via the Storefront API below).
   • Printing + shipping = Prodigi's Shopify app (fully automatic).

   GO LIVE — fill in CONFIG, then it switches from demo to real:
   1. Create a Shopify store. Install the Prodigi app and let it
      create your products (it builds the size/material/frame
      variants and links each to print fulfillment).
   2. In Shopify admin: Settings > Apps > Develop apps > create an
      app > enable Storefront API > copy the Storefront access token.
   3. Paste your store domain + token below. (Token is public-safe;
      it only reads products and creates carts.)
   Until CONFIG is filled, the site runs in DEMO mode with the
   sample catalog so you can preview the design.
   ============================================================ */

const BRAND = "Meridian Editions";

const CONFIG = {
  SHOPIFY_DOMAIN: "",          // e.g. "meridian-editions.myshopify.com"
  STOREFRONT_TOKEN: "",        // Storefront API access token
  API_VERSION: "2024-10",
};
const LIVE = Boolean(CONFIG.SHOPIFY_DOMAIN && CONFIG.STOREFRONT_TOKEN);

/* ---------- Shopify Storefront API client ---------- */
async function shopify(query, variables = {}) {
  const res = await fetch(
    `https://${CONFIG.SHOPIFY_DOMAIN}/api/${CONFIG.API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": CONFIG.STOREFRONT_TOKEN,
      },
      body: JSON.stringify({ query, variables }),
    }
  );
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0]?.message || "Shopify error");
  return json.data;
}

const PRODUCTS_QUERY = `{
  products(first: 50) {
    edges { node {
      id title handle
      featuredImage { url altText }
      collections(first:1){ edges { node { title } } }
      options { name values }
      variants(first: 100) { edges { node {
        id title availableForSale
        price { amount currencyCode }
        selectedOptions { name value }
      } } }
    } }
  }
}`;

const CART_CREATE = `mutation($lines:[CartLineInput!]!){
  cartCreate(input:{lines:$lines}){
    cart { id checkoutUrl }
    userErrors { message }
  }
}`;

/* ---------- DEMO catalog (used until CONFIG is filled) ---------- */
const DEMO_PHOTOS = [
  { id:1,  t:"Apex",          cat:"Motion", loc:"No. 01 · Edition of 25", h:380, grad:"linear-gradient(135deg,#e08a3c,#3a1c0a)", ed:"Ed. of 25" },
  { id:2,  t:"First Light",   cat:"Snow",   loc:"No. 02 · Edition of 50", h:300, grad:"linear-gradient(160deg,#bcd9ef,#13283d)" },
  { id:3,  t:"Exit Altitude", cat:"Air",    loc:"No. 03 · Edition of 25", h:440, grad:"linear-gradient(180deg,#3a72c4,#0c1730)", ed:"Ed. of 25" },
  { id:4,  t:"Blue Hour",     cat:"Sea",    loc:"No. 04 · Edition of 50", h:320, grad:"linear-gradient(160deg,#2ba0ad,#06262d)" },
  { id:5,  t:"Glasswater",    cat:"Water",  loc:"No. 05 · Edition of 50", h:300, grad:"linear-gradient(140deg,#46b89a,#0a322c)" },
  { id:6,  t:"Last Sun",      cat:"Lake",   loc:"No. 06 · Edition of 25", h:360, grad:"linear-gradient(150deg,#e0a23f,#6e2c08)", ed:"Ed. of 25" },
  { id:7,  t:"Long Miles",    cat:"Trail",  loc:"No. 07 · Edition of 50", h:420, grad:"linear-gradient(170deg,#d4574a,#2a0d0a)" },
  { id:8,  t:"Dust Line",     cat:"Road",   loc:"No. 08 · Edition of 50", h:300, grad:"linear-gradient(135deg,#bd7a3e,#1c1109)" },
  { id:9,  t:"Berm",          cat:"Motion", loc:"No. 09 · Edition of 50", h:340, grad:"linear-gradient(150deg,#dd8348,#241208)" },
  { id:10, t:"Cornice",       cat:"Snow",   loc:"No. 10 · Edition of 25", h:400, grad:"linear-gradient(180deg,#cfe4f3,#1d2f44)", ed:"Ed. of 25" },
  { id:11, t:"Freefall",      cat:"Air",    loc:"No. 11 · Edition of 50", h:320, grad:"linear-gradient(160deg,#4585d6,#0e1c3a)" },
  { id:12, t:"Kelp Cathedral",cat:"Sea",    loc:"No. 12 · Edition of 50", h:380, grad:"linear-gradient(170deg,#2a8f7d,#052420)" },
];
const DEMO_SIZES = [
  { label:'8 × 12"', base:48 }, { label:'12 × 18"', base:82 },
  { label:'18 × 24"', base:130 }, { label:'24 × 36"', base:195 },
];
const DEMO_MATERIALS = [
  { label:"Archival Lustre", mult:1.0, note:"Pro photo paper" },
  { label:"Fine Art Matte",  mult:1.15, note:"Cotton rag" },
  { label:"Metal",           mult:1.6, note:"HD aluminum" },
  { label:"Canvas",          mult:1.5, note:"Gallery wrap" },
  { label:"Acrylic",         mult:1.95, note:"Face-mounted" },
];
const DEMO_FRAMES = [
  { label:"Unframed", add:0 }, { label:"Black", add:48 },
  { label:"White", add:48 }, { label:"Natural Maple", add:64 },
];
const usd = (n) => "$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });

/* Build a uniform product shape the UI understands, for either mode. */
function demoProducts() {
  return DEMO_PHOTOS.map(p => ({
    id: String(p.id), title: p.t, cat: p.cat, loc: p.loc, h: p.h, grad: p.grad,
    image: null, ed: p.ed,
    optionGroups: [
      { name: "Size",     values: DEMO_SIZES.map(s => ({ label: s.label, note: usd(s.base) + "+" })) },
      { name: "Material", values: DEMO_MATERIALS.map(m => ({ label: m.label, note: m.note })) },
      { name: "Framing",  values: DEMO_FRAMES.map(f => ({ label: f.label, note: f.add ? "+" + usd(f.add) : "included" })) },
    ],
    fromPrice: DEMO_SIZES[0].base,
    resolve(sel) {
      const s = DEMO_SIZES.find(x => x.label === sel.Size) || DEMO_SIZES[0];
      const m = DEMO_MATERIALS.find(x => x.label === sel.Material) || DEMO_MATERIALS[0];
      const f = DEMO_FRAMES.find(x => x.label === sel.Framing) || DEMO_FRAMES[0];
      return { price: Math.round(s.base * m.mult + f.add), variantId: null };
    },
  }));
}

function normalizeShopify(data) {
  return data.products.edges.map(({ node }) => {
    const variants = node.variants.edges.map(e => e.node);
    const prices = variants.map(v => parseFloat(v.price.amount));
    const cat = node.collections.edges[0]?.node.title || "Editions";
    return {
      id: node.id, title: node.title, cat, loc: cat, h: 360,
      grad: "linear-gradient(150deg,#cfc6b6,#3a342b)",
      image: node.featuredImage?.url || null, ed: null,
      optionGroups: node.options.map(o => ({ name: o.name, values: o.values.map(v => ({ label: v })) })),
      fromPrice: Math.min(...prices),
      resolve(sel) {
        const match = variants.find(v => v.selectedOptions.every(o => sel[o.name] === o.value));
        return { price: match ? parseFloat(match.price.amount) : Math.min(...prices), variantId: match?.id || null };
      },
    };
  });
}

/* ---------- styles (unchanged Meridian aesthetic) ---------- */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400&family=Hanken+Grotesk:wght@400;500;600;700&display=swap');
.me * { box-sizing:border-box; margin:0; padding:0; }
.me { --paper:#F4F1EA; --paper2:#ECE8DF; --ink:#1A1714; --ink2:#4A4540; --muted:#8C857B; --line:rgba(26,23,20,0.13); --accent:#B14A32; --accent-soft:rgba(177,74,50,0.08);
  font-family:'Hanken Grotesk',system-ui,sans-serif; color:var(--ink); background:var(--paper); min-height:100vh; position:relative; overflow-x:hidden; -webkit-font-smoothing:antialiased; }
.me::before{ content:""; position:fixed; inset:0; z-index:1; pointer-events:none; opacity:.5; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E"); }
.me-wrap{ position:relative; z-index:2; }
.serif{ font-family:'Fraunces',Georgia,serif; font-weight:400; }
.kicker{ font-size:11px; letter-spacing:0.32em; text-transform:uppercase; font-weight:600; color:var(--muted); }
.hdr{ position:sticky; top:0; z-index:50; background:rgba(244,241,234,0.86); backdrop-filter:blur(12px); border-bottom:1px solid var(--line); }
.hdr-in{ max-width:1320px; margin:0 auto; padding:18px 30px; display:flex; align-items:center; justify-content:space-between; gap:20px; }
.brand{ display:flex; flex-direction:column; cursor:pointer; line-height:1; }
.brand .b1{ font-family:'Fraunces'; font-size:23px; font-weight:500; letter-spacing:-0.01em; }
.brand .b2{ font-size:9px; letter-spacing:0.4em; text-transform:uppercase; color:var(--muted); margin-top:5px; font-weight:600; }
.nav{ display:flex; gap:30px; align-items:center; }
.nav a{ color:var(--ink2); text-decoration:none; font-size:13px; font-weight:500; cursor:pointer; transition:color .2s; position:relative; }
.nav a::after{ content:""; position:absolute; left:0; bottom:-4px; width:0; height:1px; background:var(--ink); transition:width .25s; }
.nav a:hover{ color:var(--ink); } .nav a:hover::after{ width:100%; }
.cartbtn{ position:relative; display:flex; align-items:center; gap:8px; background:var(--ink); color:var(--paper); border:none; padding:11px 18px; font-weight:600; font-size:12px; letter-spacing:0.08em; text-transform:uppercase; cursor:pointer; transition:opacity .2s; }
.cartbtn:hover{ opacity:.85; }
.badge{ position:absolute; top:-7px; right:-7px; background:var(--accent); color:#fff; font-size:11px; font-weight:700; min-width:19px; height:19px; border-radius:99px; display:grid; place-items:center; padding:0 5px; }
.demobar{ background:var(--ink); color:var(--paper); text-align:center; font-size:12px; letter-spacing:0.04em; padding:8px 16px; }
.demobar b{ color:#f0b; } .demobar .dot{ color:var(--accent); }
.hero{ max-width:1320px; margin:0 auto; padding:88px 30px 56px; display:grid; grid-template-columns:1.25fr 1fr; gap:48px; align-items:end; }
@media(max-width:860px){ .hero{ grid-template-columns:1fr; gap:30px; padding:54px 24px 36px; } .nav{ display:none; } }
.hero h1{ font-family:'Fraunces'; font-weight:400; font-size:clamp(44px,7vw,92px); line-height:0.96; letter-spacing:-0.02em; }
.hero h1 em{ font-style:italic; color:var(--accent); }
.hero .lead{ margin-top:26px; color:var(--ink2); font-size:17px; line-height:1.6; max-width:42ch; }
.hero-r{ border-left:1px solid var(--line); padding-left:34px; padding-bottom:8px; }
@media(max-width:860px){ .hero-r{ border-left:0; padding-left:0; } }
.spec{ margin-bottom:22px; } .spec .t{ font-family:'Fraunces'; font-size:17px; } .spec .d{ color:var(--muted); font-size:13px; margin-top:3px; line-height:1.5; }
.hero-cta{ margin-top:14px; display:inline-flex; align-items:center; gap:9px; background:var(--ink); color:var(--paper); border:none; padding:15px 26px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; font-size:13px; cursor:pointer; transition:gap .2s; }
.hero-cta:hover{ gap:15px; }
.strip{ border-top:1px solid var(--line); border-bottom:1px solid var(--line); background:var(--paper2); }
.strip-in{ max-width:1320px; margin:0 auto; padding:16px 30px; display:flex; gap:40px; flex-wrap:wrap; justify-content:space-between; }
.strip span{ font-size:12px; letter-spacing:0.14em; text-transform:uppercase; color:var(--ink2); display:flex; align-items:center; gap:9px; } .strip span b{ color:var(--accent); }
.sec-head{ max-width:1320px; margin:0 auto; padding:54px 30px 8px; display:flex; align-items:flex-end; justify-content:space-between; gap:20px; flex-wrap:wrap; }
.sec-head h2{ font-family:'Fraunces'; font-weight:400; font-size:clamp(28px,4vw,42px); letter-spacing:-0.02em; }
.filterbar{ max-width:1320px; margin:0 auto; padding:18px 30px 6px; display:flex; gap:9px; flex-wrap:wrap; }
.pill{ background:transparent; border:1px solid var(--line); color:var(--ink2); padding:8px 16px; border-radius:99px; font-size:13px; font-weight:500; cursor:pointer; transition:all .18s; }
.pill:hover{ border-color:var(--ink); } .pill.on{ background:var(--ink); color:var(--paper); border-color:var(--ink); }
.gallery{ max-width:1320px; margin:0 auto; padding:22px 30px 90px; columns:3; column-gap:26px; }
@media(max-width:900px){ .gallery{ columns:2; } } @media(max-width:560px){ .gallery{ columns:1; } }
.shot{ break-inside:avoid; margin-bottom:26px; cursor:pointer; opacity:0; transform:translateY(20px); animation:rise .65s cubic-bezier(.2,.7,.2,1) forwards; }
@keyframes rise{ to{ opacity:1; transform:none; } }
.shot .frame{ background:#fff; padding:14px; box-shadow:0 1px 0 var(--line), 0 22px 40px -28px rgba(26,23,20,.4); transition:transform .3s, box-shadow .3s; position:relative; overflow:hidden; }
.shot:hover .frame{ transform:translateY(-4px); box-shadow:0 1px 0 var(--line), 0 34px 54px -26px rgba(26,23,20,.5); }
.shot .img{ width:100%; display:block; position:relative; background-size:cover; background-position:center; }
.shot .cap{ display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding:14px 2px 0; }
.shot .cap .t{ font-family:'Fraunces'; font-size:18px; line-height:1.05; } .shot .cap .loc{ color:var(--muted); font-size:12px; margin-top:4px; }
.shot .cap .pr{ text-align:right; white-space:nowrap; } .shot .cap .pr .from{ color:var(--muted); font-size:11px; } .shot .cap .pr .v{ font-family:'Fraunces'; font-size:17px; }
.edtag{ position:absolute; top:14px; left:14px; background:rgba(244,241,234,.92); border:1px solid var(--line); font-size:10px; font-weight:600; letter-spacing:0.12em; text-transform:uppercase; padding:5px 9px; }
.overlay{ position:fixed; inset:0; background:rgba(26,23,20,.42); backdrop-filter:blur(5px); z-index:90; display:flex; align-items:center; justify-content:center; padding:24px; animation:fade .2s ease; }
@keyframes fade{ from{ opacity:0; } }
.modal{ background:var(--paper); width:min(980px,100%); max-height:90vh; overflow:auto; display:grid; grid-template-columns:1.15fr 1fr; animation:pop .3s cubic-bezier(.2,.7,.2,1); box-shadow:0 40px 90px -30px rgba(0,0,0,.5); }
@keyframes pop{ from{ transform:scale(.97) translateY(8px); opacity:0; } }
@media(max-width:780px){ .modal{ grid-template-columns:1fr; } }
.preview{ position:relative; background:var(--paper2); display:grid; place-items:center; padding:46px; min-height:320px; }
.matte{ background:#fff; box-shadow:0 26px 50px -22px rgba(0,0,0,.4); transition:all .3s; }
.matte .photo{ width:230px; max-width:60vw; background-size:cover; background-position:center; }
.closex{ position:absolute; top:16px; right:16px; z-index:5; background:var(--paper); border:1px solid var(--line); color:var(--ink); width:38px; height:38px; border-radius:99px; display:grid; place-items:center; cursor:pointer; }
.closex:hover{ background:var(--ink); color:var(--paper); }
.panel{ padding:34px; display:flex; flex-direction:column; gap:20px; }
.panel .cat{ color:var(--accent); font-size:11px; font-weight:600; letter-spacing:0.2em; text-transform:uppercase; }
.panel h2{ font-family:'Fraunces'; font-weight:400; font-size:34px; line-height:1; margin-top:8px; letter-spacing:-0.01em; }
.panel .sub{ color:var(--ink2); font-size:13px; margin-top:10px; line-height:1.6; }
.opt h4{ font-size:11px; letter-spacing:0.16em; text-transform:uppercase; color:var(--muted); margin-bottom:9px; font-weight:600; }
.choices{ display:flex; flex-wrap:wrap; gap:8px; }
.choice{ border:1px solid var(--line); background:#fff; color:var(--ink); padding:9px 13px; cursor:pointer; transition:all .15s; display:flex; flex-direction:column; align-items:flex-start; gap:2px; }
.choice small{ color:var(--muted); font-size:11px; } .choice:hover{ border-color:var(--ink); }
.choice.on{ border-color:var(--accent); background:var(--accent-soft); } .choice.on small{ color:var(--accent); } .choice b{ font-weight:600; font-size:13px; }
.priceline{ display:flex; align-items:baseline; justify-content:space-between; border-top:1px solid var(--line); padding-top:18px; margin-top:auto; }
.priceline .pl{ color:var(--muted); font-size:12px; letter-spacing:0.08em; text-transform:uppercase; } .priceline .p{ font-family:'Fraunces'; font-size:36px; }
.addbtn{ width:100%; background:var(--ink); color:var(--paper); border:none; padding:16px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; font-size:13px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:10px; transition:opacity .2s; }
.addbtn:hover{ opacity:.88; }
.drawer{ position:fixed; top:0; right:0; height:100%; width:min(450px,100%); background:var(--paper); border-left:1px solid var(--line); z-index:95; display:flex; flex-direction:column; animation:slide .3s cubic-bezier(.2,.7,.2,1); }
@keyframes slide{ from{ transform:translateX(100%); } }
.drawer-h{ padding:24px; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid var(--line); }
.drawer-h h3{ font-family:'Fraunces'; font-weight:400; font-size:24px; }
.drawer-body{ flex:1; overflow:auto; padding:18px 24px; display:flex; flex-direction:column; gap:16px; }
.citem{ display:flex; gap:14px; border-bottom:1px solid var(--line); padding-bottom:16px; }
.citem .th{ width:64px; height:64px; flex-shrink:0; border:1px solid var(--line); background-size:cover; background-position:center; }
.citem .info{ flex:1; } .citem .nm{ font-family:'Fraunces'; font-size:16px; } .citem .sp{ color:var(--muted); font-size:12px; margin-top:3px; line-height:1.5; }
.qty{ display:flex; align-items:center; gap:10px; margin-top:8px; }
.qty button{ width:25px; height:25px; border:1px solid var(--line); background:#fff; color:var(--ink); cursor:pointer; display:grid; place-items:center; } .qty span{ font-weight:600; font-size:13px; min-width:16px; text-align:center; }
.citem .pr{ font-family:'Fraunces'; font-size:16px; }
.rm{ background:none; border:none; color:var(--muted); font-size:11px; cursor:pointer; text-decoration:underline; margin-top:6px; padding:0; }
.empty{ text-align:center; color:var(--muted); padding:64px 16px; } .empty .serif{ font-size:22px; color:var(--ink); display:block; margin-bottom:8px; }
.drawer-f{ border-top:1px solid var(--line); padding:24px; display:flex; flex-direction:column; gap:14px; }
.subtotal{ display:flex; justify-content:space-between; align-items:baseline; } .subtotal .l{ color:var(--muted); letter-spacing:0.06em; text-transform:uppercase; font-size:12px; } .subtotal .v{ font-family:'Fraunces'; font-size:30px; }
.ship{ color:var(--muted); font-size:12px; line-height:1.5; }
.checkout{ background:var(--ink); color:var(--paper); border:none; padding:16px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; font-size:13px; cursor:pointer; display:flex; gap:10px; align-items:center; justify-content:center; transition:opacity .2s; }
.checkout:hover{ opacity:.88; } .checkout:disabled{ opacity:.5; cursor:default; }
.note{ font-size:11px; color:var(--muted); text-align:center; line-height:1.5; }
.spin{ animation:spin 1s linear infinite; } @keyframes spin{ to{ transform:rotate(360deg); } }
.loadwrap{ display:grid; place-items:center; padding:120px 20px; color:var(--muted); gap:14px; }
.ftr{ border-top:1px solid var(--line); background:var(--paper2); }
.ftr-in{ max-width:1320px; margin:0 auto; padding:56px 30px; display:grid; grid-template-columns:1.6fr 1fr 1fr 1fr; gap:32px; }
@media(max-width:760px){ .ftr-in{ grid-template-columns:1fr 1fr; } }
.ftr .big{ font-family:'Fraunces'; font-weight:400; font-size:30px; letter-spacing:-0.01em; } .ftr .tg{ color:var(--muted); font-size:13px; margin-top:10px; line-height:1.6; max-width:34ch; }
.ftr h5{ font-size:11px; letter-spacing:0.16em; text-transform:uppercase; color:var(--muted); margin-bottom:14px; font-weight:600; }
.ftr ul{ list-style:none; display:flex; flex-direction:column; gap:9px; } .ftr a{ color:var(--ink2); text-decoration:none; font-size:13px; cursor:pointer; transition:color .2s; } .ftr a:hover{ color:var(--accent); }
.ftr-base{ border-top:1px solid var(--line); padding:18px 30px; max-width:1320px; margin:0 auto; display:flex; justify-content:space-between; flex-wrap:wrap; gap:12px; color:var(--muted); font-size:12px; }
`;

function ProductModal({ product, onClose, onAdd }) {
  const [sel, setSel] = useState(() => {
    const init = {};
    product.optionGroups.forEach(g => { init[g.name] = g.values[0].label; });
    return init;
  });
  const { price, variantId } = product.resolve(sel);
  const frameVal = sel.Framing || "";
  const fStyle = !frameVal || frameVal === "Unframed" ? { padding: 0 } :
    { padding: "15px", background: frameVal === "Black" ? "#1a1714" : frameVal === "White" ? "#fff" : "#c89b63",
      boxShadow: frameVal === "White" ? "0 26px 50px -22px rgba(0,0,0,.4), inset 0 0 0 1px rgba(0,0,0,.06)" : "0 26px 50px -22px rgba(0,0,0,.4)" };
  const photoBg = product.image ? { backgroundImage: `url(${product.image})` } : { background: product.grad };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button className="closex" onClick={onClose}><X size={18} /></button>
        <div className="preview">
          <div className="matte" style={fStyle}>
            <div className="photo" style={{ height: 200, ...photoBg }} />
          </div>
        </div>
        <div className="panel">
          <div>
            <div className="cat">{product.cat}{product.loc && product.loc !== product.cat ? " · " + product.loc : ""}</div>
            <h2>{product.title}</h2>
            <div className="sub">Museum-grade archival pigment print, signed and edition-numbered. Includes a Certificate of Authenticity. Made to order — ships in 5–7 days.</div>
          </div>
          {product.optionGroups.map(g => (
            <div className="opt" key={g.name}>
              <h4>{g.name}</h4>
              <div className="choices">
                {g.values.map(v => (
                  <button key={v.label} className={"choice" + (sel[g.name] === v.label ? " on" : "")}
                    onClick={() => setSel(s => ({ ...s, [g.name]: v.label }))}>
                    <b>{v.label}</b>{v.note && <small>{v.note}</small>}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="priceline">
            <div className="pl">Your price</div>
            <div className="p">{usd(price)}</div>
          </div>
          <button className="addbtn" onClick={() => onAdd({ product, sel, price, variantId })}>
            <ShoppingBag size={16} /> Add to cart
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [products, setProducts] = useState(LIVE ? null : demoProducts());
  const [filter, setFilter] = useState("All");
  const [active, setActive] = useState(null);
  const [cart, setCart] = useState([]);
  const [drawer, setDrawer] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [working, setWorking] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!LIVE) return;
    shopify(PRODUCTS_QUERY)
      .then(d => setProducts(normalizeShopify(d)))
      .catch(e => { setErr(e.message); setProducts(demoProducts()); });
  }, []);

  const cats = useMemo(() => {
    if (!products) return ["All"];
    return ["All", ...Array.from(new Set(products.map(p => p.cat)))];
  }, [products]);

  const shots = useMemo(() => {
    if (!products) return [];
    return filter === "All" ? products : products.filter(p => p.cat === filter);
  }, [products, filter]);

  const count = cart.reduce((a, c) => a + c.qty, 0);
  const subtotal = cart.reduce((a, c) => a + c.price * c.qty, 0);

  const addToCart = (item) => {
    const key = `${item.product.id}|${Object.values(item.sel).join("|")}`;
    setCart(prev => {
      const i = prev.findIndex(x => x.key === key);
      if (i >= 0) { const cp = [...prev]; cp[i] = { ...cp[i], qty: cp[i].qty + 1 }; return cp; }
      return [...prev, {
        key, qty: 1, price: item.price, variantId: item.variantId,
        title: item.product.title, image: item.product.image, grad: item.product.grad,
        spec: Object.values(item.sel).join(" · "),
      }];
    });
    setActive(null); setDrawer(true);
  };
  const setQty = (key, d) => setCart(prev => prev.map(x => x.key === key ? { ...x, qty: Math.max(0, x.qty + d) } : x).filter(x => x.qty > 0));

  const checkout = async () => {
    if (!LIVE) { setPlaced(true); return; }          // demo
    setWorking(true); setErr("");
    try {
      const lines = cart.map(c => ({ merchandiseId: c.variantId, quantity: c.qty }));
      const d = await shopify(CART_CREATE, { lines });
      const url = d.cartCreate?.cart?.checkoutUrl;
      if (!url) throw new Error(d.cartCreate?.userErrors?.[0]?.message || "Could not start checkout");
      window.location.href = url;                     // hand off to Shopify checkout
    } catch (e) { setErr(e.message); setWorking(false); }
  };

  return (
    <div className="me">
      <style>{CSS}</style>
      <div className="me-wrap">
        {!LIVE && (
          <div className="demobar"><span className="dot">●</span> Demo mode — add your Shopify domain + Storefront token in <b>CONFIG</b> to go live</div>
        )}

        <header className="hdr">
          <div className="hdr-in">
            <div className="brand" onClick={() => setFilter("All")}>
              <span className="b1 serif">{BRAND}</span>
              <span className="b2">Fine-Art Print Editions</span>
            </div>
            <nav className="nav">
              <a onClick={() => setFilter("All")}>All Editions</a>
              <a onClick={() => document.querySelector('.sec-head')?.scrollIntoView({ behavior: 'smooth' })}>Collection</a>
              <a onClick={() => document.querySelector('.ftr')?.scrollIntoView({ behavior: 'smooth' })}>Print Quality</a>
            </nav>
            <button className="cartbtn" onClick={() => setDrawer(true)}>
              <ShoppingBag size={15} /> Cart {count > 0 && <span className="badge">{count}</span>}
            </button>
          </div>
        </header>

        <section className="hero">
          <div>
            <div className="kicker">Limited Editions · Archival</div>
            <h1 className="serif">The world,<br /><em>held still.</em></h1>
            <p className="lead">A curated house of limited fine-art editions — moments of motion, light and landscape, printed museum-grade and shipped to your wall.</p>
            <button className="hero-cta" onClick={() => document.querySelector('.sec-head')?.scrollIntoView({ behavior: 'smooth' })}>
              Browse the collection <ArrowRight size={16} />
            </button>
          </div>
          <div className="hero-r">
            <div className="spec"><div className="t serif">Archival pigment</div><div className="d">Museum-grade inks rated to last a century without fading.</div></div>
            <div className="spec"><div className="t serif">Numbered & signed</div><div className="d">Every print is part of a limited edition with a certificate.</div></div>
            <div className="spec"><div className="t serif">Made to order</div><div className="d">Printed by a premium lab and shipped within 5–7 days.</div></div>
          </div>
        </section>

        <div className="strip">
          <div className="strip-in">
            <span><b>✦</b> Free worldwide shipping over $250</span>
            <span><b>✦</b> 100-year archival guarantee</span>
            <span><b>✦</b> Metal · Acrylic · Canvas · Fine art paper</span>
            <span><b>✦</b> Hand-inspected before dispatch</span>
          </div>
        </div>

        <div className="sec-head">
          <h2 className="serif">The Collection</h2>
          <span className="kicker">{shots.length} editions</span>
        </div>

        <div className="filterbar">
          {cats.map(c => <button key={c} className={"pill" + (filter === c ? " on" : "")} onClick={() => setFilter(c)}>{c}</button>)}
        </div>

        {!products ? (
          <div className="loadwrap"><Loader size={26} className="spin" /><span>Loading the collection…</span></div>
        ) : (
          <main className="gallery">
            {shots.map((p, i) => (
              <div key={p.id} className="shot" style={{ animationDelay: `${i * 55}ms` }} onClick={() => setActive(p)}>
                <div className="frame">
                  {p.ed && <span className="edtag">{p.ed}</span>}
                  <div className="img" style={{ height: p.h, ...(p.image ? { backgroundImage: `url(${p.image})` } : { background: p.grad }) }} />
                </div>
                <div className="cap">
                  <div><div className="t">{p.title}</div><div className="loc">{p.loc}</div></div>
                  <div className="pr"><div className="from">from</div><div className="v">{usd(p.fromPrice)}</div></div>
                </div>
              </div>
            ))}
          </main>
        )}

        <footer className="ftr">
          <div className="ftr-in">
            <div>
              <div className="big serif">{BRAND}</div>
              <div className="tg">Limited fine-art editions of the natural world in motion. Printed museum-grade, made to order, shipped worldwide.</div>
            </div>
            <div><h5>Shop</h5><ul><li><a onClick={() => setFilter("All")}>All editions</a></li><li><a>Collections</a></li><li><a>New releases</a></li><li><a>Gift cards</a></li></ul></div>
            <div><h5>The Print</h5><ul><li><a>Print quality</a></li><li><a>Materials & sizes</a></li><li><a>Framing guide</a></li><li><a>Care & handling</a></li></ul></div>
            <div><h5>Support</h5><ul><li><a>Shipping & returns</a></li><li><a>Track an order</a></li><li><a>Contact</a></li><li><a>Trade & wholesale</a></li></ul></div>
          </div>
          <div className="ftr-base">
            <span>© {new Date().getFullYear()} {BRAND}. All rights reserved.</span>
            <span>Archival · Carbon-neutral shipping · Made to order</span>
          </div>
        </footer>
      </div>

      {active && <ProductModal product={active} onClose={() => setActive(null)} onAdd={addToCart} />}

      {drawer && (
        <div className="overlay" style={{ justifyContent: "flex-end", padding: 0 }} onClick={() => { setDrawer(false); setPlaced(false); }}>
          <div className="drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-h">
              <h3 className="serif">{placed ? "Order confirmed" : "Your cart"}</h3>
              <button className="closex" style={{ position: "static" }} onClick={() => { setDrawer(false); setPlaced(false); }}><X size={18} /></button>
            </div>
            {placed ? (
              <div className="drawer-body"><div className="empty">
                <div style={{ width: 62, height: 62, borderRadius: 99, background: "var(--accent)", display: "grid", placeItems: "center", margin: "0 auto 18px" }}><Check size={28} color="#fff" /></div>
                <span className="serif">Beautifully done.</span>
                <p>This is the demo confirmation. Once your Shopify domain + token are in CONFIG, Checkout sends customers to Shopify's secure checkout, and Prodigi prints and ships automatically.</p>
              </div></div>
            ) : cart.length === 0 ? (
              <div className="drawer-body"><div className="empty"><span className="serif">Your cart is empty</span><p>Browse the collection to begin.</p></div></div>
            ) : (
              <>
                <div className="drawer-body">
                  {cart.map(c => (
                    <div className="citem" key={c.key}>
                      <div className="th" style={c.image ? { backgroundImage: `url(${c.image})` } : { background: c.grad }} />
                      <div className="info">
                        <div className="nm">{c.title}</div>
                        <div className="sp">{c.spec}</div>
                        <div className="qty">
                          <button onClick={() => setQty(c.key, -1)}><Minus size={13} /></button>
                          <span>{c.qty}</span>
                          <button onClick={() => setQty(c.key, 1)}><Plus size={13} /></button>
                        </div>
                        <button className="rm" onClick={() => setQty(c.key, -c.qty)}>Remove</button>
                      </div>
                      <div className="pr">{usd(c.price * c.qty)}</div>
                    </div>
                  ))}
                </div>
                <div className="drawer-f">
                  <div className="subtotal"><span className="l">Subtotal</span><span className="v">{usd(subtotal)}</span></div>
                  <div className="ship">Shipping & tax calculated at checkout. Editions are made to order and fulfilled hands-off by the print lab.</div>
                  {err && <div className="note" style={{ color: "var(--accent)" }}>{err}</div>}
                  <button className="checkout" onClick={checkout} disabled={working}>
                    {working ? <><Loader size={15} className="spin" /> Starting checkout…</> : <>Checkout <ArrowRight size={16} /></>}
                  </button>
                  <div className="note">{LIVE ? "Secure checkout powered by Shopify." : "Demo checkout — fill CONFIG to take real orders."}</div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
