/**
 * script.js — Sales Analytics Dashboard
 *
 * Architecture:
 *  1. Fetch data from sales_data.json
 *  2. Populate filter dropdowns dynamically
 *  3. Apply active filters to produce a filtered dataset
 *  4. Compute KPIs and render / update all Chart.js instances
 *  5. Listen for filter changes → re-render everything
 */

/* ============================================================
   SECTION 1 · CONSTANTS & PALETTE
   ============================================================ */

/** Consistent colour palette used across all charts */
const PALETTE = {
  blue:    '#3b82f6',
  violet:  '#7c3aed',
  emerald: '#10b981',
  amber:   '#f59e0b',
  rose:    '#f43f5e',
  cyan:    '#06b6d4',
  indigo:  '#6366f1',
  orange:  '#f97316',
  teal:    '#14b8a6',
  pink:    '#ec4899',
};

/** Array of palette values for multi-series charts */
const COLORS = Object.values(PALETTE);

/** Month labels (Jan–Dec) */
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/* ============================================================
   SECTION 2 · STATE
   ============================================================ */

/** Raw data loaded from JSON */
let rawData = [];

/** Current filter selections */
const filters = {
  region:   'all',
  category: 'all',
  customer: 'all',
  channel:  'all',
};

/** Registry of Chart.js instances (so they can be updated) */
const charts = {};

/* ============================================================
   SECTION 3 · DATA LOADING
   ============================================================ */

/**
 * Fetches sales_data.json, initialises the dashboard.
 * Entry point called on DOMContentLoaded.
 */
async function init() {
  try {
    const res = await fetch('sales_data.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    rawData = await res.json();

    populateFilters();
    bindFilterEvents();
    renderDashboard();
  } catch (err) {
    console.error('Failed to load sales_data.json:', err);
    document.querySelector('main').innerHTML =
      `<div class="text-center py-24 text-red-500 font-medium">
         ⚠️ Could not load sales_data.json. Make sure the file is in the same directory.
       </div>`;
  }
}

/* ============================================================
   SECTION 4 · FILTER HELPERS
   ============================================================ */

/**
 * Populates each <select> with unique values derived from rawData.
 */
function populateFilters() {
  const unique = (key) => [...new Set(rawData.map(d => d[key]))].sort();

  fillSelect('filterRegion',   unique('Region'));
  fillSelect('filterCategory', unique('Product_Category'));
  fillSelect('filterCustomer', unique('Customer_Type'));
  fillSelect('filterChannel',  unique('Sales_Channel'));
}

/**
 * Appends <option> elements to a <select> given an array of values.
 * @param {string} id - The select element's id
 * @param {string[]} values - Option values / labels
 */
function fillSelect(id, values) {
  const el = document.getElementById(id);
  values.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    el.appendChild(opt);
  });
}

/**
 * Attaches change listeners to all filter selects.
 */
function bindFilterEvents() {
  document.getElementById('filterRegion').addEventListener('change', e => {
    filters.region = e.target.value;
    onFilterChange();
  });
  document.getElementById('filterCategory').addEventListener('change', e => {
    filters.category = e.target.value;
    onFilterChange();
  });
  document.getElementById('filterCustomer').addEventListener('change', e => {
    filters.customer = e.target.value;
    onFilterChange();
  });
  document.getElementById('filterChannel').addEventListener('change', e => {
    filters.channel = e.target.value;
    onFilterChange();
  });

  // Reset button
  document.getElementById('btnResetFilters').addEventListener('click', resetFilters);
}

/**
 * Called on every filter change — triggers full dashboard re-render.
 */
function onFilterChange() {
  updateFilterBadges();
  renderDashboard();
}

/**
 * Returns true if any filter is active.
 */
function hasActiveFilters() {
  return Object.values(filters).some(v => v !== 'all');
}

/**
 * Resets all filters to 'all' and re-renders.
 */
function resetFilters() {
  filters.region = filters.category = filters.customer = filters.channel = 'all';
  ['filterRegion','filterCategory','filterCustomer','filterChannel'].forEach(id => {
    document.getElementById(id).value = 'all';
  });
  onFilterChange();
}

/**
 * Shows active filter badges in the header bar.
 */
function updateFilterBadges() {
  const bar = document.getElementById('activeFiltersBar');
  const btn = document.getElementById('btnResetFilters');

  bar.innerHTML = '';

  const labels = {
    region:   { label: 'Region',   value: filters.region },
    category: { label: 'Category', value: filters.category },
    customer: { label: 'Customer', value: filters.customer },
    channel:  { label: 'Channel',  value: filters.channel },
  };

  let count = 0;
  for (const [, { label, value }] of Object.entries(labels)) {
    if (value !== 'all') {
      count++;
      const badge = document.createElement('span');
      badge.className = 'filter-badge';
      badge.textContent = `${label}: ${value}`;
      bar.appendChild(badge);
    }
  }

  if (count > 0) {
    bar.classList.remove('hidden');
    bar.classList.add('flex');
    btn.classList.remove('hidden');
  } else {
    bar.classList.add('hidden');
    bar.classList.remove('flex');
    btn.classList.add('hidden');
  }
}

/* ============================================================
   SECTION 5 · DATA FILTERING & AGGREGATION
   ============================================================ */

/**
 * Applies active filters and returns the filtered dataset.
 * @returns {Object[]} filtered records
 */
function getFilteredData() {
  return rawData.filter(d => {
    if (filters.region   !== 'all' && d.Region           !== filters.region)   return false;
    if (filters.category !== 'all' && d.Product_Category !== filters.category) return false;
    if (filters.customer !== 'all' && d.Customer_Type    !== filters.customer) return false;
    if (filters.channel  !== 'all' && d.Sales_Channel    !== filters.channel)  return false;
    return true;
  });
}

/**
 * Aggregates an array of records into key → summed_value map.
 * @param {Object[]} data
 * @param {string} keyField  - field to group by
 * @param {string} valueField - field to sum
 * @returns {Object} { key: sum }
 */
function aggregate(data, keyField, valueField) {
  return data.reduce((acc, d) => {
    const k = d[keyField];
    acc[k] = (acc[k] || 0) + d[valueField];
    return acc;
  }, {});
}

/**
 * Counts occurrences of each unique value in keyField.
 * @param {Object[]} data
 * @param {string} keyField
 * @returns {Object} { key: count }
 */
function count(data, keyField) {
  return data.reduce((acc, d) => {
    const k = d[keyField];
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
}

/* ============================================================
   SECTION 6 · CHART FACTORY HELPERS
   ============================================================ */

/**
 * Creates or updates a Chart.js chart.
 * If a chart with `id` already exists, it is destroyed first.
 * @param {string} id - canvas element id
 * @param {string} type - Chart.js chart type
 * @param {Object} data - Chart.js data config
 * @param {Object} options - Chart.js options config
 */
function upsertChart(id, type, data, options = {}) {
  if (charts[id]) {
    charts[id].destroy();
  }
  const ctx = document.getElementById(id).getContext('2d');
  charts[id] = new Chart(ctx, { type, data, options });
}

/** Default options shared by bar/line/horizontal-bar charts */
function baseOptions(legend = false) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: legend, position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
      tooltip: {
        callbacks: {
          label: ctx => {
            const v = ctx.parsed.y ?? ctx.parsed.x ?? ctx.raw;
            if (typeof v === 'number') return ` ${fmtNum(v)}`;
            return ` ${v}`;
          }
        }
      }
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 11 } } },
      y: { grid: { color: '#f3f4f6' }, ticks: { font: { size: 11 }, callback: v => fmtShort(v) } },
    }
  };
}

/** Options for horizontal bar charts */
function horizontalBarOptions() {
  return {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: ctx => ` ${fmtNum(ctx.parsed.x)}` } }
    },
    scales: {
      x: { grid: { color: '#f3f4f6' }, ticks: { font: { size: 10 }, callback: v => fmtShort(v) } },
      y: { grid: { display: false }, ticks: { font: { size: 11 } } },
    }
  };
}

/** Options for doughnut / pie charts */
function pieOptions(legend = true) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: legend,
        position: 'bottom',
        labels: { boxWidth: 12, font: { size: 11 }, padding: 10 }
      },
      tooltip: {
        callbacks: {
          label: ctx => {
            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
            const pct   = ((ctx.parsed / total) * 100).toFixed(1);
            return ` ${ctx.label}: ${fmtNum(ctx.parsed)} (${pct}%)`;
          }
        }
      }
    }
  };
}

/* ============================================================
   SECTION 7 · NUMBER FORMATTERS
   ============================================================ */

/** Full currency format: $1,234.56 */
const fmtNum = v => new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits:0 }).format(v);

/** Short format for axis ticks: $1.2K / $3.4M */
function fmtShort(v) {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000)     return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v}`;
}

/** Plain integer formatter */
const fmtInt = v => new Intl.NumberFormat('en-US').format(v);

/* ============================================================
   SECTION 8 · KPI RENDERER
   ============================================================ */

/**
 * Computes and displays the four KPI cards.
 * @param {Object[]} data - filtered dataset
 */
function renderKPIs(data) {
  const totalRevenue  = data.reduce((s, d) => s + d.Sales_Amount, 0);
  const totalQty      = data.reduce((s, d) => s + d.Quantity_Sold, 0);
  const avgDiscount   = data.length ? data.reduce((s, d) => s + d.Discount, 0) / data.length : 0;

  document.getElementById('kpiRevenue').textContent       = fmtNum(totalRevenue);
  document.getElementById('kpiRevenueCount').textContent  = `${fmtInt(data.length)} transactions`;
  document.getElementById('kpiTx').textContent            = fmtInt(data.length);
  document.getElementById('kpiQty').textContent           = fmtInt(totalQty);
  document.getElementById('kpiDiscount').textContent      = `${(avgDiscount * 100).toFixed(1)}%`;
}

/* ============================================================
   SECTION 9 · CHART RENDERERS
   ============================================================ */

/**
 * CHART 1: Sales Trend (Line) — monthly total revenue
 */
function renderSalesTrend(data) {
  // Build monthly sums: { "2023-01": 12345, ... }
  const monthly = {};
  data.forEach(d => {
    const ym = d.Sale_Date.slice(0, 7); // "YYYY-MM"
    monthly[ym] = (monthly[ym] || 0) + d.Sales_Amount;
  });

  // Sort keys chronologically
  const sorted = Object.keys(monthly).sort();
  const labels = sorted.map(ym => {
    const [, m] = ym.split('-');
    return MONTHS[parseInt(m, 10) - 1];
  });
  const values = sorted.map(k => monthly[k]);

  upsertChart('chartSalesTrend', 'line', {
    labels,
    datasets: [{
      label: 'Revenue',
      data: values,
      borderColor: PALETTE.blue,
      backgroundColor: 'rgba(59,130,246,0.1)',
      borderWidth: 2.5,
      pointRadius: 4,
      pointHoverRadius: 6,
      tension: 0.4,
      fill: true,
    }]
  }, {
    ...baseOptions(false),
    plugins: {
      ...baseOptions(false).plugins,
      tooltip: { callbacks: { label: ctx => ` ${fmtNum(ctx.parsed.y)}` } }
    }
  });
}

/**
 * CHART 2: Revenue per Region (Doughnut)
 */
function renderRegion(data) {
  const agg    = aggregate(data, 'Region', 'Sales_Amount');
  const labels = Object.keys(agg);
  const values = Object.values(agg);

  upsertChart('chartRegion', 'doughnut', {
    labels,
    datasets: [{
      data: values,
      backgroundColor: COLORS.slice(0, labels.length),
      borderWidth: 2,
      borderColor: '#fff',
      hoverOffset: 6,
    }]
  }, pieOptions());
}

/**
 * CHART 3: Revenue per Product Category (Bar)
 */
function renderCategory(data) {
  const agg    = aggregate(data, 'Product_Category', 'Sales_Amount');
  const sorted = Object.entries(agg).sort((a, b) => b[1] - a[1]);
  const labels = sorted.map(e => e[0]);
  const values = sorted.map(e => e[1]);

  upsertChart('chartCategory', 'bar', {
    labels,
    datasets: [{
      label: 'Revenue',
      data: values,
      backgroundColor: COLORS.slice(0, labels.length).map(c => c + 'cc'),
      borderColor: COLORS.slice(0, labels.length),
      borderWidth: 1.5,
      borderRadius: 6,
    }]
  }, baseOptions(false));
}

/**
 * CHART 4: Sales per Sales Rep (Horizontal Bar)
 */
function renderSalesRep(data) {
  const agg    = aggregate(data, 'Sales_Rep', 'Sales_Amount');
  const sorted = Object.entries(agg).sort((a, b) => b[1] - a[1]);
  const labels = sorted.map(e => e[0]);
  const values = sorted.map(e => e[1]);

  upsertChart('chartSalesRep', 'bar', {
    labels,
    datasets: [{
      label: 'Revenue',
      data: values,
      backgroundColor: COLORS.slice(0, labels.length).map(c => c + 'cc'),
      borderColor: COLORS.slice(0, labels.length),
      borderWidth: 1.5,
      borderRadius: 6,
    }]
  }, horizontalBarOptions());
}

/**
 * CHART 5: Customer Type Distribution (Pie)
 */
function renderCustomerType(data) {
  const cnt    = count(data, 'Customer_Type');
  const labels = Object.keys(cnt);
  const values = Object.values(cnt);

  upsertChart('chartCustomer', 'pie', {
    labels,
    datasets: [{
      data: values,
      backgroundColor: [PALETTE.blue, PALETTE.violet],
      borderWidth: 2,
      borderColor: '#fff',
      hoverOffset: 5,
    }]
  }, pieOptions());
}

/**
 * CHART 6: Payment Method Usage (Doughnut)
 */
function renderPayment(data) {
  const cnt    = count(data, 'Payment_Method');
  const labels = Object.keys(cnt);
  const values = Object.values(cnt);

  upsertChart('chartPayment', 'doughnut', {
    labels,
    datasets: [{
      data: values,
      backgroundColor: [PALETTE.emerald, PALETTE.amber, PALETTE.rose].slice(0, labels.length),
      borderWidth: 2,
      borderColor: '#fff',
      hoverOffset: 5,
    }]
  }, pieOptions());
}

/**
 * CHART 7: Sales Channel Distribution (Pie)
 */
function renderChannel(data) {
  const cnt    = count(data, 'Sales_Channel');
  const labels = Object.keys(cnt);
  const values = Object.values(cnt);

  upsertChart('chartChannel', 'pie', {
    labels,
    datasets: [{
      data: values,
      backgroundColor: [PALETTE.cyan, PALETTE.orange],
      borderWidth: 2,
      borderColor: '#fff',
      hoverOffset: 5,
    }]
  }, pieOptions());
}

/**
 * CHART 8: Discount vs Sales Amount (Scatter)
 */
function renderScatter(data) {
  // Map each record to { x: discount%, y: sales_amount }
  const points = data.map(d => ({
    x: parseFloat((d.Discount * 100).toFixed(1)),
    y: d.Sales_Amount,
  }));

  upsertChart('chartScatter', 'scatter', {
    datasets: [{
      label: 'Transaction',
      data: points,
      backgroundColor: PALETTE.blue + '99',
      borderColor: PALETTE.blue,
      borderWidth: 1,
      pointRadius: 5,
      pointHoverRadius: 7,
    }]
  }, {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: ctx => `Discount: ${ctx.parsed.x}%  |  Sales: ${fmtNum(ctx.parsed.y)}`
        }
      }
    },
    scales: {
      x: {
        title: { display: true, text: 'Discount (%)', font: { size: 11 }, color: '#9ca3af' },
        grid: { color: '#f3f4f6' },
        ticks: { font: { size: 11 }, callback: v => `${v}%` }
      },
      y: {
        title: { display: true, text: 'Sales Amount', font: { size: 11 }, color: '#9ca3af' },
        grid: { color: '#f3f4f6' },
        ticks: { font: { size: 11 }, callback: v => fmtShort(v) }
      }
    }
  });
}

/**
 * CHART 9: Top 10 Highest Sales (Horizontal Bar)
 */
function renderTop10(data) {
  // Sort by Sales_Amount descending and take first 10
  const top10 = [...data]
    .sort((a, b) => b.Sales_Amount - a.Sales_Amount)
    .slice(0, 10);

  // Label: "ProductID · Rep · Date"
  const labels = top10.map(d => `#${d.Product_ID} · ${d.Sales_Rep} · ${d.Sale_Date.slice(5)}`);
  const values = top10.map(d => d.Sales_Amount);

  upsertChart('chartTop10', 'bar', {
    labels,
    datasets: [{
      label: 'Sales',
      data: values,
      backgroundColor: values.map((_, i) => COLORS[i % COLORS.length] + 'cc'),
      borderColor:     values.map((_, i) => COLORS[i % COLORS.length]),
      borderWidth: 1.5,
      borderRadius: 5,
    }]
  }, horizontalBarOptions());
}

/**
 * CHART 10: Quantity Sold per Category (Bar)
 */
function renderQtyCategory(data) {
  const agg    = aggregate(data, 'Product_Category', 'Quantity_Sold');
  const sorted = Object.entries(agg).sort((a, b) => b[1] - a[1]);
  const labels = sorted.map(e => e[0]);
  const values = sorted.map(e => e[1]);

  const opts = baseOptions(false);
  // Override Y-axis to show plain integers (not currency)
  opts.scales.y.ticks.callback = v => fmtInt(v);

  upsertChart('chartQtyCategory', 'bar', {
    labels,
    datasets: [{
      label: 'Qty Sold',
      data: values,
      backgroundColor: COLORS.slice(0, labels.length).map(c => c + 'cc'),
      borderColor: COLORS.slice(0, labels.length),
      borderWidth: 1.5,
      borderRadius: 6,
    }]
  }, {
    ...opts,
    plugins: {
      ...opts.plugins,
      tooltip: { callbacks: { label: ctx => ` ${fmtInt(ctx.parsed.y)} units` } }
    }
  });
}

/* ============================================================
   SECTION 10 · MASTER RENDER
   ============================================================ */

/**
 * Runs the full render pipeline on the current filtered dataset.
 * Called on initial load and on every filter change.
 */
function renderDashboard() {
  const data = getFilteredData();

  renderKPIs(data);
  renderSalesTrend(data);
  renderRegion(data);
  renderCategory(data);
  renderSalesRep(data);
  renderCustomerType(data);
  renderPayment(data);
  renderChannel(data);
  renderScatter(data);
  renderTop10(data);
  renderQtyCategory(data);
}

/* ============================================================
   SECTION 11 · BOOTSTRAP
   ============================================================ */

document.addEventListener('DOMContentLoaded', init);
