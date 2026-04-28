# SALI - Satoshi Annual Labor Index

SALI is an educational measurement tool that converts your annual salary into satoshis, showing whether your labor is gaining or losing real value when measured against Bitcoin.

## Running Locally

Start a simple local server from the project directory:

```bash
cd /path/to/SALI
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000) in your browser.

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
├── robots.txt          # Search engine directives
├── sitemap.xml         # Site map for SEO
├── CNAME               # GitHub Pages custom domain (sali.angarlo.com)
├── .nojekyll           # Disable Jekyll processing on GitHub Pages
├── README.md           # This file
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

## License

Educational use. Not financial advice.
