// frontend/assets/js/analytics.js
// ✅ Enterprise analytics with drill-down filters and month-in-focus insights

let currentFilters = {};
let charts = {};
let allMaterials = [];
let locationChartType = 'doughnut';
let timeseriesCache = [];
let summaryCache = null;
let monthFocusKey = '';
let latestLocations = [];

const BRAND_COLORS = ['#00205B', '#F58220', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#f59e0b', '#06b6d4'];

document.addEventListener('DOMContentLoaded', () => {
  if (!app.requireAuth()) return;
  
  // Allow admin and POD planner to access analytics
  const user = app.getUser();
  if (user.role !== 'admin' && user.role !== 'pod_planner') {
    app.showAlert('Access denied. Admin or POD Planner role required.', 'error');
    setTimeout(() => window.location.href = '/worker-dashboard.html', 2000);
    return;
  }
  
  setupMaterialSearch();
  setupPeriodFilters();
  setupLocationSpotlight();
  loadAnalytics();
});

// ===================================
// MATERIAL SEARCH
// ===================================
function setupMaterialSearch() {
  const searchInput = document.getElementById('materialSearchInput');
  const searchBtn = document.getElementById('materialSearchBtn');
  
  if (searchBtn) {
    searchBtn.addEventListener('click', performMaterialSearch);
  }
  
  if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        performMaterialSearch();
      }
    });
  }
}

function setupPeriodFilters() {
  const yearSelect = document.getElementById('filterYear');
  if (yearSelect && yearSelect.options.length === 1) {
    const currentYear = new Date().getFullYear();
    for (let year = currentYear; year >= currentYear - 6; year--) {
      const option = document.createElement('option');
      option.value = year;
      option.textContent = year;
      yearSelect.appendChild(option);
    }
  }

  const refreshBtn = document.getElementById('refreshAnalyticsBtn');
  refreshBtn?.addEventListener('click', () => loadAnalytics());

  const monthFocusSelect = document.getElementById('monthFocusSelect');
  monthFocusSelect?.addEventListener('change', handleMonthFocusChange);
  
  // Add month filter that auto-filters everything (works with year filter)
  const monthFilter = document.getElementById('filterMonth');
  const yearFilter = document.getElementById('filterYear');
  if (monthFilter && yearFilter) {
    const applyMonthFilter = () => {
      const year = yearFilter.value;
      const month = monthFilter.value;
      if (year && month) {
        const yearNum = year.length === 4 ? year : (year.length === 2 ? `20${year}` : year);
        const monthNum = month.length === 1 ? `0${month}` : month;
        if (yearNum && monthNum && !isNaN(yearNum) && !isNaN(monthNum)) {
          const range = getMonthRange(yearNum, monthNum);
          currentFilters.from = range.from;
          currentFilters.to = range.to;
          // Clear other date filters
          document.getElementById('filterFrom').value = '';
          document.getElementById('filterTo').value = '';
          loadAnalytics();
        }
      } else {
        // Clear filters if month or year is cleared
        delete currentFilters.from;
        delete currentFilters.to;
        loadAnalytics();
      }
    };
    
    monthFilter.addEventListener('change', applyMonthFilter);
    yearFilter.addEventListener('change', applyMonthFilter);
  }
}

function setupLocationSpotlight() {
  const select = document.getElementById('locationSpotlightSelect');
  if (!select) return;
  
  select.addEventListener('change', (event) => {
    const value = event.target.value;
    if (value) {
      loadLocationSpotlight(value);
    } else {
      resetLocationSpotlight();
    }
  });
}

async function performMaterialSearch() {
  const searchInput = document.getElementById('materialSearchInput');
  const query = searchInput?.value?.trim();
  
  if (!query) {
    app.showAlert('Please enter a material name to search', 'warning');
    return;
  }
  
  try {
    app.showLoading(true);
    
    const response = await app.api.get('/analytics/search', { q: query });
    
    if (!response.success) {
      app.showAlert(response.message || 'Search failed', 'error');
      return;
    }
    
    if (response.materials && response.materials.length > 0) {
      showMaterialSearchResults(response.materials, response.recentRequests || []);
    } else {
      app.showAlert('No materials found matching your search', 'info');
    }
    
  } catch (error) {
    console.error('Search error:', error);
    app.showAlert('Search failed: ' + (error.message || 'Unknown error'), 'error');
  } finally {
    app.showLoading(false);
  }
}

function showMaterialSearchResults(materials, recentRequests) {
  const modal = document.getElementById('searchResultsModal');
  
  if (!modal) {
    createSearchResultsModal();
    showMaterialSearchResults(materials, recentRequests);
    return;
  }
  
  const resultsContainer = document.getElementById('searchResults');
  
  let html = '';
  
  materials.forEach((material) => {
    html += `
      <div style="background: white; border: 1px solid #e5e5e5; border-radius: 0.5rem; padding: 1.5rem; margin-bottom: 1.5rem;">
        <h3 style="color: #00205B; font-size: 1.125rem; font-weight: 600; margin: 0 0 1rem 0;">
          ${material.material_description}
        </h3>
        
        ${material.oem_model ? `<p style="color: #737373; font-size: 0.875rem; margin: 0 0 1rem 0;"><strong>OEM/Model:</strong> ${material.oem_model}</p>` : ''}
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
          <div style="background: #f5f5f5; padding: 1rem; border-radius: 0.375rem;">
            <div style="font-size: 0.75rem; color: #737373; font-weight: 600; text-transform: uppercase; margin-bottom: 0.25rem;">Total Quantity</div>
            <div style="font-size: 1.5rem; font-weight: 700; color: #F58220;">${app.formatNumber(material.total_quantity)} ${material.quantity_unit || 'pcs'}</div>
          </div>
          
          <div style="background: #f5f5f5; padding: 1rem; border-radius: 0.375rem;">
            <div style="font-size: 0.75rem; color: #737373; font-weight: 600; text-transform: uppercase; margin-bottom: 0.25rem;">Total Requests</div>
            <div style="font-size: 1.5rem; font-weight: 700; color: #00205B;">${material.total_requests}</div>
          </div>
          
        </div>
        
        ${material.locations && material.locations.length > 0 ? `
        <div style="margin-top: 1rem;">
          <h4 style="color: #00205B; font-size: 0.875rem; font-weight: 600; margin: 0 0 0.75rem 0;">📍 Location Breakdown</h4>
          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 0.8125rem;">
              <thead>
                <tr style="background: #f5f5f5;">
                  <th style="padding: 0.5rem; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e5e5;">Location</th>
                  <th style="padding: 0.5rem; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e5e5;">Area</th>
                  <th style="padding: 0.5rem; text-align: right; font-weight: 600; border-bottom: 2px solid #e5e5e5;">Quantity</th>
                  <th style="padding: 0.5rem; text-align: right; font-weight: 600; border-bottom: 2px solid #e5e5e5;">Requests</th>
                </tr>
              </thead>
              <tbody>
                ${material.locations.map(loc => `
                  <tr style="border-bottom: 1px solid #f3f3f3;">
                    <td style="padding: 0.5rem;">${loc.location}</td>
                    <td style="padding: 0.5rem;">${loc.area}</td>
                    <td style="padding: 0.5rem; text-align: right; font-weight: 600; color: #F58220;">${app.formatNumber(loc.quantity_at_location)}</td>
                    <td style="padding: 0.5rem; text-align: right;">${loc.request_count}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
        ` : ''}
      </div>
    `;
  });
  
  resultsContainer.innerHTML = html;
  modal.style.display = 'flex';
}

function createSearchResultsModal() {
  const modal = document.createElement('div');
  modal.id = 'searchResultsModal';
  modal.className = 'modal-overlay';
  modal.style.display = 'none';
  
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 1000px; max-height: 90vh; overflow-y: auto;">
      <div style="padding: 1.5rem; border-bottom: 1px solid #e5e5e5; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; background: white; z-index: 10;">
        <h2 style="color: #00205B; font-size: 1.25rem; font-weight: 700; margin: 0;">🔍 Material Search Results</h2>
        <button onclick="closeSearchModal()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #737373; padding: 0; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 0.25rem;">×</button>
      </div>
      <div id="searchResults" style="padding: 1.5rem;"></div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeSearchModal();
    }
  });
}

function closeSearchModal() {
  const modal = document.getElementById('searchResultsModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

window.closeSearchModal = closeSearchModal;

// ===================================
// LOAD ANALYTICS (Parallel fetch + caching)
// ===================================
async function loadAnalytics(silent = false) {
  try {
    if (!silent) app.showLoading(true);

    // Clean and validate filters before sending
    const cleanFilters = {};
    if (currentFilters.from && currentFilters.to) {
      // Validate date format (YYYY-MM-DD)
      if (/^\d{4}-\d{2}-\d{2}$/.test(currentFilters.from) && /^\d{4}-\d{2}-\d{2}$/.test(currentFilters.to)) {
        cleanFilters.from = currentFilters.from;
        cleanFilters.to = currentFilters.to;
      } else {
        console.warn('Invalid date format in filters, clearing dates');
        delete currentFilters.from;
        delete currentFilters.to;
      }
    }
    if (currentFilters.location) cleanFilters.location = currentFilters.location;
    if (currentFilters.discipline) cleanFilters.discipline = currentFilters.discipline;

    const [
      summary,
      topMaterials,
      timeseries,
      byLocation,
      byGroup,
      byVendor
    ] = await Promise.all([
      app.api.get('/analytics/summary', cleanFilters),
      app.api.get('/analytics/top-materials', { limit: 15, ...cleanFilters }),
      app.api.get('/analytics/timeseries', { interval: 'month', ...cleanFilters }),
      app.api.get('/analytics/by-location', cleanFilters),
      app.api.get('/analytics/by-group', cleanFilters),
      app.api.get('/analytics/by-vendor', cleanFilters)
    ]);

    const allMaterialsResponse = await app.api.get('/analytics/top-materials', { limit: 1000, ...cleanFilters });
    allMaterials = allMaterialsResponse.materials || [];
    summaryCache = summary.summary;
    timeseriesCache = timeseries.data || [];
    
    // Update currentFilters to prevent stale invalid dates
    if (cleanFilters.from && cleanFilters.to) {
      currentFilters.from = cleanFilters.from;
      currentFilters.to = cleanFilters.to;
    } else {
      delete currentFilters.from;
      delete currentFilters.to;
    }
    
    // Update currentFilters to prevent stale invalid dates
    if (cleanFilters.from && cleanFilters.to) {
      currentFilters.from = cleanFilters.from;
      currentFilters.to = cleanFilters.to;
    } else {
      delete currentFilters.from;
      delete currentFilters.to;
    }

    renderSummary(summary.summary);
    renderTrendChart(timeseries.data);
    renderYearComparisonChart(timeseries.data);
    renderMaterialsChart(topMaterials.materials);
    renderLocationChart(byLocation.data);
    populateLocationSpotlight(byLocation.data);
    renderDisciplineChart(byGroup.data);
    renderStatusChart(summary.summary.byStatus || []);
    renderMaterialBreakdown(allMaterials);
    renderVendorLeaderboard(byVendor.data || []);

    populateMonthFocusOptions(timeseriesCache);
    if (monthFocusKey) {
      renderMonthFocusStats(monthFocusKey);
      loadMonthDisciplineBreakdown(getMonthRangeFromKey(monthFocusKey));
    } else {
      renderMonthFocusStats(null);
      renderMonthDisciplineChart([]);
    }
  } catch (error) {
    console.error('❌ Analytics error:', error);
    if (!silent) {
      app.showAlert('Failed to load analytics: ' + error.message, 'error');
    }
  } finally {
    if (!silent) app.showLoading(false);
  }
}

// ===================================
// RENDER SUMMARY (✅ Enhanced with avg per month)
// ===================================
function renderSummary(summary) {
  const totalEl = document.getElementById('statTotal');
  if (totalEl) {
    totalEl.textContent = app.formatNumber(summary.totalRequests);
  }

  const avgPerMonth = document.getElementById('statAvgPerMonth');
  if (avgPerMonth) {
    avgPerMonth.textContent = summary.avgRequestsPerMonth || '0';
  }

  renderWorkflowKpis(summary.workflowBuckets || {});
}

function renderWorkflowKpis(buckets) {
  const defaults = {
    awaitingApproval: 0,
    awaitingQuotation: 0,
    delivered: 0,
    closed: 0
  };
  const data = { ...defaults, ...buckets };

  const mappings = [
    { id: 'statAwaitingApproval', value: data.awaitingApproval },
    { id: 'statAwaitingQuotation', value: data.awaitingQuotation },
    { id: 'statDelivered', value: data.delivered },
    { id: 'statClosed', value: data.closed }
  ];

  mappings.forEach(({ id, value }) => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = app.formatNumber(value || 0);
    }
  });
}

// ===================================
// RENDER CHARTS (Same as before)
// ===================================
function renderTrendChart(data) {
  const ctx = document.getElementById('trendChart')?.getContext('2d');
  if (!ctx) return;
  
  if (charts.trend) charts.trend.destroy();
  
  charts.trend = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => {
        const date = new Date(d.period);
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      }),
      datasets: [{
        label: 'Requests',
        data: data.map(d => d.request_count),
        borderColor: '#00205B',
        backgroundColor: 'rgba(0, 32, 91, 0.05)',
        tension: 0.1,
        fill: true,
        pointBackgroundColor: '#00205B',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(0, 32, 91, 0.95)',
          padding: 12,
          titleFont: { size: 13, weight: '600' },
          bodyFont: { size: 12 },
          cornerRadius: 4,
          displayColors: false
        }
      },
      scales: {
        y: { 
          beginAtZero: true,
          ticks: { 
            precision: 0,
            font: { size: 11, weight: '500' },
            color: '#525252'
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.06)',
            drawBorder: false
          },
          border: { display: false }
        },
        x: {
          ticks: { 
            font: { size: 11, weight: '500' },
            color: '#525252'
          },
          grid: { display: false },
          border: { display: false }
        }
      }
    }
  });
}

function renderYearComparisonChart(data) {
  const ctx = document.getElementById('yearComparisonChart')?.getContext('2d');
  if (!ctx) return;

  if (charts.yearComparison) charts.yearComparison.destroy();

  const allowedYears = [2024, 2025];
  const grouped = {};
  allowedYears.forEach(year => {
    grouped[year] = new Array(12).fill(0);
  });

  data.forEach(item => {
    const date = new Date(item.period);
    const year = date.getFullYear();
    if (!allowedYears.includes(year)) return;
    const month = date.getMonth();
    grouped[year][month] += Number(item.request_count || 0);
  });

  const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const datasets = allowedYears.map((year, index) => {
    const color = BRAND_COLORS[index % BRAND_COLORS.length];
    return {
      label: year,
      data: grouped[year],
      borderColor: color,
      backgroundColor: color + '33',
      borderWidth: 2,
      tension: 0.15,
      fill: false
    };
  });

  charts.yearComparison = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          backgroundColor: 'rgba(0, 32, 91, 0.95)',
          padding: 10,
          titleFont: { size: 12, weight: '600' },
          bodyFont: { size: 11 }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 5, color: '#4b5563' },
          grid: { color: 'rgba(0,0,0,0.06)', drawBorder: false }
        },
        x: {
          ticks: { color: '#4b5563' },
          grid: { display: false }
        }
      }
    }
  });
}

function renderMaterialsChart(materials) {
  const ctx = document.getElementById('materialsChart')?.getContext('2d');
  if (!ctx) return;
  
  if (charts.materials) charts.materials.destroy();
  
  charts.materials = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: materials.map(m => {
        const desc = m.material_description;
        return desc.length > 40 ? desc.substring(0, 37) + '...' : desc;
      }),
      datasets: [{
        label: 'Quantity',
        data: materials.map(m => m.total_quantity),
        backgroundColor: '#00205B',
        borderWidth: 0,
        borderRadius: 0,
        barThickness: 24
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(0, 32, 91, 0.95)',
          padding: 14,
          cornerRadius: 4,
          titleFont: { size: 12, weight: '600' },
          bodyFont: { size: 11 },
          displayColors: false,
          callbacks: {
            title: (items) => {
              const index = items[0].dataIndex;
              return materials[index].material_description;
            },
            label: (context) => {
              return `Quantity: ${app.formatNumber(context.parsed.x)} ${materials[context.dataIndex].quantity_unit || 'pcs'}`;
            },
            afterLabel: (context) => {
              const material = materials[context.dataIndex];
              return [
                `Requests: ${material.request_count}`,
                material.oem_model ? `OEM: ${material.oem_model}` : ''
              ].filter(Boolean);
            }
          }
        }
      },
      scales: {
        x: { 
          beginAtZero: true,
          ticks: { 
            precision: 0,
            font: { size: 10, weight: '500' },
            color: '#525252'
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.06)',
            drawBorder: false
          },
          border: { display: false }
        },
        y: {
          ticks: {
            font: { size: 10, weight: '500' },
            color: '#00205B'
          },
          grid: { display: false },
          border: { display: false }
        }
      }
    }
  });
}

// ===================================
// ✅ ENHANCED: Location chart with click handler
// ===================================
function renderLocationChart(data) {
  const ctx = document.getElementById('locationChart')?.getContext('2d');
  if (!ctx) return;
  
  if (charts.location) charts.location.destroy();
  
  const chartColors = [
    '#00205B', '#F58220', '#3b82f6', '#10b981', '#f59e0b', 
    '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316'
  ];
  
  const chartConfig = {
    type: locationChartType,
    data: {
      labels: data.map(d => d.location),
      datasets: [{
        data: data.map(d => d.request_count),
        backgroundColor: chartColors,
        borderWidth: locationChartType === 'doughnut' ? 3 : 0,
        borderColor: '#fff',
        hoverBorderWidth: locationChartType === 'doughnut' ? 4 : 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      onClick: (event, elements) => {
        if (elements.length > 0) {
          const index = elements[0].index;
          const location = data[index].location;
          openLocationDeepDive(location);
        }
      },
      plugins: {
        legend: locationChartType === 'doughnut' ? { 
          position: 'right',
          labels: {
            padding: 16,
            font: { size: 12, weight: '500' },
            color: '#00205B',
            usePointStyle: true,
            pointStyle: 'circle',
            boxWidth: 10,
            boxHeight: 10
          }
        } : { display: false },
        tooltip: {
          backgroundColor: 'rgba(0, 32, 91, 0.95)',
          padding: 14,
          cornerRadius: 4,
          titleFont: { size: 13, weight: '600' },
          bodyFont: { size: 11 },
          displayColors: true,
          callbacks: {
            label: (context) => {
              const location = data[context.dataIndex];
              if (locationChartType === 'doughnut') {
                const total = data.reduce((sum, l) => sum + l.request_count, 0);
                const percentage = ((location.request_count / total) * 100).toFixed(1);
                return [
                  `${context.label}: ${context.parsed} requests (${percentage}%)`,
                  `Materials: ${location.unique_materials || 0}`,
                  `Total Qty: ${app.formatNumber(location.total_quantity || 0)}`,
                  'Click for detailed analysis →'
                ];
              } else {
                return [
                  `Requests: ${context.parsed.y}`,
                  `Materials: ${location.unique_materials || 0}`,
                  `Total Qty: ${app.formatNumber(location.total_quantity || 0)}`,
                  'Click for detailed analysis →'
                ];
              }
            }
          }
        }
      },
      scales: locationChartType === 'bar' ? {
        y: { 
          beginAtZero: true,
          ticks: { 
            precision: 0,
            font: { size: 11, weight: '500' },
            color: '#525252'
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.06)',
            drawBorder: false
          },
          border: { display: false }
        },
        x: {
          ticks: {
            font: { size: 11, weight: '500' },
            color: '#00205B'
          },
          grid: { display: false },
          border: { display: false }
        }
      } : undefined
    }
  };
  
  charts.location = new Chart(ctx, chartConfig);
}

function populateLocationSpotlight(locations) {
  const select = document.getElementById('locationSpotlightSelect');
  if (!select) return;

  latestLocations = locations || [];
  const previous = select.value;
  select.innerHTML = '<option value="">Select Location</option>';

  latestLocations.forEach(loc => {
    if (!loc.location) return;
    const option = document.createElement('option');
    option.value = loc.location;
    option.textContent = loc.location;
    select.appendChild(option);
  });

  let targetValue = '';
  if (previous && latestLocations.some(loc => loc.location === previous)) {
    targetValue = previous;
  } else if (latestLocations.length > 0) {
    targetValue = latestLocations[0].location;
  }

  if (targetValue) {
    select.value = targetValue;
    loadLocationSpotlight(targetValue);
  } else {
    select.value = '';
    resetLocationSpotlight();
  }
}

function resetLocationSpotlight() {
  const requestEl = document.getElementById('locationSpotlightRequests');
  const qtyEl = document.getElementById('locationSpotlightQuantity');
  const matEl = document.getElementById('locationSpotlightTopMaterial');
  if (requestEl) requestEl.textContent = '—';
  if (qtyEl) qtyEl.textContent = '—';
  if (matEl) matEl.textContent = '—';

  const body = document.getElementById('locationTopMaterialsBody');
  if (body) {
    body.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:1rem;color:#737373;">Select a location to view insights</td></tr>`;
  }

  if (charts.locationSpotlight) {
    charts.locationSpotlight.destroy();
    charts.locationSpotlight = null;
  }
}

async function loadLocationSpotlight(location) {
  if (!location) {
    resetLocationSpotlight();
    return;
  }

  try {
    const params = {};
    if (currentFilters.from) params.from = currentFilters.from;
    if (currentFilters.to) params.to = currentFilters.to;
    if (currentFilters.discipline) params.discipline = currentFilters.discipline;

    const response = await app.api.get(`/analytics/location/${encodeURIComponent(location)}`, params);
    if (!response.success) {
      app.showAlert('Failed to load location analytics', 'error');
      return;
    }

    renderLocationSpotlight(response);
  } catch (error) {
    console.error('Location spotlight error:', error);
    app.showAlert('Failed to load location analytics: ' + error.message, 'error');
  }
}

function renderLocationSpotlight(data) {
  const summary = data.summary || {};
  const requests = document.getElementById('locationSpotlightRequests');
  const quantity = document.getElementById('locationSpotlightQuantity');
  const topMaterial = document.getElementById('locationSpotlightTopMaterial');

  if (requests) requests.textContent = app.formatNumber(summary.total_requests || 0);
  if (quantity) quantity.textContent = app.formatNumber(summary.total_quantity || 0);
  if (topMaterial) {
    const leader = (data.topMaterials || [])[0];
    topMaterial.textContent = leader ? leader.material_description : '—';
  }

  renderLocationTrendChart(data.monthlyTrend || [], data.location);
  renderLocationTopMaterials(data.topMaterials || []);
}

function renderLocationTrendChart(trend, location) {
  const canvas = document.getElementById('locationSpotlightTrend');
  const ctx = canvas?.getContext('2d');
  if (!ctx) return;

  const container = canvas.parentElement;
  const emptyState = container.querySelector('.location-trend-empty');
  if (emptyState) {
    emptyState.remove();
  }

  if (charts.locationSpotlight) {
    charts.locationSpotlight.destroy();
    charts.locationSpotlight = null;
  }

  if (!trend.length) {
    canvas.style.display = 'none';
    const message = document.createElement('div');
    message.className = 'location-trend-empty';
    message.style.cssText = 'padding:1rem;color:#6b7280;text-align:center;';
    message.textContent = `No monthly history available for ${location || 'this location'}.`;
    container.appendChild(message);
    return;
  }

  canvas.style.display = 'block';

  const sortedTrend = [...trend].sort((a, b) => new Date(a.month) - new Date(b.month));
  const labels = sortedTrend.map(item => new Date(item.month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
  const dataPoints = sortedTrend.map(item => item.request_count);

  charts.locationSpotlight = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: `${location || 'Location'} Requests`,
        data: dataPoints,
        borderColor: '#00205B',
        backgroundColor: 'rgba(0,32,91,0.08)',
        borderWidth: 2,
        fill: true,
        tension: 0.2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0, color: '#4b5563' },
          grid: { color: 'rgba(0,0,0,0.06)', drawBorder: false }
        },
        x: {
          ticks: { color: '#4b5563' },
          grid: { display: false }
        }
      }
    }
  });
}

function renderLocationTopMaterials(materials) {
  const body = document.getElementById('locationTopMaterialsBody');
  if (!body) return;

  if (!materials.length) {
    body.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:1rem;color:#737373;">No material movement recorded for this period.</td></tr>`;
    return;
  }

  body.innerHTML = materials.map(material => `
    <tr>
      <td style="font-size: 0.8125rem; color: #737373;">${material.material_category || '-'}</td>
      <td style="font-size: 0.8125rem; color: #737373;">${material.material_class || '-'}</td>
      <td>${material.material_description}</td>
      <td style="font-weight:600;color:#F58220;">${app.formatNumber(material.total_quantity || 0)}</td>
      <td>${material.quantity_unit || 'pcs'}</td>
      <td>${material.request_count || 0}</td>
    </tr>
  `).join('');
}

function renderStatusChart(statusRows) {
  const ctx = document.getElementById('statusChart')?.getContext('2d');
  if (!ctx) return;

  if (charts.status) charts.status.destroy();

  const labels = statusRows.map(row => row.status || 'Unknown');
  const values = statusRows.map(row => Number(row.count || 0));

  charts.status = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: labels.map((_, idx) => BRAND_COLORS[idx % BRAND_COLORS.length]),
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          backgroundColor: 'rgba(0, 32, 91, 0.95)',
          callbacks: {
            label: (context) => `${context.label}: ${context.parsed}`
          }
        }
      },
      cutout: '55%'
    }
  });
}

function renderCurrencyChart(summary) {
  const ctx = document.getElementById('currencyChart')?.getContext('2d');
  if (!ctx) return;

  if (charts.currency) charts.currency.destroy();

  const usd = Number(summary.totalValueUSD || 0);
  const ngn = Number(summary.totalValueNGN || 0);

  charts.currency = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['USD', 'NGN'],
      datasets: [{
        data: [usd, ngn],
        backgroundColor: ['#00205B', '#F58220'],
        borderRadius: 6,
        barThickness: 60
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => context.label === 'USD'
              ? `$${app.formatNumber(context.parsed.toFixed(0))}`
              : `₦${app.formatNumber(context.parsed.toFixed(0))}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value) => app.formatNumber(value),
            color: '#4b5563'
          },
          grid: { color: 'rgba(0,0,0,0.06)', drawBorder: false }
        },
        x: {
          ticks: { color: '#4b5563' },
          grid: { display: false }
        }
      }
    }
  });
}

function toggleLocationChart() {
  locationChartType = locationChartType === 'doughnut' ? 'bar' : 'doughnut';
  
  const btn = document.getElementById('toggleLocationBtn');
  if (btn) {
    btn.textContent = locationChartType === 'doughnut' ? '📊 Bar View' : '🍩 Donut View';
  }
  
  loadAnalytics(true);
}

function renderDisciplineChart(data) {
  const ctx = document.getElementById('disciplineChart')?.getContext('2d');
  if (!ctx) return;
  
  if (charts.discipline) charts.discipline.destroy();
  
  const sortedData = [...data].sort((a, b) => b.request_count - a.request_count);
  const top6 = sortedData.slice(0, 6);
  
  charts.discipline = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: top6.map(d => d.discipline),
      datasets: [{
        label: 'Requests',
        data: top6.map(d => d.request_count),
        backgroundColor: '#00205B',
        borderWidth: 0,
        borderRadius: 0,
        barThickness: 40
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(0, 32, 91, 0.95)',
          padding: 14,
          cornerRadius: 4,
          titleFont: { size: 12, weight: '600' },
          bodyFont: { size: 11 },
          displayColors: false,
          callbacks: {
            label: (context) => {
              const discipline = top6[context.dataIndex];
              return [
                `Requests: ${context.parsed.y}`,
                `Total Quantity: ${app.formatNumber(discipline.total_quantity || 0)}`,
                `Value (USD): $${app.formatNumber((discipline.total_value_usd || 0).toFixed(0))}`
              ];
            }
          }
        }
      },
      scales: {
        y: { 
          beginAtZero: true,
          ticks: { 
            precision: 0,
            font: { size: 11, weight: '500' },
            color: '#525252'
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.06)',
            drawBorder: false
          },
          border: { display: false }
        },
        x: {
          ticks: {
            font: { size: 10, weight: '500' },
            color: '#00205B'
          },
          grid: { display: false },
          border: { display: false }
        }
      }
    }
  });
}

function renderMonthDisciplineChart(data) {
  const container = document.querySelector('[data-month-discipline-container]');
  if (!container) return;

  const existingMessage = container.querySelector('.month-discipline-empty');
  if (existingMessage) existingMessage.remove();

  if (charts.monthDiscipline) {
    charts.monthDiscipline.destroy();
    charts.monthDiscipline = null;
  }

  if (!data.length) {
    const message = document.createElement('div');
    message.className = 'month-discipline-empty';
    message.style.cssText = 'padding:1rem;color:#6b7280;font-size:0.9rem;text-align:center;';
    message.textContent = 'Select a month to see discipline-level insights.';
    container.innerHTML = '';
    container.appendChild(message);
    const placeholderCanvas = document.createElement('canvas');
    placeholderCanvas.id = 'monthDisciplineChart';
    placeholderCanvas.style.display = 'none';
    container.appendChild(placeholderCanvas);
    return;
  }

  let canvas = container.querySelector('canvas#monthDisciplineChart');
  if (!canvas) {
    container.innerHTML = '<canvas id="monthDisciplineChart"></canvas>';
    canvas = container.querySelector('canvas#monthDisciplineChart');
  }
  canvas.style.display = 'block';
  const ctx = canvas.getContext('2d');

  const labels = data.map(d => d.discipline || 'Unknown');
  const values = data.map(d => Number(d.request_count || 0));

  charts.monthDiscipline = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Requests',
        data: values,
        backgroundColor: '#00205B',
        borderRadius: 4,
        barThickness: 32
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0, color: '#4b5563' },
          grid: { color: 'rgba(0,0,0,0.05)', drawBorder: false }
        },
        x: {
          ticks: { color: '#4b5563' },
          grid: { display: false }
        }
      }
    }
  });
}

function renderMaterialBreakdown(materials) {
  const tbody = document.getElementById('materialBreakdownBody');
  
  if (materials.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: #737373;">No materials found</td></tr>';
    return;
  }
  
  tbody.innerHTML = materials.map((material, index) => `
    <tr>
      <td style="font-weight: 600; color: #00205B;">${material.material_description}</td>
      <td style="font-weight: 700; color: #F58220; font-size: 1rem;">${material.total_quantity}</td>
      <td style="font-weight: 600;">${material.quantity_unit || 'pcs'}</td>
      <td style="font-weight: 600; color: #3b82f6;">${material.request_count}</td>
      <td style="font-size: 0.8125rem; color: #737373;">${material.material_category || '-'}</td>
      <td style="font-size: 0.8125rem; color: #737373;">${material.material_class || '-'}</td>
      <td style="font-size: 0.8125rem; color: #737373;">${(material.locations || []).join(', ')}</td>
    </tr>
  `).join('');
}

function renderVendorLeaderboard(vendors) {
  const tbody = document.getElementById('vendorLeaderboardBody');
  if (!tbody) return;

  if (!vendors.length) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:1.5rem;color:#737373;">No vendor activity found for the selected filters.</td></tr>';
    return;
  }

  tbody.innerHTML = vendors.map(vendor => {
    const totalQty = Number(vendor.total_quantity || 0);

    return `
    <tr>
      <td style="font-weight:600;color:#00205B;">${vendor.vendor_name || 'Unknown'}</td>
      <td>${vendor.request_count}</td>
      <td>${app.formatNumber(totalQty)}</td>
    </tr>
  `;
  }).join('');
}

function exportMaterialBreakdown() {
  if (allMaterials.length === 0) {
    app.showAlert('No data to export', 'warning');
    return;
  }
  
  let csv = 'Material Description,Total Quantity,Unit,Number of Requests,Locations\n';
  allMaterials.forEach(material => {
    const locations = (material.locations || []).join('; ');
    const description = `"${material.material_description.replace(/"/g, '""')}"`;
    csv += `${description},${material.total_quantity},${material.quantity_unit || 'pcs'},${material.request_count},"${locations}"\n`;
  });
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Material_Breakdown_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
  
  app.showAlert('✅ Material breakdown exported successfully!', 'success');
}

function populateMonthFocusOptions(data) {
  const select = document.getElementById('monthFocusSelect');
  if (!select) return;

  const uniqueMonths = [];
  const seen = new Set();
  data.forEach(item => {
    const key = getMonthKey(new Date(item.period));
    if (!seen.has(key)) {
      seen.add(key);
      uniqueMonths.push(key);
    }
  });

  uniqueMonths.sort((a, b) => b.localeCompare(a));

  const previous = monthFocusKey && uniqueMonths.includes(monthFocusKey) ? monthFocusKey : '';
  select.innerHTML = `
    <option value="">Select a month</option>
    ${uniqueMonths.map(key => {
      const [year, month] = key.split('-');
      const label = new Date(`${key}-01`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      return `<option value="${key}">${label}</option>`;
    }).join('')}
  `;

  if (previous) {
    select.value = previous;
    monthFocusKey = previous;
    return;
  }

  if (uniqueMonths.length > 0) {
    monthFocusKey = uniqueMonths[0];
    select.value = monthFocusKey;
  } else {
    monthFocusKey = '';
    select.value = '';
  }
}

function renderMonthFocusStats(key) {
  const requestsEl = document.getElementById('monthFocusRequests');
  const qtyEl = document.getElementById('monthFocusQuantity');
  const valueEl = document.getElementById('monthFocusValue');
  const avgEl = document.getElementById('monthFocusAvg');
  const hint = document.getElementById('monthFocusHint');

  if (!key) {
    monthFocusKey = '';
    requestsEl.textContent = qtyEl.textContent = valueEl.textContent = avgEl.textContent = '—';
    if (hint) hint.textContent = 'Pick a month (e.g. June) to see tailored insights.';
    return;
  }

  monthFocusKey = key;
  const record = timeseriesCache.find(item => getMonthKey(new Date(item.period)) === key);

  if (!record) {
    requestsEl.textContent = qtyEl.textContent = valueEl.textContent = avgEl.textContent = '0';
    if (hint) hint.textContent = 'No data found for the selected month.';
    return;
  }

  const label = new Date(record.period).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  requestsEl.textContent = app.formatNumber(record.request_count || 0);
  qtyEl.textContent = app.formatNumber(record.total_quantity || 0);
  const avgQuantity = (record.total_quantity || 0) / Math.max(record.request_count || 1, 1);
  valueEl.textContent = app.formatNumber(avgQuantity.toFixed(1));
  avgEl.textContent = label;
  if (hint) hint.textContent = `Showing ${label} performance across current filters.`;
}

function handleMonthFocusChange(event) {
  const value = event.target.value;
  if (!value) {
    monthFocusKey = '';
    renderMonthFocusStats(null);
    renderMonthDisciplineChart([]);
    return;
  }

  monthFocusKey = value;
  renderMonthFocusStats(value);
  loadMonthDisciplineBreakdown(getMonthRangeFromKey(value));
}

function getMonthKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${date.getFullYear()}-${month}`;
}

function getMonthRange(year, month) {
  const paddedMonth = String(month).padStart(2, '0');
  const from = `${year}-${paddedMonth}-01`;
  const lastDay = new Date(year, Number(paddedMonth), 0).getDate();
  const to = `${year}-${paddedMonth}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
}

function getMonthRangeFromKey(key) {
  if (!key) return null;
  const [year, month] = key.split('-');
  return getMonthRange(year, month);
}

function getWeekRange(weekValue) {
  if (!weekValue) return null;
  // Parse week format: YYYY-W## (e.g., 2025-W01)
  const [yearStr, weekStr] = weekValue.split('-W');
  if (!yearStr || !weekStr) return null;
  const yearNum = parseInt(yearStr);
  const weekNum = parseInt(weekStr);
  
  // Calculate start of week
  const jan1 = new Date(yearNum, 0, 1);
  const daysOffset = (weekNum - 1) * 7;
  const start = new Date(jan1);
  start.setDate(jan1.getDate() + daysOffset - jan1.getDay());
  start.setHours(0, 0, 0, 0);
  
  // End of week (6 days later)
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  
  return {
    from: start.toISOString().split('T')[0],
    to: end.toISOString().split('T')[0]
  };
}

async function loadMonthDisciplineBreakdown(range) {
  if (!range) {
    renderMonthDisciplineChart([]);
    return;
  }

  try {
    const params = { ...currentFilters, from: range.from, to: range.to };
    const response = await app.api.get('/analytics/by-group', params);
    renderMonthDisciplineChart(response.data || []);
  } catch (error) {
    console.error('Month discipline load error:', error);
    app.showAlert('Failed to load month discipline view: ' + error.message, 'error');
  }
}

function applyFilters() {
  const location = document.getElementById('filterLocation').value;
  const discipline = document.getElementById('filterDiscipline').value;
  const from = document.getElementById('filterFrom').value;
  const to = document.getElementById('filterTo').value;
  const year = document.getElementById('filterYear').value;
  const month = document.getElementById('filterMonth').value;
  
  currentFilters = {};
  if (location) currentFilters.location = location;
  if (discipline) currentFilters.discipline = discipline;
  
  // Handle date filters - validate inputs
  if (year && month) {
    // Validate year is 4 digits
    const yearNum = year.length === 4 ? year : (year.length === 2 ? `20${year}` : year);
    // Month should be 2 digits
    const monthNum = month.length === 1 ? `0${month}` : month;
    if (yearNum && monthNum && !isNaN(yearNum) && !isNaN(monthNum)) {
      const range = getMonthRange(yearNum, monthNum);
      currentFilters.from = range.from;
      currentFilters.to = range.to;
    }
  } else if (year) {
    const yearNum = year.length === 4 ? year : (year.length === 2 ? `20${year}` : year);
    if (yearNum && !isNaN(yearNum)) {
      currentFilters.from = `${yearNum}-01-01`;
      currentFilters.to = `${yearNum}-12-31`;
    }
  } else {
    if (from) currentFilters.from = from;
    if (to) currentFilters.to = to;
  }
  
  const monthSelect = document.getElementById('monthFocusSelect');
  if (monthSelect) monthSelect.value = '';
  renderMonthFocusStats(null);
  renderMonthDisciplineChart([]);
  
  app.showAlert('🔄 Applying filters...', 'info');
  loadAnalytics();
}

function resetFilters() {
  document.getElementById('filterLocation').value = '';
  document.getElementById('filterDiscipline').value = '';
  document.getElementById('filterFrom').value = '';
  document.getElementById('filterTo').value = '';
  document.getElementById('filterYear').value = '';
  document.getElementById('filterMonth').value = '';
  const dateRangeSelect = document.getElementById('filterDateRange');
  if (dateRangeSelect) dateRangeSelect.value = '';
  const customDateGroup = document.getElementById('customDateGroup');
  const customDateGroup2 = document.getElementById('customDateGroup2');
  if (customDateGroup) customDateGroup.style.display = 'none';
  if (customDateGroup2) customDateGroup2.style.display = 'none';
  const monthSelect = document.getElementById('monthFocusSelect');
  if (monthSelect) monthSelect.value = '';
  renderMonthFocusStats(null);
  renderMonthDisciplineChart([]);
  currentFilters = {};
  loadAnalytics();
}

function handleAnalyticsDateRangeChange() {
  const select = document.getElementById('filterDateRange');
  const fromGroup = document.getElementById('customDateGroup');
  const toGroup = document.getElementById('customDateGroup2');
  const fromInput = document.getElementById('filterFrom');
  const toInput = document.getElementById('filterTo');
  
  if (!select) return;
  
  if (select.value === 'custom') {
    if (fromGroup) fromGroup.style.display = 'block';
    if (toGroup) toGroup.style.display = 'block';
  } else {
    if (fromGroup) fromGroup.style.display = 'none';
    if (toGroup) toGroup.style.display = 'none';
    if (fromInput) fromInput.value = '';
    if (toInput) toInput.value = '';
    
    // Set date range based on selection
    const now = new Date();
    let fromDate = '';
    let toDate = '';
    
    if (select.value === 'this_month') {
      fromDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      toDate = now.toISOString().split('T')[0];
    } else if (select.value === 'last_month') {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      fromDate = lastMonth.toISOString().split('T')[0];
      toDate = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
    } else if (select.value === 'this_year') {
      fromDate = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
      toDate = now.toISOString().split('T')[0];
    } else if (select.value === 'last_year') {
      fromDate = new Date(now.getFullYear() - 1, 0, 1).toISOString().split('T')[0];
      toDate = new Date(now.getFullYear() - 1, 11, 31).toISOString().split('T')[0];
    }
    
    if (fromDate && toDate) {
      currentFilters.from = fromDate;
      currentFilters.to = toDate;
      loadAnalytics();
    } else {
      delete currentFilters.from;
      delete currentFilters.to;
      loadAnalytics();
    }
  }
}

// ===================================
// ✅ NEW: LOCATION DEEP DIVE MODAL
// ===================================
async function openLocationDeepDive(location) {
  try {
    app.showLoading(true);
    
    const response = await app.api.get(`/analytics/location/${encodeURIComponent(location)}`);
    
    if (!response.success) {
      app.showAlert('Failed to load location details', 'error');
      return;
    }
    
    showLocationDeepDiveModal(response);
    
  } catch (error) {
    console.error('Location deep dive error:', error);
    app.showAlert('Failed to load location analysis: ' + error.message, 'error');
  } finally {
    app.showLoading(false);
  }
}

function showLocationDeepDiveModal(data) {
  let modal = document.getElementById('locationDeepDiveModal');
  
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'locationDeepDiveModal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }
  
  const summary = data.summary;
  const topMaterials = data.topMaterials || [];
  const byDiscipline = data.byDiscipline || [];
  const monthlyTrend = data.monthlyTrend || [];
  
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 1200px; max-height: 90vh; overflow-y: auto;">
      <div style="padding: 1.5rem; border-bottom: 1px solid #e5e5e5; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; background: white; z-index: 10;">
        <h2 style="color: #00205B; font-size: 1.25rem; font-weight: 700; margin: 0;">📍 ${data.location} - Detailed Analysis</h2>
        <button onclick="closeLocationDeepDive()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #737373;">×</button>
      </div>
      
      <div style="padding: 1.5rem;">
        <!-- Summary KPIs -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
          <div style="background: linear-gradient(135deg, #00205B 0%, #003d8f 100%); padding: 1.25rem; border-radius: 0.5rem; color: white;">
            <div style="font-size: 0.75rem; opacity: 0.9; margin-bottom: 0.5rem;">TOTAL REQUESTS</div>
            <div style="font-size: 2rem; font-weight: 700;">${summary.total_requests || 0}</div>
          </div>
          <div style="background: linear-gradient(135deg, #F58220 0%, #FCA94B 100%); padding: 1.25rem; border-radius: 0.5rem; color: white;">
            <div style="font-size: 0.75rem; opacity: 0.9; margin-bottom: 0.5rem;">UNIQUE MATERIALS</div>
            <div style="font-size: 2rem; font-weight: 700;">${summary.unique_materials || 0}</div>
          </div>
          <div style="background: linear-gradient(135deg, #10b981 0%, #34d399 100%); padding: 1.25rem; border-radius: 0.5rem; color: white;">
            <div style="font-size: 0.75rem; opacity: 0.9; margin-bottom: 0.5rem;">TOTAL VALUE (USD)</div>
            <div style="font-size: 2rem; font-weight: 700;">$${app.formatNumber((summary.total_value_usd || 0).toFixed(0))}</div>
          </div>
          <div style="background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%); padding: 1.25rem; border-radius: 0.5rem; color: white;">
            <div style="font-size: 0.75rem; opacity: 0.9; margin-bottom: 0.5rem;">TOTAL QUANTITY</div>
            <div style="font-size: 2rem; font-weight: 700;">${app.formatNumber(summary.total_quantity || 0)}</div>
          </div>
        </div>
        
        <!-- Top 10 Materials -->
        <div style="margin-bottom: 2rem;">
          <h3 style="color: #00205B; font-size: 1.125rem; font-weight: 600; margin-bottom: 1rem;">📦 Top 10 Materials at ${data.location}</h3>
          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 0.875rem;">
              <thead style="background: #f5f5f5;">
                <tr>
                  <th style="padding: 0.75rem; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e5e5;">Material Description</th>
                  <th style="padding: 0.75rem; text-align: right; font-weight: 600; border-bottom: 2px solid #e5e5e5;">Total Quantity</th>
                  <th style="padding: 0.75rem; text-align: center; font-weight: 600; border-bottom: 2px solid #e5e5e5;">Unit</th>
                  <th style="padding: 0.75rem; text-align: right; font-weight: 600; border-bottom: 2px solid #e5e5e5;">Requests</th>
                </tr>
              </thead>
              <tbody>
                ${topMaterials.map((mat, idx) => `
                  <tr style="border-bottom: 1px solid #f3f3f3;">
                    <td style="padding: 0.75rem;">${mat.material_description}</td>
                    <td style="padding: 0.75rem; text-align: right; font-weight: 700; color: #F58220;">${app.formatNumber(mat.total_quantity)}</td>
                    <td style="padding: 0.75rem; text-align: center;">${mat.quantity_unit || 'pcs'}</td>
                    <td style="padding: 0.75rem; text-align: right; font-weight: 600; color: #00205B;">${mat.request_count}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
        
        <!-- By Discipline -->
        <div style="margin-bottom: 2rem;">
          <h3 style="color: #00205B; font-size: 1.125rem; font-weight: 600; margin-bottom: 1rem;">🔧 Requests by Discipline</h3>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 1rem;">
            ${byDiscipline.map(disc => `
              <div style="background: white; border: 1px solid #e5e5e5; border-radius: 0.5rem; padding: 1rem; text-align: center;">
                <div style="font-size: 0.75rem; color: #737373; margin-bottom: 0.5rem;">${disc.discipline}</div>
                <div style="font-size: 1.75rem; font-weight: 700; color: #00205B;">${disc.request_count}</div>
              </div>
            `).join('')}
          </div>
        </div>
        
        <!-- Monthly Trend -->
        <div>
          <h3 style="color: #00205B; font-size: 1.125rem; font-weight: 600; margin-bottom: 1rem;">📈 Last 12 Months Trend</h3>
          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 0.875rem;">
              <thead style="background: #f5f5f5;">
                <tr>
                  <th style="padding: 0.75rem; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e5e5;">Month</th>
                  <th style="padding: 0.75rem; text-align: right; font-weight: 600; border-bottom: 2px solid #e5e5e5;">Requests</th>
                </tr>
              </thead>
              <tbody>
                ${monthlyTrend.map(trend => `
                  <tr style="border-bottom: 1px solid #f3f3f3;">
                    <td style="padding: 0.75rem;">${new Date(trend.month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</td>
                    <td style="padding: 0.75rem; text-align: right; font-weight: 600; color: #00205B;">${trend.request_count}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;
  
  modal.style.display = 'flex';
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeLocationDeepDive();
    }
  });
}

function closeLocationDeepDive() {
  const modal = document.getElementById('locationDeepDiveModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

window.closeLocationDeepDive = closeLocationDeepDive;
window.openLocationDeepDive = openLocationDeepDive;

// ===================================
// EXPORT ANALYTICS AS PDF/WORD
// ===================================
function updateExportDateInputs() {
  const period = document.getElementById('exportPeriod')?.value || 'monthly';
  const monthGroup = document.getElementById('exportMonthGroup');
  const weekGroup = document.getElementById('exportWeekGroup');
  const customGroup = document.getElementById('exportCustomGroup');
  
  // Hide all groups first
  if (monthGroup) monthGroup.style.display = 'none';
  if (weekGroup) weekGroup.style.display = 'none';
  if (customGroup) customGroup.style.display = 'none';
  
  // Show relevant group
  if (period === 'monthly') {
    if (monthGroup) monthGroup.style.display = 'flex';
    // Set default to current month
    const now = new Date();
    const monthInput = document.getElementById('exportMonth');
    if (monthInput) {
      monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
  } else if (period === 'weekly') {
    if (weekGroup) weekGroup.style.display = 'flex';
    // Set default to current week
    const now = new Date();
    const weekInput = document.getElementById('exportWeek');
    if (weekInput) {
      const year = now.getFullYear();
      const startOfYear = new Date(year, 0, 1);
      const days = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000));
      const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
      weekInput.value = `${year}-W${String(weekNumber).padStart(2, '0')}`;
    }
  } else if (period === 'custom') {
    if (customGroup) customGroup.style.display = 'flex';
    // Set default to current month range
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const fromInput = document.getElementById('exportFrom');
    const toInput = document.getElementById('exportTo');
    if (fromInput) fromInput.value = monthStart.toISOString().split('T')[0];
    if (toInput) toInput.value = now.toISOString().split('T')[0];
  }
}

async function exportAnalyticsPDF() {
  try {
    const period = document.getElementById('exportPeriod')?.value || 'monthly';
    let params = { format: 'pdf', period };
    
    // Get date range based on period - use currentFilters if available
    if (period === 'monthly') {
      const monthValue = document.getElementById('exportMonth')?.value;
      if (monthValue) {
        const [year, month] = monthValue.split('-');
        params.year = year;
        params.month = month;
        // Also set from/to for accurate filtering
        const range = getMonthRange(year, month);
        params.from = range.from;
        params.to = range.to;
      } else if (currentFilters.from && currentFilters.to) {
        // Use current filters if month not selected
        params.from = currentFilters.from;
        params.to = currentFilters.to;
      }
    } else if (period === 'weekly') {
      const weekValue = document.getElementById('exportWeek')?.value;
      if (weekValue) {
        params.week = weekValue;
        // Calculate week range
        const weekRange = getWeekRange(weekValue);
        if (weekRange) {
          params.from = weekRange.from;
          params.to = weekRange.to;
        }
      }
    } else if (period === 'custom') {
      const from = document.getElementById('exportFrom')?.value;
      const to = document.getElementById('exportTo')?.value;
      if (from) params.from = from;
      if (to) params.to = to;
    } else if (currentFilters.from && currentFilters.to) {
      // Use current filters if no period selected
      params.from = currentFilters.from;
      params.to = currentFilters.to;
    }
    
    // Include location and discipline filters if set
    if (currentFilters.location) params.location = currentFilters.location;
    if (currentFilters.discipline) params.discipline = currentFilters.discipline;
    
    // Capture chart images - compress to reduce size
    const chartImages = await captureChartImages();
    // Compress chart images to reduce payload size
    const compressedImages = {};
    for (const [key, dataUrl] of Object.entries(chartImages)) {
      try {
        // Convert to blob and compress
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              // Resize to max 800px width to reduce size
              const maxWidth = 800;
              const ratio = Math.min(maxWidth / img.width, 1);
              canvas.width = img.width * ratio;
              canvas.height = img.height * ratio;
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              compressedImages[key] = canvas.toDataURL('image/jpeg', 0.6); // JPEG at 60% quality
              resolve();
            } catch (err) {
              console.warn(`Failed to compress ${key}:`, err);
              // Fallback to original if compression fails
              compressedImages[key] = dataUrl;
              resolve();
            }
          };
          img.onerror = () => {
            console.warn(`Failed to load image ${key}`);
            resolve(); // Skip this image
          };
          img.src = dataUrl;
        });
      } catch (err) {
        console.warn(`Error processing ${key}:`, err);
        // Skip this image if there's an error
      }
    }
    params.chart_images = JSON.stringify(compressedImages);
    
    app.showLoading(true);
    // Use POST to send large chart images in body instead of query string
    const token = localStorage.getItem('token');
    const response = await fetch(`${app.API_BASE}/analytics/export`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    });
    
    if (!response.ok) {
      throw new Error('Export failed');
    }
    
    const blob = await response.blob();
    const periodLabel = period === 'monthly' ? (params.month || 'current') : period;
    const fileName = `Analytics_Report_${periodLabel}_${new Date().toISOString().split('T')[0]}.pdf`;
    app.downloadFile(blob, fileName);
    app.showAlert('✅ Analytics PDF exported successfully', 'success');
  } catch (error) {
    app.showAlert('Failed to export PDF: ' + error.message, 'error');
  } finally {
    app.showLoading(false);
  }
}

async function exportAnalyticsWord() {
  try {
    const period = document.getElementById('exportPeriod')?.value || 'monthly';
    let params = { format: 'word', period };
    
    // Get date range based on period - use currentFilters if available
    if (period === 'monthly') {
      const monthValue = document.getElementById('exportMonth')?.value;
      if (monthValue) {
        const [year, month] = monthValue.split('-');
        params.year = year;
        params.month = month;
        // Also set from/to for accurate filtering
        const range = getMonthRange(year, month);
        params.from = range.from;
        params.to = range.to;
      } else if (currentFilters.from && currentFilters.to) {
        // Use current filters if month not selected
        params.from = currentFilters.from;
        params.to = currentFilters.to;
      } else {
        app.showAlert('Please select a month for export', 'warning');
        return;
      }
    } else if (period === 'weekly') {
      const weekValue = document.getElementById('exportWeek')?.value;
      if (weekValue) {
        params.week = weekValue;
        // Calculate week range
        const weekRange = getWeekRange(weekValue);
        if (weekRange) {
          params.from = weekRange.from;
          params.to = weekRange.to;
        }
      } else {
        app.showAlert('Please select a week for export', 'warning');
        return;
      }
    } else if (period === 'custom') {
      const from = document.getElementById('exportFrom')?.value;
      const to = document.getElementById('exportTo')?.value;
      if (from && to) {
        params.from = from;
        params.to = to;
      } else {
        app.showAlert('Please select both start and end dates', 'warning');
        return;
      }
    } else if (currentFilters.from && currentFilters.to) {
      // Use current filters if no period selected
      params.from = currentFilters.from;
      params.to = currentFilters.to;
    }
    
    // Include location and discipline filters if set
    if (currentFilters.location) params.location = currentFilters.location;
    if (currentFilters.discipline) params.discipline = currentFilters.discipline;
    
    app.showLoading(true);
    // Use POST to send data in body
    const token = localStorage.getItem('token');
    const response = await fetch(`${app.API_BASE}/analytics/export`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    });
    
    if (!response.ok) {
      throw new Error('Export failed');
    }
    
    const blob = await response.blob();
    const periodLabel = period === 'monthly' ? (params.month || 'current') : (period === 'weekly' ? (params.week || 'current') : 'custom');
    const fileName = `Analytics_Report_${periodLabel}_${new Date().toISOString().split('T')[0]}.docx`;
    app.downloadFile(blob, fileName);
    app.showAlert('✅ Analytics Word document exported successfully', 'success');
  } catch (error) {
    app.showAlert('Failed to export report: ' + error.message, 'error');
  } finally {
    app.showLoading(false);
  }
}

// Capture chart images as base64 with white background
async function captureChartImages() {
  const images = {};
  
  // Find all canvas elements (Chart.js uses canvas)
  const canvases = document.querySelectorAll('canvas');
  canvases.forEach((canvas, index) => {
    try {
      // Create a new canvas with white background
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = canvas.width;
      exportCanvas.height = canvas.height;
      const ctx = exportCanvas.getContext('2d');
      
      // Fill with white background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
      
      // Draw the original chart on top
      ctx.drawImage(canvas, 0, 0);
      
      // Convert to data URL
      const dataURL = exportCanvas.toDataURL('image/png');
      const chartId = canvas.id || `chart_${index}`;
      images[chartId] = dataURL;
    } catch (error) {
      console.warn('Failed to capture chart:', error);
      // Fallback to original canvas
      try {
        const dataURL = canvas.toDataURL('image/png');
        const chartId = canvas.id || `chart_${index}`;
        images[chartId] = dataURL;
      } catch (e) {
        console.warn('Fallback capture also failed:', e);
      }
    }
  });
  
  return images;
}

window.exportAnalyticsPDF = exportAnalyticsPDF;
window.exportAnalyticsWord = exportAnalyticsWord;
window.updateExportDateInputs = updateExportDateInputs;