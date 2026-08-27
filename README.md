# SALI - Satoshi Annual Labor Index

SALI is an educational measurement tool that converts your annual salary into satoshis, showing whether your labor is gaining or losing real value when measured against Bitcoin.

## Running Locally

Use Node 20 for this project. If you use `nvm`, run:

```bash
nvm use
```

If you do not use `nvm`, update Node through your usual installer before building.

Install dependencies once:

```bash
cd /path/to/SALI
npm install
```

Start the local site:

```bash
npm run dev
```

Then open the local URL Astro prints in your browser, usually [http://localhost:4321](http://localhost:4321).

## Publishing Notes

Notes are plain Markdown files in `src/content/notes`.

Create a file like `src/content/notes/my-new-note.md`:

```md
---
title: "My New Note"
description: "A short preview for the archive and share cards."
date: 2026-05-03
tags: ["bitcoin", "labor"]
draft: false
---

Write whatever you want here.
```

That creates:

- `/notes` for the archive
- `/notes/my-new-note` for the post
- `/rss.xml` for RSS readers

Set `draft: true` when you want to keep a note out of the published site.

## Building and Deploying

Run a production build:

```bash
npm run build
```

Astro copies the existing static site into `public/`, builds the Markdown notes, and outputs the deployable site into `dist/`.

GitHub Actions deploys `dist/` automatically on every push to `main`. In GitHub, set **Settings > Pages > Build and deployment > Source** to **GitHub Actions**.

## Embedding into Webflow

1. **HTML Content**: Copy the HTML structure into Webflow Embed elements
2. **CSS**: Add `styles.css` content to your Webflow project's custom CSS (Site Settings > Custom Code > Head)
3. **JavaScript**: Add `app.js` content to page-level custom code (Page Settings > Custom Code > Before </body>)
4. **Chart.js**: Include the Chart.js CDN script before your custom JavaScript

## Data Notes

- **Annual Average BTC Prices** (`/data/btc_annual_average_usd.json`): Calendar-year arithmetic mean of daily closing prices. Source: StatMuse cross-referenced with CoinGecko / CoinMarketCap. Source attribution lives inside the JSON file under `_source`.
- **Benchmark Series** (`/data/sp500_annual.json`, `/data/gold_annual_avg_usd.json`, `/data/cpi_annual.json`): Sourced from Yahoo Finance / CNBC (S&P 500 year-end close), Kitco / LBMA London PM Fix (gold), and BLS CPI-U (CPI). Each file carries its own `_source` annotation.
- **Live BTC Spot Price**: Fetched at runtime from the Coinbase public API (`api.coinbase.com/v2/prices/BTC-USD/spot`). No API key required.
- **FX Rates**: Live USD-to-EUR/MXN rates are fetched at runtime from the European Central Bank via the Frankfurter API (`api.frankfurter.app`). The hardcoded values in `app.js` are fallbacks used only if the live fetch fails.

## Files

```
/
├── index.html          # Home page with SALI calculator
├── methodology.html    # How SALI works
├── examples.html       # Worked calculation examples
├── podcast.html        # Podcast information
├── contact.html        # Contact (mailto + social links)
├── privacy.html        # Privacy notes
├── astro.config.mjs    # Astro build config
├── package.json        # Astro scripts and dependencies
├── robots.txt          # Search engine directives
├── sitemap.xml         # Site map for SEO
├── CNAME               # GitHub Pages custom domain (sali.angarlo.com)
├── .nojekyll           # Disable Jekyll processing on GitHub Pages
├── README.md           # This file
├── /src
│   ├── /content
│   │   └── /notes      # Markdown posts / thoughts
│   ├── /layouts        # Astro note layout
│   └── /pages          # Notes archive, post pages, RSS
├── /assets
│   ├── /css
│   │   └── styles.css  # All styles
│   ├── /js
│   │   ├── app.js      # Calculator engine
│   │   └── theme.js    # Dark/light theme toggle
│   └── /images
│       └── sali-share.png  # OG / Twitter share card
└── /data
    ├── btc_annual_average_usd.json  # Historical BTC annual averages
    ├── sp500_annual.json            # S&P 500 year-end closes
    ├── gold_annual_avg_usd.json     # Gold annual averages (USD/oz)
    └── cpi_annual.json              # US CPI-U annual averages
```

## Companion Project

[The Whole Coin Standard](https://wcs.angarlo.com) is a sibling site, not part
of this one. It lives in `../WCS` and deploys separately, because SALI is a
measurement tool whose neutrality is what makes it citable and WCS is advocacy.

The only thing SALI carries is one footer line per page, `.footer__sibling`,
linking to it. If that link ever needs to change, it is in the footer block of
every `*.html` and `es/*.html` page.

## License

Educational use. Not financial advice.
