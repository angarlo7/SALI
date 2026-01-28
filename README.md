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

- **Annual Average BTC Prices** (`/data/btc_annual_average_usd.json`): These are placeholder values for demonstration. Replace with actual historical annual average prices for production use.
- **FX Rates**: Currency conversion rates (EUR, MXN to USD) are hardcoded placeholders in `app.js`. Update these for accurate conversions or integrate a live FX API.

## Files

```
/
├── index.html          # Home page with SALI calculator
├── methodology.html    # How SALI works
├── examples.html       # Worked calculation examples
├── podcast.html        # Podcast information
├── contact.html        # Contact form
├── robots.txt          # Search engine directives
├── sitemap.xml         # Site map for SEO
├── README.md           # This file
├── /assets
│   ├── /css
│   │   └── styles.css  # All styles
│   ├── /js
│   │   └── app.js      # Calculator logic
│   └── /img            # Images (optional)
└── /data
    └── btc_annual_average_usd.json  # Historical BTC prices
```

## License

Educational use. Not financial advice.
