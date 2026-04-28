/**
 * SALI - Satoshi Annual Labor Index
 * Calculator Engine
 *
 * Formula: SALI (sats/year) = (AnnualSalaryFiat / BitcoinPriceFiat) * 100,000,000
 */

(function() {
  'use strict';

  // Constants
  const SATS_PER_BTC = 100000000;
  const DEFAULT_START_YEAR = 2020;
  const DEFAULT_FORECAST_YEARS = 5;
  const DEFAULT_SALARY_GROWTH = 3.5;
  const DEFAULT_BTC_GROWTH = 5;
  const BTC_GROWTH_MODES = { CUSTOM: 'custom', HISTORICAL: 'historical', FIVE_YEAR: '5y' };
  const CURRENT_YEAR = new Date().getFullYear();

  // Historical benchmark data for multi-benchmark comparison
  const BENCHMARK_DATA = {
    spx: {
      name: 'S&P 500', unit: 'S&P units/yr', unitShort: 'S&P units',
      defaultGrowth: 10,
      annual: {
        // Year-end closing prices (Dec 31) — must match sp500_annual.json exactly
        2015: 2043, 2016: 2239, 2017: 2674, 2018: 2507, 2019: 3231,
        2020: 3756, 2021: 4766, 2022: 3840, 2023: 4770, 2024: 5881, 2025: 6846
      },
      format: v => v.toFixed(3)
    },
    gold: {
      name: 'Gold', unit: 'oz Au/yr', unitShort: 'oz Au',
      defaultGrowth: 5,
      annual: {
        2015: 1160, 2016: 1251, 2017: 1257, 2018: 1268, 2019: 1393,
        2020: 1770, 2021: 1799, 2022: 1800, 2023: 1943, 2024: 2395, 2025: 3446
      },
      format: v => v.toFixed(2)
    },
    cpi: {
      name: 'Real (CPI)', unit: 'real $ (2015 base)', unitShort: 'real $',
      defaultGrowth: 3,
      // US CPI-U annual average (BLS, 1982-84 = 100)
      annual: {
        2015: 237.0, 2016: 240.0, 2017: 245.1, 2018: 251.1, 2019: 255.7,
        2020: 258.8, 2021: 270.9, 2022: 292.7, 2023: 304.7, 2024: 314.2, 2025: 321.9
      },
      format: v => '$' + Math.round(v).toLocaleString('en-US')
    }
  };

  // FX rates to USD — updated at init via fetchFxRates() (ECB/Frankfurter).
  // These fallback values are used only if the live fetch fails.
  const FX_RATES = {
    USD: 1,
    EUR: 1.08,  // fallback: 1 EUR ≈ 1.08 USD
    MXN: 0.058  // fallback: 1 MXN ≈ 0.058 USD
  };

  // State
  let spotPrice = null;
  let annualAverages = null;
  let chartInstance = null;
  let normalizedChartInstance = null;
  let benchmarkChartInstance = null;
  let sp500JsonData = null;
  let goldJsonData = null;
  let cpiJsonData = null;
  let displayUnit = 'sats'; // 'sats' or 'btc'
  let salaryGrowthMode = 'nominal'; // 'nominal' or 'real'
  let btcGrowthMode = BTC_GROWTH_MODES.CUSTOM; // 'custom', 'historical', '5y'
  let customBtcGrowth = DEFAULT_BTC_GROWTH;    // last value the user typed in Custom mode
  let btcCagrCache = null;                     // { historical: number, fiveYear: number, historicalSpan: [yA,yB], fiveYearSpan: [yA,yB] }
  let activeBenchmark = 'btc';     // 'btc', 'spx', 'gold', 'cpi'
  let benchmarkGrowthOverride = null; // null = use benchmark default
  let showBreakdown = false;
  let initComputeComplete = false;   // true after the first auto-compute on page load
  let hasInitialUrlParams = false;   // true if the page was loaded with meaningful URL params

  // DOM Elements (cached after DOMContentLoaded)
  let elements = {};

  /**
   * Format currency with proper symbol and separators
   */
  function formatCurrency(amount, currency) {
    const symbols = { USD: '$', EUR: '€', MXN: '$' };
    const symbol = symbols[currency] || '$';
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
    return `${symbol}${formatted} ${currency}`;
  }

  /**
   * Format USD currency for BTC price display
   */
  function formatUsdCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  /**
   * Format satoshis as integer with commas
   */
  function formatSats(sats) {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.round(sats));
  }

  /**
   * Format BTC with appropriate decimal places
   */
  function formatBtc(btc, decimals = 6) {
    return btc.toFixed(decimals) + ' BTC';
  }

  /**
   * Format percent with sign and 2 decimals
   */
  function formatPercent(pct) {
    const sign = pct >= 0 ? '+' : '';
    return sign + pct.toFixed(2) + '%';
  }

  /**
   * Update purchasing power equivalents display
   */
  function updateEquivalents(sats, btcEquivalent) {
    if (!elements.equivalentsGrid) return;
    if (!sats || isNaN(sats) || sats <= 0) {
      elements.equivalentsGrid.style.display = 'none';
      return;
    }
    const satsPerDay = sats / 260;   // 260 working days (matches 2080-hour basis)
    const satsPerHour = sats / 2080; // 40 hrs/week × 52 weeks
    const pctOfBtc = btcEquivalent * 100;
    if (elements.equivSatsDay) elements.equivSatsDay.textContent = formatSats(satsPerDay);
    if (elements.equivSatsHour) elements.equivSatsHour.textContent = formatSats(satsPerHour);
    if (elements.equivPctBtc) elements.equivPctBtc.textContent = pctOfBtc.toFixed(4) + '%';
    elements.equivalentsGrid.style.display = 'grid';
  }

  /**
   * Convert salary to USD
   */
  function convertToUsd(amount, currency) {
    const rate = FX_RATES[currency];
    if (!rate) {
      throw new Error(`Unknown currency: ${currency}`);
    }
    return amount * rate;
  }

  /**
   * Calculate SALI in sats
   */
  function calculateSali(salaryUsd, btcPriceUsd) {
    if (btcPriceUsd <= 0) {
      throw new Error('BTC price must be greater than zero');
    }
    const btcEquivalent = salaryUsd / btcPriceUsd;
    const sats = btcEquivalent * SATS_PER_BTC;
    return { sats, btcEquivalent };
  }

  /**
   * Generate projection data with actual years
   */
  function generateProjections(salaryUsd, baseBtcPrice, salaryGrowth, btcGrowth, startYear, forecastYears) {
    const projections = [];
    const endYear = CURRENT_YEAR + forecastYears;

    for (let year = startYear; year <= endYear; year++) {
      // Salary is anchored to CURRENT_YEAR — the entered value is today's salary.
      // Past years are back-calculated (deflated) and future years grow forward.
      const yearsFromCurrent = year - CURRENT_YEAR;
      const salaryYear = salaryUsd * Math.pow(1 + salaryGrowth / 100, yearsFromCurrent);

      // BTC price: use historical annual average if available, otherwise use
      // baseBtcPrice (the user's selected method) anchored at CURRENT_YEAR.
      let btcPriceYear;
      if (annualAverages && annualAverages[year]) {
        btcPriceYear = annualAverages[year];
      } else {
        // Current year uses baseBtcPrice directly (spot, annual avg, or manual).
        // Future years project forward from baseBtcPrice.
        const yearsFromCurrent = year - CURRENT_YEAR;
        btcPriceYear = baseBtcPrice * Math.pow(1 + btcGrowth / 100, yearsFromCurrent);
      }

      const { sats, btcEquivalent } = calculateSali(salaryYear, btcPriceYear);

      projections.push({
        year,
        salary: salaryYear,
        btcPrice: btcPriceYear,
        sats,
        btcEquivalent,
        isHistorical: annualAverages && annualAverages[year] !== undefined,
        isCurrentYear: year === CURRENT_YEAR
      });
    }

    return projections;
  }

  /**
   * Calculate SALI trend score
   * Compares current year SALI to historical trend
   */
  function calculateTrendScore(projections) {
    if (projections.length < 2) {
      return { score: null, trend: 'neutral', description: 'Not enough data' };
    }

    // Find current year and first year data
    const currentYearData = projections.find(p => p.year === CURRENT_YEAR);
    const firstYearData = projections[0];
    const lastYearData = projections[projections.length - 1];

    if (!currentYearData || !firstYearData) {
      return { score: null, trend: 'neutral', description: 'Not enough data' };
    }

    // Calculate overall change from start to current
    const historicalChange = ((currentYearData.sats - firstYearData.sats) / firstYearData.sats) * 100;

    // Calculate projected change from current to end
    const projectedChange = ((lastYearData.sats - currentYearData.sats) / currentYearData.sats) * 100;

    // Determine trend based on projected change
    let trend, description;
    if (projectedChange > 10) {
      trend = 'gaining';
      description = 'At these assumptions, your salary is outpacing BTC appreciation';
    } else if (projectedChange < -10) {
      trend = 'losing';
      description = 'At these assumptions, BTC is appreciating faster than your salary';
    } else {
      trend = 'neutral';
      description = 'At these assumptions, your salary and BTC are appreciating at roughly the same rate';
    }

    return {
      score: projectedChange,
      trend,
      description,
      historicalChange
    };
  }

  /**
   * Generate benchmark series (S&P 500, Gold, CPI) aligned to projections
   */
  function generateBenchmarkSeries(projections, benchmark, growthRate) {
    const bData = BENCHMARK_DATA[benchmark];
    if (!bData) return projections;

    const rate = (growthRate !== null && growthRate !== undefined) ? growthRate : bData.defaultGrowth;
    const annualYears = Object.keys(bData.annual).map(Number).sort((a, b) => b - a);
    const anchorYear = annualYears[0];
    const anchorPrice = bData.annual[anchorYear];
    const cpiBase = benchmark === 'cpi' ? bData.annual[2015] : null;

    return projections.map(p => {
      let benchPrice;
      if (bData.annual[p.year]) {
        benchPrice = bData.annual[p.year];
      } else {
        const yrs = p.year - anchorYear;
        benchPrice = anchorPrice * Math.pow(1 + rate / 100, yrs);
      }

      let benchValue;
      if (benchmark === 'cpi') {
        benchValue = p.salary / (benchPrice / cpiBase);
      } else {
        benchValue = p.salary / benchPrice;
      }

      return {
        ...p,
        benchPrice,
        benchValue,
        isHistorical: bData.annual[p.year] !== undefined
      };
    });
  }

  /**
   * Update decomposition summary callout
   */
  function updateDecompSummary(projections) {
    const el = elements.decompSummary;
    if (!el) return;

    const currentIdx = projections.findIndex(p => p.isCurrentYear);
    const first = projections[0];
    const current = currentIdx >= 0 ? projections[currentIdx] : null;

    if (!current || !first || first === current) {
      el.style.display = 'none';
      return;
    }

    const totalSaliChange = ((current.sats - first.sats) / first.sats) * 100;
    const salaryCumulative = (current.salary / first.salary - 1) * 100;
    const btcCumulative = -(current.btcPrice / first.btcPrice - 1) * 100;

    const sign = v => v >= 0 ? '+' : '';
    const fmt = v => sign(v) + v.toFixed(1) + '%';
    const salaryColor = salaryCumulative >= 0 ? '#16a34a' : '#dc2626';
    const btcColor = btcCumulative >= 0 ? '#16a34a' : '#dc2626';
    const totalColor = totalSaliChange >= 0 ? '#16a34a' : '#dc2626';

    el.innerHTML =
      `SALI changed <strong style="color:${totalColor}">${fmt(totalSaliChange)}</strong> since ${first.year}: ` +
      `salary <strong style="color:${salaryColor}">${fmt(salaryCumulative)}</strong> (positive) · ` +
      `BTC <strong style="color:${btcColor}">${fmt(btcCumulative)}</strong> impact`;
    el.style.display = 'block';
  }

  /**
   * Compute SALI grade based on annualized historical SALI decay rate (CAGR).
   * Returns grade (S/A/B/C/D/F), annual rate %, gap %, tagline.
   */
  function computeSaliGrade(projections, btcGrowth, nominalSalaryGrowth) {
    const first = projections[0];
    const current = projections.find(p => p.isCurrentYear);
    if (!first || !current || first.year === current.year) return null;

    const years = current.year - first.year;
    if (years < 1) return null;

    // Annualized SALI change using actual historical BTC prices (CAGR)
    const annualRate = (Math.pow(current.sats / first.sats, 1 / years) - 1) * 100;

    // How many more %/yr of salary growth are needed to keep SALI flat
    const gap = btcGrowth - nominalSalaryGrowth;

    let grade, tagline, colorClass;
    if (annualRate >= 0)         { grade = 'S'; tagline = 'Keeping pace with Bitcoin — extremely rare'; colorClass = 'sali-score__grade--S'; }
    else if (annualRate >= -10)  { grade = 'A'; tagline = 'Near-parity with Bitcoin appreciation'; colorClass = 'sali-score__grade--A'; }
    else if (annualRate >= -20)  { grade = 'B'; tagline = 'Above average — losing ground slowly'; colorClass = 'sali-score__grade--B'; }
    else if (annualRate >= -35)  { grade = 'C'; tagline = 'Typical salary trajectory vs Bitcoin'; colorClass = 'sali-score__grade--C'; }
    else if (annualRate >= -50)  { grade = 'D'; tagline = 'Bitcoin outpacing your salary significantly'; colorClass = 'sali-score__grade--D'; }
    else                         { grade = 'F'; tagline = 'Bitcoin is winning by a wide margin'; colorClass = 'sali-score__grade--F'; }

    return { grade, annualRate, gap, tagline, colorClass };
  }

  /**
   * Render the SALI score badge in the outputs panel
   */
  function updateSaliScore(gradeData) {
    const wrap = elements.saliScoreWrap;
    if (!wrap) return;
    if (!gradeData) { wrap.style.display = 'none'; return; }

    const { grade, annualRate, gap, tagline, colorClass } = gradeData;

    if (elements.saliScoreGrade) {
      elements.saliScoreGrade.textContent = grade;
      elements.saliScoreGrade.className = `sali-score__grade ${colorClass}`;
    }
    if (elements.saliScoreRate) {
      const sign = annualRate >= 0 ? '+' : '';
      elements.saliScoreRate.textContent =
        `${sign}${annualRate.toFixed(1)}% / yr Bitcoin purchasing power`;
    }
    if (elements.saliScoreGap) {
      if (gap > 0.1) {
        elements.saliScoreGap.textContent =
          `Need +${gap.toFixed(1)}%/yr more salary growth to keep pace`;
      } else if (gap < -0.1) {
        elements.saliScoreGap.textContent =
          `Outpacing Bitcoin by ${Math.abs(gap).toFixed(1)}%/yr`;
      } else {
        elements.saliScoreGap.textContent = 'At break-even with Bitcoin';
      }
    }
    if (elements.saliScoreTagline) {
      elements.saliScoreTagline.textContent = tagline;
    }

    wrap.style.display = 'block';
  }

  /**
   * Build and set the "Post on X" href — shares grade and insights, never salary or sats
   */
  function updateTweetLink(gradeData) {
    if (!elements.tweetSaliBtn) return;

    let text;
    if (gradeData) {
      const { grade, annualRate, gap } = gradeData;
      const rateStr = annualRate >= 0 ? `+${annualRate.toFixed(1)}%/yr` : `${annualRate.toFixed(1)}%/yr`;

      let hook;
      if (annualRate >= 0) {
        hook = `my salary is actually keeping pace with Bitcoin (${rateStr}). Extremely rare.`;
      } else if (gap > 0.1) {
        hook = `my salary loses ${rateStr} to Bitcoin every year. I'd need a +${gap.toFixed(1)}%/yr raise just to break even.`;
      } else {
        hook = `my salary is right at Bitcoin break-even (${rateStr}). Holding the line.`;
      }

      text = `🟠 SALI Grade: ${grade} — ${hook}\n\nWhat’s your grade? #Bitcoin #SALI`;
    } else {
      text = `🟠 How much is your salary worth in Bitcoin?\n\nCalculate your SALI Grade → #Bitcoin #SALI`;
    }

    const url = 'https://sali.angarlo.com';
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    elements.tweetSaliBtn.href = tweetUrl;
  }

  /**
   * Generate and download a share card PNG — dark medal design
   */
  function generateShareCard() {
    const W = 1200, H = 628, DPR = 2;
    const canvas = document.createElement('canvas');
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    const ctx = canvas.getContext('2d');
    ctx.scale(DPR, DPR);

    const orange = '#F7931A';
    const bgColor = '#0d0d0d';
    const white = '#ffffff';
    const muted = '#888888';
    const font = '"Roboto Mono", "Courier New", monospace';

    // Grade data — read from live DOM
    const gradeEl   = elements.saliScoreGrade;
    const rateEl    = elements.saliScoreRate;
    const gapEl     = elements.saliScoreGap;
    const tagEl     = elements.saliScoreTagline;
    const gradeText   = gradeEl ? gradeEl.textContent.trim() : '—';
    const rateText    = rateEl  ? rateEl.textContent.trim()  : '—';
    const gapText     = gapEl   ? gapEl.textContent.trim()   : '—';
    const taglineText = tagEl   ? tagEl.textContent.trim()   : '';

    const gradeColors = { S:'#F7931A', A:'#16a34a', B:'#65a30d', C:'#ca8a04', D:'#ea580c', F:'#dc2626' };
    const gradeColor  = gradeColors[gradeText] || orange;

    // ── Background ──────────────────────────────────────────
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, W, H);

    // Top orange stripe
    ctx.fillStyle = orange;
    ctx.fillRect(0, 0, W, 8);

    // ── Header label ────────────────────────────────────────
    ctx.fillStyle = orange;
    ctx.font = `600 13px ${font}`;
    ctx.textAlign = 'center';
    ctx.fillText('S A T O S H I   A N N U A L   L A B O R   I N D E X', W / 2, 46);

    // ── Medal circle ────────────────────────────────────────
    const cx = W / 2, cy = 278, R = 150;

    // Radial glow behind circle
    const glow = ctx.createRadialGradient(cx, cy, R * 0.3, cx, cy, R * 1.8);
    glow.addColorStop(0, gradeColor + '28');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Circle fill
    ctx.fillStyle = gradeColor + '18';
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();

    // Circle ring
    ctx.strokeStyle = gradeColor;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();

    // Grade letter — centered in circle
    ctx.fillStyle = gradeColor;
    ctx.font = `700 200px ${font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(gradeText, cx, cy + 10);
    ctx.textBaseline = 'alphabetic';

    // ── Below medal ─────────────────────────────────────────
    const belowR = cy + R;

    // "SALI GRADE" micro-label
    ctx.fillStyle = muted;
    ctx.font = `500 12px ${font}`;
    ctx.textAlign = 'center';
    ctx.fillText('S A L I   G R A D E', cx, belowR + 26);

    // Tagline
    ctx.fillStyle = white;
    ctx.font = `400 17px ${font}`;
    ctx.fillText(taglineText, cx, belowR + 54);

    // Stats — rate · gap
    const rateClean = rateText.replace(' Bitcoin purchasing power', '');
    const gapClean  = gapText
      .replace('Need ', '')
      .replace(' more salary growth to keep pace', '')
      .replace('Outpacing Bitcoin by ', '+')
      .replace('At break-even with Bitcoin', '= break-even');
    ctx.fillStyle = muted;
    ctx.font = `500 13px ${font}`;
    ctx.fillText(`${rateClean}   ·   ${gapClean}`, cx, belowR + 82);

    // ── Footer ──────────────────────────────────────────────
    // Divider
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(60, H - 72);
    ctx.lineTo(W - 60, H - 72);
    ctx.stroke();

    ctx.fillStyle = orange;
    ctx.font = `700 15px ${font}`;
    ctx.textAlign = 'left';
    ctx.fillText('SALI.ANGARLO.COM', 60, H - 40);

    ctx.fillStyle = muted;
    ctx.font = `400 12px ${font}`;
    ctx.textAlign = 'right';
    ctx.fillText('Not financial advice.', W - 60, H - 40);

    // ── Download ────────────────────────────────────────────
    canvas.toBlob(blob => {
      const dlUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = dlUrl;
      a.download = `sali-grade-${gradeText}-${CURRENT_YEAR}.png`;
      a.click();
      URL.revokeObjectURL(dlUrl);
    }, 'image/png');

    // ── Clipboard: punchy text + URL ─────────────────────────
    const shareUrl = 'https://sali.angarlo.com';
    const textSummary = `🟠 SALI Grade: ${gradeText} | ${rateClean} | ${gapClean}\n${shareUrl}`;
    navigator.clipboard.writeText(textSummary).catch(() => {});

    if (elements.shareSaliBtn) {
      const original = elements.shareSaliBtn.textContent;
      elements.shareSaliBtn.textContent = '✓ Card & Link Copied';
      setTimeout(() => { elements.shareSaliBtn.textContent = original; }, 2500);
    }
  }

  /**
   * Fetch live FX rates from Frankfurter (ECB-sourced, free, no API key)
   * Updates FX_RATES in place and refreshes the warning banner text.
   */
  async function fetchFxRates() {
    try {
      const response = await fetch(
        'https://api.frankfurter.app/latest?from=USD&to=EUR,MXN'
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      // Frankfurter gives USD→EUR and USD→MXN; we need the inverse (per-unit-to-USD)
      if (data.rates && data.rates.EUR) FX_RATES.EUR = 1 / data.rates.EUR;
      if (data.rates && data.rates.MXN) FX_RATES.MXN = 1 / data.rates.MXN;
      // Update warning banner with live values
      if (elements.fxWarning) {
        elements.fxWarning.textContent =
          `Live FX rates (ECB, ${data.date}): 1 EUR ≈ ${FX_RATES.EUR.toFixed(4)} USD · 1 MXN ≈ ${FX_RATES.MXN.toFixed(5)} USD`;
      }
    } catch (error) {
      console.warn('FX rate fetch failed, using fallback rates:', error);
      // Leave FX_RATES at their hardcoded fallback values — warning text stays as-is
    }
  }

  /**
   * Fetch spot price from Coinbase (free, no API key, no rate limit)
   */
  async function fetchSpotPrice() {
    try {
      const response = await fetch(
        'https://api.coinbase.com/v2/prices/BTC-USD/spot'
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data.data || !data.data.amount) {
        throw new Error('Invalid response format');
      }

      spotPrice = parseFloat(data.data.amount);
      return spotPrice;
    } catch (error) {
      console.error('Failed to fetch spot price:', error);
      setStatus(`Unable to fetch live BTC price. Using Manual mode or try again later.`, 'error');
      return null;
    }
  }

  /**
   * Load annual averages from JSON file
   */
  async function loadAnnualAverages() {
    try {
      const response = await fetch('/data/btc_annual_average_usd.json');

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const raw = await response.json();
      // Strip metadata keys (e.g. "_source") — keep only integer year keys
      annualAverages = Object.fromEntries(
        Object.entries(raw).filter(([k]) => /^\d{4}$/.test(k))
      );
      return annualAverages;
    } catch (error) {
      console.error('Failed to load annual averages:', error);
      setStatus('Unable to load annual average data.', 'error');
      return null;
    }
  }

  /**
   * Load benchmark comparison JSON data (S&P 500, Gold, CPI)
   */
  async function loadBenchmarkJsonData() {
    try {
      const [sp500Resp, goldResp, cpiResp] = await Promise.all([
        fetch('/data/sp500_annual.json'),
        fetch('/data/gold_annual_avg_usd.json'),
        fetch('/data/cpi_annual.json')
      ]);
      if (sp500Resp.ok) sp500JsonData = await sp500Resp.json();
      if (goldResp.ok)  goldJsonData  = await goldResp.json();
      if (cpiResp.ok)   cpiJsonData   = await cpiResp.json();

      // Sync JSON data into BENCHMARK_DATA so the benchmark calculator
      // always uses the same values as the normalized comparison chart.
      if (sp500JsonData) {
        Object.keys(sp500JsonData).forEach(y => {
          if (!isNaN(Number(y))) BENCHMARK_DATA.spx.annual[y] = sp500JsonData[y];
        });
      }
      if (goldJsonData) {
        Object.keys(goldJsonData).forEach(y => {
          if (!isNaN(Number(y))) BENCHMARK_DATA.gold.annual[y] = goldJsonData[y];
        });
      }
      if (cpiJsonData) {
        Object.keys(cpiJsonData).forEach(y => {
          if (!isNaN(Number(y))) BENCHMARK_DATA.cpi.annual[y] = cpiJsonData[y];
        });
      }
    } catch (error) {
      console.error('Failed to load benchmark JSON data:', error);
    }
  }

  /**
   * Compute BTC CAGR (compound annual growth rate) from the loaded annual averages.
   * Returns { historical, fiveYear, historicalSpan, fiveYearSpan } as percentages.
   * Returns null if not enough data (need at least 2 years).
   *
   * Math: CAGR = (endPrice / startPrice)^(1 / years) - 1
   */
  function computeBtcCagrs() {
    if (!annualAverages) return null;
    const years = Object.keys(annualAverages).map(Number).sort((a, b) => a - b);
    if (years.length < 2) return null;

    const earliest = years[0];
    const latest = years[years.length - 1];
    const earliestPrice = annualAverages[earliest];
    const latestPrice = annualAverages[latest];

    // Historical CAGR: full available span
    const historicalYears = latest - earliest;
    const historical = historicalYears > 0
      ? (Math.pow(latestPrice / earliestPrice, 1 / historicalYears) - 1) * 100
      : null;

    // 5-year CAGR: latest minus 5, falling back to earliest if data shorter
    const fiveStartTarget = latest - 5;
    const fiveStart = fiveStartTarget >= earliest ? fiveStartTarget : earliest;
    const fiveStartPrice = annualAverages[fiveStart];
    const fiveYears = latest - fiveStart;
    const fiveYear = (fiveYears > 0 && fiveStartPrice)
      ? (Math.pow(latestPrice / fiveStartPrice, 1 / fiveYears) - 1) * 100
      : null;

    return {
      historical,
      fiveYear,
      historicalSpan: [earliest, latest],
      fiveYearSpan: [fiveStart, latest]
    };
  }

  /**
   * Compute trailing CPI CAGR (compound annual growth rate) from cpi_annual.json.
   * Returns { cagr, span: [startYear, endYear] } as a percentage, or null if
   * not enough data. Default is trailing 3 years; falls back to whatever data
   * is available if the file has fewer years.
   */
  function computeTrailingCpi(yearsBack = 3) {
    if (!cpiJsonData) return null;
    const years = Object.keys(cpiJsonData).map(Number).filter(n => !isNaN(n)).sort((a, b) => a - b);
    if (years.length < 2) return null;

    const latest = years[years.length - 1];
    const startTarget = latest - yearsBack;
    const start = startTarget >= years[0] ? startTarget : years[0];
    const span = latest - start;
    if (span <= 0) return null;

    const startVal = cpiJsonData[start];
    const latestVal = cpiJsonData[latest];
    if (!startVal || !latestVal) return null;

    const cagr = (Math.pow(latestVal / startVal, 1 / span) - 1) * 100;
    return { cagr, span: [start, latest] };
  }

  /**
   * Update the Historical / 5-Year mode-toggle button labels with the
   * actual CAGR values. Called once after annual averages load.
   */
  function updateBtcGrowthButtonLabels() {
    if (!btcCagrCache) return;
    if (elements.btcHistoricalModeBtn && btcCagrCache.historical !== null) {
      const [a, b] = btcCagrCache.historicalSpan;
      elements.btcHistoricalModeBtn.textContent = `Historical CAGR (${btcCagrCache.historical.toFixed(1)}%)`;
      elements.btcHistoricalModeBtn.title = `${a}–${b} compound annual growth rate of BTC annual averages.`;
    }
    if (elements.btc5yModeBtn && btcCagrCache.fiveYear !== null) {
      const [a, b] = btcCagrCache.fiveYearSpan;
      elements.btc5yModeBtn.textContent = `5-Year CAGR (${btcCagrCache.fiveYear.toFixed(1)}%)`;
      elements.btc5yModeBtn.title = `${a}–${b} compound annual growth rate of BTC annual averages.`;
    }
  }

  /**
   * Switch the BTC growth-rate mode (custom / historical / 5y) and reflect
   * the change in the input value, readonly state, and active-button class.
   * - Custom: input is editable and shows the user's last custom value.
   * - Historical / 5y: input is read-only and shows the computed CAGR.
   * Always re-runs compute() at the end so the calculator reflects the new value.
   */
  function setBtcGrowthMode(mode) {
    if (!elements.btcGrowthInput) return;

    // Preserve the user's last custom value before switching away from Custom
    if (btcGrowthMode === BTC_GROWTH_MODES.CUSTOM) {
      const v = parseFloat(elements.btcGrowthInput.value);
      if (!isNaN(v)) customBtcGrowth = v;
    }

    btcGrowthMode = mode;

    // Active-button class
    if (elements.btcCustomModeBtn)     elements.btcCustomModeBtn.classList.toggle('mode-btn--active',     mode === BTC_GROWTH_MODES.CUSTOM);
    if (elements.btcHistoricalModeBtn) elements.btcHistoricalModeBtn.classList.toggle('mode-btn--active', mode === BTC_GROWTH_MODES.HISTORICAL);
    if (elements.btc5yModeBtn)         elements.btc5yModeBtn.classList.toggle('mode-btn--active',         mode === BTC_GROWTH_MODES.FIVE_YEAR);

    // Input value & readonly
    if (mode === BTC_GROWTH_MODES.CUSTOM) {
      elements.btcGrowthInput.removeAttribute('readonly');
      elements.btcGrowthInput.value = customBtcGrowth;
    } else {
      elements.btcGrowthInput.setAttribute('readonly', 'readonly');
      if (btcCagrCache) {
        const value = mode === BTC_GROWTH_MODES.HISTORICAL ? btcCagrCache.historical : btcCagrCache.fiveYear;
        if (value !== null) elements.btcGrowthInput.value = value.toFixed(1);
      }
    }

    compute();
  }

  /**
   * Get most recent year from annual averages
   */
  function getMostRecentAverageYear() {
    if (!annualAverages) return null;

    const years = Object.keys(annualAverages)
      .map(Number)
      .sort((a, b) => b - a);

    return years[0] || null;
  }

  /**
   * Get BTC price based on selected method
   */
  function getBtcPrice() {
    const method = elements.btcPriceMethodSelect.value;

    switch (method) {
      case 'spot':
        if (spotPrice === null) {
          throw new Error('Spot price not available. Try Manual mode.');
        }
        return spotPrice;

      case 'annual':
        if (!annualAverages) {
          throw new Error('Annual average data not loaded.');
        }
        const recentYear = getMostRecentAverageYear();
        if (!recentYear) {
          throw new Error('No annual average data available.');
        }
        return annualAverages[recentYear];

      case 'manual':
        const manualPrice = parseFloat(elements.btcPriceManualInput.value);
        if (isNaN(manualPrice) || manualPrice <= 0) {
          throw new Error('Please enter a valid BTC price.');
        }
        return manualPrice;

      default:
        throw new Error('Unknown price method.');
    }
  }

  /**
   * Show/hide FX warning when a non-USD currency is selected
   */
  function updateFxWarning() {
    if (!elements.fxWarning) return;
    const isNonUsd = elements.currencySelect.value !== 'USD';
    elements.fxWarning.classList.toggle('fx-warning--hidden', !isNonUsd);
  }

  /**
   * Update BTC price display
   */
  function updateBtcPriceDisplay() {
    const method = elements.btcPriceMethodSelect.value;
    let displayText = '';

    // Show/hide manual input
    const manualGroup = elements.btcPriceManualInput.closest('.form-group');
    if (method === 'manual') {
      manualGroup.classList.remove('form-group--hidden');
      elements.btcPriceDisplay.textContent = '';
      return;
    } else {
      manualGroup.classList.add('form-group--hidden');
    }

    // Update display for spot or annual
    if (method === 'spot') {
      if (spotPrice !== null) {
        displayText = `Spot: ${formatUsdCurrency(spotPrice)}`;
      } else {
        displayText = 'Loading spot price...';
      }
    } else if (method === 'annual') {
      if (annualAverages) {
        const recentYear = getMostRecentAverageYear();
        if (recentYear) {
          const isStale = recentYear < CURRENT_YEAR;
          displayText = `${recentYear} Avg: ${formatUsdCurrency(annualAverages[recentYear])}${isStale ? ' — most recent full year' : ''}`;
        }
      } else {
        displayText = 'Loading annual data...';
      }
    }

    elements.btcPriceDisplay.textContent = displayText;
  }

  /**
   * Set status message
   */
  function setStatus(message, type = 'info') {
    if (!elements.statusOutput) return;

    elements.statusOutput.textContent = message;
    elements.statusOutput.className = 'status';

    if (message) {
      elements.statusOutput.classList.add(`status--${type}`);
    }
  }

  /**
   * Clear status
   */
  function clearStatus() {
    if (elements.statusOutput) {
      elements.statusOutput.textContent = '';
      elements.statusOutput.className = 'status';
    }
  }

  /**
   * Validate inputs
   */
  function validateInputs() {
    const salary = parseFloat(elements.salaryInput.value);
    if (isNaN(salary) || salary <= 0) {
      throw new Error('Please enter a valid annual salary.');
    }

    const salaryGrowth = parseFloat(elements.salaryGrowthInput.value) || 0;
    if (salaryGrowth < -100 || salaryGrowth > 1000) {
      throw new Error('Salary growth rate must be between -100% and 1000%.');
    }

    const btcGrowth = parseFloat(elements.btcGrowthInput.value) || 0;
    if (btcGrowth < -100 || btcGrowth > 1000) {
      throw new Error('BTC growth rate must be between -100% and 1000%.');
    }

    const startYear = parseInt(elements.startYearSelect.value);
    const forecastYears = parseInt(elements.yearsSelect.value);

    return { salary, salaryGrowth, btcGrowth, startYear, forecastYears };
  }

  /**
   * Render projection table (with optional salary/BTC decomposition columns)
   */
  function renderTable(projections, currency) {
    if (!elements.projectionTableBody) return;

    // Update main SALI/Salary headers (4th and 2nd columns)
    const headerRow = document.querySelector('#mainProjectionTable thead tr');
    if (headerRow) {
      if (headerRow.cells[3]) headerRow.cells[3].textContent = displayUnit === 'btc' ? 'SALI (BTC)' : 'SALI (sats)';
      if (headerRow.cells[1]) headerRow.cells[1].textContent = salaryGrowthMode === 'real' ? 'Salary (Real)' : 'Salary';
    }

    // Show/hide breakdown columns in thead
    const breakdownThs = document.querySelectorAll('#mainProjectionTable thead .breakdown-col');
    breakdownThs.forEach(th => { th.style.display = showBreakdown ? '' : 'none'; });

    const firstFutureIdx = projections.findIndex(p => !p.isHistorical && p.year > CURRENT_YEAR);

    elements.projectionTableBody.innerHTML = projections.map((p, idx) => {
      let rowClass = p.isCurrentYear ? 'current-year-row' : (p.isHistorical ? '' : 'projected-row');
      if (idx === firstFutureIdx) rowClass += ' first-projected-row';
      const yearLabel = p.isCurrentYear ? `${p.year} (Now)` : p.year;
      const saliDisplay = displayUnit === 'btc' ? formatBtc(p.btcEquivalent) : formatSats(p.sats);
      const dispStyle = showBreakdown ? '' : 'style="display:none"';

      let salaryEffectCell = `<td class="breakdown-col" ${dispStyle}>—</td>`;
      let btcEffectCell = `<td class="breakdown-col" ${dispStyle}>—</td>`;

      if (idx > 0) {
        const prev = projections[idx - 1];
        const salaryEffect = (p.salary / prev.salary - 1) * 100;
        const btcEffect = -(p.btcPrice / prev.btcPrice - 1) * 100;
        const seCls = salaryEffect >= 0 ? 'score--gaining' : 'score--losing';
        const beCls = btcEffect >= 0 ? 'score--gaining' : 'score--losing';
        salaryEffectCell = `<td class="breakdown-col ${seCls}" ${dispStyle}>${formatPercent(salaryEffect)}</td>`;
        btcEffectCell = `<td class="breakdown-col ${beCls}" ${dispStyle}>${formatPercent(btcEffect)}</td>`;
      }

      return `
        <tr class="${rowClass.trim()}">
          <td>${yearLabel}</td>
          <td>${formatCurrency(p.salary, currency)}</td>
          <td>${formatUsdCurrency(p.btcPrice)}${p.isHistorical ? '' : '*'}</td>
          <td>${saliDisplay}</td>
          ${salaryEffectCell}
          ${btcEffectCell}
        </tr>
      `;
    }).join('');
  }

  /**
   * Read URL query params and apply to inputs (called after selects are populated)
   */
  function parseUrlParams() {
    const params = new URLSearchParams(window.location.search);
    if (params.has('salary'))      elements.salaryInput.value        = params.get('salary');
    if (params.has('currency'))    elements.currencySelect.value     = params.get('currency');
    if (params.has('salaryGrowth'))elements.salaryGrowthInput.value  = params.get('salaryGrowth');
    if (params.has('startYear'))   elements.startYearSelect.value    = params.get('startYear');
    if (params.has('forecast'))    elements.yearsSelect.value        = params.get('forecast');
    if (params.has('btcMethod'))   elements.btcPriceMethodSelect.value = params.get('btcMethod');
    if (params.has('btcPrice'))    elements.btcPriceManualInput.value = params.get('btcPrice');
    if (params.has('btcGrowth'))   elements.btcGrowthInput.value     = params.get('btcGrowth');
  }

  /**
   * Write current calculator state to URL query params
   */
  function updateUrlParams() {
    const params = new URLSearchParams();
    if (elements.salaryInput.value) params.set('salary', elements.salaryInput.value);
    const currency = elements.currencySelect.value;
    if (currency !== 'USD') params.set('currency', currency);
    const salaryGrowth = elements.salaryGrowthInput.value;
    if (salaryGrowth && salaryGrowth !== String(DEFAULT_SALARY_GROWTH)) params.set('salaryGrowth', salaryGrowth);
    params.set('startYear', elements.startYearSelect.value);
    params.set('forecast', elements.yearsSelect.value);
    const btcMethod = elements.btcPriceMethodSelect.value;
    if (btcMethod !== 'spot') params.set('btcMethod', btcMethod);
    if (btcMethod === 'manual' && elements.btcPriceManualInput.value) {
      params.set('btcPrice', elements.btcPriceManualInput.value);
    }
    const btcGrowth = elements.btcGrowthInput.value;
    if (btcGrowth && btcGrowth !== String(DEFAULT_BTC_GROWTH)) params.set('btcGrowth', btcGrowth);
    const qs = params.toString();
    window.history.replaceState({}, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }

  /**
   * Render chart — Bitcoin (default) or benchmark comparison
   */
  function renderChart(projections) {
    if (!elements.saliChart) return;

    const ctx = elements.saliChart.getContext('2d');

    // Build dataset based on active benchmark
    let chartProjections, chartData, yAxisLabel, datasetLabel, tooltipValueFn, yTickFn;

    if (activeBenchmark !== 'btc') {
      const bConfig = BENCHMARK_DATA[activeBenchmark];
      const growthRate = benchmarkGrowthOverride !== null ? benchmarkGrowthOverride : bConfig.defaultGrowth;
      chartProjections = generateBenchmarkSeries(projections, activeBenchmark, growthRate);
      chartData = chartProjections.map(p => p.benchValue);
      yAxisLabel = bConfig.unit;
      datasetLabel = `${bConfig.name} — salary in ${bConfig.unitShort}`;
      tooltipValueFn = p => `${bConfig.name}: ${bConfig.format(p.benchValue)}`;
      yTickFn = value => {
        if (value >= 1e6) return (value / 1e6).toFixed(1) + 'M';
        if (value >= 1e3) return (value / 1e3).toFixed(1) + 'K';
        return value.toFixed(2);
      };
    } else {
      chartProjections = projections;
      chartData = displayUnit === 'btc'
        ? projections.map(p => p.btcEquivalent)
        : projections.map(p => Math.round(p.sats));
      yAxisLabel = displayUnit === 'btc' ? 'BTC per Year' : 'Sats per Year';
      datasetLabel = displayUnit === 'btc'
        ? `SALI (BTC/year${salaryGrowthMode === 'real' ? ' · real' : ''})`
        : `SALI (sats/year${salaryGrowthMode === 'real' ? ' · real' : ''})`;
      tooltipValueFn = p => displayUnit === 'btc'
        ? `SALI: ${formatBtc(p.btcEquivalent)}/year`
        : `SALI: ${formatSats(p.sats)} sats/year`;
      yTickFn = value => {
        if (displayUnit === 'btc') return value.toFixed(4);
        if (value >= 1e9) return (value / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
        if (value >= 1e6) return (value / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
        if (value >= 1e3) return (value / 1e3).toFixed(0) + 'K';
        return formatSats(value);
      };
    }

    // Update chart title
    const titleEl = document.getElementById('chartTitle');
    if (titleEl) {
      titleEl.textContent = activeBenchmark === 'btc'
        ? 'SALI Over Time'
        : `Salary vs ${BENCHMARK_DATA[activeBenchmark].name} Over Time`;
    }

    const labels = chartProjections.map(p => p.year.toString());
    const currentYearIndex = chartProjections.findIndex(p => p.isCurrentYear);

    const isRerender = !!chartInstance;
    if (chartInstance) chartInstance.destroy();

    // Get fresh context after destroy to avoid any stale state
    const freshCtx = elements.saliChart.getContext('2d');

    const accentColor = '#F7931A';
    const accentDim = 'rgba(247, 147, 26, 0.12)';
    const textMuted = '#999999';
    const textSecondary = '#555555';
    const bgCard = '#ffffff';

    const todayLinePlugin = {
      id: 'todayLine',
      afterDraw(chart) {
        if (currentYearIndex < 0) return;
        const { ctx: c, chartArea, scales } = chart;
        const label = labels[currentYearIndex];
        const x = scales.x.getPixelForValue(label);
        c.save();
        c.beginPath();
        c.setLineDash([4, 3]);
        c.moveTo(x, chartArea.top);
        c.lineTo(x, chartArea.bottom);
        c.strokeStyle = 'rgba(247, 147, 26, 0.55)';
        c.lineWidth = 1.5;
        c.stroke();
        c.setLineDash([]);
        c.fillStyle = '#F7931A';
        c.font = '10px "Roboto Mono", monospace';
        c.textAlign = 'center';
        c.fillText('Today', x, chartArea.top + 12);
        c.restore();
      }
    };

    chartInstance = new Chart(freshCtx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: datasetLabel,
          data: chartData,
          borderColor: accentColor,
          backgroundColor: accentDim,
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointBackgroundColor: chartProjections.map(p =>
            p.isCurrentYear ? '#111111' : (p.isHistorical ? accentColor : 'rgba(247, 147, 26, 0.45)')
          ),
          pointBorderColor: chartProjections.map(p =>
            p.isCurrentYear ? '#111111' : (p.isHistorical ? accentColor : 'rgba(247, 147, 26, 0.45)')
          ),
          pointRadius: chartProjections.map(p => p.isCurrentYear ? 6 : 4),
          pointHoverRadius: 8,
          segment: {
            borderDash: ctx => {
              const idx = ctx.p0DataIndex;
              return chartProjections[idx] && !chartProjections[idx].isHistorical && idx >= currentYearIndex ? [5, 5] : undefined;
            }
          }
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 20 } },
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: bgCard,
            borderColor: '#e5e5e5',
            borderWidth: 1,
            titleColor: '#111111',
            bodyColor: textSecondary,
            padding: 12,
            displayColors: false,
            callbacks: {
              title: function(context) {
                const idx = context[0].dataIndex;
                const p = chartProjections[idx];
                let title = p.year.toString();
                if (p.isCurrentYear) title += ' (Current)';
                else if (!p.isHistorical) title += ' (Projected)';
                return title;
              },
              label: function(context) {
                return tooltipValueFn(chartProjections[context.dataIndex]);
              },
              afterLabel: function(context) {
                const p = chartProjections[context.dataIndex];
                if (activeBenchmark === 'btc') return `BTC Price: ${formatUsdCurrency(p.btcPrice)}`;
                const bConfig = BENCHMARK_DATA[activeBenchmark];
                return `${bConfig.name} price: ${formatUsdCurrency(p.benchPrice)}`;
              }
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: 'Year', color: textMuted },
            ticks: { color: textMuted },
            grid: { color: 'rgba(0, 0, 0, 0.06)' }
          },
          y: {
            beginAtZero: false,
            title: { display: true, text: yAxisLabel, color: textMuted },
            ticks: { color: textMuted, callback: yTickFn },
            grid: { color: 'rgba(0, 0, 0, 0.06)' }
          }
        }
      },
      plugins: [todayLinePlugin]
    });

    // On first load, Chart.js may cache a stale container width; force-resize
    // after one frame. On rerenders the container is already sized correctly.
    if (!isRerender) {
      const parent = elements.saliChart.parentNode;
      requestAnimationFrame(() => {
        if (chartInstance) chartInstance.resize(parent.clientWidth, parent.clientHeight);
      });
    }
  }

  /**
   * Render normalized multi-benchmark comparison chart
   * All four benchmarks normalized to 100 at start year so they can be compared directly.
   */
  function renderNormalizedChart(projections) {
    const canvas = document.getElementById('normalizedChart');
    if (!canvas || !projections.length) return;

    // Build series for each benchmark using existing generateBenchmarkSeries
    const spxSeries  = generateBenchmarkSeries(projections, 'spx',  null);
    const goldSeries = generateBenchmarkSeries(projections, 'gold', null);
    const cpiSeries  = generateBenchmarkSeries(projections, 'cpi',  null);

    // First-year anchor values for normalization
    const btcStart  = projections[0].btcEquivalent;
    const spxStart  = spxSeries[0].benchValue;
    const goldStart = goldSeries[0].benchValue;
    const cpiStart  = cpiSeries[0].benchValue;

    if (!btcStart || !spxStart || !goldStart || !cpiStart) return;

    const labels = projections.map(p => p.year.toString());
    const currentYearIndex = projections.findIndex(p => p.isCurrentYear);

    // Normalize: value[year] / value[startYear] × 100
    const btcData  = projections.map(p => (p.btcEquivalent / btcStart) * 100);
    const spxData  = spxSeries.map(p  => (p.benchValue / spxStart)  * 100);
    const goldData = goldSeries.map(p => (p.benchValue / goldStart) * 100);
    const cpiData  = cpiSeries.map(p  => (p.benchValue / cpiStart)  * 100);

    // Helper: dashed segment for projected years
    function makeSegmentFn(series) {
      return {
        borderDash: ctx => {
          const i = ctx.p0DataIndex;
          return series[i] && !series[i].isHistorical && i >= currentYearIndex ? [5, 5] : undefined;
        }
      };
    }

    const todayPlugin = {
      id: 'normTodayLine',
      afterDraw(chart) {
        if (currentYearIndex < 0) return;
        const { ctx: c, chartArea, scales } = chart;
        const x = scales.x.getPixelForValue(labels[currentYearIndex]);
        c.save();
        c.beginPath();
        c.setLineDash([4, 3]);
        c.moveTo(x, chartArea.top);
        c.lineTo(x, chartArea.bottom);
        c.strokeStyle = 'rgba(100, 100, 100, 0.35)';
        c.lineWidth = 1.5;
        c.stroke();
        c.setLineDash([]);
        c.fillStyle = '#888888';
        c.font = '10px "Roboto Mono", monospace';
        c.textAlign = 'center';
        c.fillText('Today', x, chartArea.top + 12);
        c.restore();
      }
    };

    if (normalizedChartInstance) normalizedChartInstance.destroy();
    const freshCtx = canvas.getContext('2d');

    normalizedChartInstance = new Chart(freshCtx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Bitcoin',
            data: btcData,
            borderColor: '#F7931A',
            backgroundColor: 'transparent',
            borderWidth: 2.5,
            fill: false,
            tension: 0.3,
            pointRadius: projections.map(p => p.isCurrentYear ? 5 : 3),
            pointHoverRadius: 7,
            segment: makeSegmentFn(projections)
          },
          {
            label: 'S&P 500',
            data: spxData,
            borderColor: '#4A90D9',
            backgroundColor: 'transparent',
            borderWidth: 2,
            fill: false,
            tension: 0.3,
            pointRadius: spxSeries.map(p => p.isCurrentYear ? 5 : 3),
            pointHoverRadius: 7,
            segment: makeSegmentFn(spxSeries)
          },
          {
            label: 'Gold',
            data: goldData,
            borderColor: '#C9A84C',
            backgroundColor: 'transparent',
            borderWidth: 2,
            fill: false,
            tension: 0.3,
            pointRadius: goldSeries.map(p => p.isCurrentYear ? 5 : 3),
            pointHoverRadius: 7,
            segment: makeSegmentFn(goldSeries)
          },
          {
            label: 'Real (CPI)',
            data: cpiData,
            borderColor: '#6B9E6B',
            backgroundColor: 'transparent',
            borderWidth: 2,
            fill: false,
            tension: 0.3,
            pointRadius: cpiSeries.map(p => p.isCurrentYear ? 5 : 3),
            pointHoverRadius: 7,
            segment: makeSegmentFn(cpiSeries)
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 20 } },
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: '#555555',
              usePointStyle: true,
              pointStyleWidth: 14,
              boxHeight: 8,
              font: { family: '"Roboto Mono", monospace', size: 12 }
            }
          },
          tooltip: {
            backgroundColor: '#ffffff',
            borderColor: '#e5e5e5',
            borderWidth: 1,
            titleColor: '#111111',
            bodyColor: '#555555',
            padding: 12,
            displayColors: true,
            callbacks: {
              title: function(context) {
                const idx = context[0].dataIndex;
                const p = projections[idx];
                let title = p.year.toString();
                if (p.isCurrentYear) title += ' (Current)';
                else if (!p.isHistorical) title += ' (Projected)';
                return title;
              },
              label: function(context) {
                const val = context.parsed.y;
                const diff = val - 100;
                const sign = diff >= 0 ? '+' : '';
                return `${context.dataset.label}: ${val.toFixed(1)}  (${sign}${diff.toFixed(1)}%)`;
              }
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: 'Year', color: '#999999' },
            ticks: { color: '#999999' },
            grid: { color: 'rgba(0, 0, 0, 0.06)' }
          },
          y: {
            beginAtZero: false,
            title: { display: true, text: 'Index (Start Year = 100)', color: '#999999' },
            ticks: {
              color: '#999999',
              callback: v => v.toFixed(0)
            },
            grid: { color: 'rgba(0, 0, 0, 0.06)' }
          }
        }
      },
      plugins: [todayPlugin]
    });
  }

  /**
   * SALI Tier — compares user's sats to US income benchmarks at current BTC price
   */
  function updateSaliTier(userSats, btcPrice) {
    const wrap = elements.saliTierWrap;
    const badge = elements.saliTier;
    if (!wrap || !badge || !btcPrice) return;

    const saliFor = salary => (salary / btcPrice) * SATS_PER_BTC;
    const minWage   = saliFor(15080);
    const median    = saliFor(59000);
    const top25     = saliFor(100000);
    const top10     = saliFor(150000);

    let tier, dot;
    if (userSats >= top10)       { tier = 'Top 10%';      dot = '🔵'; }
    else if (userSats >= top25)  { tier = 'Top 25%';      dot = '🟡'; }
    else if (userSats >= median * 0.9 && userSats <= median * 1.1)
                                 { tier = 'Median';        dot = '⚪'; }
    else if (userSats > median)  { tier = 'Above Median'; dot = '🟠'; }
    else                         { tier = 'Below Median'; dot = '🟤'; }

    badge.textContent = `${dot} ${tier}`;
    wrap.style.display = 'block';
  }

  /**
   * Purchasing Power Narrative — plain-English interpretation of historical SALI change
   */
  function updatePurchasingPowerNarrative(projections, currency) {
    const el = elements.ppNarrative;
    if (!el) return;

    const first = projections[0];
    const current = projections.find(p => p.isCurrentYear);
    if (!first || !current || first === current) { el.style.display = 'none'; return; }

    const pctChange = ((current.sats - first.sats) / first.sats) * 100;
    const absPct = Math.abs(pctChange).toFixed(1);
    const direction = pctChange >= 0 ? 'gained' : 'lost';
    const dirWord   = pctChange >= 0 ? 'more'   : 'less';

    const firstBtc = first.btcEquivalent.toFixed(4);
    const currBtc  = current.btcEquivalent.toFixed(4);

    // Plain-English one-liner
    let interpretation;
    if (Math.abs(pctChange) < 5) {
      interpretation = 'Your salary is roughly keeping pace with Bitcoin appreciation at these assumptions.';
    } else if (pctChange < 0) {
      interpretation = `Your salary is buying ${absPct}% less Bitcoin than it did in ${first.year} — Bitcoin has appreciated faster than wages.`;
    } else {
      interpretation = `Your salary is buying ${absPct}% more Bitcoin than it did in ${first.year} — your earnings have outpaced Bitcoin's price.`;
    }

    el.innerHTML =
      `<div class="pp-narrative__headline">Purchasing Power Change since ${first.year}</div>` +
      `In ${first.year}, your ${formatCurrency(first.salary, currency)} salary could acquire <strong>${firstBtc} BTC/year</strong>. ` +
      `Today it acquires <strong>${currBtc} BTC/year</strong> — ` +
      `<strong>${direction} ${absPct}%</strong> in Bitcoin terms. ` +
      interpretation;
    el.style.display = 'block';
  }

  /**
   * Show real vs nominal salary growth callout
   */
  function updateInflationNote(nominalGrowth, inflationRate) {
    if (!elements.realGrowthNote) return;
    if (salaryGrowthMode !== 'real') {
      elements.realGrowthNote.style.display = 'none';
      return;
    }
    const realGrowth = ((1 + nominalGrowth / 100) / (1 + inflationRate / 100) - 1) * 100;
    elements.realGrowthNote.textContent =
      `Nominal ${nominalGrowth.toFixed(1)}% → real ${realGrowth.toFixed(2)}% after ${inflationRate.toFixed(1)}% inflation`;
    elements.realGrowthNote.style.display = 'block';
  }

  /**
   * Update break-even calculator
   */
  function updateBreakEven(salary, currency, nominalSalaryGrowth, btcGrowth) {
    if (!elements.breakevenRateOutput) return;
    const breakevenRate = btcGrowth;
    elements.breakevenRateOutput.textContent = '+' + breakevenRate.toFixed(1) + '%/yr';

    const yearsAhead = 5;
    const salaryBreakEven5 = salary * Math.pow(1 + breakevenRate / 100, yearsAhead);
    const salaryProjected5 = salary * Math.pow(1 + nominalSalaryGrowth / 100, yearsAhead);

    if (elements.breakevenSalary5) elements.breakevenSalary5.textContent = formatCurrency(salaryBreakEven5, currency);
    if (elements.projectedSalary5) elements.projectedSalary5.textContent = formatCurrency(salaryProjected5, currency);

    const gap = nominalSalaryGrowth - breakevenRate;
    if (elements.breakevenGap) {
      if (Math.abs(gap) < 0.01) {
        elements.breakevenGap.style.display = 'none';
      } else {
        const gapStr = Math.abs(gap).toFixed(1);
        const diff5 = Math.abs(salaryBreakEven5 - salaryProjected5);
        if (gap < 0) {
          elements.breakevenGap.textContent =
            `To accumulate Bitcoin at the same rate it's appreciating, your salary needs to grow ${gapStr}%/yr faster than it currently is. Over 5 years, that's a ${formatCurrency(diff5, currency)} gap.`;
          elements.breakevenGap.className = 'breakeven-gap breakeven-gap--behind';
        } else {
          elements.breakevenGap.textContent =
            `Your salary is growing ${gapStr}%/yr faster than BTC — your SALI is increasing at these assumptions.`;
          elements.breakevenGap.className = 'breakeven-gap breakeven-gap--ahead';
        }
        elements.breakevenGap.style.display = 'block';
      }
    }
  }

  /**
   * Compute and render actual historical SALI from a starting salary
   */
  function computeHistorical(baseBtcPrice, currency) {
    if (!elements.histStartYear || !elements.histStartSalary) return;
    const startYear = parseInt(elements.histStartYear.value);
    const startSalaryRaw = parseFloat(elements.histStartSalary.value);

    if (!startSalaryRaw || isNaN(startSalaryRaw) || startSalaryRaw <= 0) {
      if (elements.historyResults) elements.historyResults.style.display = 'none';
      return;
    }

    const nominalGrowth = parseFloat(elements.salaryGrowthInput.value) || 0;
    const startSalaryUsd = convertToUsd(startSalaryRaw, currency);
    const historyData = [];

    for (let year = startYear; year <= CURRENT_YEAR; year++) {
      let btcPrice;
      if (annualAverages && annualAverages[year]) {
        btcPrice = annualAverages[year];
      } else if (year === CURRENT_YEAR) {
        btcPrice = baseBtcPrice;
      } else {
        continue;
      }
      const yearsFromStart = year - startYear;
      const salaryUsdYear = startSalaryUsd * Math.pow(1 + nominalGrowth / 100, yearsFromStart);
      const salaryDisplay = startSalaryRaw * Math.pow(1 + nominalGrowth / 100, yearsFromStart);
      const { sats, btcEquivalent } = calculateSali(salaryUsdYear, btcPrice);
      const isSpotYear = year === CURRENT_YEAR && !(annualAverages && annualAverages[year]);
      historyData.push({ year, salary: salaryDisplay, btcPrice, sats, btcEquivalent, isSpotYear });
    }

    if (historyData.length < 1) {
      if (elements.historyResults) elements.historyResults.style.display = 'none';
      return;
    }

    const first = historyData[0];
    const last = historyData[historyData.length - 1];
    const totalChange = ((last.sats - first.sats) / first.sats) * 100;
    const direction = totalChange >= 0 ? 'gained' : 'lost';
    const absPct = Math.abs(totalChange).toFixed(1);

    if (elements.historySummary) {
      elements.historySummary.innerHTML =
        `From ${first.year} (<strong>${formatCurrency(startSalaryRaw, currency)}</strong>) to ${last.year}, ` +
        `your BTC purchasing power <strong>${direction} ${absPct}%</strong>. ` +
        `SALI: <strong>${formatSats(first.sats)}</strong> → <strong>${formatSats(last.sats)} sats/yr</strong>.`;
    }

    if (elements.historyTableBody) {
      elements.historyTableBody.innerHTML = historyData.map((row, idx) => {
        const prev = idx > 0 ? historyData[idx - 1] : null;
        const yoyChange = prev ? ((row.sats - prev.sats) / prev.sats * 100) : null;
        const yoyText = yoyChange !== null ? formatPercent(yoyChange) : '—';
        const yoyClass = yoyChange !== null ? (yoyChange >= 0 ? 'score--gaining' : 'score--losing') : '';
        const isLast = idx === historyData.length - 1;
        return `
          <tr class="${isLast ? 'current-year-row' : ''}">
            <td>${row.year}${isLast ? ' (Now)' : ''}</td>
            <td>${formatCurrency(row.salary, currency)}</td>
            <td>${formatUsdCurrency(row.btcPrice)}${row.isSpotYear ? '*' : ''}</td>
            <td>${formatSats(row.sats)}</td>
            <td class="${yoyClass}">${yoyText}</td>
          </tr>
        `;
      }).join('');
    }

    if (elements.historyResults) elements.historyResults.style.display = 'block';
  }

  /**
   * Update unit toggle UI
   */
  function updateUnitToggle() {
    elements.unitToggleSats.classList.toggle('unit-toggle__btn--active', displayUnit === 'sats');
    elements.unitToggleBtc.classList.toggle('unit-toggle__btn--active', displayUnit === 'btc');
  }

  /**
   * Build normalized benchmark comparison chart on #benchmarkChart
   * Normalizes Bitcoin, S&P 500, Gold, and CPI to 100 at startYear.
   */
  function buildBenchmarkChart(startYear) {
    const canvas = document.getElementById('benchmarkChart');
    const section = document.getElementById('benchmarkSection');
    if (!canvas || !section) return;
    if (!annualAverages || !sp500JsonData || !goldJsonData || !cpiJsonData) return;

    // Collect years with data in all 4 sources, from startYear through the most recent available year
    const latestYear = Math.max(
      ...Object.keys(annualAverages).map(Number).filter(n => !isNaN(n)),
      ...Object.keys(sp500JsonData).map(Number).filter(n => !isNaN(n)),
      ...Object.keys(goldJsonData).map(Number).filter(n => !isNaN(n)),
      ...Object.keys(cpiJsonData).map(Number).filter(n => !isNaN(n))
    );
    const years = [];
    for (let y = startYear; y <= latestYear; y++) {
      if (
        annualAverages[y] !== undefined &&
        sp500JsonData[y]  !== undefined &&
        goldJsonData[y]   !== undefined &&
        cpiJsonData[y]    !== undefined
      ) {
        years.push(y);
      }
    }
    if (years.length < 2) return;

    const base = years[0];
    const btcBase  = annualAverages[base];
    const sp500Base = sp500JsonData[base];
    const goldBase  = goldJsonData[base];
    const cpiBase   = cpiJsonData[base];
    if (!btcBase || !sp500Base || !goldBase || !cpiBase) return;

    const labels    = years.map(String);
    const btcNorm   = years.map(y => (annualAverages[y] / btcBase)  * 100);
    const sp500Norm = years.map(y => (sp500JsonData[y]  / sp500Base) * 100);
    const goldNorm  = years.map(y => (goldJsonData[y]   / goldBase)  * 100);
    const cpiNorm   = years.map(y => (cpiJsonData[y]    / cpiBase)   * 100);

    if (benchmarkChartInstance) {
      benchmarkChartInstance.destroy();
      benchmarkChartInstance = null;
    }

    const freshCtx = canvas.getContext('2d');
    benchmarkChartInstance = new Chart(freshCtx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Bitcoin',
            data: btcNorm,
            borderColor: '#F7931A',
            backgroundColor: 'transparent',
            borderWidth: 2.5,
            fill: false,
            tension: 0.3,
            pointRadius: 4,
            pointHoverRadius: 7
          },
          {
            label: 'S&P 500',
            data: sp500Norm,
            borderColor: '#4CAF50',
            backgroundColor: 'transparent',
            borderWidth: 2,
            fill: false,
            tension: 0.3,
            pointRadius: 3,
            pointHoverRadius: 7
          },
          {
            label: 'Gold',
            data: goldNorm,
            borderColor: '#FFD700',
            backgroundColor: 'transparent',
            borderWidth: 2,
            fill: false,
            tension: 0.3,
            pointRadius: 3,
            pointHoverRadius: 7
          },
          {
            label: 'CPI Inflation',
            data: cpiNorm,
            borderColor: '#9E9E9E',
            backgroundColor: 'transparent',
            borderWidth: 2,
            fill: false,
            tension: 0.3,
            pointRadius: 3,
            pointHoverRadius: 7
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 20 } },
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          title: {
            display: true,
            text: `Normalized Growth Since ${startYear} (Base = 100)`,
            color: '#111111',
            font: { family: '"Roboto Mono", monospace', size: 13 }
          },
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: '#555555',
              usePointStyle: true,
              pointStyleWidth: 14,
              boxHeight: 8,
              font: { family: '"Roboto Mono", monospace', size: 12 }
            }
          },
          tooltip: {
            backgroundColor: '#ffffff',
            borderColor: '#e5e5e5',
            borderWidth: 1,
            titleColor: '#111111',
            bodyColor: '#555555',
            padding: 12,
            displayColors: true,
            callbacks: {
              label: function(context) {
                const val = context.parsed.y;
                const diff = val - 100;
                const sign = diff >= 0 ? '+' : '';
                return `${context.dataset.label}: ${val.toFixed(1)}  (${sign}${diff.toFixed(1)}%)`;
              }
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: 'Year', color: '#999999' },
            ticks: { color: '#999999' },
            grid: { color: 'rgba(0, 0, 0, 0.06)' }
          },
          y: {
            beginAtZero: false,
            title: { display: true, text: 'Indexed Value (Start = 100)', color: '#999999' },
            ticks: {
              color: '#999999',
              callback: v => v.toFixed(0)
            },
            grid: { color: 'rgba(0, 0, 0, 0.06)' }
          }
        }
      }
    });

    section.style.display = 'block';
  }

  /**
   * Main compute function
   */
  function compute() {
    clearStatus();

    try {
      // Validate inputs
      const { salary, salaryGrowth: nominalSalaryGrowth, btcGrowth, startYear, forecastYears } = validateInputs();
      const currency = elements.currencySelect.value;

      // Compute effective salary growth (nominal or real/inflation-adjusted)
      const inflationRate = salaryGrowthMode === 'real'
        ? (parseFloat(elements.inflationInput && elements.inflationInput.value) || 3)
        : 0;
      const effectiveSalaryGrowth = salaryGrowthMode === 'real'
        ? ((1 + nominalSalaryGrowth / 100) / (1 + inflationRate / 100) - 1) * 100
        : nominalSalaryGrowth;

      updateInflationNote(nominalSalaryGrowth, inflationRate);

      // Convert salary to USD
      const salaryUsd = convertToUsd(salary, currency);

      // Get base BTC price
      const baseBtcPrice = getBtcPrice();

      // Generate projections with actual years
      const projections = generateProjections(salaryUsd, baseBtcPrice, effectiveSalaryGrowth, btcGrowth, startYear, forecastYears);

      // Find current year data for primary output
      const currentYearData = projections.find(p => p.isCurrentYear) || projections[projections.length - 1];

      // Update primary outputs
      if (displayUnit === 'btc') {
        elements.saliSatsOutput.textContent = formatBtc(currentYearData.btcEquivalent) + '/year';
        elements.btcOutputGroup.style.display = 'none';
      } else {
        elements.saliSatsOutput.textContent = formatSats(currentYearData.sats) + ' sats/year';
        elements.saliBtcOutput.textContent = formatBtc(currentYearData.btcEquivalent) + '/year';
        elements.btcOutputGroup.style.display = 'block';
      }

      // Calculate trend (used for historical change and projected description)
      const trendScore = calculateTrendScore(projections);

      // Historical change (real data, not projection assumptions)
      if (elements.historicalChangeGroup) {
        if (trendScore.historicalChange !== undefined && startYear < CURRENT_YEAR) {
          elements.historicalChangeYear.textContent = startYear;
          elements.historicalChangeOutput.textContent = formatPercent(trendScore.historicalChange);
          const hClass = trendScore.historicalChange >= 0 ? 'score--gaining' : 'score--losing';
          elements.historicalChangeOutput.className = 'output-group__value output-group__value--secondary ' + hClass;
          elements.historicalChangeGroup.style.display = 'block';
        } else {
          elements.historicalChangeGroup.style.display = 'none';
        }
      }

      // Projected change — label reflects forecast horizon and salary mode
      if (elements.projectedChangeLabel) {
        const modeLabel = salaryGrowthMode === 'real' ? ' · real' : '';
        elements.projectedChangeLabel.textContent = `Projected Change (${forecastYears}yr${modeLabel})`;
      }
      const lastProjection = projections[projections.length - 1];
      const currentYearData2 = projections.find(p => p.isCurrentYear);
      if (trendScore.score !== null && currentYearData2 && lastProjection && lastProjection.year > CURRENT_YEAR) {
        elements.saliYoyOutput.textContent = formatPercent(trendScore.score);
        elements.saliYoyOutput.className = 'output-group__value output-group__value--secondary score--' + trendScore.trend;
        if (elements.projectedChangeDesc) {
          elements.projectedChangeDesc.textContent = trendScore.description;
        }
        elements.saliYoyOutput.parentElement.style.display = 'block';
      } else {
        elements.saliYoyOutput.parentElement.style.display = 'none';
      }

      // FX warning
      updateFxWarning();

      // Update URL to reflect current state
      updateUrlParams();

      // Purchasing power equivalents
      updateEquivalents(currentYearData.sats, currentYearData.btcEquivalent);

      // SALI Grade score
      const gradeData = computeSaliGrade(projections, btcGrowth, nominalSalaryGrowth);
      updateSaliScore(gradeData);

      // Show share buttons once we have a valid result
      if (elements.shareRow) elements.shareRow.style.display = 'flex';
      updateTweetLink(gradeData);

      // Decomposition summary
      updateDecompSummary(projections);

      // SALI Tier
      updateSaliTier(currentYearData.sats, baseBtcPrice);

      // Purchasing Power Narrative
      updatePurchasingPowerNarrative(projections, currency);

      // Break-even calculator
      updateBreakEven(salary, currency, nominalSalaryGrowth, btcGrowth);

      // Historical SALI (if user has entered a starting point)
      computeHistorical(baseBtcPrice, currency);

      // Render table and charts
      renderTable(projections, currency);
      renderChart(projections);
      renderNormalizedChart(projections);
      // Only show the benchmark section after the user has interacted (or if the
      // page was loaded with URL params that imply explicit user intent).
      if (initComputeComplete || hasInitialUrlParams) {
        buildBenchmarkChart(startYear);
      } else {
        const bSection = document.getElementById('benchmarkSection');
        if (bSection) bSection.style.display = 'none';
      }

    } catch (error) {
      setStatus(error.message, 'error');
      const bSection = document.getElementById('benchmarkSection');
      if (bSection) bSection.style.display = 'none';
    }
  }

  /**
   * Populate year selects
   */
  function populateYearSelects() {
    // Start year select (2015 to current year)
    const minYear = annualAverages ? Math.min(...Object.keys(annualAverages).map(Number)) : 2015;
    for (let year = minYear; year <= CURRENT_YEAR; year++) {
      const option = document.createElement('option');
      option.value = year;
      option.textContent = year;
      if (year === DEFAULT_START_YEAR) option.selected = true;
      elements.startYearSelect.appendChild(option);
    }

    // Forecast years select (1-30)
    for (let i = 1; i <= 30; i++) {
      const option = document.createElement('option');
      option.value = i;
      option.textContent = i + (i === 1 ? ' year' : ' years');
      if (i === DEFAULT_FORECAST_YEARS) option.selected = true;
      elements.yearsSelect.appendChild(option);
    }

    // Historical start year select (earliest data year to CURRENT_YEAR - 1)
    if (elements.histStartYear) {
      for (let year = minYear; year < CURRENT_YEAR; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        if (year === DEFAULT_START_YEAR) option.selected = true;
        elements.histStartYear.appendChild(option);
      }
    }
  }

  /**
   * Initialize calculator
   */
  function init() {
    // Cache DOM elements
    elements = {
      salaryInput: document.getElementById('salaryInput'),
      currencySelect: document.getElementById('currencySelect'),
      salaryGrowthInput: document.getElementById('salaryGrowthInput'),
      startYearSelect: document.getElementById('startYearSelect'),
      yearsSelect: document.getElementById('yearsSelect'),
      btcPriceMethodSelect: document.getElementById('btcPriceMethodSelect'),
      btcPriceDisplay: document.getElementById('btcPriceDisplay'),
      btcPriceManualInput: document.getElementById('btcPriceManualInput'),
      btcGrowthInput: document.getElementById('btcGrowthInput'),
      unitToggleSats: document.getElementById('unitToggleSats'),
      unitToggleBtc: document.getElementById('unitToggleBtc'),
      saliSatsOutput: document.getElementById('saliSatsOutput'),
      saliBtcOutput: document.getElementById('saliBtcOutput'),
      btcOutputGroup: document.getElementById('btcOutputGroup'),
      saliYoyOutput: document.getElementById('saliYoyOutput'),
      projectedChangeDesc: document.getElementById('projectedChangeDesc'),
      historicalChangeGroup: document.getElementById('historicalChangeGroup'),
      historicalChangeOutput: document.getElementById('historicalChangeOutput'),
      historicalChangeYear: document.getElementById('historicalChangeYear'),
      projectedChangeLabel: document.getElementById('projectedChangeLabel'),
      fxWarning: document.getElementById('fxWarning'),
      statusOutput: document.getElementById('statusOutput'),
      saliChart: document.getElementById('saliChart'),
      projectionTableBody: document.getElementById('projectionTableBody'),
      // Purchasing power equivalents
      equivalentsGrid: document.getElementById('equivalentsGrid'),
      equivSatsDay: document.getElementById('equivSatsDay'),
      equivSatsHour: document.getElementById('equivSatsHour'),
      equivPctBtc: document.getElementById('equivPctBtc'),
      // Inflation / real mode
      nominalModeBtn: document.getElementById('nominalModeBtn'),
      realModeBtn: document.getElementById('realModeBtn'),
      inflationGroup: document.getElementById('inflationGroup'),
      inflationInput: document.getElementById('inflationInput'),
      realGrowthNote: document.getElementById('realGrowthNote'),
      // BTC growth mode toggle (custom / historical CAGR / 5-Year CAGR)
      btcCustomModeBtn: document.getElementById('btcCustomModeBtn'),
      btcHistoricalModeBtn: document.getElementById('btcHistoricalModeBtn'),
      btc5yModeBtn: document.getElementById('btc5yModeBtn'),
      // Historical mode
      histStartYear: document.getElementById('histStartYear'),
      histStartSalary: document.getElementById('histStartSalary'),
      historyResults: document.getElementById('historyResults'),
      historySummary: document.getElementById('historySummary'),
      historyTableBody: document.getElementById('historyTableBody'),
      // Break-even
      breakevenRateOutput: document.getElementById('breakevenRateOutput'),
      breakevenSalary5: document.getElementById('breakevenSalary5'),
      projectedSalary5: document.getElementById('projectedSalary5'),
      breakevenGap: document.getElementById('breakevenGap'),
      // Multi-benchmark
      benchBtcBtn: document.getElementById('benchBtcBtn'),
      benchSpxBtn: document.getElementById('benchSpxBtn'),
      benchGoldBtn: document.getElementById('benchGoldBtn'),
      benchCpiBtn: document.getElementById('benchCpiBtn'),
      benchmarkPanel: document.getElementById('benchmarkPanel'),
      benchmarkGrowthInput: document.getElementById('benchmarkGrowthInput'),
      benchmarkGrowthLabel: document.getElementById('benchmarkGrowthLabel'),
      // Share / tweet
      shareRow: document.getElementById('shareRow'),
      shareSaliBtn: document.getElementById('shareSaliBtn'),
      tweetSaliBtn: document.getElementById('tweetSaliBtn'),
      // Decomposition
      decompSummary: document.getElementById('decompSummary'),
      breakdownToggle: document.getElementById('breakdownToggle'),
      // SALI Grade Score
      saliScoreWrap: document.getElementById('saliScoreWrap'),
      saliScoreGrade: document.getElementById('saliScoreGrade'),
      saliScoreRate: document.getElementById('saliScoreRate'),
      saliScoreGap: document.getElementById('saliScoreGap'),
      saliScoreTagline: document.getElementById('saliScoreTagline'),
      // SALI Tier + Purchasing Power
      saliTierWrap: document.getElementById('saliTierWrap'),
      saliTier: document.getElementById('saliTier'),
      ppNarrative: document.getElementById('ppNarrative')
    };

    // Check if we're on the calculator page
    if (!elements.salaryInput) {
      return; // Not on calculator page
    }

    // Load data first, then populate selects
    Promise.all([
      fetchSpotPrice(),
      fetchFxRates(),
      loadAnnualAverages(),
      loadBenchmarkJsonData()
    ]).then(() => {
      populateYearSelects();
      parseUrlParams();        // apply any URL params after selects have options
      updateBtcPriceDisplay();
      updateFxWarning();

      // Compute BTC CAGRs from the loaded annual averages, then populate
      // the Historical / 5-Year toggle button labels with live values.
      btcCagrCache = computeBtcCagrs();
      updateBtcGrowthButtonLabels();
      // Sync customBtcGrowth with the input value (which may have been
      // overridden by a URL param). Keeps "switch back to Custom" honest.
      const initialBtcGrowth = parseFloat(elements.btcGrowthInput.value);
      if (!isNaN(initialBtcGrowth)) customBtcGrowth = initialBtcGrowth;

      // Set the inflation input default to trailing 3-year CPI from the
      // loaded data (BLS CPI-U via cpi_annual.json) instead of the static
      // 3% in the HTML. Keeps the calculator's Real mode grounded in actual
      // recent inflation rather than a hardcoded guess. Users can still edit.
      const trailingCpi = computeTrailingCpi(3);
      if (trailingCpi && elements.inflationInput) {
        elements.inflationInput.value = trailingCpi.cagr.toFixed(1);
        const [a, b] = trailingCpi.span;
        elements.inflationInput.title = `Default: trailing ${b - a}-year US CPI (${a}–${b}) from BLS data. Edit to use your own assumption.`;
      }

      // Set up event listeners
      const inputElements = [
        elements.salaryInput,
        elements.currencySelect,
        elements.salaryGrowthInput,
        elements.startYearSelect,
        elements.yearsSelect,
        elements.btcPriceMethodSelect,
        elements.btcPriceManualInput,
        elements.btcGrowthInput
      ];

      inputElements.forEach(el => {
        if (el) {
          el.addEventListener('input', compute);
          el.addEventListener('change', compute);
        }
      });

      // Unit toggle listeners
      if (elements.unitToggleSats) {
        elements.unitToggleSats.addEventListener('click', () => {
          displayUnit = 'sats';
          updateUnitToggle();
          compute();
        });
      }

      if (elements.unitToggleBtc) {
        elements.unitToggleBtc.addEventListener('click', () => {
          displayUnit = 'btc';
          updateUnitToggle();
          compute();
        });
      }

      // BTC price method change
      elements.btcPriceMethodSelect.addEventListener('change', () => {
        updateBtcPriceDisplay();
        compute();
      });

      // Salary growth mode toggle (Nominal / Real)
      if (elements.nominalModeBtn) {
        elements.nominalModeBtn.addEventListener('click', () => {
          salaryGrowthMode = 'nominal';
          elements.nominalModeBtn.classList.add('mode-btn--active');
          elements.realModeBtn.classList.remove('mode-btn--active');
          if (elements.inflationGroup) elements.inflationGroup.classList.add('form-group--hidden');
          if (elements.realGrowthNote) elements.realGrowthNote.style.display = 'none';
          compute();
        });
      }
      if (elements.realModeBtn) {
        elements.realModeBtn.addEventListener('click', () => {
          salaryGrowthMode = 'real';
          elements.realModeBtn.classList.add('mode-btn--active');
          elements.nominalModeBtn.classList.remove('mode-btn--active');
          if (elements.inflationGroup) elements.inflationGroup.classList.remove('form-group--hidden');
          compute();
        });
      }
      if (elements.inflationInput) {
        elements.inflationInput.addEventListener('input', compute);
        elements.inflationInput.addEventListener('change', compute);
      }

      // BTC growth mode toggle (Custom / Historical CAGR / 5-Year CAGR)
      if (elements.btcCustomModeBtn)     elements.btcCustomModeBtn.addEventListener('click',     () => setBtcGrowthMode(BTC_GROWTH_MODES.CUSTOM));
      if (elements.btcHistoricalModeBtn) elements.btcHistoricalModeBtn.addEventListener('click', () => setBtcGrowthMode(BTC_GROWTH_MODES.HISTORICAL));
      if (elements.btc5yModeBtn)         elements.btc5yModeBtn.addEventListener('click',         () => setBtcGrowthMode(BTC_GROWTH_MODES.FIVE_YEAR));
      // Keep customBtcGrowth in sync with the input whenever the user types
      // while in Custom mode. (If they edit while readonly is set in another
      // mode, the browser blocks the write — so this is a no-op there.)
      if (elements.btcGrowthInput) {
        elements.btcGrowthInput.addEventListener('input', () => {
          if (btcGrowthMode === BTC_GROWTH_MODES.CUSTOM) {
            const v = parseFloat(elements.btcGrowthInput.value);
            if (!isNaN(v)) customBtcGrowth = v;
          }
        });
      }

      // Historical mode listeners
      if (elements.histStartYear) {
        elements.histStartYear.addEventListener('change', compute);
      }
      if (elements.histStartSalary) {
        elements.histStartSalary.addEventListener('input', compute);
        elements.histStartSalary.addEventListener('change', compute);
      }

      // Multi-benchmark toggle
      function setBenchmark(b) {
        activeBenchmark = b;
        benchmarkGrowthOverride = null;
        // Update button states
        [
          [elements.benchBtcBtn, 'btc'],
          [elements.benchSpxBtn, 'spx'],
          [elements.benchGoldBtn, 'gold'],
          [elements.benchCpiBtn, 'cpi']
        ].forEach(([btn, key]) => {
          if (btn) btn.classList.toggle('benchmark-btn--active', key === b);
        });
        // Show/hide benchmark growth panel
        if (elements.benchmarkPanel) {
          elements.benchmarkPanel.style.display = b === 'btc' ? 'none' : 'block';
        }
        if (b !== 'btc' && elements.benchmarkGrowthLabel && elements.benchmarkGrowthInput) {
          const bConfig = BENCHMARK_DATA[b];
          elements.benchmarkGrowthLabel.textContent = `${bConfig.name} Growth Rate (% per year)`;
          elements.benchmarkGrowthInput.value = bConfig.defaultGrowth;
        }
        compute();
      }
      if (elements.benchBtcBtn) elements.benchBtcBtn.addEventListener('click', () => setBenchmark('btc'));
      if (elements.benchSpxBtn) elements.benchSpxBtn.addEventListener('click', () => setBenchmark('spx'));
      if (elements.benchGoldBtn) elements.benchGoldBtn.addEventListener('click', () => setBenchmark('gold'));
      if (elements.benchCpiBtn) elements.benchCpiBtn.addEventListener('click', () => setBenchmark('cpi'));
      if (elements.benchmarkGrowthInput) {
        elements.benchmarkGrowthInput.addEventListener('input', () => {
          benchmarkGrowthOverride = parseFloat(elements.benchmarkGrowthInput.value) || null;
          compute();
        });
      }

      // Breakdown toggle
      if (elements.breakdownToggle) {
        elements.breakdownToggle.addEventListener('click', () => {
          showBreakdown = !showBreakdown;
          elements.breakdownToggle.textContent = showBreakdown ? 'Hide breakdown ←' : 'Show breakdown →';
          compute();
        });
      }

      // Share card
      if (elements.shareSaliBtn) {
        elements.shareSaliBtn.addEventListener('click', generateShareCard);
      }

      // Resize charts when window resizes (Chart.js ResizeObserver can get stale)
      window.addEventListener('resize', () => {
        if (chartInstance) {
          const parent = elements.saliChart.parentNode;
          chartInstance.resize(parent.clientWidth, parent.clientHeight);
        }
        if (normalizedChartInstance) {
          const normCanvas = document.getElementById('normalizedChart');
          if (normCanvas) {
            const parent = normCanvas.parentNode;
            normalizedChartInstance.resize(parent.clientWidth, parent.clientHeight);
          }
        }
        if (benchmarkChartInstance) {
          const bmCanvas = document.getElementById('benchmarkChart');
          if (bmCanvas) {
            benchmarkChartInstance.resize(bmCanvas.parentNode.clientWidth, bmCanvas.parentNode.clientHeight);
          }
        }
      });

      // Check whether the page was loaded with meaningful URL params (e.g. a
      // shared link). Must happen BEFORE the first compute() call because
      // compute() calls updateUrlParams() which will overwrite window.location.search.
      const _initParams = new URLSearchParams(window.location.search);
      hasInitialUrlParams = _initParams.has('salary') || _initParams.has('startYear') ||
                            _initParams.has('btcGrowth') || _initParams.has('forecast');

      // Initial compute — always run since salary has a default value
      compute();
      // After the first auto-compute, mark it done so subsequent user-triggered
      // computes will show the benchmark chart section.
      initComputeComplete = true;
    });
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
