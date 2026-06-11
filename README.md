# Meridian Editions — Website

A ready-to-deploy Vite + React storefront (headless Shopify).

## Deploy to Vercel (recommended)
1. Put this folder in a GitHub repo (github.com → New repository → upload these files).
2. Go to vercel.com → "Add New Project" → import the repo.
3. Vercel auto-detects Vite. Click Deploy. You'll get a live *.vercel.app URL.
4. In Vercel → Settings → Domains → add `meridianeditions.co`.
5. Vercel shows DNS records → paste them into Namecheap (Domain → Advanced DNS).

## Go live (turn off demo mode)
Open `src/App.jsx`, fill in the CONFIG block near the top:
- SHOPIFY_DOMAIN  → your-store.myshopify.com
- STOREFRONT_TOKEN → Shopify Storefront API access token
Save, commit, and Vercel redeploys automatically. The site then pulls real
products from Shopify and checkout hands off to Shopify's secure payment page.

## Run locally (optional)
npm install
npm run dev
