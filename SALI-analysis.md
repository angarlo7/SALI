# SALI Project Analysis

*Moved from Claude/3. To Do/Do this.md - originally generated in a prior session.*

## Project Overview
**SALI** (Satoshi Annual Labor Index) is an educational calculator that converts annual salaries into satoshis (the smallest Bitcoin unit) to help users measure whether their labor is gaining or losing real value when priced in Bitcoin terms.

## Technical Stack
- **Frontend**: Pure HTML/CSS/JavaScript (no framework dependencies)
- **Styling**: Dark theme inspired by ultrasound.money with slate background and cyan/orange accents
- **Charts**: Chart.js v4.4.1 for visualizations
- **Data**: Coinbase public API for live BTC spot prices + Frankfurter (ECB) for live FX + local JSON for historical annual averages and benchmark series
- **Server**: Python HTTP server for local development

## Project Structure
```
SALI/
├── index.html          # Main calculator page
├── methodology.html    # Explanation of how SALI works
├── examples.html       # Worked calculation examples
├── podcast.html        # Podcast information page
├── contact.html        # Contact form
├── robots.txt          # Search engine directives
├── sitemap.xml         # SEO sitemap
├── README.md
├── /assets
│   ├── /css
│   │   └── styles.css  # Complete dark theme styling (~1,852 lines)
│   ├── /js
│   │   ├── app.js      # Calculator engine (~2,071 lines)
│   │   └── theme.js    # Dark/light theme toggle
│   └── /images
│       └── sali-share.png  # OG / Twitter share card
└── /data
    ├── btc_annual_average_usd.json  # Historical BTC prices (2015-2025)
    ├── sp500_annual.json            # S&P 500 year-end closes
    ├── gold_annual_avg_usd.json     # Gold annual averages (USD/oz)
    └── cpi_annual.json              # US CPI-U annual averages
```

## Core Functionality Analysis

**Calculator Features:**
- Annual salary input with multi-currency support (USD, EUR, MXN)
- Three BTC price methods:
  - Live spot price from Coinbase public API
  - Annual average from historical data
  - Manual entry
- Salary growth rate projections
- BTC price growth rate assumptions
- Customizable start year (2015-present)
- Forecast horizon (1-30 years)
- Unit toggle between satoshis and BTC
- Interactive Chart.js visualization
- Detailed projection table showing year-by-year breakdown

**Key Metrics Displayed:**
- Current year SALI value (sats/year or BTC/year)
- SALI Trend Score (gaining/losing/neutral purchasing power)
- 10-year projected change
- Historical and projected data visualization

**Formula:**
```
SALI (sats/year) = (Annual Salary in USD ÷ BTC Price in USD) × 100,000,000
```

## Code Quality Assessment
✅ **Strengths:**
- Clean, well-documented code with clear function separation
- Responsive design with mobile breakpoints
- Proper error handling and validation
- Accessible color contrast in dark theme
- Professional UX with status messages and loading states
- Chart interactivity with tooltips and hover states

⚠️ **Known Placeholders (resolved 2026-04-27):**
- ~~FX rates (EUR, MXN to USD) are hardcoded placeholders~~ - Resolved: live ECB rates now fetched at runtime via Frankfurter API. Hardcoded values kept only as fallback.
- ~~BTC annual average data is documented as placeholder~~ - Resolved: values now sourced from StatMuse cross-referenced with CoinGecko / CoinMarketCap, with `_source` annotation in the JSON.
- ~~No live FX API integration yet~~ - Resolved: Frankfurter (ECB) integrated.

## Local Testing Status
✅ **Successfully Running:**
- Local server started at `http://localhost:8000`
- Server responds with HTTP 200
- All HTML pages accessible
- Calculator loads properly

**To test the calculator:**
1. Navigate to `http://localhost:8000`
2. Enter an annual salary (e.g., 75000)
3. Select currency and BTC price method
4. Adjust growth rates and forecast horizon
5. View SALI calculation, chart, and projections

## Git Repository Status
✅ **Repo:** https://github.com/angarlo7/SALI.git
**Branch:** `main` (clean working tree as of 2026-04-27)
**Last commit:** `4b0ddd9 - fix: og:image with visible grade letters, clean labels`
**Custom domain:** `sali.angarlo.com` (GitHub Pages, via `CNAME` + `.nojekyll`)

✅ **Earlier uncommitted-changes block (2026-03-22) - resolved.** All prior modifications to `styles.css` and `app.js` have since been committed; `wireframe-mobile.html` and `.claude/` are now in `.gitignore`.

## Running Locally (Quick Start)
```bash
cd /Users/Luis/Documents/Claude/Obsidian\ LAGL/Claude/4.Projects/SALI
python3 -m http.server 8000
```
Then open http://localhost:8000 in your browser.

## Recommendations for Future Improvements
1. **API Integration**: Replace hardcoded FX rates with live currency conversion API
2. **Data Updates**: Update BTC annual averages with actual historical data (currently using estimates)
3. **Features**:
   - Export chart/table as image or PDF
   - Save calculations locally (localStorage)
   - Compare multiple scenarios side-by-side
   - Historical inflation data overlay
4. **Deployment**: Consider deploying to Webflow as documented in README
5. **Analytics**: Add privacy-respecting analytics to understand user engagement

## Files Summary (refreshed 2026-04-27)
- **index.html**: 454 lines - Main calculator interface with form inputs, multi-benchmark normalized chart, break-even calc, historical reconstruction, and share card
- **app.js**: 2,071 lines - Calculator engine, FX (ECB/Frankfurter), BTC spot (Coinbase), four-benchmark comparison (BTC, S&P 500, Gold, CPI), projections, SALI Grade badge, share-to-X
- **styles.css**: 1,852 lines - Professional dark theme with responsive design (light/dark toggle is JS-driven via `theme.js`; no `prefers-color-scheme` media query yet)
- **btc_annual_average_usd.json**: ~12 lines - Historical BTC price data (2015-2025) with `_source` attribution
