/**
 * SALI - Satoshi Annual Labor Index
 * Calculator Engine
 *
 * Formula: SALI (sats/year) = (AnnualSalaryFiat / BitcoinPriceFiat) * 100,000,000
 */

(function() {
  'use strict';

  // i18n: detect page language, fall back to English
  const LANG = (document.documentElement.lang || 'en').split('-')[0];
  const STRINGS = {
    en: {
      gradeS: 'Keeping pace with Bitcoin - extremely rare',
      gradeA: 'Losing ground slowly - better than almost everyone',
      gradeB: 'Above average - real loss, but manageable',
      gradeC: 'Typical - Bitcoin is outpacing your salary',
      gradeD: 'Bitcoin is pulling away significantly',
      gradeF: 'Bitcoin is winning by a wide margin',
      scoreRateSuffix: '/ yr Bitcoin purchasing power',
      scoreStrcFwd: p => `incl. +${p}% $STRC fwd`,
      scoreNeedMore: g => `Need +${g}%/yr more salary growth to keep pace`,
      scoreOutpacing: g => `Outpacing Bitcoin by ${g}%/yr`,
      scoreBreakEven: 'At break-even with Bitcoin',
      docTitle: g => `SALI Grade: ${g} | Satoshi Annual Labor Index`,
      errSpotFetch: 'Unable to fetch live BTC price. Using Manual mode or try again later.',
      errAnnualLoad: 'Unable to load annual average data.',
      errSalary: 'Please enter a valid salary.',
      errSalaryGrowth: 'Salary growth rate must be between -100% and 1000%.',
      errBtcGrowth: 'BTC growth rate must be between -100% and 1000%.',
      errSpotNA: 'Spot price not available. Try Manual mode.',
      errAnnualNA: 'Annual average data not loaded.',
      errAnnualNoData: 'No annual average data available.',
      errBtcPrice: 'Please enter a valid BTC price.',
      errMethod: 'Unknown price method.',
      fxLive: (date, eur, mxn) => `Live FX rates (ECB, ${date}): 1 EUR ≈ ${eur} USD · 1 MXN ≈ ${mxn} USD`,
      btcSpot: p => `Spot: ${p}`,
      btcLoadingSpot: 'Loading spot price...',
      btcAnnualStale: (y, p) => `${y} Avg: ${p} - most recent full year`,
      btcAnnual: (y, p) => `${y} Avg: ${p}`,
      btcLoadingAnnual: 'Loading annual data...',
      trendNotEnough: 'Not enough data',
      trendGaining: 'At these assumptions, your salary is outpacing BTC appreciation',
      trendLosing: 'At these assumptions, BTC is appreciating faster than your salary',
      trendNeutral: 'At these assumptions, your salary and BTC are appreciating at roughly the same rate',
      tableHeaderSaliSats: 'SALI (sats)',
      tableHeaderSaliBtc: 'SALI (BTC)',
      tableHeaderSalary: 'Salary',
      tableHeaderSalaryReal: 'Salary (Real)',
      tableNow: y => `${y} (Now)`,
      chartToday: 'Today',
      chartTitleSali: 'SALI Over Time',
      chartTitleBench: n => `Salary vs ${n} Over Time`,
      chartAxisYear: 'Year',
      chartAxisSats: 'Sats per Year',
      chartAxisBtc: 'BTC per Year',
      chartCurrent: ' (Current)',
      chartProjected: ' (Projected)',
      chartBtcPrice: p => `BTC Price: ${p}`,
      chartBenchPrice: (n, p) => `${n} price: ${p}`,
      normAxisY: 'Pressure vs Salary (Start = 100)',
      normBitcoin: 'Bitcoin',
      normSP500: 'S&P 500',
      normGold: 'Gold',
      normCpi: 'Cost of living (CPI)',
      benchCpi: 'CPI Inflation',
      benchAxisY: 'Indexed Value (Start = 100)',
      benchTitle: y => `Normalized Growth Since ${y} (Base = 100)`,
      tierTop10: 'Top 10%',
      tierTop25: 'Top 25%',
      tierMedian: 'Median',
      tierAbove: 'Above Median',
      tierBelow: 'Below Median',
      ppHeadline: y => `Purchasing Power Change since ${y}`,
      ppEqual: 'Your salary is roughly keeping pace with Bitcoin appreciation at these assumptions.',
      ppLess: (pct, y) => `Your salary is buying ${pct}% less Bitcoin than it did in ${y} - Bitcoin has appreciated faster than wages.`,
      ppMore: (pct, y) => `Your salary is buying ${pct}% more Bitcoin than it did in ${y} - your earnings have outpaced Bitcoin's price.`,
      ppNarr: (y, sal, fb, cb, dir, pct, interp) =>
        `In ${y}, your ${sal} salary could acquire <strong>${fb} BTC/year</strong>. ` +
        `Today it acquires <strong>${cb} BTC/year</strong> - ` +
        `<strong>${dir} ${pct}%</strong> in Bitcoin terms. ${interp}`,
      ppGained: 'gained',
      ppLost: 'lost',
      inflNote: (nom, real, inf) => `Nominal ${nom}% → real ${real}% after ${inf}% inflation`,
      bkStrcReduced: b => ` (reduced by ${b}% $STRC yield - rate adjusts monthly)`,
      bkBehindStrc: (g, d) => `Even with $STRC income, your salary needs to grow ${g}%/yr faster to fully break even with Bitcoin. Over 5 years, that's a ${d} gap.`,
      bkBehind: (g, d) => `To accumulate Bitcoin at the same rate it's appreciating, your salary needs to grow ${g}%/yr faster than it currently is. Over 5 years, that's a ${d} gap.`,
      bkAheadStrc: b => `Your salary growth + $STRC yield (${b}%/yr) is outpacing Bitcoin at these assumptions - your SALI is improving.`,
      bkAhead: g => `Your salary is growing ${g}%/yr faster than BTC - your SALI is increasing at these assumptions.`,
      histSummary: (sy, sal, ey, dir, pct, ss, es) =>
        `From ${sy} (<strong>${sal}</strong>) to ${ey}, your BTC purchasing power <strong>${dir} ${pct}%</strong>. SALI: <strong>${ss}</strong> → <strong>${es} sats/yr</strong>.`,
      histGained: 'gained',
      histLost: 'lost',
      histNow: ' (Now)',
      decompSummary: (tot, tc, yr, sal, sc, btc, bc) =>
        `SALI changed <strong style="color:${tc}">${tot}</strong> since ${yr}: ` +
        `salary <strong style="color:${sc}">${sal}</strong> (positive) · ` +
        `BTC <strong style="color:${bc}">${btc}</strong> impact`,
      shareSameStrc: (pct, boost, grade) => `${pct}% in $STRC (+${boost}%/yr yield) keeps my salary even with Bitcoin. Grade: ${grade}.`,
      shareGapStrc: (pct, boost, grade, rate) => `My salary loses ${rate} to Bitcoin. $STRC adds ${boost}%/yr — closing the gap. Grade: ${grade}.`,
      shareSame: (rate, grade) => `My salary is keeping pace with Bitcoin (${rate}). Grade: ${grade} — extremely rare.`,
      shareLosing: (rate, gap, grade) => `My salary loses ${rate} to Bitcoin every year. I need +${gap}%/yr just to break even. Grade: ${grade}.`,
      shareBreakEven: (rate, grade) => `My salary is right at Bitcoin break-even (${rate}). Grade: ${grade}.`,
      shareFallback: '🟠 Is your salary keeping up with Bitcoin? Find out your SALI Grade → #Bitcoin #SALI',
      shareReddit: g => `My SALI Grade: ${g} — How much is your salary worth in Bitcoin?`,
      shareRedditFallback: 'How much is your salary worth in Bitcoin? — SALI Calculator',
      shareCopied: '✓ Copied!',
      breakdownShow: 'Show breakdown →',
      breakdownHide: 'Hide breakdown ←',
      yearForecast1: '1 year',
      yearForecastN: n => `${n} years`,
      strcYieldLive: 'live price',
      strcYieldDate: d => `as of ${d}`,
      strcYieldDisplay: (price, pct, src) => `$STRC ${price} · ${pct}% yield (${src} · launched Jul 2025 · rate adjusts monthly)`,
      strcNoteLive: 'Yahoo Finance live',
      strcNoteFallback: 'stated rate fallback',
      strcNoteHist: 'Grade boost is time-weighted from July 2025 (STRC launch).',
      strcNoteText: (sh, div, yld, src, hist) => `${sh} shares · $${div}/share/yr · ${yld}% yield (${src}) · ${hist}`,
      projStrcDiv: d => ` (Projections include $${d}/yr $STRC dividend income.)`,
      benchGrowthLabel: n => `${n} Growth Rate (% per year)`,
      btcHistoricalBtn: p => `Historical CAGR (${p}%)`,
      btcHistoricalTitle: (a, b) => `${a}–${b} compound annual growth rate of BTC annual averages.`,
      btc5yBtn: p => `5-Year CAGR (${p}%)`,
      btc5yTitle: (a, b) => `${a}–${b} compound annual growth rate of BTC annual averages.`,
      salaryPlaceholderAnnual: 'e.g., 60000',
      salaryPlaceholderMonthly: 'e.g., 5000',
    },
    es: {
      gradeS: 'Mantiene el ritmo con Bitcoin — extremadamente raro',
      gradeA: 'Pierde terreno lentamente — mejor que casi todos',
      gradeB: 'Por encima de la media — pérdida real, pero manejable',
      gradeC: 'Típico — Bitcoin supera tu salario',
      gradeD: 'Bitcoin se aleja significativamente',
      gradeF: 'Bitcoin gana por amplio margen',
      scoreRateSuffix: '/ año de poder adquisitivo en Bitcoin',
      scoreStrcFwd: p => `incl. +${p}% $STRC adelante`,
      scoreNeedMore: g => `Necesitas +${g}%/año más de crecimiento salarial para mantener el ritmo`,
      scoreOutpacing: g => `Superando a Bitcoin por ${g}%/año`,
      scoreBreakEven: 'En equilibrio con Bitcoin',
      docTitle: g => `Calificación SALI: ${g} | Índice Anual de Labor en Satoshis`,
      errSpotFetch: 'No se pudo obtener el precio en vivo de BTC. Usa el modo Manual o inténtalo más tarde.',
      errAnnualLoad: 'No se pudieron cargar los datos del promedio anual.',
      errSalary: 'Por favor ingresa un salario válido.',
      errSalaryGrowth: 'La tasa de crecimiento del salario debe estar entre -100% y 1000%.',
      errBtcGrowth: 'La tasa de crecimiento de BTC debe estar entre -100% y 1000%.',
      errSpotNA: 'Precio en tiempo real no disponible. Prueba el modo Manual.',
      errAnnualNA: 'Datos del promedio anual no cargados.',
      errAnnualNoData: 'No hay datos del promedio anual disponibles.',
      errBtcPrice: 'Por favor ingresa un precio de BTC válido.',
      errMethod: 'Método de precio desconocido.',
      fxLive: (date, eur, mxn) => `Tasas de cambio en vivo (ECB, ${date}): 1 EUR ≈ ${eur} USD · 1 MXN ≈ ${mxn} USD`,
      btcSpot: p => `Spot: ${p}`,
      btcLoadingSpot: 'Cargando precio en tiempo real...',
      btcAnnualStale: (y, p) => `Promedio ${y}: ${p} — año completo más reciente`,
      btcAnnual: (y, p) => `Promedio ${y}: ${p}`,
      btcLoadingAnnual: 'Cargando datos anuales...',
      trendNotEnough: 'Datos insuficientes',
      trendGaining: 'Con estos supuestos, tu salario supera la apreciación de BTC',
      trendLosing: 'Con estos supuestos, BTC se aprecia más rápido que tu salario',
      trendNeutral: 'Con estos supuestos, tu salario y BTC se aprecian a tasas similares',
      tableHeaderSaliSats: 'SALI (sats)',
      tableHeaderSaliBtc: 'SALI (BTC)',
      tableHeaderSalary: 'Salario',
      tableHeaderSalaryReal: 'Salario (Real)',
      tableNow: y => `${y} (Ahora)`,
      chartToday: 'Hoy',
      chartTitleSali: 'SALI a lo largo del tiempo',
      chartTitleBench: n => `Salario vs ${n} a lo largo del tiempo`,
      chartAxisYear: 'Año',
      chartAxisSats: 'Sats por año',
      chartAxisBtc: 'BTC por año',
      chartCurrent: ' (Actual)',
      chartProjected: ' (Proyectado)',
      chartBtcPrice: p => `Precio BTC: ${p}`,
      chartBenchPrice: (n, p) => `Precio ${n}: ${p}`,
      normAxisY: 'Presión vs Salario (Inicio = 100)',
      normBitcoin: 'Bitcoin',
      normSP500: 'S&P 500',
      normGold: 'Oro',
      normCpi: 'Costo de vida (IPC)',
      benchCpi: 'Inflación IPC',
      benchAxisY: 'Valor indexado (Inicio = 100)',
      benchTitle: y => `Crecimiento normalizado desde ${y} (Base = 100)`,
      tierTop10: 'Top 10%',
      tierTop25: 'Top 25%',
      tierMedian: 'Mediana',
      tierAbove: 'Por encima de la mediana',
      tierBelow: 'Por debajo de la mediana',
      ppHeadline: y => `Cambio de poder adquisitivo desde ${y}`,
      ppEqual: 'Tu salario mantiene aproximadamente el ritmo con la apreciación de Bitcoin con estos supuestos.',
      ppLess: (pct, y) => `Tu salario compra ${pct}% menos Bitcoin que en ${y} — Bitcoin se ha apreciado más rápido que los salarios.`,
      ppMore: (pct, y) => `Tu salario compra ${pct}% más Bitcoin que en ${y} — tus ingresos han superado el precio de Bitcoin.`,
      ppNarr: (y, sal, fb, cb, dir, pct, interp) =>
        `En ${y}, tu salario de ${sal} podía adquirir <strong>${fb} BTC/año</strong>. ` +
        `Hoy adquiere <strong>${cb} BTC/año</strong> — ` +
        `<strong>${dir} ${pct}%</strong> en términos de Bitcoin. ${interp}`,
      ppGained: 'ganó',
      ppLost: 'perdió',
      inflNote: (nom, real, inf) => `Nominal ${nom}% → real ${real}% tras ${inf}% de inflación`,
      bkStrcReduced: b => ` (reducido por ${b}% de rendimiento $STRC — tasa ajusta mensualmente)`,
      bkBehindStrc: (g, d) => `Incluso con ingresos de $STRC, tu salario necesita crecer ${g}%/año más rápido para igualar a Bitcoin. En 5 años, eso es una brecha de ${d}.`,
      bkBehind: (g, d) => `Para acumular Bitcoin al mismo ritmo que se aprecia, tu salario necesita crecer ${g}%/año más rápido. En 5 años, eso es una brecha de ${d}.`,
      bkAheadStrc: b => `Tu crecimiento salarial + rendimiento $STRC (${b}%/año) supera a Bitcoin con estos supuestos — tu SALI está mejorando.`,
      bkAhead: g => `Tu salario crece ${g}%/año más rápido que BTC — tu SALI está aumentando con estos supuestos.`,
      histSummary: (sy, sal, ey, dir, pct, ss, es) =>
        `De ${sy} (<strong>${sal}</strong>) a ${ey}, tu poder adquisitivo en BTC <strong>${dir} ${pct}%</strong>. SALI: <strong>${ss}</strong> → <strong>${es} sats/año</strong>.`,
      histGained: 'ganó',
      histLost: 'perdió',
      histNow: ' (Ahora)',
      decompSummary: (tot, tc, yr, sal, sc, btc, bc) =>
        `SALI cambió <strong style="color:${tc}">${tot}</strong> desde ${yr}: ` +
        `salario <strong style="color:${sc}">${sal}</strong> (positivo) · ` +
        `BTC <strong style="color:${bc}">${btc}</strong> impacto`,
      shareSameStrc: (pct, boost, grade) => `${pct}% en $STRC (+${boost}%/año) mantiene mi salario al ritmo de Bitcoin. Calificación: ${grade}.`,
      shareGapStrc: (pct, boost, grade, rate) => `Mi salario pierde ${rate} ante Bitcoin. $STRC agrega ${boost}%/año — cerrando la brecha. Calificación: ${grade}.`,
      shareSame: (rate, grade) => `Mi salario mantiene el ritmo con Bitcoin (${rate}). Calificación: ${grade} — extremadamente raro.`,
      shareLosing: (rate, gap, grade) => `Mi salario pierde ${rate} ante Bitcoin cada año. Necesito +${gap}%/año solo para empatar. Calificación: ${grade}.`,
      shareBreakEven: (rate, grade) => `Mi salario está en el punto de equilibrio con Bitcoin (${rate}). Calificación: ${grade}.`,
      shareFallback: '🟠 ¿Tu salario le sigue el ritmo a Bitcoin? Descubre tu Calificación SALI → #Bitcoin #SALI',
      shareReddit: g => `Mi Calificación SALI: ${g} — ¿Cuánto vale tu salario en Bitcoin?`,
      shareRedditFallback: '¿Cuánto vale tu salario en Bitcoin? — Calculadora SALI',
      shareCopied: '✓ ¡Copiado!',
      breakdownShow: 'Ver desglose →',
      breakdownHide: 'Ocultar desglose ←',
      yearForecast1: '1 año',
      yearForecastN: n => `${n} años`,
      strcYieldLive: 'precio en vivo',
      strcYieldDate: d => `al ${d}`,
      strcYieldDisplay: (price, pct, src) => `$STRC ${price} · ${pct}% rendimiento (${src} · lanzado Jul 2025 · tasa ajusta mensualmente)`,
      strcNoteLive: 'Yahoo Finance en vivo',
      strcNoteFallback: 'tasa declarada de respaldo',
      strcNoteHist: 'El boost de calificación está ponderado por tiempo desde julio 2025 (lanzamiento STRC).',
      strcNoteText: (sh, div, yld, src, hist) => `${sh} acciones · $${div}/acción/año · ${yld}% rendimiento (${src}) · ${hist}`,
      projStrcDiv: d => ` (Las proyecciones incluyen $${d}/año de dividendos $STRC.)`,
      benchGrowthLabel: n => `Tasa de crecimiento de ${n} (% por año)`,
      btcHistoricalBtn: p => `CAGR Histórico (${p}%)`,
      btcHistoricalTitle: (a, b) => `CAGR de promedios anuales de BTC ${a}–${b}.`,
      btc5yBtn: p => `CAGR 5 años (${p}%)`,
      btc5yTitle: (a, b) => `CAGR de promedios anuales de BTC ${a}–${b}.`,
      salaryPlaceholderAnnual: 'ej. 60000',
      salaryPlaceholderMonthly: 'ej. 5000',
    }
  };
  const S = STRINGS[LANG] || STRINGS.en;

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
        // Year-end closing prices (Dec 31) - must match sp500_annual.json exactly
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

  // FX rates to USD - updated at init via fetchFxRates() (ECB/Frankfurter).
  // These fallback values are used only if the live fetch fails.
  const FX_RATES = {
    USD: 1,
    EUR: 1.18,  // fallback: 1 EUR ≈ 1.18 USD
    MXN: 0.058  // fallback: 1 MXN ≈ 0.058 USD
  };

  // STRC / Salary Under STRETCH
  // Variable Rate Series A Perpetual Stretch Preferred Stock - Nasdaq: STRC
  // Par/liquidation value $100. Rate is variable, adjusted monthly by Strategy (±0.25%/mo)
  // to keep market price near $100.
  const STRC_PAR = 100;
  const STRC_STATED_RATE = 0.115;        // 11.5% current rate (Apr 2026)
  const STRC_ANNUAL_DIV = STRC_PAR * STRC_STATED_RATE; // $11.50/share/yr at current rate
  const STRC_RATE_DATE = 'Apr 2026';
  const STRC_LAUNCH = new Date(2025, 6, 29); // July 29, 2025 - IPO close date

  // Known monthly rate snapshots since launch (approximate; ±0.25%/mo adjustments).
  // Each entry: [year, month (0-indexed), annualRate].
  // Update the last entry when Strategy announces a rate change.
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

  /**
   * Compute the time-weighted average STRC yield between two dates.
   * Returns 0 for any period before STRC_LAUNCH.
   */
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
        : new Date(); // last known rate extends to today
      const a = Math.max(start, sliceStart);
      const b = Math.min(end,   sliceEnd);
      if (b > a) {
        const ms = b - a;
        totalMs       += ms;
        weightedRate  += rate * ms;
      }
    }
    return totalMs > 0 ? weightedRate / totalMs : 0;
  }

  let strcEnabled = false;
  let strcPct = 10;
  let strcCurrentYield = STRC_STATED_RATE;
  let strcCurrentPrice = STRC_PAR;
  let strcDataSource = 'fallback'; // 'live' | 'fallback'

  // State
  let spotPrice = null;
  let spotPriceFailed = false;
  let annualAverages = null;
  let chartInstance = null;
  let normalizedChartInstance = null;
  let benchmarkChartInstance = null;
  let sp500JsonData = null;
  let goldJsonData = null;
  let cpiJsonData = null;
  let displayUnit = 'sats'; // 'sats' or 'btc'
  let salaryFrequency = 'annual'; // 'annual' | 'monthly'
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
      const yearsFromCurrent = year - CURRENT_YEAR;
      const salaryYear = salaryUsd * Math.pow(1 + salaryGrowth / 100, yearsFromCurrent);

      let btcPriceYear;
      if (annualAverages && annualAverages[year]) {
        btcPriceYear = annualAverages[year];
      } else {
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
   */
  function calculateTrendScore(projections) {
    if (projections.length < 2) {
      return { score: null, trend: 'neutral', description: S.trendNotEnough };
    }

    const currentYearData = projections.find(p => p.year === CURRENT_YEAR);
    const firstYearData = projections[0];
    const lastYearData = projections[projections.length - 1];

    if (!currentYearData || !firstYearData) {
      return { score: null, trend: 'neutral', description: S.trendNotEnough };
    }

    const historicalChange = ((currentYearData.sats - firstYearData.sats) / firstYearData.sats) * 100;
    const projectedChange = ((lastYearData.sats - currentYearData.sats) / currentYearData.sats) * 100;

    let trend, description;
    if (projectedChange > 10) {
      trend = 'gaining';
      description = S.trendGaining;
    } else if (projectedChange < -10) {
      trend = 'losing';
      description = S.trendLosing;
    } else {
      trend = 'neutral';
      description = S.trendNeutral;
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

    el.innerHTML = S.decompSummary(fmt(totalSaliChange), totalColor, first.year, fmt(salaryCumulative), salaryColor, fmt(btcCumulative), btcColor);
    el.style.display = 'block';
  }

  /**
   * Compute SALI grade based on annualized historical SALI decay rate (CAGR).
   */
  function computeSaliGrade(projections, btcGrowth, nominalSalaryGrowth) {
    const first = projections[0];
    const current = projections.find(p => p.isCurrentYear);
    if (!first || !current || first.year === current.year) return null;

    const years = current.year - first.year;
    if (years < 1) return null;

    const historicalRate = (Math.pow(current.sats / first.sats, 1 / years) - 1) * 100;

    let strcBoost = 0;
    if (strcEnabled && strcPct > 0) {
      const periodStart = new Date(first.year, 0, 1);
      const periodEnd   = new Date();
      const totalMs     = periodEnd - periodStart;
      const strcMs      = Math.max(0, periodEnd - STRC_LAUNCH);
      const strcFraction = totalMs > 0 ? strcMs / totalMs : 0;
      const avgYield    = strcAvgYield(periodStart, periodEnd);
      strcBoost = (strcPct / 100) * avgYield * 100 * strcFraction;
    }

    const annualRate = historicalRate + strcBoost;

    const strcForwardBoost = (strcEnabled && strcPct > 0)
      ? (strcPct / 100) * strcCurrentYield * 100
      : 0;
    const gap = btcGrowth - nominalSalaryGrowth - strcForwardBoost;

    let grade, tagline, colorClass;
    if (annualRate >= 0)         { grade = 'S'; tagline = S.gradeS; colorClass = 'sali-score__grade--S'; }
    else if (annualRate >= -10)  { grade = 'A'; tagline = S.gradeA; colorClass = 'sali-score__grade--A'; }
    else if (annualRate >= -20)  { grade = 'B'; tagline = S.gradeB; colorClass = 'sali-score__grade--B'; }
    else if (annualRate >= -35)  { grade = 'C'; tagline = S.gradeC; colorClass = 'sali-score__grade--C'; }
    else if (annualRate >= -50)  { grade = 'D'; tagline = S.gradeD; colorClass = 'sali-score__grade--D'; }
    else                         { grade = 'F'; tagline = S.gradeF; colorClass = 'sali-score__grade--F'; }

    const cumulativeDeficit = current.sats < first.sats
      ? Math.round((1 - current.sats / first.sats) * 100)
      : 0;

    return { grade, annualRate, gap, tagline, colorClass, cumulativeDeficit, firstYear: first.year };
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
      const strcForwardBoost = (strcEnabled && strcPct > 0)
        ? (strcPct / 100) * strcCurrentYield * 100
        : 0;
      const boostNote = strcForwardBoost > 0 ? ` (${S.scoreStrcFwd(strcForwardBoost.toFixed(2))})` : '';
      elements.saliScoreRate.textContent =
        `${sign}${annualRate.toFixed(1)}% ${S.scoreRateSuffix}${boostNote}`;
    }
    if (elements.saliScoreGap) {
      if (gap > 0.1) {
        elements.saliScoreGap.textContent = S.scoreNeedMore(gap.toFixed(1));
      } else if (gap < -0.1) {
        elements.saliScoreGap.textContent = S.scoreOutpacing(Math.abs(gap).toFixed(1));
      } else {
        elements.saliScoreGap.textContent = S.scoreBreakEven;
      }
    }
    if (elements.saliScoreTagline) {
      elements.saliScoreTagline.textContent = tagline;
    }

    document.title = S.docTitle(grade);
    wrap.style.display = 'block';
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

  /**
   * Build and set share hrefs for X, Facebook, LinkedIn, and Reddit.
   */
  function updateShareLinks(gradeData) {
    const validGrades = new Set(['S', 'A', 'B', 'C', 'D', 'F']);
    const gradeUrl = (gradeData && validGrades.has(gradeData.grade))
      ? `https://sali.angarlo.com/share?rank=${gradeData.grade}&deficit=${gradeData.cumulativeDeficit}&raise=${Math.max(0, Math.round(gradeData.gap))}&since=${gradeData.firstYear}`
      : 'https://sali.angarlo.com';

    let shortText;

    if (gradeData) {
      const { grade, annualRate, gap } = gradeData;
      const rateStr = annualRate >= 0 ? `+${annualRate.toFixed(1)}%/yr` : `${Math.abs(annualRate).toFixed(1)}%/yr`;

      let hook;
      if (strcEnabled && strcPct > 0) {
        const boost = ((strcPct / 100) * strcCurrentYield * 100).toFixed(1);
        if (annualRate >= 0) {
          hook = S.shareSameStrc(strcPct, boost, grade);
        } else {
          hook = S.shareGapStrc(strcPct, boost, grade, rateStr);
        }
      } else if (annualRate >= 0) {
        hook = S.shareSame(rateStr, grade);
      } else if (gap > 0.1) {
        hook = S.shareLosing(rateStr, gap.toFixed(1), grade);
      } else {
        hook = S.shareBreakEven(rateStr, grade);
      }

      const tags = strcEnabled && strcPct > 0 ? '#Bitcoin #SALI #STRC' : '#Bitcoin #SALI';
      shortText = `🟠 ${hook}\n\nWhat's yours? → ${tags}`;
    } else {
      shortText = S.shareFallback;
    }

    if (elements.tweetSaliBtn) {
      elements.tweetSaliBtn.href =
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(shortText)}&url=${encodeURIComponent(gradeUrl)}`;
    }
    if (elements.gradeShareBtn) {
      elements.gradeShareBtn.href =
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(shortText)}&url=${encodeURIComponent(gradeUrl)}`;
      elements.gradeShareBtn.style.display = 'block';
    }
    if (elements.fbShareBtn) {
      elements.fbShareBtn.href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(gradeUrl)}`;
    }
    if (elements.liShareBtn) {
      elements.liShareBtn.href = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(gradeUrl)}`;
    }
    if (elements.redditShareBtn) {
      const redditTitle = gradeData
        ? S.shareReddit(gradeData.grade)
        : S.shareRedditFallback;
      elements.redditShareBtn.href = `https://www.reddit.com/submit?url=${encodeURIComponent(gradeUrl)}&title=${encodeURIComponent(redditTitle)}`;
    }
  }

  function copyCurrentLink() {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      if (elements.copyLinkBtn) {
        const original = elements.copyLinkBtn.textContent;
        elements.copyLinkBtn.textContent = S.shareCopied;
        setTimeout(() => { elements.copyLinkBtn.textContent = original; }, 2000);
      }
    }).catch(() => {
      try {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        if (elements.copyLinkBtn) {
          const original = elements.copyLinkBtn.textContent;
          elements.copyLinkBtn.textContent = S.shareCopied;
          setTimeout(() => { elements.copyLinkBtn.textContent = original; }, 2000);
        }
      } catch (_) {}
    });
  }


  /**
   * Fetch live FX rates from Frankfurter (ECB-sourced, free, no API key)
   */
  async function fetchFxRates() {
    try {
      const response = await fetch(
        'https://api.frankfurter.app/latest?from=USD&to=EUR,MXN'
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data.rates && data.rates.EUR) FX_RATES.EUR = 1 / data.rates.EUR;
      if (data.rates && data.rates.MXN) FX_RATES.MXN = 1 / data.rates.MXN;
      if (elements.fxWarning) {
        elements.fxWarning.textContent = S.fxLive(data.date, FX_RATES.EUR.toFixed(4), FX_RATES.MXN.toFixed(5));
      }
    } catch (error) {
      console.warn('FX rate fetch failed, using fallback rates:', error);
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
      spotPriceFailed = true;
      setStatus(S.errSpotFetch, 'error');
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
      annualAverages = Object.fromEntries(
        Object.entries(raw).filter(([k]) => /^\d{4}$/.test(k))
      );
      return annualAverages;
    } catch (error) {
      console.error('Failed to load annual averages:', error);
      setStatus(S.errAnnualLoad, 'error');
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
   * Compute BTC CAGR from the loaded annual averages.
   */
  function computeBtcCagrs() {
    if (!annualAverages) return null;
    const years = Object.keys(annualAverages).map(Number).sort((a, b) => a - b);
    if (years.length < 2) return null;

    const earliest = years[0];
    const latest = years[years.length - 1];
    const earliestPrice = annualAverages[earliest];
    const latestPrice = annualAverages[latest];

    const historicalYears = latest - earliest;
    const historical = historicalYears > 0
      ? (Math.pow(latestPrice / earliestPrice, 1 / historicalYears) - 1) * 100
      : null;

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
   * Compute trailing CPI CAGR from cpi_annual.json.
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
   * Update the Historical / 5-Year mode-toggle button labels with actual CAGR values.
   */
  function updateBtcGrowthButtonLabels() {
    if (!btcCagrCache) return;
    if (elements.btcHistoricalModeBtn && btcCagrCache.historical !== null) {
      const [a, b] = btcCagrCache.historicalSpan;
      elements.btcHistoricalModeBtn.textContent = S.btcHistoricalBtn(btcCagrCache.historical.toFixed(1));
      elements.btcHistoricalModeBtn.title = S.btcHistoricalTitle(a, b);
    }
    if (elements.btc5yModeBtn && btcCagrCache.fiveYear !== null) {
      const [a, b] = btcCagrCache.fiveYearSpan;
      elements.btc5yModeBtn.textContent = S.btc5yBtn(btcCagrCache.fiveYear.toFixed(1));
      elements.btc5yModeBtn.title = S.btc5yTitle(a, b);
    }
  }

  /**
   * Switch the BTC growth-rate mode (custom / historical / 5y).
   */
  function setBtcGrowthMode(mode) {
    if (!elements.btcGrowthInput) return;

    if (btcGrowthMode === BTC_GROWTH_MODES.CUSTOM) {
      const v = parseFloat(elements.btcGrowthInput.value);
      if (!isNaN(v)) customBtcGrowth = v;
    }

    btcGrowthMode = mode;

    if (elements.btcCustomModeBtn)     elements.btcCustomModeBtn.classList.toggle('mode-btn--active',     mode === BTC_GROWTH_MODES.CUSTOM);
    if (elements.btcHistoricalModeBtn) elements.btcHistoricalModeBtn.classList.toggle('mode-btn--active', mode === BTC_GROWTH_MODES.HISTORICAL);
    if (elements.btc5yModeBtn)         elements.btc5yModeBtn.classList.toggle('mode-btn--active',         mode === BTC_GROWTH_MODES.FIVE_YEAR);

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
          throw new Error(S.errSpotNA);
        }
        return spotPrice;

      case 'annual':
        if (!annualAverages) {
          throw new Error(S.errAnnualNA);
        }
        const recentYear = getMostRecentAverageYear();
        if (!recentYear) {
          throw new Error(S.errAnnualNoData);
        }
        return annualAverages[recentYear];

      case 'manual':
        const manualPrice = parseFloat(elements.btcPriceManualInput.value);
        if (isNaN(manualPrice) || manualPrice <= 0) {
          throw new Error(S.errBtcPrice);
        }
        return manualPrice;

      default:
        throw new Error(S.errMethod);
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

    const manualGroup = elements.btcPriceManualInput.closest('.form-group');
    if (method === 'manual') {
      manualGroup.classList.remove('form-group--hidden');
      elements.btcPriceDisplay.textContent = '';
      return;
    } else {
      manualGroup.classList.add('form-group--hidden');
    }

    if (method === 'spot') {
      if (spotPrice !== null) {
        displayText = S.btcSpot(formatUsdCurrency(spotPrice));
      } else if (spotPriceFailed) {
        displayText = S.errSpotFetch;
      } else {
        displayText = S.btcLoadingSpot;
      }
    } else if (method === 'annual') {
      if (annualAverages) {
        const recentYear = getMostRecentAverageYear();
        if (recentYear) {
          const isStale = recentYear < CURRENT_YEAR;
          displayText = isStale
            ? S.btcAnnualStale(recentYear, formatUsdCurrency(annualAverages[recentYear]))
            : S.btcAnnual(recentYear, formatUsdCurrency(annualAverages[recentYear]));
        }
      } else {
        displayText = S.btcLoadingAnnual;
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
    const salaryRaw = parseFloat(elements.salaryInput.value);
    if (isNaN(salaryRaw) || salaryRaw <= 0) {
      throw new Error(S.errSalary);
    }
    const salary = salaryFrequency === 'monthly' ? salaryRaw * 12 : salaryRaw;

    const salaryGrowth = parseFloat(elements.salaryGrowthInput.value) || 0;
    if (salaryGrowth < -100 || salaryGrowth > 1000) {
      throw new Error(S.errSalaryGrowth);
    }

    const btcGrowth = parseFloat(elements.btcGrowthInput.value) || 0;
    if (btcGrowth < -100 || btcGrowth > 1000) {
      throw new Error(S.errBtcGrowth);
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

    const headerRow = document.querySelector('#mainProjectionTable thead tr');
    if (headerRow) {
      if (headerRow.cells[3]) headerRow.cells[3].textContent = displayUnit === 'btc' ? S.tableHeaderSaliBtc : S.tableHeaderSaliSats;
      if (headerRow.cells[1]) headerRow.cells[1].textContent = salaryGrowthMode === 'real' ? S.tableHeaderSalaryReal : S.tableHeaderSalary;
    }

    const breakdownThs = document.querySelectorAll('#mainProjectionTable thead .breakdown-col');
    breakdownThs.forEach(th => { th.style.display = showBreakdown ? '' : 'none'; });

    const firstFutureIdx = projections.findIndex(p => !p.isHistorical && p.year > CURRENT_YEAR);

    elements.projectionTableBody.innerHTML = projections.map((p, idx) => {
      let rowClass = p.isCurrentYear ? 'current-year-row' : (p.isHistorical ? '' : 'projected-row');
      if (idx === firstFutureIdx) rowClass += ' first-projected-row';
      const yearLabel = p.isCurrentYear ? S.tableNow(p.year) : p.year;
      const saliDisplay = displayUnit === 'btc' ? formatBtc(p.btcEquivalent) : formatSats(p.sats);
      const dispStyle = showBreakdown ? '' : 'style="display:none"';

      let salaryEffectCell = `<td class="breakdown-col" ${dispStyle}>-</td>`;
      let btcEffectCell = `<td class="breakdown-col" ${dispStyle}>-</td>`;

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
   * Read URL query params and apply to inputs
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
    if (params.has('strc')) {
      const strc = parseFloat(params.get('strc'));
      if (!isNaN(strc) && strc > 0) {
        strcEnabled = true;
        strcPct = Math.min(100, Math.max(0, strc));
        if (elements.strcEnableToggle) elements.strcEnableToggle.checked = true;
        if (elements.strcPctInput) elements.strcPctInput.value = strcPct;
        if (elements.strcPctGroup) elements.strcPctGroup.classList.remove('form-group--hidden');
      }
    }
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
    if (strcEnabled && strcPct > 0) params.set('strc', strcPct);
    const qs = params.toString();
    window.history.replaceState({}, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }

  /**
   * Render chart - Bitcoin (default) or benchmark comparison
   */
  function renderChart(projections) {
    if (!elements.saliChart) return;

    const ctx = elements.saliChart.getContext('2d');

    let chartProjections, chartData, yAxisLabel, datasetLabel, tooltipValueFn, yTickFn;

    if (activeBenchmark !== 'btc') {
      const bConfig = BENCHMARK_DATA[activeBenchmark];
      const growthRate = benchmarkGrowthOverride !== null ? benchmarkGrowthOverride : bConfig.defaultGrowth;
      chartProjections = generateBenchmarkSeries(projections, activeBenchmark, growthRate);
      chartData = chartProjections.map(p => p.benchValue);
      yAxisLabel = bConfig.unit;
      datasetLabel = `${bConfig.name} - salary in ${bConfig.unitShort}`;
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
      yAxisLabel = displayUnit === 'btc' ? S.chartAxisBtc : S.chartAxisSats;
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

    const titleEl = document.getElementById('chartTitle');
    if (titleEl) {
      titleEl.textContent = activeBenchmark === 'btc'
        ? S.chartTitleSali
        : S.chartTitleBench(BENCHMARK_DATA[activeBenchmark].name);
    }

    const labels = chartProjections.map(p => p.year.toString());
    const currentYearIndex = chartProjections.findIndex(p => p.isCurrentYear);

    const isRerender = !!chartInstance;
    if (chartInstance) chartInstance.destroy();

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
        c.fillText(S.chartToday, x, chartArea.top + 12);
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
                if (p.isCurrentYear) title += S.chartCurrent;
                else if (!p.isHistorical) title += S.chartProjected;
                return title;
              },
              label: function(context) {
                return tooltipValueFn(chartProjections[context.dataIndex]);
              },
              afterLabel: function(context) {
                const p = chartProjections[context.dataIndex];
                if (activeBenchmark === 'btc') return S.chartBtcPrice(formatUsdCurrency(p.btcPrice));
                const bConfig = BENCHMARK_DATA[activeBenchmark];
                return S.chartBenchPrice(bConfig.name, formatUsdCurrency(p.benchPrice));
              }
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: S.chartAxisYear, color: textMuted },
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

    if (!isRerender) {
      const parent = elements.saliChart.parentNode;
      requestAnimationFrame(() => {
        if (chartInstance) chartInstance.resize(parent.clientWidth, parent.clientHeight);
      });
    }
  }

  /**
   * Render normalized multi-benchmark comparison chart.
   */
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

    const btcData  = projections.map(p => (btcStart / p.btcEquivalent) * 100);
    const spxData  = spxSeries.map(p  => (spxStart / p.benchValue)  * 100);
    const goldData = goldSeries.map(p => (goldStart / p.benchValue) * 100);
    const cpiData  = cpiSeries.map(p  => (cpiStart / p.benchValue)  * 100);

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
        c.fillText(S.chartToday, x, chartArea.top + 12);
        c.restore();
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
          {
            label: S.normBitcoin,
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
            label: S.normSP500,
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
            label: S.normGold,
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
            label: S.normCpi,
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
              color: normTheme.textSecondary,
              usePointStyle: true,
              pointStyleWidth: 14,
              boxHeight: 8,
              font: { family: '"Roboto Mono", monospace', size: 12 }
            }
          },
          tooltip: {
            backgroundColor: normTheme.bgCard,
            borderColor: normTheme.border,
            borderWidth: 1,
            titleColor: normTheme.text,
            bodyColor: normTheme.textSecondary,
            padding: 12,
            displayColors: true,
            callbacks: {
              title: function(context) {
                const idx = context[0].dataIndex;
                const p = projections[idx];
                let title = p.year.toString();
                if (p.isCurrentYear) title += S.chartCurrent;
                else if (!p.isHistorical) title += S.chartProjected;
                return title;
              },
              label: function(context) {
                const val = context.parsed.y;
                const diff = val - 100;
                const sign = diff >= 0 ? '+' : '';
                return `${context.dataset.label}: ${val.toFixed(1)}  (${sign}${diff.toFixed(1)}% vs salary)`;
              }
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: S.chartAxisYear, color: normTheme.textMuted },
            ticks: { color: normTheme.textMuted },
            grid: { color: normTheme.grid }
          },
          y: {
            beginAtZero: false,
            title: { display: true, text: S.normAxisY, color: normTheme.textMuted },
            ticks: {
              color: normTheme.textMuted,
              callback: v => v.toFixed(0)
            },
            grid: { color: normTheme.grid }
          }
        }
      },
      plugins: [todayPlugin]
    });
  }

  /**
   * SALI Tier - compares user's sats to US income benchmarks at current BTC price
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
    if (userSats >= top10)       { tier = S.tierTop10; dot = '🔵'; }
    else if (userSats >= top25)  { tier = S.tierTop25; dot = '🟡'; }
    else if (userSats >= median * 0.9 && userSats <= median * 1.1)
                                 { tier = S.tierMedian; dot = '⚪'; }
    else if (userSats > median)  { tier = S.tierAbove; dot = '🟠'; }
    else                         { tier = S.tierBelow; dot = '🟤'; }

    badge.textContent = `${dot} ${tier}`;
    wrap.style.display = 'block';
  }

  /**
   * Purchasing Power Narrative - plain-English interpretation of historical SALI change
   */
  function updatePurchasingPowerNarrative(projections, currency) {
    const el = elements.ppNarrative;
    if (!el) return;

    const first = projections[0];
    const current = projections.find(p => p.isCurrentYear);
    if (!first || !current || first === current) { el.style.display = 'none'; return; }

    const pctChange = ((current.sats - first.sats) / first.sats) * 100;
    const absPct = Math.abs(pctChange).toFixed(1);
    const direction = pctChange >= 0 ? S.ppGained : S.ppLost;

    const firstBtc = first.btcEquivalent.toFixed(4);
    const currBtc  = current.btcEquivalent.toFixed(4);

    let interpretation;
    if (Math.abs(pctChange) < 5) {
      interpretation = S.ppEqual;
    } else if (pctChange < 0) {
      interpretation = S.ppLess(absPct, first.year);
    } else {
      interpretation = S.ppMore(absPct, first.year);
    }

    el.innerHTML =
      `<div class="pp-narrative__headline">${S.ppHeadline(first.year)}</div>` +
      S.ppNarr(first.year, formatCurrency(first.salary, currency), firstBtc, currBtc, direction, absPct, interpretation);
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
    elements.realGrowthNote.textContent = S.inflNote(nominalGrowth.toFixed(1), realGrowth.toFixed(2), inflationRate.toFixed(1));
    elements.realGrowthNote.style.display = 'block';
  }

  /**
   * Update break-even calculator
   */
  function updateBreakEven(salary, currency, nominalSalaryGrowth, btcGrowth) {
    if (!elements.breakevenRateOutput) return;

    const strcForwardBoost = (strcEnabled && strcPct > 0)
      ? (strcPct / 100) * strcCurrentYield * 100
      : 0;
    const breakevenRate = Math.max(0, btcGrowth - strcForwardBoost);

    elements.breakevenRateOutput.textContent = '+' + breakevenRate.toFixed(1) + '%/yr'
      + (strcForwardBoost > 0 ? S.bkStrcReduced(strcForwardBoost.toFixed(2)) : '');

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
          elements.breakevenGap.textContent = strcForwardBoost > 0
            ? S.bkBehindStrc(gapStr, formatCurrency(diff5, currency))
            : S.bkBehind(gapStr, formatCurrency(diff5, currency));
          elements.breakevenGap.className = 'breakeven-gap breakeven-gap--behind';
        } else {
          elements.breakevenGap.textContent = strcForwardBoost > 0
            ? S.bkAheadStrc(strcForwardBoost.toFixed(2))
            : S.bkAhead(gapStr);
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
    const direction = totalChange >= 0 ? S.histGained : S.histLost;
    const absPct = Math.abs(totalChange).toFixed(1);

    if (elements.historySummary) {
      elements.historySummary.innerHTML = S.histSummary(
        first.year, formatCurrency(startSalaryRaw, currency), last.year,
        direction, absPct, formatSats(first.sats), formatSats(last.sats)
      );
    }

    if (elements.historyTableBody) {
      elements.historyTableBody.innerHTML = historyData.map((row, idx) => {
        const prev = idx > 0 ? historyData[idx - 1] : null;
        const yoyChange = prev ? ((row.sats - prev.sats) / prev.sats * 100) : null;
        const yoyText = yoyChange !== null ? formatPercent(yoyChange) : '-';
        const yoyClass = yoyChange !== null ? (yoyChange >= 0 ? 'score--gaining' : 'score--losing') : '';
        const isLast = idx === historyData.length - 1;
        return `
          <tr class="${isLast ? 'current-year-row' : ''}">
            <td>${row.year}${isLast ? S.histNow : ''}</td>
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
   */
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
    const bmTheme = getThemeColors();
    benchmarkChartInstance = new Chart(freshCtx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: S.normBitcoin,
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
            label: S.normSP500,
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
            label: S.normGold,
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
            label: S.benchCpi,
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
            text: S.benchTitle(startYear),
            color: bmTheme.text,
            font: { family: '"Roboto Mono", monospace', size: 13 }
          },
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: bmTheme.textSecondary,
              usePointStyle: true,
              pointStyleWidth: 14,
              boxHeight: 8,
              font: { family: '"Roboto Mono", monospace', size: 12 }
            }
          },
          tooltip: {
            backgroundColor: bmTheme.bgCard,
            borderColor: bmTheme.border,
            borderWidth: 1,
            titleColor: bmTheme.text,
            bodyColor: bmTheme.textSecondary,
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
            title: { display: true, text: S.chartAxisYear, color: bmTheme.textMuted },
            ticks: { color: bmTheme.textMuted },
            grid: { color: bmTheme.grid }
          },
          y: {
            beginAtZero: false,
            title: { display: true, text: S.benchAxisY, color: bmTheme.textMuted },
            ticks: {
              color: bmTheme.textMuted,
              callback: v => v.toFixed(0)
            },
            grid: { color: bmTheme.grid }
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
      const { salary, salaryGrowth: nominalSalaryGrowth, btcGrowth, startYear, forecastYears } = validateInputs();
      const currency = elements.currencySelect.value;

      const inflationRate = salaryGrowthMode === 'real'
        ? (parseFloat(elements.inflationInput && elements.inflationInput.value) || 3)
        : 0;
      const effectiveSalaryGrowth = salaryGrowthMode === 'real'
        ? ((1 + nominalSalaryGrowth / 100) / (1 + inflationRate / 100) - 1) * 100
        : nominalSalaryGrowth;

      updateInflationNote(nominalSalaryGrowth, inflationRate);

      const salaryUsd = convertToUsd(salary, currency);

      const strcDividendUsd = (strcEnabled && strcPct > 0)
        ? salaryUsd * (strcPct / 100) * strcCurrentYield
        : 0;
      const effectiveSalaryUsd = salaryUsd + strcDividendUsd;

      const baseBtcPrice = getBtcPrice();

      const projections = generateProjections(effectiveSalaryUsd, baseBtcPrice, effectiveSalaryGrowth, btcGrowth, startYear, forecastYears);

      const currentYearData = projections.find(p => p.isCurrentYear) || projections[projections.length - 1];

      if (displayUnit === 'btc') {
        elements.saliSatsOutput.textContent = formatBtc(currentYearData.btcEquivalent) + '/year';
        elements.btcOutputGroup.style.display = 'none';
      } else {
        elements.saliSatsOutput.textContent = formatSats(currentYearData.sats) + ' sats/year';
        elements.saliBtcOutput.textContent = formatBtc(currentYearData.btcEquivalent) + '/year';
        elements.btcOutputGroup.style.display = 'block';
      }

      const trendScore = calculateTrendScore(projections);

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
          let desc = trendScore.description;
          if (strcEnabled && strcDividendUsd > 0) {
            desc += S.projStrcDiv(Math.round(strcDividendUsd).toLocaleString('en-US'));
          }
          elements.projectedChangeDesc.textContent = desc;
        }
        elements.saliYoyOutput.parentElement.style.display = 'block';
      } else {
        elements.saliYoyOutput.parentElement.style.display = 'none';
      }

      updateFxWarning();
      updateUrlParams();
      updateEquivalents(currentYearData.sats, currentYearData.btcEquivalent);

      const gradeData = computeSaliGrade(projections, btcGrowth, nominalSalaryGrowth);
      updateSaliScore(gradeData);

      if (elements.shareRow) elements.shareRow.style.display = 'grid';
      updateShareLinks(gradeData);

      updateDecompSummary(projections);
      updateSaliTier(currentYearData.sats, baseBtcPrice);
      updatePurchasingPowerNarrative(projections, currency);
      updateBreakEven(salary, currency, nominalSalaryGrowth, btcGrowth);
      computeHistorical(baseBtcPrice, currency);
      updateStrcOutput(salary, currency, baseBtcPrice);

      renderTable(projections, currency);
      renderChart(projections);
      renderNormalizedChart(projections);
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
    const minYear = annualAverages ? Math.min(...Object.keys(annualAverages).map(Number)) : 2015;
    for (let year = minYear; year <= CURRENT_YEAR; year++) {
      const option = document.createElement('option');
      option.value = year;
      option.textContent = year;
      if (year === DEFAULT_START_YEAR) option.selected = true;
      elements.startYearSelect.appendChild(option);
    }

    for (let i = 1; i <= 30; i++) {
      const option = document.createElement('option');
      option.value = i;
      option.textContent = i === 1 ? S.yearForecast1 : S.yearForecastN(i);
      if (i === DEFAULT_FORECAST_YEARS) option.selected = true;
      elements.yearsSelect.appendChild(option);
    }

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
   * Fetch STRC live price from Yahoo Finance's v8 chart endpoint.
   */
  async function fetchStrcData() {
    try {
      const res = await fetch(
        'https://query1.finance.yahoo.com/v8/finance/chart/STRC?interval=1d&range=1d',
        { signal: AbortSignal.timeout(2000) }
      );
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
      if (!price || price <= 0) throw new Error('No price');
      strcCurrentPrice = price;
      strcCurrentYield = STRC_ANNUAL_DIV / price;
      strcDataSource = 'live';
    } catch (_) {
      strcCurrentPrice = STRC_PAR;
      strcCurrentYield = STRC_STATED_RATE;
      strcDataSource = 'fallback';
    }
    updateStrcYieldDisplay();
    if (strcEnabled) compute();
  }

  function updateStrcYieldDisplay() {
    const el = elements.strcYieldDisplay || document.getElementById('strcYieldDisplay');
    if (!el) return;
    const yieldPct = (strcCurrentYield * 100).toFixed(2);
    const priceStr = formatUsdCurrency(strcCurrentPrice);
    const src = strcDataSource === 'live' ? S.strcYieldLive : S.strcYieldDate(STRC_RATE_DATE);
    el.textContent = S.strcYieldDisplay(priceStr, yieldPct, src);
    el.className = 'strc-yield-display strc-yield-display--' + strcDataSource;
  }

  function updateStrcOutput(salary, currency, btcPrice) {
    const wrap = elements.strcOutputWrap;
    if (!wrap) return;
    if (!strcEnabled || !salary || salary <= 0) {
      wrap.style.display = 'none';
      return;
    }
    const alloc = salary * (strcPct / 100);
    const dividendIncome = alloc * strcCurrentYield;
    const remaining = salary - alloc;
    const shares = strcCurrentPrice > 0 ? Math.round(alloc / strcCurrentPrice) : 0;

    if (elements.strcAllocOutput)  elements.strcAllocOutput.textContent  = formatCurrency(alloc, currency);
    if (elements.strcDivOutput)    elements.strcDivOutput.textContent    = formatCurrency(dividendIncome, currency) + '/yr';
    if (elements.strcRemainOutput) elements.strcRemainOutput.textContent = formatCurrency(remaining, currency);

    if (elements.strcYieldNote) {
      const yieldPct = (strcCurrentYield * 100).toFixed(2);
      const srcNote  = strcDataSource === 'live' ? S.strcNoteLive : S.strcNoteFallback;
      const histNote = S.strcNoteHist;
      elements.strcYieldNote.textContent = S.strcNoteText(shares.toLocaleString('en-US'), STRC_ANNUAL_DIV.toFixed(2), yieldPct, srcNote, histNote);
    }
    wrap.style.display = 'block';
  }

  /**
   * Initialize calculator
   */
  function init() {
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
      histStartYear: document.getElementById('histStartYear'),
      histStartSalary: document.getElementById('histStartSalary'),
      historyResults: document.getElementById('historyResults'),
      historySummary: document.getElementById('historySummary'),
      historyTableBody: document.getElementById('historyTableBody'),
      breakevenRateOutput: document.getElementById('breakevenRateOutput'),
      breakevenSalary5: document.getElementById('breakevenSalary5'),
      projectedSalary5: document.getElementById('projectedSalary5'),
      breakevenGap: document.getElementById('breakevenGap'),
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
      strcYieldNote: document.getElementById('strcYieldNote')
    };

    if (!elements.salaryInput) {
      return;
    }

    updateStrcYieldDisplay();

    if (elements.strcEnableToggle) {
      elements.strcEnableToggle.addEventListener('change', () => {
        strcEnabled = elements.strcEnableToggle.checked;
        if (elements.strcPctGroup) {
          elements.strcPctGroup.classList.toggle('form-group--hidden', !strcEnabled);
        }
        compute();
      });
    }
    if (elements.strcPctInput) {
      const onStrcPct = () => {
        strcPct = parseFloat(elements.strcPctInput.value) || 0;
        compute();
      };
      elements.strcPctInput.addEventListener('input', onStrcPct);
      elements.strcPctInput.addEventListener('change', onStrcPct);
    }

    fetchStrcData();

    Promise.all([
      fetchSpotPrice(),
      fetchFxRates(),
      loadAnnualAverages(),
      loadBenchmarkJsonData()
    ]).then(() => {
      populateYearSelects();
      parseUrlParams();
      updateBtcPriceDisplay();
      updateFxWarning();

      btcCagrCache = computeBtcCagrs();
      updateBtcGrowthButtonLabels();
      const initialBtcGrowth = parseFloat(elements.btcGrowthInput.value);
      if (!isNaN(initialBtcGrowth)) customBtcGrowth = initialBtcGrowth;

      const trailingCpi = computeTrailingCpi(3);
      if (trailingCpi && elements.inflationInput) {
        elements.inflationInput.value = trailingCpi.cagr.toFixed(1);
        const [a, b] = trailingCpi.span;
        elements.inflationInput.title = `Default: trailing ${b - a}-year US CPI (${a}–${b}) from BLS data. Edit to use your own assumption.`;
      }

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

      elements.btcPriceMethodSelect.addEventListener('change', () => {
        updateBtcPriceDisplay();
        compute();
      });

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

      if (elements.btcCustomModeBtn)     elements.btcCustomModeBtn.addEventListener('click',     () => setBtcGrowthMode(BTC_GROWTH_MODES.CUSTOM));
      if (elements.btcHistoricalModeBtn) elements.btcHistoricalModeBtn.addEventListener('click', () => setBtcGrowthMode(BTC_GROWTH_MODES.HISTORICAL));
      if (elements.btc5yModeBtn)         elements.btc5yModeBtn.addEventListener('click',         () => setBtcGrowthMode(BTC_GROWTH_MODES.FIVE_YEAR));
      if (elements.btcGrowthInput) {
        elements.btcGrowthInput.addEventListener('input', () => {
          if (btcGrowthMode === BTC_GROWTH_MODES.CUSTOM) {
            const v = parseFloat(elements.btcGrowthInput.value);
            if (!isNaN(v)) customBtcGrowth = v;
          }
        });
      }

      if (elements.histStartYear) {
        elements.histStartYear.addEventListener('change', compute);
      }
      if (elements.histStartSalary) {
        elements.histStartSalary.addEventListener('input', compute);
        elements.histStartSalary.addEventListener('change', compute);
      }

      function setBenchmark(b) {
        activeBenchmark = b;
        benchmarkGrowthOverride = null;
        [
          [elements.benchBtcBtn, 'btc'],
          [elements.benchSpxBtn, 'spx'],
          [elements.benchGoldBtn, 'gold'],
          [elements.benchCpiBtn, 'cpi']
        ].forEach(([btn, key]) => {
          if (btn) btn.classList.toggle('benchmark-btn--active', key === b);
        });
        if (elements.benchmarkPanel) {
          elements.benchmarkPanel.style.display = b === 'btc' ? 'none' : 'block';
        }
        if (b !== 'btc' && elements.benchmarkGrowthLabel && elements.benchmarkGrowthInput) {
          const bConfig = BENCHMARK_DATA[b];
          elements.benchmarkGrowthLabel.textContent = S.benchGrowthLabel(bConfig.name);
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

      if (elements.breakdownToggle) {
        elements.breakdownToggle.addEventListener('click', () => {
          showBreakdown = !showBreakdown;
          elements.breakdownToggle.textContent = showBreakdown ? S.breakdownHide : S.breakdownShow;
          compute();
        });
      }

      if (elements.salaryAnnualBtn) {
        elements.salaryAnnualBtn.addEventListener('click', () => {
          if (salaryFrequency === 'monthly') {
            const v = parseFloat(elements.salaryInput.value);
            if (!isNaN(v)) elements.salaryInput.value = Math.round(v * 12);
            elements.salaryInput.step = 1000;
            elements.salaryInput.placeholder = S.salaryPlaceholderAnnual;
          }
          salaryFrequency = 'annual';
          elements.salaryAnnualBtn.classList.add('mode-btn--active');
          if (elements.salaryMonthlyBtn) elements.salaryMonthlyBtn.classList.remove('mode-btn--active');
          compute();
        });
      }
      if (elements.salaryMonthlyBtn) {
        elements.salaryMonthlyBtn.addEventListener('click', () => {
          if (salaryFrequency === 'annual') {
            const v = parseFloat(elements.salaryInput.value);
            if (!isNaN(v)) elements.salaryInput.value = Math.round(v / 12);
            elements.salaryInput.step = 100;
            elements.salaryInput.placeholder = S.salaryPlaceholderMonthly;
          }
          salaryFrequency = 'monthly';
          elements.salaryMonthlyBtn.classList.add('mode-btn--active');
          if (elements.salaryAnnualBtn) elements.salaryAnnualBtn.classList.remove('mode-btn--active');
          compute();
        });
      }

      new MutationObserver(() => { if (initComputeComplete) compute(); })
        .observe(document.body, { attributes: true, attributeFilter: ['class'] });

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

      const _initParams = new URLSearchParams(window.location.search);
      hasInitialUrlParams = _initParams.has('salary') || _initParams.has('startYear') ||
                            _initParams.has('btcGrowth') || _initParams.has('forecast');

      compute();
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
