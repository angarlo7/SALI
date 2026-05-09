/**
 * SALI - Satoshi Annual Labor Index
 * Calculator Engine
 *
 * Formula: SALI (sats/year) = (AnnualSalaryFiat / BitcoinPriceFiat) * 100,000,000
 */

(function() {
  'use strict';

  // Constants
  const SATS_PER_BTC = 100_000_000;
  const CURRENT_YEAR = new Date().getFullYear();
  const DEFAULT_BTC_GROWTH = 5;

  const BTC_GROWTH_MODES = {
    CUSTOM: 'custom',
    HISTORICAL: 'historical',
    FIVE_YEAR: '5y'
  };

  // Benchmark data
  const BENCHMARK_DATA = {
    spx: {
      name: 'S&P 500', unit: 'S&P units/yr', unitShort: 'S&P units',
      defaultGrowth: 10,
      annual: {
        // Year-end closing prices (Dec 31) — must match sp500_annual.json exactly
        2015: 2043, 2016: 2239, 2017: 2674, 2018: 2507, 2019: 3231,
        2020: 3756, 2021: 4766, 2022: 3840, 2023: 4770, 2024: 5881, 2025: 6846
      },
      growthLabel: 'S&P 500 Growth Rate (% per year)'
    },
    gold: {
      name: 'Gold', unit: 'troy oz/yr', unitShort: 'oz',
      defaultGrowth: 5,
      annual: {
        // Calendar-year arithmetic mean of daily spot prices (USD/troy oz)
        2015: 1161, 2016: 1251, 2017: 1257, 2018: 1268,
        2019: 1393, 2020: 1770, 2021: 1799, 2022: 1800,
        2023: 1943, 2024: 2395, 2025: 3446
      },
      growthLabel: 'Gold Price Growth Rate (% per year)'
    },
    cpi: {
      name: 'Real (CPI)', unit: 'CPI-adj units/yr', unitShort: 'CPI units',
      defaultGrowth: 3,
      annual: {
        // BLS CPI-U annual averages (1982-84=100)
        2015: 237.0, 2016: 240.0, 2017: 245.1, 2018: 251.1,
        2019: 255.7, 2020: 258.8, 2021: 271.0, 2022: 292.7,
        2023: 304.7, 2024: 313.5, 2025: 319.1
      },
      growthLabel: 'CPI / Inflation Rate (% per year)'
    }
  };

  // FX rates to USD — updated at init via fetchFxRates() (ECB/Frankfurter).
  // These fallback values are used only if the live fetch fails.
  const FX_RATES = {
    USD: 1,
    EUR: 1.08,
    MXN: 0.058
  };

  // STRC / Salary Under STRETCH
  // Variable Rate Series A Perpetual Stretch Preferred Stock — Nasdaq: STRC
  // Par/liquidation value $100. Rate is variable, adjusted monthly by Strategy (±0.25%/mo)
  // to keep market price near $100. Rate history: 9% (Jul 2025) → 11.5% (Apr 2026).
  const STRC_PAR = 100;
  const STRC_STATED_RATE = 0.115;        // 11.5% current monthly-adjusted rate (Apr 2026)
  const STRC_ANNUAL_DIV = STRC_PAR * STRC_STATED_RATE; // $11.50/share/yr
  const STRC_RATE_DATE = 'Apr 2026';
  const STRC_LAUNCH = new Date(2025, 6, 29); // July 29, 2025 - IPO close date

  // Known monthly rate snapshots since launch (approximate; ±0.25%/mo adjustments).
  // Each entry: [year, month (0-indexed), annualRate].
  const STRC_RATE_HISTORY = [
    [2025,  6, 0.0900],  // Jul 2025 - launch at 9.00%
    [2025,  7, 0.0925],  // Aug 2025
    [2025,  8, 0.0950],  // Sep 2025
    [2025,  9, 0.0975],  // Oct 2025
    [2025, 10, 0.1000],  // Nov 2025
    [2025, 11, 0.1025],  // Dec 2025
    [2026,  0, 0.1050],  // Jan 2026
    [2026,  1, 0.1075],  // Feb 2026
    [2026,  2, 0.1100],  // Mar 2026
    [2026,  3, 0.1150],  // Apr 2026 - held steady (first time)
  ];

  function strcAvgYield(fromDate, toDate) {
    const start = fromDate < STRC_LAUNCH ? STRC_LAUNCH : fromDate;
    const end   = toDate > new Date() ? new Date() : toDate;
    if (start >= end) return 0;
    let totalMs = 0, weightedRate = 0;
    for (let i = 0; i < STRC_RATE_HISTORY.length; i++) {
      const [yr, mo, rate] = STRC_RATE_HISTORY[i];
      const sliceStart = new Date(yr, mo, 1);
      const sliceEnd   = i + 1 < STRC_RATE_HISTORY.length
        ? new Date(STRC_RATE_HISTORY[i + 1][0], STRC_RATE_HISTORY[i + 1][1], 1)
        : new Date();
      const a = Math.max(start, sliceStart);
      const b = Math.min(end,   sliceEnd);
      if (b > a) { const ms = b - a; totalMs += ms; weightedRate += rate * ms; }
    }
    return totalMs > 0 ? weightedRate / totalMs : 0;
  }

  let strcEnabled = false;
  let strcPct = 10;
  let strcCurrentYield = STRC_STATED_RATE;
  let strcCurrentPrice = STRC_PAR;
  let strcDataSource = 'stated';

  let annualAverages = null;
  let spotPrice = null;
  let sp500JsonData = null;
  let goldJsonData = null;
  let cpiJsonData = null;
  let displayUnit = 'sats'; // 'sats' or 'btc'
  let salaryFrequency = 'annual'; // 'annual' | 'monthly'
  let salaryGrowthMode = 'nominal'; // 'nominal' or 'real'
  let btcGrowthMode = BTC_GROWTH_MODES.CUSTOM;
  let customBtcGrowth = DEFAULT_BTC_GROWTH;
  let customBenchmarkGrowth = 10;
  let activeBenchmark = 'btc';
  let showBreakdown = false;
  let chartInstance = null;
  let normalizedChartInstance = null;
  let benchmarkChartInstance = null;
  let initComputeComplete = false;

  // DOM Elements (cached after DOMContentLoaded)
  let elements = {};

  function formatCurrency(amount, currency) {
    const symbols = { USD: '$', EUR: '€', MXN: '$' };
    const symbol = symbols[currency] || '$';
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.round(amount));
    return `${symbol}${formatted} ${currency}`;
  }

  function formatUsdCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  function formatSats(sats) {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.round(sats));
  }

  function formatBtc(btc, decimals = 6) {
    return btc.toFixed(decimals) + ' BTC';
  }

  function formatPercent(pct) {
    const sign = pct >= 0 ? '+' : '';
    return sign + pct.toFixed(2) + '%';
  }

  function updateEquivalents(sats, btcEquivalent) {
    if (!elements.equivalentsGrid) return;
    if (!sats || isNaN(sats) || sats <= 0) {
      elements.equivalentsGrid.style.display = 'none';
      return;
    }
    const satsPerDay = sats / 260;
    const satsPerHour = sats / 2080;
    const pctOfBtc = btcEquivalent * 100;
    if (elements.equivSatsDay) elements.equivSatsDay.textContent = formatSats(satsPerDay);
    if (elements.equivSatsHour) elements.equivSatsHour.textContent = formatSats(satsPerHour);
    if (elements.equivPctBtc) elements.equivPctBtc.textContent = pctOfBtc.toFixed(4) + '%';
    elements.equivalentsGrid.style.display = 'grid';
  }

  function convertToUsd(amount, currency) {
    const rate = FX_RATES[currency];
    if (!rate) throw new Error(`Unknown currency: ${currency}`);
    return amount * rate;
  }

  function calculateSali(salaryUsd, btcPriceUsd) {
    if (btcPriceUsd <= 0) throw new Error('BTC price must be greater than zero');
    const btcEquivalent = salaryUsd / btcPriceUsd;
    const sats = btcEquivalent * SATS_PER_BTC;
    return { sats, btcEquivalent };
  }

  function generateProjections(salaryUsd, baseBtcPrice, salaryGrowth, btcGrowth, startYear, forecastYears) {
    const projections = [];
    const endYear = CURRENT_YEAR + forecastYears;
    for (let year = startYear; year <= endYear; year++) {
      const yearsFromCurrent = year - CURRENT_YEAR;
      const salaryYear = salaryUsd * Math.pow(1 + salaryGrowth / 100, yearsFromCurrent);
      let btcPriceYear;
      if (annualAverages && annualAverages[year]) {
        btcPriceYear = annualAverages[year];
      } else {
        const yearsFromBase = year - CURRENT_YEAR;
        btcPriceYear = baseBtcPrice * Math.pow(1 + btcGrowth / 100, yearsFromBase);
      }
      const { sats, btcEquivalent } = calculateSali(salaryYear, btcPriceYear);
      const isHistorical = annualAverages && annualAverages[year] !== undefined;
      const isCurrentYear = year === CURRENT_YEAR;
      projections.push({
        year, salary: salaryYear, btcPrice: btcPriceYear, sats, btcEquivalent,
        isHistorical, isCurrentYear
      });
    }
    return projections;
  }

  function computeSaliScore(projections, btcGrowth, salaryGrowth) {
    if (projections.length < 2) return { score: null, trend: 'neutral', description: 'Not enough data' };
    const currentYearData = projections.find(p => p.isCurrentYear);
    const firstYearData = projections[0];
    if (!currentYearData || !firstYearData) return { score: null, trend: 'neutral', description: 'Not enough data' };
    const years = currentYearData.year - firstYearData.year;
    if (years === 0) return { score: null, trend: 'neutral', description: 'Not enough data' };
    const annualRate = (Math.pow(currentYearData.sats / firstYearData.sats, 1 / years) - 1) * 100;
    const nominalSalaryGrowth = salaryGrowthMode === 'real'
      ? salaryGrowth + parseFloat(elements.inflationInput?.value || 3)
      : salaryGrowth;
    const gap = btcGrowth - nominalSalaryGrowth;
    let grade, tagline, colorClass;
    if (annualRate >= 0)         { grade = 'S'; tagline = 'Keeping pace with Bitcoin — extremely rare'; colorClass = 'sali-score__grade--S'; }
    else if (annualRate >= -10)  { grade = 'A'; tagline = 'Near-parity with Bitcoin appreciation'; colorClass = 'sali-score__grade--A'; }
    else if (annualRate >= -20)  { grade = 'B'; tagline = 'Above average — losing ground slowly'; colorClass = 'sali-score__grade--B'; }
    else if (annualRate >= -35)  { grade = 'C'; tagline = 'Typical salary trajectory vs Bitcoin'; colorClass = 'sali-score__grade--C'; }
    else if (annualRate >= -50)  { grade = 'D'; tagline = 'Bitcoin outpacing your salary significantly'; colorClass = 'sali-score__grade--D'; }
    else                         { grade = 'F'; tagline = 'Bitcoin appreciation far outpaces salary'; colorClass = 'sali-score__grade--F'; }
    const historicalChange = annualRate;
    let projectedChange = btcGrowth - nominalSalaryGrowth;
    const trend = projectedChange <= -10 ? 'declining' : projectedChange >= 0 ? 'growing' : 'stable';
    return { score: annualRate, grade, trend, description: tagline, colorClass, historicalChange, projectedChange, gap, annualRate };
  }

  function updateSaliScoreBadge(gradeData, btcGrowth, salaryGrowth) {
    if (!elements.saliScoreWrap || !gradeData || gradeData.score === null) {
      if (elements.saliScoreWrap) elements.saliScoreWrap.style.display = 'none';
      return;
    }
    const { grade, annualRate, gap, colorClass, tagline } = gradeData;
    const sign = annualRate >= 0 ? '+' : '';
    if (elements.saliScoreGrade) {
      elements.saliScoreGrade.textContent = grade;
      elements.saliScoreGrade.className = `sali-score__grade ${colorClass}`;
    }
    if (elements.saliScoreRate) elements.saliScoreRate.textContent = `${sign}${annualRate.toFixed(1)}% / yr Bitcoin purchasing power`;
    if (elements.saliScoreGap) {
      if (gap > 0.1) {
        elements.saliScoreGap.textContent = `Need +${gap.toFixed(1)}%/yr more salary growth to keep pace`;
      } else if (gap < -0.1) {
        elements.saliScoreGap.textContent = `Outpacing Bitcoin by ${Math.abs(gap).toFixed(1)}%/yr`;
      } else {
        elements.saliScoreGap.textContent = 'At break-even with Bitcoin';
      }
    }
    if (elements.saliScoreTagline) elements.saliScoreTagline.textContent = tagline;
    elements.saliScoreWrap.style.display = 'block';
  }

  function getThemeColors() {
    const dark = document.body.classList.contains('dark');
    return {
      text:          dark ? '#f0f0f0' : '#111111',
      textSecondary: dark ? '#cccccc' : '#555555',
      textMuted:     dark ? '#888888' : '#999999',
      bgCard:        dark ? '#1a1a1a' : '#ffffff',
      border:        dark ? '#333333' : '#e5e5e5',
      grid:          dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
    };
  }

  function updateShareLinks(gradeData) {
    const validGrades = new Set(['S', 'A', 'B', 'C', 'D', 'F']);
    const gradeUrl = (gradeData && validGrades.has(gradeData.grade))
      ? `https://sali.angarlo.com/share/${gradeData.grade}.html`
      : 'https://sali.angarlo.com';

    let shortText;
    if (gradeData) {
      const { grade, annualRate, gap } = gradeData;
      const rateStr = annualRate >= 0 ? `+${annualRate.toFixed(1)}%/yr` : `${annualRate.toFixed(1)}%/yr`;
      let hook;
      if (strcEnabled && strcPct > 0) {
        const boost = ((strcPct / 100) * strcCurrentYield * 100).toFixed(1);
        hook = annualRate >= 0
          ? `With ${strcPct}% in $STRC (+${boost}%/yr yield), my salary is keeping pace with Bitcoin. Grade: ${grade}.`
          : `${strcPct}% in $STRC adds ${boost}%/yr dividend income — closing the Bitcoin gap. Grade: ${grade} (${rateStr}).`;
      } else if (annualRate >= 0) {
        hook = `My salary is keeping pace with Bitcoin (${rateStr}). Grade: ${grade} — extremely rare.`;
      } else if (gap > 0.1) {
        hook = `My salary loses ${rateStr} to Bitcoin every year. A +${gap.toFixed(1)}%/yr raise would just break even. Grade: ${grade}.`;
      } else {
        hook = `My salary is right at Bitcoin break-even (${rateStr}). Grade: ${grade}.`;
      }
      const tags = strcEnabled && strcPct > 0 ? '#Bitcoin #SALI #STRC' : '#Bitcoin #SALI';
      shortText = `🟠 SALI — ${hook}\n\nCalculate yours: ${tags}`;
    } else {
      shortText = `🟠 How much is your salary worth in Bitcoin? Calculate your SALI Grade → #Bitcoin #SALI`;
    }

    const tweetHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shortText)}&url=${encodeURIComponent(gradeUrl)}`;
    if (elements.tweetSaliBtn) elements.tweetSaliBtn.href = tweetHref;
    if (elements.fbShareBtn) elements.fbShareBtn.href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(gradeUrl)}`;
    if (elements.liShareBtn) elements.liShareBtn.href = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(gradeUrl)}`;
    if (elements.redditShareBtn) {
      const redditTitle = gradeData
        ? `My SALI Grade: ${gradeData.grade} — How much is your salary worth in Bitcoin?`
        : 'How much is your salary worth in Bitcoin? — SALI Calculator';
      elements.redditShareBtn.href = `https://www.reddit.com/submit?url=${encodeURIComponent(gradeUrl)}&title=${encodeURIComponent(redditTitle)}`;
    }
  }

  function generateBenchmarkSeries(projections, benchmarkKey, customGrowth) {
    const bData = BENCHMARK_DATA[benchmarkKey];
    if (!bData) return [];
    const growth = customGrowth !== null ? customGrowth : bData.defaultGrowth;
    const baseYear = projections[0]?.year;
    const basePrice = bData.annual[baseYear];
    if (!basePrice) return [];
    return projections.map(p => {
      let benchPrice;
      if (bData.annual[p.year] !== undefined) {
        benchPrice = bData.annual[p.year];
      } else {
        const yearsFromBase = p.year - baseYear;
        benchPrice = basePrice * Math.pow(1 + growth / 100, yearsFromBase);
      }
      const benchValue = p.salary / benchPrice;
      return { ...p, benchPrice, benchValue, isHistorical: bData.annual[p.year] !== undefined };
    });
  }

  function updateHistoricalChange(projections) {
    const el = elements.historicalChangeGroup;
    const out = elements.historicalChangeOutput;
    const yearEl = elements.historicalChangeYear;
    if (!el || !out) return;
    const historical = projections.filter(p => p.isHistorical && !p.isCurrentYear);
    const first = historical[0];
    const current = projections.find(p => p.isCurrentYear);
    if (!current || !first || first === current) { el.style.display = 'none'; return; }
    const years = current.year - first.year;
    const annualRate = (Math.pow(current.sats / first.sats, 1 / years) - 1) * 100;
    const sign = annualRate >= 0 ? '+' : '';
    out.textContent = `${sign}${annualRate.toFixed(2)}% / yr (${first.year}–${current.year})`;
    if (yearEl) yearEl.textContent = first.year;
    el.style.display = 'block';
  }

  function makeSegmentFn(series) {
    return {
      borderDash: ctx => {
        const idx = ctx.p0DataIndex;
        const p = series[idx];
        return (!p || p.isHistorical || p.isCurrentYear) ? [] : [5, 4];
      }
    };
  }

  function renderNormalizedChart(projections) {
    const canvas = document.getElementById('normalizedChart');
    if (!canvas || !projections.length) return;
    const spxSeries  = generateBenchmarkSeries(projections, 'spx',  null);
    const goldSeries = generateBenchmarkSeries(projections, 'gold', null);
    const cpiSeries  = generateBenchmarkSeries(projections, 'cpi',  null);
    const btcStart  = projections[0].btcEquivalent;
    const spxStart  = spxSeries[0].benchValue;
    const goldStart = goldSeries[0].benchValue;
    const cpiStart  = cpiSeries[0].benchValue;
    if (!btcStart || !spxStart || !goldStart || !cpiStart) return;
    const labels = projections.map(p => p.year.toString());
    const currentYearIndex = projections.findIndex(p => p.isCurrentYear);
    // Inverted: higher = asset outpaced salary more (Bitcoin going UP = Bitcoin appreciated)
    const btcData  = projections.map(p => (btcStart / p.btcEquivalent) * 100);
    const spxData  = spxSeries.map(p  => (spxStart / p.benchValue)  * 100);
    const goldData = goldSeries.map(p => (goldStart / p.benchValue) * 100);
    const cpiData  = cpiSeries.map(p  => (cpiStart / p.benchValue)  * 100);
    const todayPlugin = {
      id: 'todayLine',
      afterDraw(chart) {
        if (currentYearIndex < 0) return;
        const { ctx, chartArea, scales } = chart;
        const x = scales.x.getPixelForIndex(currentYearIndex);
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'rgba(136,136,136,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, chartArea.top); ctx.lineTo(x, chartArea.bottom); ctx.stroke();
        ctx.setLineDash([]); ctx.fillStyle = '#888888'; ctx.font = '10px "Roboto Mono", monospace';
        ctx.textAlign = 'center'; ctx.fillText('Today', x, chartArea.top + 12); ctx.restore();
      }
    };
    if (normalizedChartInstance) normalizedChartInstance.destroy();
    const freshCtx = canvas.getContext('2d');
    const normTheme = getThemeColors();
    normalizedChartInstance = new Chart(freshCtx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Bitcoin',   data: btcData,  borderColor: '#F7931A', backgroundColor: 'transparent', borderWidth: 2.5, fill: false, tension: 0.3, pointRadius: projections.map(p => p.isCurrentYear ? 5 : 3), pointHoverRadius: 7, segment: makeSegmentFn(projections) },
          { label: 'S&P 500',  data: spxData,  borderColor: '#4A90D9', backgroundColor: 'transparent', borderWidth: 2,   fill: false, tension: 0.3, pointRadius: spxSeries.map(p => p.isCurrentYear ? 5 : 3),  pointHoverRadius: 7, segment: makeSegmentFn(spxSeries) },
          { label: 'Gold',     data: goldData, borderColor: '#C9A84C', backgroundColor: 'transparent', borderWidth: 2,   fill: false, tension: 0.3, pointRadius: goldSeries.map(p => p.isCurrentYear ? 5 : 3), pointHoverRadius: 7, segment: makeSegmentFn(goldSeries) },
          { label: 'Real (CPI)', data: cpiData, borderColor: '#6B9E6B', backgroundColor: 'transparent', borderWidth: 2,  fill: false, tension: 0.3, pointRadius: cpiSeries.map(p => p.isCurrentYear ? 5 : 3),  pointHoverRadius: 7, segment: makeSegmentFn(cpiSeries) }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 20 } },
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: { display: true, position: 'top', labels: { color: normTheme.textSecondary, usePointStyle: true, pointStyleWidth: 14, boxHeight: 8, font: { family: '"Roboto Mono", monospace', size: 12 } } },
          tooltip: {
            backgroundColor: normTheme.bgCard, borderColor: normTheme.border, borderWidth: 1,
            titleColor: normTheme.text, bodyColor: normTheme.textSecondary, padding: 12, displayColors: true,
            callbacks: {
              title: (ctx) => { const p = projections[ctx[0].dataIndex]; let t = p.year.toString(); if (p.isCurrentYear) t += ' (Current)'; else if (!p.isHistorical) t += ' (Projected)'; return t; },
              label: (ctx) => { const v = ctx.parsed.y; const d = v - 100; const s = d >= 0 ? '+' : ''; return `${ctx.dataset.label}: ${v.toFixed(1)}  (${s}${d.toFixed(1)}% vs start)`; }
            }
          }
        },
        scales: {
          x: { title: { display: true, text: 'Year', color: normTheme.textMuted }, ticks: { color: normTheme.textMuted }, grid: { color: normTheme.grid } },
          y: { beginAtZero: false, title: { display: true, text: 'Index (Start Year = 100)', color: normTheme.textMuted }, ticks: { color: normTheme.textMuted, callback: v => v.toFixed(0) }, grid: { color: normTheme.grid } }
        }
      },
      plugins: [todayPlugin]
    });
  }

  function updateSaliTier(userSats, btcPrice) {
    const wrap = elements.saliTierWrap;
    const badge = elements.saliTier;
    if (!wrap || !badge || !btcPrice) return;
    const saliFor = salary => (salary / btcPrice) * SATS_PER_BTC;
    const minWage = saliFor(15080); const median = saliFor(59000);
    const top25 = saliFor(100000); const top10 = saliFor(150000);
    let tier, dot;
    if (userSats >= top10)       { tier = 'Top 10%'; dot = '🔵'; }
    else if (userSats >= top25)  { tier = 'Top 25%'; dot = '🟡'; }
    else if (userSats >= median * 0.9 && userSats <= median * 1.1) { tier = 'Median'; dot = '⚪'; }
    else if (userSats >= minWage){ tier = 'Above Min Wage'; dot = '🟢'; }
    else                         { tier = 'Below Min Wage'; dot = '🔴'; }
    badge.textContent = `${dot} ${tier}`;
    wrap.style.display = 'block';
  }

  function updatePpNarrative(sats, btcPrice) {
    const el = elements.ppNarrative;
    if (!el) return;
    const currentSali = (spotPrice || btcPrice) > 0 ? (parseFloat(elements.salaryInput?.value || 0) * (salaryFrequency === 'monthly' ? 12 : 1) / (spotPrice || btcPrice)) * SATS_PER_BTC : 0;
    if (!currentSali || currentSali <= 0) { el.style.display = 'none'; return; }
    const pizzaPrice = 25; const coffeePrice = 6;
    const pizzasPerYear = Math.round(sats / (pizzaPrice / (spotPrice || btcPrice) * SATS_PER_BTC));
    const coffeesPerDay = (sats / (coffeePrice / (spotPrice || btcPrice) * SATS_PER_BTC) / 365).toFixed(1);
    el.innerHTML = `At today's price, your annual salary = <strong>${formatSats(sats)} sats</strong> — enough to buy roughly <strong>${pizzasPerYear.toLocaleString()} pizzas</strong> or <strong>${coffeesPerDay} coffees/day</strong>.`;
    el.style.display = 'block';
  }

  function renderChart(projections, currency, activeBenchmarkKey) {
    const canvas = elements.saliChart;
    if (!canvas) return;
    const theme = getThemeColors();
    const benchSeries = activeBenchmarkKey !== 'btc'
      ? generateBenchmarkSeries(projections, activeBenchmarkKey, customBenchmarkGrowth)
      : null;
    const labels = projections.map(p => p.year.toString());
    const currentYearIndex = projections.findIndex(p => p.isCurrentYear);
    const isShowingBtc = activeBenchmarkKey === 'btc';
    const primaryData  = projections.map(p => displayUnit === 'btc' ? p.btcEquivalent : p.sats);
    const benchData    = benchSeries ? benchSeries.map(p => p.benchValue) : null;
    const todayPlugin = {
      id: 'todayLine',
      afterDraw(chart) {
        if (currentYearIndex < 0) return;
        const { ctx, chartArea, scales } = chart;
        const x = scales.x.getPixelForIndex(currentYearIndex);
        ctx.save();
        ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(136,136,136,0.5)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, chartArea.top); ctx.lineTo(x, chartArea.bottom); ctx.stroke();
        ctx.setLineDash([]); ctx.fillStyle = '#888888'; ctx.font = '10px "Roboto Mono", monospace';
        ctx.textAlign = 'center'; ctx.fillText('Today', x, chartArea.top + 12); ctx.restore();
      }
    };
    const datasets = [{
      label: displayUnit === 'btc' ? 'BTC/year' : 'Sats/year',
      data: primaryData,
      borderColor: '#F7931A',
      backgroundColor: 'rgba(247,147,26,0.08)',
      borderWidth: 2.5, fill: true, tension: 0.3,
      pointRadius: projections.map(p => p.isCurrentYear ? 5 : 3),
      pointHoverRadius: 7,
      segment: makeSegmentFn(projections)
    }];
    if (benchData && benchSeries) {
      const bColors = { spx: '#4A90D9', gold: '#C9A84C', cpi: '#6B9E6B' };
      datasets.push({
        label: BENCHMARK_DATA[activeBenchmarkKey]?.unitShort || activeBenchmarkKey,
        data: benchData,
        borderColor: bColors[activeBenchmarkKey] || '#888888',
        backgroundColor: 'transparent',
        borderWidth: 2, fill: false, tension: 0.3,
        pointRadius: benchSeries.map(p => p.isCurrentYear ? 5 : 3),
        pointHoverRadius: 7,
        segment: makeSegmentFn(benchSeries),
        yAxisID: 'y2'
      });
    }
    if (chartInstance) chartInstance.destroy();
    const freshCtx = canvas.getContext('2d');
    chartInstance = new Chart(freshCtx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        layout: { padding: { top: 20 } },
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: { display: !!benchData, position: 'top', labels: { color: theme.textSecondary, usePointStyle: true, font: { family: '"Roboto Mono", monospace', size: 12 } } },
          tooltip: {
            backgroundColor: theme.bgCard, borderColor: theme.border, borderWidth: 1,
            titleColor: theme.text, bodyColor: theme.textSecondary, padding: 12, displayColors: true,
            callbacks: {
              title: (ctx) => { const p = projections[ctx[0].dataIndex]; let t = p.year.toString(); if (p.isCurrentYear) t += ' (Current)'; else if (!p.isHistorical) t += ' (Projected)'; return t; },
              label: (ctx) => {
                if (ctx.datasetIndex === 0) {
                  const v = ctx.parsed.y;
                  return displayUnit === 'btc' ? `SALI: ${v.toFixed(6)} BTC/yr` : `SALI: ${formatSats(v)} sats/yr`;
                }
                return `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(4)}`;
              }
            }
          }
        },
        scales: {
          x: { ticks: { color: theme.textMuted }, grid: { color: theme.grid } },
          y: {
            type: 'linear', position: 'left',
            title: { display: true, text: displayUnit === 'btc' ? 'BTC / year' : 'Sats / year', color: theme.textMuted },
            ticks: { color: theme.textMuted, callback: v => displayUnit === 'btc' ? v.toFixed(4) : formatSats(v) },
            grid: { color: theme.grid }
          },
          ...(benchData ? { y2: { type: 'linear', position: 'right', title: { display: true, text: BENCHMARK_DATA[activeBenchmarkKey]?.unit || '', color: theme.textMuted }, ticks: { color: theme.textMuted }, grid: { drawOnChartArea: false } } } : {})
        }
      },
      plugins: [todayPlugin]
    });
    const titleEl = document.getElementById('chartTitle');
    if (titleEl) titleEl.textContent = activeBenchmarkKey === 'btc' ? 'SALI Over Time' : `SALI vs ${BENCHMARK_DATA[activeBenchmarkKey]?.name || activeBenchmarkKey}`;
  }

  function renderTable(projections, currency) {
    if (!elements.projectionTableBody) return;
    const headerRow = document.querySelector('#mainProjectionTable thead tr');
    if (headerRow) {
      if (headerRow.cells[3]) headerRow.cells[3].textContent = displayUnit === 'btc' ? 'SALI (BTC)' : 'SALI (sats)';
      if (headerRow.cells[1]) headerRow.cells[1].textContent = salaryGrowthMode === 'real' ? 'Salary (Real)' : 'Salary';
    }
    const breakdownThs = document.querySelectorAll('#mainProjectionTable thead .breakdown-col');
    breakdownThs.forEach(th => { th.style.display = showBreakdown ? '' : 'none'; });
    const firstFutureIdx = projections.findIndex(p => !p.isHistorical && p.year > CURRENT_YEAR);
    elements.projectionTableBody.innerHTML = projections.map((p, idx) => {
      let rowClass = p.isCurrentYear ? 'current-year-row' : (p.isHistorical ? '' : 'projected-row');
      const salaryDisplay = formatCurrency(p.salary, currency);
      const btcPriceDisplay = formatUsdCurrency(p.btcPrice);
      const saliDisplay = displayUnit === 'btc' ? formatBtc(p.btcEquivalent) : formatSats(p.sats) + ' sats';
      let salaryEffect = '', btcEffect = '';
      if (showBreakdown && idx > 0) {
        const prev = projections[idx - 1];
        const salaryImpact = ((prev.salary / p.btcPrice) * SATS_PER_BTC - prev.sats);
        const btcImpact = (p.sats - (prev.salary / p.btcPrice) * SATS_PER_BTC);
        const fmt = v => (v >= 0 ? '+' : '') + formatSats(Math.abs(v)) + (v >= 0 ? '▲' : '▼');
        salaryEffect = fmt(salaryImpact); btcEffect = fmt(btcImpact);
      }
      const isFuture = !p.isHistorical && p.year > CURRENT_YEAR;
      return `<tr class="${rowClass}">
        <td>${p.year}${isFuture ? '*' : ''}</td>
        <td>${salaryDisplay}</td>
        <td>${btcPriceDisplay}</td>
        <td>${saliDisplay}</td>
        ${showBreakdown ? `<td class="breakdown-col">${salaryEffect}</td><td class="breakdown-col">${btcEffect}</td>` : ''}
      </tr>`;
    }).join('');
    const breakdownCols = document.querySelectorAll('#mainProjectionTable tbody .breakdown-col');
    breakdownCols.forEach(td => { td.style.display = showBreakdown ? '' : 'none'; });
  }

  function renderHistoryTable(histProjections) {
    if (!elements.historyTableBody) return;
    elements.historyTableBody.innerHTML = histProjections.map((p, idx) => {
      const yoy = idx === 0 ? '—' : (() => {
        const prev = histProjections[idx - 1];
        const change = ((p.sats - prev.sats) / prev.sats) * 100;
        return (change >= 0 ? '+' : '') + change.toFixed(1) + '%';
      })();
      return `<tr>
        <td>${p.year}</td>
        <td>${formatCurrency(p.salary, 'USD')}</td>
        <td>${formatUsdCurrency(p.btcPrice)}</td>
        <td>${formatSats(p.sats)} sats</td>
        <td>${yoy}</td>
      </tr>`;
    }).join('');
  }

  function showStatus(message, type = 'info') {
    if (!elements.statusOutput) return;
    elements.statusOutput.textContent = message;
    elements.statusOutput.className = 'status';
    if (message) elements.statusOutput.classList.add(`status--${type}`);
  }

  function clearStatus() {
    if (elements.statusOutput) {
      elements.statusOutput.textContent = '';
      elements.statusOutput.className = 'status';
    }
  }

  function validateInputs() {
    const salaryRaw = parseFloat(elements.salaryInput.value);
    if (isNaN(salaryRaw) || salaryRaw <= 0) throw new Error('Please enter a valid salary.');
    const salary = salaryFrequency === 'monthly' ? salaryRaw * 12 : salaryRaw;
    const salaryGrowth = parseFloat(elements.salaryGrowthInput.value) || 0;
    if (salaryGrowth < -100 || salaryGrowth > 1000) throw new Error('Salary growth rate must be between -100% and 1000%.');
    const btcGrowth = parseFloat(elements.btcGrowthInput.value) || 0;
    if (btcGrowth < -100 || btcGrowth > 1000) throw new Error('BTC growth rate must be between -100% and 1000%.');
    const startYear = parseInt(elements.startYearSelect.value);
    const forecastYears = parseInt(elements.yearsSelect.value);
    return { salary, salaryGrowth, btcGrowth, startYear, forecastYears };
  }

  function getBtcPrice() {
    const method = elements.btcPriceMethodSelect?.value || 'spot';
    if (method === 'spot') {
      if (spotPrice === null) throw new Error('Spot price not available. Try Manual mode.');
      return spotPrice;
    } else if (method === 'annual') {
      if (!annualAverages) throw new Error('Annual average data not loaded.');
      const years = Object.keys(annualAverages).map(Number).sort((a, b) => b - a);
      const recentYear = years[0];
      if (!recentYear) throw new Error('No annual average data available.');
      return annualAverages[recentYear];
    } else {
      const manualPrice = parseFloat(elements.btcPriceManualInput?.value);
      if (isNaN(manualPrice) || manualPrice <= 0) throw new Error('Please enter a valid BTC price.');
      return manualPrice;
    }
  }

  function updateBtcPriceDisplay() {
    if (!elements.btcPriceDisplay) return;
    const method = elements.btcPriceMethodSelect?.value || 'spot';
    let displayText = '';
    if (method === 'spot') {
      displayText = spotPrice !== null ? `Spot: ${formatUsdCurrency(spotPrice)}` : 'Loading spot price...';
    } else if (method === 'annual') {
      if (annualAverages) {
        const years = Object.keys(annualAverages).map(Number).filter(n => !isNaN(n)).sort((a, b) => b - a);
        const recentYear = years[0];
        const isStale = recentYear < CURRENT_YEAR;
        displayText = recentYear ? `${recentYear} Avg: ${formatUsdCurrency(annualAverages[recentYear])}${isStale ? ' — most recent full year' : ''}` : 'Loading...';
      } else { displayText = 'Loading...'; }
    } else { displayText = ''; }
    elements.btcPriceDisplay.textContent = displayText;
  }

  function updateDecompSummary(projections, salaryGrowth, btcGrowth) {
    const el = elements.decompSummary;
    if (!el) return;
    const current = projections.find(p => p.isCurrentYear);
    const next = projections.find(p => p.year === CURRENT_YEAR + 1);
    if (!current || !next) { el.style.display = 'none'; return; }
    const saliChange = ((next.sats - current.sats) / current.sats) * 100;
    const nomSalGrowth = salaryGrowthMode === 'real'
      ? salaryGrowth + parseFloat(elements.inflationInput?.value || 3)
      : salaryGrowth;
    const salaryEffect = nomSalGrowth;
    const btcEffect = -(btcGrowth / (1 + btcGrowth / 100));
    el.innerHTML = `Next year SALI change: <strong>${saliChange >= 0 ? '+' : ''}${saliChange.toFixed(1)}%</strong> — Salary effect: <span class="${nomSalGrowth >= 0 ? 'positive' : 'negative'}">${nomSalGrowth >= 0 ? '+' : ''}${nomSalGrowth.toFixed(1)}%</span> · BTC price effect: <span class="negative">${btcEffect.toFixed(1)}%</span>`;
    el.style.display = 'block';
  }

  function buildBenchmarkChart(startYear) {
    const canvas = document.getElementById('benchmarkChart');
    const section = document.getElementById('benchmarkSection');
    if (!canvas || !section) return;
    if (!annualAverages || !sp500JsonData || !goldJsonData || !cpiJsonData) return;
    const latestYear = Math.max(
      ...Object.keys(annualAverages).map(Number).filter(n => !isNaN(n)),
      ...Object.keys(sp500JsonData).map(Number).filter(n => !isNaN(n)),
      ...Object.keys(goldJsonData).map(Number).filter(n => !isNaN(n)),
      ...Object.keys(cpiJsonData).map(Number).filter(n => !isNaN(n))
    );
    const years = [];
    for (let y = startYear; y <= latestYear; y++) {
      if (annualAverages[y] && sp500JsonData[y] && goldJsonData[y] && cpiJsonData[y]) years.push(y);
    }
    if (years.length < 2) { section.style.display = 'none'; return; }
    const baseBtc = annualAverages[years[0]]; const baseSpx = sp500JsonData[years[0]];
    const baseGold = goldJsonData[years[0]]; const baseCpi = cpiJsonData[years[0]];
    const bmTheme = getThemeColors();
    const data = {
      labels: years.map(String),
      datasets: [
        { label: 'Bitcoin', data: years.map(y => (annualAverages[y] / baseBtc) * 100), borderColor: '#F7931A', backgroundColor: 'transparent', borderWidth: 2.5, tension: 0.3, pointRadius: 3, fill: false },
        { label: 'S&P 500', data: years.map(y => (sp500JsonData[y] / baseSpx) * 100), borderColor: '#4CAF50', backgroundColor: 'transparent', borderWidth: 2, tension: 0.3, pointRadius: 3, fill: false },
        { label: 'Gold',    data: years.map(y => (goldJsonData[y] / baseGold) * 100), borderColor: '#FFD700', backgroundColor: 'transparent', borderWidth: 2, tension: 0.3, pointRadius: 3, fill: false },
        { label: 'CPI',     data: years.map(y => (cpiJsonData[y] / baseCpi) * 100), borderColor: '#9E9E9E', backgroundColor: 'transparent', borderWidth: 2, tension: 0.3, pointRadius: 3, fill: false }
      ]
    };
    if (benchmarkChartInstance) benchmarkChartInstance.destroy();
    benchmarkChartInstance = new Chart(canvas.getContext('2d'), {
      type: 'line', data,
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { color: bmTheme.textSecondary, font: { family: '"Roboto Mono", monospace', size: 11 } } },
          tooltip: { backgroundColor: bmTheme.bgCard, borderColor: bmTheme.border, borderWidth: 1, titleColor: bmTheme.text, bodyColor: bmTheme.textSecondary,
            callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}` } },
          title: { display: true, text: `Normalized Growth Since ${startYear} (Base = 100)`, color: bmTheme.text, font: { size: 13 } }
        },
        scales: {
          x: { ticks: { color: bmTheme.textMuted }, grid: { color: bmTheme.grid } },
          y: { beginAtZero: false, ticks: { color: bmTheme.textMuted, callback: v => v.toFixed(0) }, grid: { color: bmTheme.grid },
            title: { display: true, text: 'Index (Base Year = 100)', color: bmTheme.textMuted } }
        }
      }
    });
    section.style.display = 'block';
  }

  async function fetchFxRates() {
    try {
      const response = await fetch(
        'https://api.frankfurter.app/latest?from=USD&to=EUR,MXN',
        { signal: AbortSignal.timeout(5000) }
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data.rates) {
        if (data.rates.EUR) FX_RATES.EUR = 1 / data.rates.EUR;
        if (data.rates.MXN) FX_RATES.MXN = 1 / data.rates.MXN;
      }
    } catch (e) { /* use fallback rates */ }
  }

  async function fetchSpotPrice() {
    try {
      const response = await fetch(
        'https://api.coinbase.com/v2/prices/BTC-USD/spot',
        { signal: AbortSignal.timeout(5000) }
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!data.data || !data.data.amount) throw new Error('Invalid response format');
      spotPrice = parseFloat(data.data.amount);
    } catch (e) { spotPrice = null; }
  }

  async function loadAnnualAverages() {
    try {
      const response = await fetch('/data/btc_annual_avg_usd.json');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      annualAverages = {};
      Object.entries(data).forEach(([k, v]) => { if (!isNaN(Number(k))) annualAverages[Number(k)] = v; });
    } catch (e) { annualAverages = null; }
  }

  function computeBtcCagrs() {
    if (!annualAverages) return null;
    const years = Object.keys(annualAverages).map(Number).sort((a, b) => a - b);
    if (years.length < 2) return null;
    const earliest = years[0]; const latest = years[years.length - 1];
    const earliestPrice = annualAverages[earliest]; const latestPrice = annualAverages[latest];
    const historicalYears = latest - earliest;
    const historical = historicalYears > 0 ? (Math.pow(latestPrice / earliestPrice, 1 / historicalYears) - 1) * 100 : null;
    const fiveStart = latest - 5;
    const fiveStartPrice = annualAverages[fiveStart];
    const fiveYear = fiveStartPrice ? (Math.pow(latestPrice / fiveStartPrice, 1 / 5) - 1) * 100 : null;
    return { historical, fiveYear, historicalSpan: [earliest, latest], fiveYearSpan: [fiveStart, latest] };
  }

  function updateBtcGrowthDisplay() {
    if (!elements.btcGrowthInput) return;
    const cagrs = computeBtcCagrs();
    const historicalBtn = document.getElementById('btcHistoricalModeBtn');
    const fiveYearBtn = document.getElementById('btc5yModeBtn');
    if (cagrs) {
      if (historicalBtn && cagrs.historical !== null) {
        historicalBtn.title = `${cagrs.historical.toFixed(1)}% CAGR (${cagrs.historicalSpan[0]}–${cagrs.historicalSpan[1]})`;
      }
      if (fiveYearBtn && cagrs.fiveYear !== null) {
        fiveYearBtn.title = `${cagrs.fiveYear.toFixed(1)}% CAGR (${cagrs.fiveYearSpan[0]}–${cagrs.fiveYearSpan[1]})`;
      }
    }
    if (btcGrowthMode === BTC_GROWTH_MODES.HISTORICAL && cagrs?.historical !== null) {
      elements.btcGrowthInput.value = cagrs.historical.toFixed(1);
    } else if (btcGrowthMode === BTC_GROWTH_MODES.FIVE_YEAR && cagrs?.fiveYear !== null) {
      elements.btcGrowthInput.value = cagrs.fiveYear.toFixed(1);
    }
  }

  async function loadBenchmarkData() {
    try {
      const [sp500Resp, goldResp, cpiResp] = await Promise.all([
        fetch('/data/sp500_annual.json'),
        fetch('/data/gold_annual_avg_usd.json'),
        fetch('/data/cpi_annual.json')
      ]);
      if (sp500Resp.ok) sp500JsonData = await sp500Resp.json();
      if (goldResp.ok)  goldJsonData  = await goldResp.json();
      if (cpiResp.ok)   cpiJsonData   = await cpiResp.json();
      if (sp500JsonData) Object.keys(sp500JsonData).forEach(y => { if (!isNaN(Number(y))) BENCHMARK_DATA.spx.annual[y] = sp500JsonData[y]; });
      if (goldJsonData)  Object.keys(goldJsonData).forEach(y => {  if (!isNaN(Number(y))) BENCHMARK_DATA.gold.annual[y] = goldJsonData[y]; });
      if (cpiJsonData)   Object.keys(cpiJsonData).forEach(y => {   if (!isNaN(Number(y))) BENCHMARK_DATA.cpi.annual[y] = cpiJsonData[y]; });
    } catch (e) { /* use built-in fallback data */ }
  }

  async function fetchStrcData() {
    const display = elements.strcYieldDisplay;
    try {
      const response = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/STRC?interval=1d&range=1d', { signal: AbortSignal.timeout(6000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
      if (price && price > 0) {
        strcCurrentYield = STRC_ANNUAL_DIV / price;
        strcCurrentPrice = price;
        strcDataSource = 'live';
      } else { throw new Error('No price data'); }
    } catch (e) {
      strcCurrentPrice = STRC_PAR;
      strcCurrentYield = STRC_STATED_RATE;
      strcDataSource = 'stated';
    }
    updateStrcYieldDisplay();
  }

  function updateStrcYieldDisplay() {
    const display = elements.strcYieldDisplay;
    if (!display) return;
    const yieldPct = (strcCurrentYield * 100).toFixed(2);
    const priceStr = formatUsdCurrency(strcCurrentPrice);
    const tag = strcDataSource === 'live' ? 'Yahoo Finance live' : `stated rate as of ${STRC_RATE_DATE}`;
    display.textContent = `$STRC ${priceStr} · ${yieldPct}% yield (${tag} · launched Jul 2025 · rate adjusts monthly)`;
  }

  function updateStrcOutputs(salary, currency) {
    const wrap = elements.strcOutputWrap;
    if (!wrap) return;
    if (!strcEnabled || !salary || salary <= 0) { wrap.style.display = 'none'; return; }
    const salaryUsd = convertToUsd(salary, currency);
    const strcAlloc = salaryUsd * (strcPct / 100);
    const remainingUsd = salaryUsd - strcAlloc;
    const shares = strcAlloc / strcCurrentPrice;
    const annualDiv = shares * (strcCurrentYield * strcCurrentPrice);
    if (elements.strcAllocOutput) elements.strcAllocOutput.textContent = formatUsdCurrency(strcAlloc);
    if (elements.strcDivOutput) elements.strcDivOutput.textContent = formatUsdCurrency(annualDiv) + '/yr';
    if (elements.strcRemainOutput) elements.strcRemainOutput.textContent = formatUsdCurrency(remainingUsd);
    const yieldPct = (strcCurrentYield * 100).toFixed(2);
    const note = elements.strcYieldNote;
    if (note) note.textContent = `At ${strcCurrentPrice === STRC_PAR ? 'par ($' + STRC_PAR + ')' : formatUsdCurrency(strcCurrentPrice)}, ${strcPct}% → ${shares.toFixed(0)} shares × ${yieldPct}% yield = ${formatUsdCurrency(annualDiv)}/yr dividend income.`;
    wrap.style.display = 'block';
  }

  function populateYearSelects() {
    if (!elements.startYearSelect || !elements.histStartYear) return;
    const startYears = [];
    for (let y = 2015; y <= CURRENT_YEAR; y++) startYears.push(y);
    elements.startYearSelect.innerHTML = startYears.map(y =>
      `<option value="${y}"${y === 2020 ? ' selected' : ''}>${y}</option>`
    ).join('');
    elements.histStartYear.innerHTML = startYears.map(y =>
      `<option value="${y}"${y === 2020 ? ' selected' : ''}>${y}</option>`
    ).join('');
    if (!elements.yearsSelect) return;
    const horizons = [3, 5, 7, 10, 15, 20];
    elements.yearsSelect.innerHTML = horizons.map(h =>
      `<option value="${h}"${h === 10 ? ' selected' : ''}>${h} years</option>`
    ).join('');
  }

  function compute() {
    clearStatus();
    try {
      const { salary, salaryGrowth, btcGrowth, startYear, forecastYears } = validateInputs();
      const currency = elements.currencySelect?.value || 'USD';
      let effectiveSalaryGrowth = salaryGrowth;
      if (salaryGrowthMode === 'real') {
        const inflation = parseFloat(elements.inflationInput?.value || 3);
        effectiveSalaryGrowth = ((1 + salaryGrowth / 100) * (1 + inflation / 100) - 1) * 100;
        if (elements.realGrowthNote) {
          elements.realGrowthNote.textContent = `Real ${salaryGrowth}% + ${inflation}% CPI = ~${effectiveSalaryGrowth.toFixed(1)}% nominal growth`;
          elements.realGrowthNote.style.display = 'block';
        }
      } else {
        if (elements.realGrowthNote) elements.realGrowthNote.style.display = 'none';
      }
      const salaryUsd = convertToUsd(salary, currency);
      const btcPrice = getBtcPrice();
      const projections = generateProjections(salaryUsd, btcPrice, effectiveSalaryGrowth, btcGrowth, startYear, forecastYears);
      const currentProj = projections.find(p => p.isCurrentYear) || projections[projections.length - 1];
      const { sats, btcEquivalent } = currentProj;
      if (elements.saliSatsOutput) {
        elements.saliSatsOutput.textContent = displayUnit === 'btc'
          ? formatBtc(btcEquivalent) + '/year'
          : formatSats(sats) + ' sats/year';
      }
      if (elements.saliBtcOutput && elements.btcOutputGroup) {
        if (displayUnit === 'sats') {
          elements.saliBtcOutput.textContent = formatBtc(btcEquivalent) + '/year';
          elements.btcOutputGroup.style.display = 'block';
        } else {
          elements.btcOutputGroup.style.display = 'none';
        }
      }
      updateEquivalents(sats, btcEquivalent);
      updateStrcOutputs(salary, currency);
      const gradeData = computeSaliScore(projections, btcGrowth, salaryGrowth);
      updateSaliScoreBadge(gradeData, btcGrowth, salaryGrowth);
      updateShareLinks(gradeData);
      if (elements.shareRow) elements.shareRow.style.display = 'grid';
      const breakevenRate = btcGrowth;
      if (elements.breakevenRateOutput) elements.breakevenRateOutput.textContent = `+${breakevenRate.toFixed(1)}% / year`;
      const yearsAhead = 5;
      const breakevenSal5 = salaryUsd * Math.pow(1 + breakevenRate / 100, yearsAhead);
      const projSal5 = salaryUsd * Math.pow(1 + effectiveSalaryGrowth / 100, yearsAhead);
      if (elements.breakevenSalary5) elements.breakevenSalary5.textContent = formatUsdCurrency(breakevenSal5);
      if (elements.projectedSalary5) elements.projectedSalary5.textContent = formatUsdCurrency(projSal5);
      const gapEl = elements.breakevenGap;
      if (gapEl) {
        const diff = projSal5 - breakevenSal5;
        if (Math.abs(diff) > 100) {
          gapEl.textContent = diff > 0 ? `Your salary will exceed break-even by ${formatUsdCurrency(diff)} in 5 years` : `You'll be ${formatUsdCurrency(Math.abs(diff))} short of break-even in 5 years`;
          gapEl.className = `breakeven-gap ${diff > 0 ? 'positive' : 'negative'}`;
          gapEl.style.display = 'block';
        } else { gapEl.style.display = 'none'; }
      }
      const yoyEl = elements.saliYoyOutput;
      const descEl = elements.projectedChangeDesc;
      const labelEl = elements.projectedChangeLabel;
      if (yoyEl) {
        const futureProjs = projections.filter(p => p.year > CURRENT_YEAR);
        if (futureProjs.length >= 2) {
          const nextYear = futureProjs[0]; const yearAfter = futureProjs[1];
          const change = ((yearAfter.sats - nextYear.sats) / nextYear.sats) * 100;
          yoyEl.textContent = (change >= 0 ? '+' : '') + change.toFixed(2) + '% / year';
          if (labelEl) labelEl.textContent = 'Projected Change';
          if (descEl) descEl.textContent = `SALI change from ${nextYear.year} to ${yearAfter.year} at current growth assumptions`;
        }
      }
      updateHistoricalChange(projections);
      updateDecompSummary(projections, salaryGrowth, btcGrowth);
      updateSaliTier(sats, btcPrice);
      updatePpNarrative(sats, btcPrice);
      renderChart(projections, currency, activeBenchmark);
      renderNormalizedChart(projections);
      buildBenchmarkChart(startYear);
      updateBtcPriceDisplay();
      const histSalary = parseFloat(elements.histStartSalary?.value);
      const histStartYr = parseInt(elements.histStartYear?.value);
      if (histSalary > 0 && histStartYr && annualAverages) {
        const histProjections = [];
        for (let y = histStartYr; y <= CURRENT_YEAR; y++) {
          const price = annualAverages[y];
          if (!price) continue;
          const yearsFromStart = y - histStartYr;
          const sal = histSalary * Math.pow(1 + effectiveSalaryGrowth / 100, yearsFromStart);
          const { sats: s, btcEquivalent: b } = calculateSali(sal, price);
          histProjections.push({ year: y, salary: sal, btcPrice: price, sats: s, btcEquivalent: b });
        }
        if (histProjections.length > 0) {
          renderHistoryTable(histProjections);
          if (elements.historyResults) elements.historyResults.style.display = 'block';
          const first = histProjections[0]; const last = histProjections[histProjections.length - 1];
          const totalChange = ((last.sats - first.sats) / first.sats) * 100;
          const summaryEl = document.getElementById('historySummary');
          if (summaryEl) summaryEl.innerHTML = `From ${first.year} to ${last.year}: SALI went from <strong>${formatSats(first.sats)} sats</strong> to <strong>${formatSats(last.sats)} sats</strong> — a <strong>${totalChange >= 0 ? '+' : ''}${totalChange.toFixed(1)}%</strong> change.`;
        }
      }
      document.title = gradeData?.grade ? `SALI Grade: ${gradeData.grade} | Satoshi Annual Labor Index` : 'SALI | Satoshi Annual Labor Index';
      initComputeComplete = true;
    } catch (err) {
      showStatus(err.message, 'error');
    }
  }

  async function init() {
    await Promise.all([fetchFxRates(), fetchSpotPrice(), loadAnnualAverages(), loadBenchmarkData(), fetchStrcData()]);
    populateYearSelects();
    updateBtcGrowthDisplay();
    updateBtcPriceDisplay();

    elements = {
      salaryInput: document.getElementById('salaryInput'),
      salaryGrowthInput: document.getElementById('salaryGrowthInput'),
      currencySelect: document.getElementById('currencySelect'),
      fxWarning: document.getElementById('fxWarning'),
      btcPriceMethodSelect: document.getElementById('btcPriceMethodSelect'),
      btcPriceDisplay: document.getElementById('btcPriceDisplay'),
      btcPriceManualInput: document.getElementById('btcPriceManualInput'),
      btcGrowthInput: document.getElementById('btcGrowthInput'),
      startYearSelect: document.getElementById('startYearSelect'),
      yearsSelect: document.getElementById('yearsSelect'),
      saliSatsOutput: document.getElementById('saliSatsOutput'),
      saliBtcOutput: document.getElementById('saliBtcOutput'),
      btcOutputGroup: document.getElementById('btcOutputGroup'),
      saliChart: document.getElementById('saliChart'),
      projectionTableBody: document.getElementById('projectionTableBody'),
      statusOutput: document.getElementById('statusOutput'),
      unitToggleSats: document.getElementById('unitToggleSats'),
      unitToggleBtc: document.getElementById('unitToggleBtc'),
      equivalentsGrid: document.getElementById('equivalentsGrid'),
      equivSatsDay: document.getElementById('equivSatsDay'),
      equivSatsHour: document.getElementById('equivSatsHour'),
      equivPctBtc: document.getElementById('equivPctBtc'),
      nominalModeBtn: document.getElementById('nominalModeBtn'),
      realModeBtn: document.getElementById('realModeBtn'),
      inflationGroup: document.getElementById('inflationGroup'),
      inflationInput: document.getElementById('inflationInput'),
      realGrowthNote: document.getElementById('realGrowthNote'),
      btcCustomModeBtn: document.getElementById('btcCustomModeBtn'),
      btcHistoricalModeBtn: document.getElementById('btcHistoricalModeBtn'),
      btc5yModeBtn: document.getElementById('btc5yModeBtn'),
      benchBtcBtn: document.getElementById('benchBtcBtn'),
      benchSpxBtn: document.getElementById('benchSpxBtn'),
      benchGoldBtn: document.getElementById('benchGoldBtn'),
      benchCpiBtn: document.getElementById('benchCpiBtn'),
      benchmarkPanel: document.getElementById('benchmarkPanel'),
      benchmarkGrowthInput: document.getElementById('benchmarkGrowthInput'),
      benchmarkGrowthLabel: document.getElementById('benchmarkGrowthLabel'),
      salaryAnnualBtn: document.getElementById('salaryAnnualBtn'),
      salaryMonthlyBtn: document.getElementById('salaryMonthlyBtn'),
      gradeShareBtn: document.getElementById('gradeShareBtn'),
      shareRow: document.getElementById('shareRow'),
      tweetSaliBtn: document.getElementById('tweetSaliBtn'),
      fbShareBtn: document.getElementById('fbShareBtn'),
      liShareBtn: document.getElementById('liShareBtn'),
      redditShareBtn: document.getElementById('redditShareBtn'),
      decompSummary: document.getElementById('decompSummary'),
      breakdownToggle: document.getElementById('breakdownToggle'),
      saliScoreWrap: document.getElementById('saliScoreWrap'),
      saliScoreGrade: document.getElementById('saliScoreGrade'),
      saliScoreRate: document.getElementById('saliScoreRate'),
      saliScoreGap: document.getElementById('saliScoreGap'),
      saliScoreTagline: document.getElementById('saliScoreTagline'),
      saliTierWrap: document.getElementById('saliTierWrap'),
      saliTier: document.getElementById('saliTier'),
      ppNarrative: document.getElementById('ppNarrative'),
      strcEnableToggle: document.getElementById('strcEnableToggle'),
      strcPctGroup: document.getElementById('strcPctGroup'),
      strcPctInput: document.getElementById('strcPctInput'),
      strcYieldDisplay: document.getElementById('strcYieldDisplay'),
      strcOutputWrap: document.getElementById('strcOutputWrap'),
      strcAllocOutput: document.getElementById('strcAllocOutput'),
      strcDivOutput: document.getElementById('strcDivOutput'),
      strcRemainOutput: document.getElementById('strcRemainOutput'),
      strcEffSaliOutput: document.getElementById('strcEffSaliOutput'),
      strcYieldNote: document.getElementById('strcYieldNote'),
      historicalChangeGroup: document.getElementById('historicalChangeGroup'),
      historicalChangeOutput: document.getElementById('historicalChangeOutput'),
      historicalChangeYear: document.getElementById('historicalChangeYear'),
      saliYoyOutput: document.getElementById('saliYoyOutput'),
      projectedChangeDesc: document.getElementById('projectedChangeDesc'),
      projectedChangeLabel: document.getElementById('projectedChangeLabel'),
      breakevenRateOutput: document.getElementById('breakevenRateOutput'),
      breakevenSalary5: document.getElementById('breakevenSalary5'),
      projectedSalary5: document.getElementById('projectedSalary5'),
      breakevenGap: document.getElementById('breakevenGap'),
      histStartYear: document.getElementById('histStartYear'),
      histStartSalary: document.getElementById('histStartSalary'),
      historyResults: document.getElementById('historyResults'),
      historyTableBody: document.getElementById('historyTableBody')
    };

    if (!elements.salaryInput) return;

    elements.salaryInput.addEventListener('input', compute);
    elements.salaryInput.addEventListener('change', compute);
    if (elements.currencySelect) elements.currencySelect.addEventListener('change', () => { const warn = elements.fxWarning; if (warn) warn.className = elements.currencySelect.value !== 'USD' ? 'fx-warning' : 'fx-warning fx-warning--hidden'; compute(); });
    if (elements.salaryGrowthInput) { elements.salaryGrowthInput.addEventListener('input', compute); elements.salaryGrowthInput.addEventListener('change', compute); }
    if (elements.btcGrowthInput) { elements.btcGrowthInput.addEventListener('input', compute); elements.btcGrowthInput.addEventListener('change', compute); }
    if (elements.startYearSelect) elements.startYearSelect.addEventListener('change', compute);
    if (elements.yearsSelect) elements.yearsSelect.addEventListener('change', compute);
    if (elements.inflationInput) { elements.inflationInput.addEventListener('input', compute); elements.inflationInput.addEventListener('change', compute); }
    if (elements.btcPriceMethodSelect) elements.btcPriceMethodSelect.addEventListener('change', () => { const manualGroup = elements.btcPriceManualInput?.closest('.form-group'); if (manualGroup) manualGroup.classList.toggle('form-group--hidden', elements.btcPriceMethodSelect.value !== 'manual'); updateBtcPriceDisplay(); compute(); });
    if (elements.btcPriceManualInput) { elements.btcPriceManualInput.addEventListener('input', compute); elements.btcPriceManualInput.addEventListener('change', compute); }
    if (elements.unitToggleSats) elements.unitToggleSats.addEventListener('click', () => { displayUnit = 'sats'; elements.unitToggleSats.classList.add('unit-toggle__btn--active'); elements.unitToggleBtc.classList.remove('unit-toggle__btn--active'); compute(); });
    if (elements.unitToggleBtc) elements.unitToggleBtc.addEventListener('click', () => { displayUnit = 'btc'; elements.unitToggleBtc.classList.add('unit-toggle__btn--active'); elements.unitToggleSats.classList.remove('unit-toggle__btn--active'); compute(); });
    if (elements.nominalModeBtn) elements.nominalModeBtn.addEventListener('click', () => { salaryGrowthMode = 'nominal'; elements.nominalModeBtn.classList.add('mode-btn--active'); elements.realModeBtn.classList.remove('mode-btn--active'); if (elements.inflationGroup) elements.inflationGroup.classList.add('form-group--hidden'); compute(); });
    if (elements.realModeBtn) elements.realModeBtn.addEventListener('click', () => { salaryGrowthMode = 'real'; elements.realModeBtn.classList.add('mode-btn--active'); elements.nominalModeBtn.classList.remove('mode-btn--active'); if (elements.inflationGroup) elements.inflationGroup.classList.remove('form-group--hidden'); compute(); });
    if (elements.btcCustomModeBtn) elements.btcCustomModeBtn.addEventListener('click', () => { btcGrowthMode = BTC_GROWTH_MODES.CUSTOM; elements.btcCustomModeBtn.classList.add('mode-btn--active'); elements.btcHistoricalModeBtn?.classList.remove('mode-btn--active'); elements.btc5yModeBtn?.classList.remove('mode-btn--active'); elements.btcGrowthInput.value = customBtcGrowth; compute(); });
    if (elements.btcHistoricalModeBtn) elements.btcHistoricalModeBtn.addEventListener('click', () => { btcGrowthMode = BTC_GROWTH_MODES.HISTORICAL; elements.btcHistoricalModeBtn.classList.add('mode-btn--active'); elements.btcCustomModeBtn?.classList.remove('mode-btn--active'); elements.btc5yModeBtn?.classList.remove('mode-btn--active'); updateBtcGrowthDisplay(); compute(); });
    if (elements.btc5yModeBtn) elements.btc5yModeBtn.addEventListener('click', () => { btcGrowthMode = BTC_GROWTH_MODES.FIVE_YEAR; elements.btc5yModeBtn.classList.add('mode-btn--active'); elements.btcCustomModeBtn?.classList.remove('mode-btn--active'); elements.btcHistoricalModeBtn?.classList.remove('mode-btn--active'); updateBtcGrowthDisplay(); compute(); });
    if (elements.btcGrowthInput) elements.btcGrowthInput.addEventListener('input', () => { if (btcGrowthMode === BTC_GROWTH_MODES.CUSTOM) customBtcGrowth = parseFloat(elements.btcGrowthInput.value) || DEFAULT_BTC_GROWTH; compute(); });
    const benchBtns = [elements.benchBtcBtn, elements.benchSpxBtn, elements.benchGoldBtn, elements.benchCpiBtn];
    const benchKeys = ['btc', 'spx', 'gold', 'cpi'];
    benchBtns.forEach((btn, i) => { if (!btn) return; btn.addEventListener('click', () => { activeBenchmark = benchKeys[i]; benchBtns.forEach(b => b?.classList.remove('benchmark-btn--active')); btn.classList.add('benchmark-btn--active'); const panel = elements.benchmarkPanel; if (panel) panel.style.display = benchKeys[i] !== 'btc' ? 'block' : 'none'; if (elements.benchmarkGrowthLabel) elements.benchmarkGrowthLabel.textContent = BENCHMARK_DATA[benchKeys[i]]?.growthLabel || ''; compute(); }); });
    if (elements.benchmarkGrowthInput) { elements.benchmarkGrowthInput.addEventListener('input', () => { customBenchmarkGrowth = parseFloat(elements.benchmarkGrowthInput.value) || 10; compute(); }); }
    if (elements.strcEnableToggle) elements.strcEnableToggle.addEventListener('change', () => { strcEnabled = elements.strcEnableToggle.checked; if (elements.strcPctGroup) elements.strcPctGroup.classList.toggle('form-group--hidden', !strcEnabled); compute(); });
    if (elements.strcPctInput) { const onStrcPct = () => { strcPct = parseFloat(elements.strcPctInput.value) || 0; compute(); }; elements.strcPctInput.addEventListener('input', onStrcPct); elements.strcPctInput.addEventListener('change', onStrcPct); }
    if (elements.breakdownToggle) elements.breakdownToggle.addEventListener('click', () => { showBreakdown = !showBreakdown; elements.breakdownToggle.textContent = showBreakdown ? 'Hide breakdown ←' : 'Show breakdown →'; compute(); });
    if (elements.salaryAnnualBtn) elements.salaryAnnualBtn.addEventListener('click', () => { if (salaryFrequency === 'monthly') { const v = parseFloat(elements.salaryInput.value); if (!isNaN(v)) elements.salaryInput.value = Math.round(v * 12); elements.salaryInput.step = 1000; elements.salaryInput.placeholder = 'e.g., 60000'; } salaryFrequency = 'annual'; elements.salaryAnnualBtn.classList.add('mode-btn--active'); if (elements.salaryMonthlyBtn) elements.salaryMonthlyBtn.classList.remove('mode-btn--active'); compute(); });
    if (elements.salaryMonthlyBtn) elements.salaryMonthlyBtn.addEventListener('click', () => { if (salaryFrequency === 'annual') { const v = parseFloat(elements.salaryInput.value); if (!isNaN(v)) elements.salaryInput.value = Math.round(v / 12); elements.salaryInput.step = 100; elements.salaryInput.placeholder = 'e.g., 5000'; } salaryFrequency = 'monthly'; elements.salaryMonthlyBtn.classList.add('mode-btn--active'); if (elements.salaryAnnualBtn) elements.salaryAnnualBtn.classList.remove('mode-btn--active'); compute(); });
    if (elements.histStartSalary) { elements.histStartSalary.addEventListener('input', compute); elements.histStartSalary.addEventListener('change', compute); }
    if (elements.histStartYear) elements.histStartYear.addEventListener('change', compute);
    new MutationObserver(() => { if (initComputeComplete) compute(); }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', () => {
      if (chartInstance) { const parent = elements.saliChart.parentNode; chartInstance.resize(parent.clientWidth, parent.clientHeight); }
      if (normalizedChartInstance) { const normCanvas = document.getElementById('normalizedChart'); if (normCanvas) { const parent = normCanvas.parentNode; normalizedChartInstance.resize(parent.clientWidth, parent.clientHeight); } }
      if (benchmarkChartInstance) { const bmCanvas = document.getElementById('benchmarkChart'); if (bmCanvas) benchmarkChartInstance.resize(bmCanvas.parentNode.clientWidth, bmCanvas.parentNode.clientHeight); }
    });
    compute();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
