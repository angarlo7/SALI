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
  const DEFAULT_FORECAST_YEARS = 10;
  const CURRENT_YEAR = new Date().getFullYear();

  // Placeholder FX rates to USD (update for production)
  const FX_RATES = {
    USD: 1,
    EUR: 1.08,  // 1 EUR = 1.08 USD (placeholder)
    MXN: 0.058  // 1 MXN = 0.058 USD (placeholder)
  };

  // State
  let spotPrice = null;
  let annualAverages = null;
  let chartInstance = null;
  let displayUnit = 'sats'; // 'sats' or 'btc'

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
   * Format SALI value based on current display unit
   */
  function formatSaliValue(sats, btcEquivalent) {
    if (displayUnit === 'btc') {
      return formatBtc(btcEquivalent);
    }
    return formatSats(sats) + ' sats';
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
   * Get BTC price for a specific year (from historical data or projected)
   */
  function getBtcPriceForYear(year, basePrice, baseYear, btcGrowthRate) {
    // Check if we have historical data for this year
    if (annualAverages && annualAverages[year]) {
      return annualAverages[year];
    }

    // Otherwise, project from base price
    const yearsDiff = year - baseYear;
    return basePrice * Math.pow(1 + btcGrowthRate / 100, yearsDiff);
  }

  /**
   * Generate projection data with actual years
   */
  function generateProjections(salaryUsd, baseBtcPrice, salaryGrowth, btcGrowth, startYear, forecastYears) {
    const projections = [];
    const endYear = CURRENT_YEAR + forecastYears;

    // Determine the base year for projections (most recent year with data or current year)
    const mostRecentDataYear = annualAverages ? Math.max(...Object.keys(annualAverages).map(Number)) : CURRENT_YEAR;

    for (let year = startYear; year <= endYear; year++) {
      const yearIndex = year - startYear;

      // Salary grows from start year
      const salaryYear = salaryUsd * Math.pow(1 + salaryGrowth / 100, yearIndex);

      // BTC price: use historical if available, otherwise project
      let btcPriceYear;
      if (annualAverages && annualAverages[year]) {
        btcPriceYear = annualAverages[year];
      } else {
        // Project from the most recent data point or base price
        const projectionBase = year > mostRecentDataYear ? mostRecentDataYear : CURRENT_YEAR;
        const projectionBasePrice = annualAverages && annualAverages[projectionBase]
          ? annualAverages[projectionBase]
          : baseBtcPrice;
        const yearsFromBase = year - projectionBase;
        btcPriceYear = projectionBasePrice * Math.pow(1 + btcGrowth / 100, yearsFromBase);
      }

      const { sats, btcEquivalent } = calculateSali(salaryYear, btcPriceYear);

      projections.push({
        year,
        yearIndex,
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
      description = 'Your labor is projected to gain purchasing power in BTC terms';
    } else if (projectedChange < -10) {
      trend = 'losing';
      description = 'Your labor is projected to lose purchasing power in BTC terms';
    } else {
      trend = 'neutral';
      description = 'Your labor purchasing power is relatively stable in BTC terms';
    }

    return {
      score: projectedChange,
      trend,
      description,
      historicalChange
    };
  }

  /**
   * Fetch spot price from CoinGecko
   */
  async function fetchSpotPrice() {
    try {
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd'
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data.bitcoin || !data.bitcoin.usd) {
        throw new Error('Invalid response format');
      }

      spotPrice = data.bitcoin.usd;
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

      annualAverages = await response.json();
      return annualAverages;
    } catch (error) {
      console.error('Failed to load annual averages:', error);
      setStatus('Unable to load annual average data.', 'error');
      return null;
    }
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
          displayText = `${recentYear} Avg: ${formatUsdCurrency(annualAverages[recentYear])}`;
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
   * Render projection table
   */
  function renderTable(projections, currency) {
    if (!elements.projectionTableBody) return;

    elements.projectionTableBody.innerHTML = projections.map(p => {
      const rowClass = p.isCurrentYear ? 'current-year-row' : (p.isHistorical ? '' : 'projected-row');
      const yearLabel = p.isCurrentYear ? `${p.year} (Now)` : p.year;
      const saliDisplay = displayUnit === 'btc' ? formatBtc(p.btcEquivalent) : formatSats(p.sats);

      return `
        <tr class="${rowClass}">
          <td>${yearLabel}</td>
          <td>${formatCurrency(p.salary, currency)}</td>
          <td>${formatUsdCurrency(p.btcPrice)}${p.isHistorical ? '' : '*'}</td>
          <td>${saliDisplay}</td>
        </tr>
      `;
    }).join('');
  }

  /**
   * Render chart with actual years
   */
  function renderChart(projections) {
    if (!elements.saliChart) return;

    const ctx = elements.saliChart.getContext('2d');
    const labels = projections.map(p => p.year.toString());

    // Data depends on display unit
    const data = displayUnit === 'btc'
      ? projections.map(p => p.btcEquivalent)
      : projections.map(p => Math.round(p.sats));

    // Find index of current year for annotation
    const currentYearIndex = projections.findIndex(p => p.isCurrentYear);

    // Destroy existing chart
    if (chartInstance) {
      chartInstance.destroy();
    }

    // Dark theme colors
    const cyanColor = '#00d4aa';
    const cyanDim = 'rgba(0, 212, 170, 0.15)';
    const textMuted = '#6a6a7a';
    const textSecondary = '#9898a8';
    const bgCard = '#1a1a24';

    chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: displayUnit === 'btc' ? 'SALI (BTC/year)' : 'SALI (sats/year)',
          data,
          borderColor: cyanColor,
          backgroundColor: cyanDim,
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointBackgroundColor: projections.map(p =>
            p.isCurrentYear ? '#e8e8ed' : (p.isHistorical ? cyanColor : 'rgba(0, 212, 170, 0.5)')
          ),
          pointBorderColor: projections.map(p =>
            p.isCurrentYear ? '#e8e8ed' : (p.isHistorical ? cyanColor : 'rgba(0, 212, 170, 0.5)')
          ),
          pointRadius: projections.map(p => p.isCurrentYear ? 6 : 4),
          pointHoverRadius: 8,
          segment: {
            borderDash: ctx => {
              const idx = ctx.p0DataIndex;
              return projections[idx] && !projections[idx].isHistorical && idx >= currentYearIndex ? [5, 5] : undefined;
            }
          }
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: bgCard,
            borderColor: '#2a2a3a',
            borderWidth: 1,
            titleColor: '#e8e8ed',
            bodyColor: textSecondary,
            padding: 12,
            displayColors: false,
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
                const idx = context.dataIndex;
                const p = projections[idx];
                if (displayUnit === 'btc') {
                  return `SALI: ${formatBtc(p.btcEquivalent)}/year`;
                }
                return `SALI: ${formatSats(p.sats)} sats/year`;
              },
              afterLabel: function(context) {
                const idx = context.dataIndex;
                const p = projections[idx];
                return `BTC Price: ${formatUsdCurrency(p.btcPrice)}`;
              }
            }
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Year',
              color: textMuted
            },
            ticks: {
              color: textMuted
            },
            grid: {
              color: 'rgba(42, 42, 58, 0.5)'
            }
          },
          y: {
            beginAtZero: false,
            title: {
              display: true,
              text: displayUnit === 'btc' ? 'BTC per Year' : 'Sats per Year',
              color: textMuted
            },
            ticks: {
              color: textMuted,
              callback: function(value) {
                if (displayUnit === 'btc') {
                  return value.toFixed(4);
                }
                return formatSats(value);
              }
            },
            grid: {
              color: 'rgba(42, 42, 58, 0.5)'
            }
          }
        }
      }
    });
  }

  /**
   * Update unit toggle UI
   */
  function updateUnitToggle() {
    elements.unitToggleSats.classList.toggle('unit-toggle__btn--active', displayUnit === 'sats');
    elements.unitToggleBtc.classList.toggle('unit-toggle__btn--active', displayUnit === 'btc');
  }

  /**
   * Main compute function
   */
  function compute() {
    clearStatus();

    try {
      // Validate inputs
      const { salary, salaryGrowth, btcGrowth, startYear, forecastYears } = validateInputs();
      const currency = elements.currencySelect.value;

      // Convert salary to USD
      const salaryUsd = convertToUsd(salary, currency);

      // Get base BTC price
      const baseBtcPrice = getBtcPrice();

      // Generate projections with actual years
      const projections = generateProjections(salaryUsd, baseBtcPrice, salaryGrowth, btcGrowth, startYear, forecastYears);

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

      // Calculate and display trend score
      const trendScore = calculateTrendScore(projections);
      if (trendScore.score !== null) {
        elements.saliScoreOutput.textContent = formatPercent(trendScore.score);
        elements.saliScoreOutput.className = 'output-group__value output-group__value--score score--' + trendScore.trend;
        elements.saliScoreDesc.textContent = trendScore.description;
      } else {
        elements.saliScoreOutput.textContent = '—';
        elements.saliScoreOutput.className = 'output-group__value output-group__value--score';
        elements.saliScoreDesc.textContent = '';
      }

      // Update projected change output
      const firstProjection = projections[0];
      const lastProjection = projections[projections.length - 1];
      if (firstProjection && lastProjection && projections.length > 1) {
        const totalChange = ((lastProjection.sats - firstProjection.sats) / firstProjection.sats) * 100;
        elements.saliYoyOutput.textContent = formatPercent(totalChange);
        elements.saliYoyOutput.parentElement.style.display = 'block';
      } else {
        elements.saliYoyOutput.parentElement.style.display = 'none';
      }

      // Render table and chart
      renderTable(projections, currency);
      renderChart(projections);

    } catch (error) {
      setStatus(error.message, 'error');
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
      computeBtn: document.getElementById('computeBtn'),
      unitToggleSats: document.getElementById('unitToggleSats'),
      unitToggleBtc: document.getElementById('unitToggleBtc'),
      saliSatsOutput: document.getElementById('saliSatsOutput'),
      saliBtcOutput: document.getElementById('saliBtcOutput'),
      btcOutputGroup: document.getElementById('btcOutputGroup'),
      saliScoreOutput: document.getElementById('saliScoreOutput'),
      saliScoreDesc: document.getElementById('saliScoreDesc'),
      saliYoyOutput: document.getElementById('saliYoyOutput'),
      statusOutput: document.getElementById('statusOutput'),
      saliChart: document.getElementById('saliChart'),
      projectionTableBody: document.getElementById('projectionTableBody')
    };

    // Check if we're on the calculator page
    if (!elements.salaryInput) {
      return; // Not on calculator page
    }

    // Load data first, then populate selects
    Promise.all([
      fetchSpotPrice(),
      loadAnnualAverages()
    ]).then(() => {
      populateYearSelects();
      updateBtcPriceDisplay();

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

      // Compute button click
      elements.computeBtn.addEventListener('click', compute);

      // Initial compute if salary has a value
      if (elements.salaryInput.value) {
        compute();
      }
    });
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
