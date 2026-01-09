// frontend/assets/js/admin-dashboard.js
// FIXED: Added CALL OFF NUMBER and REMARKS columns
let sortDirection = 'desc'; // 'asc' or 'desc'
let sortColumn = 'date'; // 'date' or 'mrf'
let currentPage = 1;
let currentFilters = {};
let autoRefreshInterval = null;
let currentRequestData = null;
let currentArea = 'all';
let pageSize = 25;
let quotationPage = 1;
const QUOTATION_PAGE_SIZE = 10;
let quotationFilters = {
  status: 'pending',
  area: 'all',
  search: '',
  from: '',
  to: ''
};
let quotationUploadFilters = {
  area: 'all',
  search: ''
};
let quotationUploadOptions = [];
let quotationsInitialized = false;

document.addEventListener('DOMContentLoaded', () => {
  if (!app.requireAuth()) return;
  
  const user = app.getUser();
  // Allow admin, pod_planner, and area managers to access this dashboard
  const allowedRoles = ['admin', 'pod_planner', 'area_manager_land', 'area_manager_swamp', 'area_manager_phc'];
  if (!allowedRoles.includes(user.role)) {
    // Silently redirect without showing alert
    window.location.href = '/worker-dashboard.html';
    return;
  }
  
  // For area managers, automatically filter by their area
  if (user.role.startsWith('area_manager_')) {
    const areaType = user.role.replace('area_manager_', '').toUpperCase();
    if (areaType === 'LAND') {
      currentArea = 'LAR';
      filterByArea('LAR');
    } else if (areaType === 'SWAMP') {
      currentArea = 'SAR';
      filterByArea('SAR');
    } else if (areaType === 'PHC') {
      currentArea = 'PHC';
      filterByArea('PHC');
    }
  }
  
  // Show month filter for POD planners
  if (user.role === 'pod_planner') {
    const monthFilterGroup = document.getElementById('monthFilterGroup');
    if (monthFilterGroup) {
      monthFilterGroup.style.display = 'block';
    }
    
    // Set default to current month
    const monthInput = document.getElementById('filterMonth');
    if (monthInput) {
      const now = new Date();
      monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
  }
  
  loadStats(currentArea);
  loadRequests();
  setupFilters();
  startAutoRefresh();
});

function openQuotationsModal() {
  const modal = document.getElementById('quotationsModal');
  if (!modal) return;
  if (!quotationsInitialized) {
    initQuotationCenter();
  } else {
    refreshQuotations();
  }
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeQuotationsModal() {
  const modal = document.getElementById('quotationsModal');
  if (!modal) return;
  modal.classList.remove('active');
  document.body.style.overflow = '';
}

function filterByArea(area) {
  currentArea = area;
  
  document.querySelectorAll('.area-tab').forEach(tab => {
    if (tab.dataset.area === area) {
      tab.classList.add('active');
      tab.style.color = '#00205B';
      tab.style.borderBottomColor = '#F58220';
    } else {
      tab.classList.remove('active');
      tab.style.color = '#737373';
      tab.style.borderBottomColor = 'transparent';
    }
  });
  
  delete currentFilters.area;
  delete currentFilters.location;
  
  if (area !== 'all') {
    currentFilters.area = area;
  }
  
  loadRequests(1);
  loadStats(area);

  const quoteAreaFilter = document.getElementById('quoteAreaFilter');
  const quoteUploadAreaFilter = document.getElementById('quoteUploadAreaFilter');
  quotationFilters.area = area;
  quotationUploadFilters.area = area;
  if (quoteAreaFilter) {
    quoteAreaFilter.value = area;
  }
  if (quoteUploadAreaFilter) {
    quoteUploadAreaFilter.value = area;
  }
  loadQuotationUploads();
  loadQuotations(1);
}

function startAutoRefresh() {
  autoRefreshInterval = setInterval(() => {
    loadStats(currentArea);
    loadRequests(currentPage, true);
    if (quotationsInitialized) {
      loadQuotations(quotationPage, true);
      loadQuotationUploads(true);
    }
  }, 30000);
}

window.addEventListener('beforeunload', () => {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
  }
});

async function loadStats(area = 'all') {
  try {
    const params = { limit: 1000 };
    if (area && area !== 'all') {
      params.area = area;
    }
    const response = await app.api.get('/requests', params);
    const requests = response.data;
    
    // Count by status
    const total = requests.length;
    const pending = requests.filter(r => r.status === 'Pending').length;
    const approved = requests.filter(r => r.status === 'Approved').length;
    const rejected = requests.filter(r => r.status === 'Rejected').length;
    const ordered = requests.filter(r => r.status === 'Ordered').length;
    const delivered = requests.filter(r => r.status === 'Delivered').length;
    const completed = requests.filter(r => r.status === 'Completed').length;
    
    // Update stat cards
    document.getElementById('statTotal').textContent = total;
    document.getElementById('statPending').textContent = pending;
    document.getElementById('statApproved').textContent = approved;
    document.getElementById('statRejected').textContent = rejected;
    document.getElementById('statOrdered').textContent = ordered;
    document.getElementById('statDelivered').textContent = delivered;
    document.getElementById('statCompleted').textContent = completed;
  } catch (error) {
    console.error('Load stats error:', error);
  }
}

async function loadRequests(page = 1, silent = false) {
  if (!silent) {
    app.showLoading(true);
  }
  document.getElementById('emptyState').classList.add('hidden');
  
  try {
    const user = app.getUser();
    const params = {
      page,
      limit: pageSize,
      ...currentFilters
    };
    
    // Add month filter for POD planners
    if (user.role === 'pod_planner') {
      const monthFilter = document.getElementById('filterMonth');
      if (monthFilter && monthFilter.value) {
        params.month = monthFilter.value;
      }
    }
    
    const response = await app.api.get('/requests', params);
    const { data, pagination } = response;
    
    currentPage = page;
    
    if (data.length === 0) {
      document.getElementById('requestsContainer').classList.add('hidden');
      document.getElementById('emptyState').classList.remove('hidden');
      document.getElementById('pagination').innerHTML = '';
    } else {
      document.getElementById('requestsContainer').classList.remove('hidden');
      renderRequests(data, pagination);
      renderPagination(pagination);
    }
  } catch (error) {
    if (!silent) {
      app.showAlert('Failed to load requests: ' + error.message, 'error');
    }
  } finally {
    if (!silent) {
      app.showLoading(false);
    }
  }
}

function sortRequests(requests) {
  return requests.sort((a, b) => {
    if (sortColumn === 'mrf') {
      // Extract numbers from MRF (e.g., LAR-MTCE-001-2025 → 1)
      const getNum = (mrf) => {
        const match = mrf.match(/-(\d+)-/);
        return match ? parseInt(match[1]) : 0;
      };
      const aNum = getNum(a.mrf_number);
      const bNum = getNum(b.mrf_number);
      return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
    } else {
      // Sort by date
      const aDate = new Date(a.request_date);
      const bDate = new Date(b.request_date);
      return sortDirection === 'asc' ? aDate - bDate : bDate - aDate;
    }
  });
}

function renderRequests(requests, pagination) {
  const tbody = document.getElementById('requestsTableBody');
  
  const sorted = sortRequests(requests);
  
  tbody.innerHTML = sorted.map((request, index) => {

    const sn = ((pagination.page - 1) * pagination.limit) + index + 1;
    const year = request.request_date ? new Date(request.request_date).getFullYear() : '';
    const reason = (request.reason || '').substring(0, 50) + (request.reason && request.reason.length > 50 ? '...' : '');
    const serviceMaterial = (request.service_material || '-').substring(0, 40) + (request.service_material && request.service_material.length > 40 ? '...' : '');
    const quotationStatus = request.quotation_status || 'Not Submitted';
    const quoteBadgeClass = getQuotationStatusBadge(quotationStatus);
    
    return `
      <tr onclick="openPdfStyleModal(${request.id})" style="cursor: pointer;">
        <td><strong>${sn}</strong></td>
        <td>${request.asset || request.location || '-'}</td>
        <td><strong>${request.mrf_number}</strong></td>
        <td>${app.formatDate(request.request_date)}</td>
        <td>${year}</td>
        <td style="max-width: 300px;">${reason}</td>
        <td>${serviceMaterial}</td>
        <td>${request.discipline}</td>
        <td>${request.status_notes || '-'}</td>
        <td><span class="badge ${quoteBadgeClass}">${quotationStatus}</span></td>
        <td>${request.call_off_number || '-'}</td>
        <td>${request.remarks || '-'}</td>
      </tr>
    `;
  }).join('');
}

function getQuotationStatusBadge(status) {
  const normalized = (status || 'Not Submitted').toLowerCase();
  switch (normalized) {
    case 'approved':
      return 'badge-approved';
    case 'pending':
      return 'badge-pending';
    case 'rejected':
      return 'badge-rejected';
    default:
      return 'badge-neutral';
  }
}

function renderPagination(pagination) {
  const container = document.getElementById('pagination');
  const { page, totalPages, total } = pagination;
  
  // Create pagination wrapper with page size selector
  let html = '<div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-top: 1.5rem;">';
  
  // Page size selector (left side)
  html += `
    <div style="display: flex; align-items: center; gap: 0.75rem;">
      <label style="font-size: 0.875rem; color: #525252; font-weight: 500;">Show:</label>
      <select id="filterPageSize" class="form-select" style="width: auto; min-width: 100px; font-size: 0.875rem;" onchange="handlePageSizeChange()">
        <option value="25" ${pageSize === 25 ? 'selected' : ''}>25</option>
        <option value="50" ${pageSize === 50 ? 'selected' : ''}>50</option>
        <option value="100" ${pageSize === 100 ? 'selected' : ''}>100</option>
        <option value="200" ${pageSize === 200 ? 'selected' : ''}>200</option>
      </select>
      <span style="font-size: 0.875rem; color: #737373;">per page</span>
      <span style="font-size: 0.875rem; color: #737373; margin-left: 0.5rem;">(${total || 0} total)</span>
    </div>
  `;
  
  // Pagination buttons (right side)
  html += '<div style="display: flex; align-items: center; gap: 0.5rem;">';
  
  if (totalPages <= 1) {
    html += '</div></div>';
    container.innerHTML = html;
    return;
  }
  
  html += `
    <button class="pagination-btn" onclick="loadRequests(${page - 1})" ${page === 1 ? 'disabled' : ''}>
      ← Previous
    </button>
  `;
  
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  
  if (start > 1) {
    html += `<button class="pagination-btn" onclick="loadRequests(1)">1</button>`;
    if (start > 2) html += `<span class="pagination-ellipsis">...</span>`;
  }
  
  for (let i = start; i <= end; i++) {
    html += `
      <button class="pagination-btn ${i === page ? 'active' : ''}" onclick="loadRequests(${i})">
        ${i}
      </button>
    `;
  }
  
  if (end < totalPages) {
    if (end < totalPages - 1) html += `<span class="pagination-ellipsis">...</span>`;
    html += `<button class="pagination-btn" onclick="loadRequests(${totalPages})">${totalPages}</button>`;
  }
  
  html += `
    <button class="pagination-btn" onclick="loadRequests(${page + 1})" ${page === totalPages ? 'disabled' : ''}>
      Next →
    </button>
  `;
  
  html += '</div></div>';
  container.innerHTML = html;
}

function handlePageSizeChange() {
  const select = document.getElementById('filterPageSize');
  if (select) {
    pageSize = parseInt(select.value);
    loadRequests(1);
  }
}

function handleDateRangeChange() {
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
    }
    
    if (fromDate && toDate) {
      currentFilters.from = fromDate;
      currentFilters.to = toDate;
      loadRequests(1);
    } else {
      delete currentFilters.from;
      delete currentFilters.to;
      loadRequests(1);
    }
  }
}

function setupFilters() {
  const user = app.getUser();
  
  // Month filter for POD planners
  if (user.role === 'pod_planner') {
    const monthFilter = document.getElementById('filterMonth');
    if (monthFilter) {
      monthFilter.addEventListener('change', () => {
        loadRequests(1);
        loadStats(currentArea);
      });
    }
  }
  
  const statusFilter = document.getElementById('filterStatus');
  if (statusFilter) {
    statusFilter.addEventListener('change', (e) => {
      if (e.target.value) {
        currentFilters.status = e.target.value;
      } else {
        delete currentFilters.status;
      }
      loadRequests(1);
    });
  }
  
  // Date range filter
  const dateRangeFilter = document.getElementById('filterDateRange');
  if (dateRangeFilter) {
    dateRangeFilter.addEventListener('change', handleDateRangeChange);
  }
  
  const disciplineFilter = document.getElementById('filterDiscipline');
  if (disciplineFilter) {
    disciplineFilter.addEventListener('change', (e) => {
      if (e.target.value) {
        currentFilters.discipline = e.target.value;
      } else {
        delete currentFilters.discipline;
      }
      loadRequests(1);
    });
  }
  
  const fromFilter = document.getElementById('filterFrom');
  if (fromFilter) {
    fromFilter.addEventListener('change', (e) => {
      if (e.target.value) {
        currentFilters.from = e.target.value;
      } else {
        delete currentFilters.from;
      }
      loadRequests(1);
    });
  }
  
  const toFilter = document.getElementById('filterTo');
  if (toFilter) {
    toFilter.addEventListener('change', (e) => {
      if (e.target.value) {
        currentFilters.to = e.target.value;
      } else {
        delete currentFilters.to;
      }
      loadRequests(1);
    });
  }
  
  const searchInput = document.getElementById('searchInput');
  searchInput.addEventListener('input', app.debounce((e) => {
    if (e.target.value.trim()) {
      currentFilters.material = e.target.value.trim();
    } else {
      delete currentFilters.material;
    }
    loadRequests(1);
  }, 500));

  const filterMrfInput = document.getElementById('filterMrf');
  if (filterMrfInput) {
    filterMrfInput.addEventListener('input', app.debounce((e) => {
      if (e.target.value.trim()) {
        currentFilters.mrf = e.target.value.trim();
      } else {
        delete currentFilters.mrf;
      }
      loadRequests(1);
    }, 400));
  }
}

// ✅ NEW: PDF-STYLE MODAL VIEW
// ✅ NEW: Open edit modal directly (skip PDF view)
// ✅ CORRECTED: Keep PDF view, add Edit button that opens edit modal

async function openPdfStyleModal(requestId) {
  try {
    app.showLoading(true);
    
    const response = await app.api.get(`/requests/${requestId}`);
    currentRequestData = response.request;
    
    // Create PDF-style receipt view
    const modal = document.getElementById('detailModal');
    if (!modal) return;
    
    modal.innerHTML = `
      <div class="pdf-receipt-container">
        <!-- Header -->
        <div class="pdf-header">
          <div class="pdf-logo-section">
            <svg width="120" height="50" viewBox="0 0 180 80">
              <circle cx="30" cy="40" r="25" fill="#FDDB6F"/>
              <circle cx="30" cy="40" r="20" fill="#FCA94B"/>
              <circle cx="30" cy="40" r="15" fill="#F58220"/>
              <circle cx="30" cy="40" r="10" fill="#EA532F"/>
              <circle cx="30" cy="40" r="6" fill="#00205B"/>
              <text x="68" y="52" font-family="Arial" font-size="32" font-weight="bold" fill="#00205B">Oando</text>
            </svg>
          </div>
          <div class="pdf-title-section">
            <h1>MATERIAL REQUISITION FORM</h1>
            <div class="mrf-number">${currentRequestData.mrf_number}</div>
          </div>
          <div class="pdf-status-section">
            ${getApprovalStatusBadge(currentRequestData)}
          </div>
        </div>

        <!-- Request Details -->
        <div class="pdf-section">
          <h3>REQUESTOR INFORMATION</h3>
          <div class="pdf-grid">
            <div class="pdf-field">
              <label>Name:</label>
              <span>${currentRequestData.first_name} ${currentRequestData.last_name}</span>
            </div>
            <div class="pdf-field">
              <label>User ID:</label>
              <span>${currentRequestData.user_code}</span>
            </div>
            <div class="pdf-field">
              <label>Designation:</label>
              <span>${currentRequestData.designation || '-'}</span>
            </div>
            <div class="pdf-field">
              <label>Office Ext:</label>
              <span>${currentRequestData.office_extension || '-'}</span>
            </div>
            <div class="pdf-field">
              <label>Location:</label>
              <span>${currentRequestData.asset || currentRequestData.location}</span>
            </div>
            <div class="pdf-field">
              <label>Request Date:</label>
              <span>${app.formatDate(currentRequestData.request_date)}</span>
            </div>
          </div>
        </div>

        <!-- Work Details -->
        <div class="pdf-section">
          <h3>WORK DETAILS</h3>
          <div class="pdf-grid">
            <div class="pdf-field">
              <label>Discipline:</label>
              <span>${currentRequestData.discipline}</span>
            </div>
            <div class="pdf-field">
              <label>Priority:</label>
              <span class="badge ${app.getPriorityBadgeClass(currentRequestData.criticality)}">${currentRequestData.criticality}</span>
            </div>
            <div class="pdf-field">
              <label>Unit Tag:</label>
              <span>${currentRequestData.unit_tag || '-'}</span>
            </div>
            <div class="pdf-field">
              <label>Work Order:</label>
              <span>${currentRequestData.work_order_no || '-'}</span>
            </div>
            <div class="pdf-field full-width">
              <label>Reason:</label>
              <span>${currentRequestData.reason}</span>
            </div>
          </div>
        </div>

        <!-- Materials Table -->
        <div class="pdf-section">
          <h3>MATERIALS SPECIFICATION</h3>
          <table class="pdf-table">
            <thead>
              <tr>
                <th>S/N</th>
                <th>Material Description</th>
                <th>OEM/Model</th>
                <th>Part Number</th>
                <th>Qty</th>
                <th>Unit</th>
              </tr>
            </thead>
            <tbody>
              ${(currentRequestData.lines || []).map((line, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${line.material_description}</td>
                  <td>${line.oem_model || '-'}</td>
                  <td>${line.part_number || '-'}</td>
                  <td>${line.quantity}</td>
                  <td>${line.quantity_unit}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Manager Tracking (Only for approved/processed) -->
        ${currentRequestData.status !== 'Pending' ? `
        <div class="pdf-section">
          <h3>TRACKING INFORMATION</h3>
          <div class="pdf-grid">
            ${currentRequestData.vendor_name ? `
            <div class="pdf-field">
              <label>Vendor:</label>
              <span>${currentRequestData.vendor_name}</span>
            </div>
            ` : ''}
            ${app.canViewCommercialDetails() && currentRequestData.quotation_amount_usd ? `
            <div class="pdf-field">
              <label>Quote (USD):</label>
              <span>$${app.formatNumber(currentRequestData.quotation_amount_usd)}</span>
            </div>
            ` : ''}
            ${currentRequestData.status_notes ? `
            <div class="pdf-field full-width">
              <label>Notes:</label>
              <span>${currentRequestData.status_notes}</span>
            </div>
            ` : ''}
          </div>
        </div>
        ` : ''}

        <!-- Actions -->
        <div class="pdf-actions">
          <button onclick="closePdfModal()" class="btn btn-outline">Close</button>
          ${app.getUser()?.role === 'admin' ? `<button onclick="openEditModal(${currentRequestData.id})" class="btn btn-secondary">Edit Details</button>` : ''}
          <button onclick="downloadPDF(${currentRequestData.id})" class="btn btn-primary">Download PDF</button>
          ${currentRequestData.workflow_stage === 'COMPLETED' || currentRequestData.status === 'Approved' ? 
            `<button onclick="downloadMRF(${currentRequestData.id})" class="btn btn-primary" style="background: #10b981;">Download MRF</button>` : 
            ''}
        </div>
      </div>
    `;
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
  } catch (error) {
    app.showAlert('Failed to load request: ' + error.message, 'error');
  } finally {
    app.showLoading(false);
  }
}

// ✅ NEW: Separate function to open edit modal
// ✅ FIXED: Restore original modal HTML before populating edit fields
async function openEditModal(requestId) {
  closePdfModal(); // Close PDF view first
  
  try {
    app.showLoading(true);
    
    const response = await app.api.get(`/requests/${requestId}`);
    currentRequestData = response.request;
    
    // ✅ RESTORE ORIGINAL MODAL HTML STRUCTURE FIRST
    const modal = document.getElementById('detailModal');
    if (!modal) return;
    
    modal.innerHTML = `
      <div class="detail-modal-content">
        <div style="padding: 1.5rem; border-bottom: 2px solid #00205B; display: flex; justify-content: space-between; align-items: center; background: white;">
          <h2 style="margin: 0; color: #00205B;" id="modalTitle">Request Details</h2>
          <button onclick="closeModal()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #737373;">×</button>
        </div>
        
        <div class="detail-section">
          <h3>Request Information</h3>
          <div class="detail-grid">
            <div class="detail-item">
              <div class="detail-label">MRF Number</div>
              <div class="detail-value" id="modal_mrf_number"></div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Request Date</div>
              <div class="detail-value" id="modal_request_date"></div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Year</div>
              <div class="detail-value" id="modal_year"></div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Requestor Name</div>
              <div class="detail-value" id="modal_requester"></div>
            </div>
            <div class="detail-item">
              <div class="detail-label">User ID</div>
              <div class="detail-value" id="modal_user_code"></div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Designation</div>
              <div class="detail-value" id="modal_designation"></div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Office Extension</div>
              <div class="detail-value" id="modal_office_ext"></div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Asset (Location)</div>
              <div class="detail-value" id="modal_asset"></div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Unit Tag</div>
              <div class="detail-value" id="modal_unit_tag"></div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Discipline</div>
              <div class="detail-value" id="modal_discipline"></div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Material Category</div>
              <div class="detail-value" id="modal_category"></div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Criticality</div>
              <div class="detail-value" id="modal_criticality"></div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Work Order No</div>
              <div class="detail-value" id="modal_work_order"></div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Work Order Type</div>
              <div class="detail-value" id="modal_work_order_type"></div>
            </div>
            <div class="detail-item" style="grid-column: 1 / -1;">
              <div class="detail-label">Reason for Request</div>
              <div class="detail-value" id="modal_reason"></div>
            </div>
          </div>
        </div>

        <div class="detail-section manager-edit-section">
          <h3>Manager Tracking</h3>
          <form id="modalUpdateForm">
            <input type="hidden" id="modal_request_id">
            <div class="form-row form-row-3">
              <div class="form-group">
                <label class="form-label">Status</label>
                <select id="modal_status" class="form-select">
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Ordered">Ordered</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Internal Reference</label>
                <input type="text" id="modal_internal_ref" class="form-input" placeholder="Staff following up">
              </div>
              <div class="form-group">
                <label class="form-label">Action Pending</label>
                <input type="text" id="modal_action_pending" class="form-input">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Vendor Name</label>
                <input type="text" id="modal_vendor" class="form-input">
              </div>
              <div class="form-group">
                <label class="form-label">Blanket Order Number</label>
                <input type="text" id="modal_blanket_order" class="form-input">
              </div>
              <div class="form-group">
                <label class="form-label">Call Off Number</label>
                <input type="text" id="modal_call_off" class="form-input">
              </div>
            </div>
            <div class="form-row form-row-3">
              <div class="form-group">
                <label class="form-label">Quotation Reference</label>
                <input type="text" id="modal_quotation_ref" class="form-input">
              </div>
              <div class="form-group">
                <label class="form-label">Quotation Approval Date</label>
                <input type="date" id="modal_quotation_date" class="form-input">
              </div>
              <div class="form-group">
                <label class="form-label">Quotation Amount (USD)</label>
                <input type="number" step="0.01" id="modal_quote_usd" class="form-input">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Quotation Amount (EUR)</label>
                <input type="number" step="0.01" id="modal_quote_eur" class="form-input">
              </div>
              <div class="form-group">
                <label class="form-label">Quotation Amount (NGN)</label>
                <input type="number" step="0.01" id="modal_quote_ngn" class="form-input">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Estimated Delivery</label>
                <input type="date" id="modal_est_delivery" class="form-input">
              </div>
              <div class="form-group">
                <label class="form-label">Date of Delivery</label>
                <input type="date" id="modal_actual_delivery" class="form-input">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Status Notes</label>
              <textarea id="modal_status_notes" class="form-textarea" rows="2"></textarea>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Notes</label>
                <textarea id="modal_notes" class="form-textarea" rows="2"></textarea>
              </div>
              <div class="form-group">
                <label class="form-label">Other</label>
                <textarea id="modal_other" class="form-textarea" rows="2"></textarea>
              </div>
            </div>
            <div style="display: flex; gap: 0.75rem; justify-content: space-between;">
              <button type="button" onclick="deleteRequestFromModal()" class="btn" style="background: #ef4444; color: white;">Delete Request</button>
              <div style="display: flex; gap: 0.75rem;">
                <button type="button" onclick="closeModal()" class="btn btn-outline">Cancel</button>
                <button type="submit" class="btn btn-primary">Save Changes</button>
              </div>
            </div>
          </form>
        </div>

        <div class="detail-section">
          <h3>Materials Technical Specification</h3>
          <div class="table-container">
            <table class="table">
              <thead>
                <tr>
                  <th>S/N</th>
                  <th>Material Description</th>
                  <th>OEM/Model</th>
                  <th>Part Number</th>
                  <th>Quantity</th>
                  <th>Unit</th>
                  <th>Received</th>
                </tr>
              </thead>
              <tbody id="modalMaterialsBody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    
    // ✅ NOW populate the fields (after HTML is restored)
    const safeSet = (id, value) => {
      const el = document.getElementById(id);
      if (el) {
        if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') {
          el.value = value || '';
        } else {
          el.textContent = value || '-';
        }
      }
    };
    
    const safeSetHTML = (id, html) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = html || '-';
    };
    
    // Modal title
    safeSet('modalTitle', `Request ${currentRequestData.mrf_number}`);
    safeSet('modal_request_id', currentRequestData.id);
    
    const requesterName = currentRequestData.first_name && currentRequestData.last_name
      ? `${currentRequestData.first_name} ${currentRequestData.last_name}`
      : 'Imported Request';
    
    // Read-only fields
    safeSet('modal_mrf_number', currentRequestData.mrf_number);
    safeSet('modal_request_date', app.formatDate(currentRequestData.request_date));
    safeSet('modal_year', currentRequestData.year || new Date(currentRequestData.request_date).getFullYear());
    safeSet('modal_requester', requesterName);
    safeSet('modal_user_code', currentRequestData.user_code);
    safeSet('modal_designation', currentRequestData.designation);
    safeSet('modal_office_ext', currentRequestData.office_extension);
    safeSet('modal_asset', currentRequestData.asset || currentRequestData.location);
    safeSet('modal_unit_tag', currentRequestData.unit_tag);
    safeSet('modal_discipline', currentRequestData.discipline);
    safeSet('modal_category', currentRequestData.material_category);
    safeSet('modal_work_order', currentRequestData.work_order_no);
    safeSet('modal_work_order_type', currentRequestData.work_order_type);
    safeSet('modal_reason', currentRequestData.reason);
    
    // Criticality badge
    safeSetHTML('modal_criticality', `<span class="badge ${app.getPriorityBadgeClass(currentRequestData.criticality)}">${currentRequestData.criticality}</span>`);
    
    // Editable fields
    safeSet('modal_status', currentRequestData.status || 'Pending');
    safeSet('modal_internal_ref', currentRequestData.internal_reference);
    safeSet('modal_action_pending', currentRequestData.action_pending);
    safeSet('modal_vendor', currentRequestData.vendor_name);
    safeSet('modal_blanket_order', currentRequestData.blanket_order_number);
    safeSet('modal_call_off', currentRequestData.call_off_number);
    safeSet('modal_quotation_ref', currentRequestData.quotation_reference);
    safeSet('modal_quotation_date', currentRequestData.quotation_approval_date);
    safeSet('modal_quote_usd', currentRequestData.quotation_amount_usd);
    safeSet('modal_quote_eur', currentRequestData.quotation_amount_eur);
    safeSet('modal_quote_ngn', currentRequestData.quotation_amount_ngn);
    safeSet('modal_est_delivery', currentRequestData.estimated_delivery_date);
    safeSet('modal_actual_delivery', currentRequestData.actual_delivery_date);
    safeSet('modal_status_notes', currentRequestData.status_notes);
    safeSet('modal_notes', currentRequestData.notes);
    safeSet('modal_other', currentRequestData.other);
    
    // Materials table
    const materialsBody = document.getElementById('modalMaterialsBody');
    if (materialsBody && currentRequestData.lines) {
      materialsBody.innerHTML = currentRequestData.lines.map(line => `
        <tr>
          <td>${line.line_no}</td>
          <td>${line.material_description}</td>
          <td>${line.oem_model || '-'}</td>
          <td>${line.part_number || '-'}</td>
          <td>${line.quantity}</td>
          <td>${line.quantity_unit}</td>
          <td>${line.received_quantity || 0}</td>
        </tr>
      `).join('');
    }
    
    // Re-attach form submit handler
    document.getElementById('modalUpdateForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleModalUpdate();
    });
    
    // Show modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
  } catch (error) {
    app.showAlert('Failed to load request details: ' + error.message, 'error');
  } finally {
    app.showLoading(false);
  }
}

// ✅ Extract form submit handler
async function handleModalUpdate() {
  const requestId = document.getElementById('modal_request_id').value;
  
  try {
    const updates = {
      status: document.getElementById('modal_status').value,
      internal_reference: document.getElementById('modal_internal_ref').value,
      action_pending: document.getElementById('modal_action_pending').value,
      vendor_name: document.getElementById('modal_vendor').value,
      blanket_order_number: document.getElementById('modal_blanket_order').value,
      call_off_number: document.getElementById('modal_call_off').value,
      quotation_reference: document.getElementById('modal_quotation_ref').value,
      quotation_approval_date: document.getElementById('modal_quotation_date').value || null,
      quotation_amount_usd: document.getElementById('modal_quote_usd').value || null,
      quotation_amount_eur: document.getElementById('modal_quote_eur').value || null,
      quotation_amount_ngn: document.getElementById('modal_quote_ngn').value || null,
      estimated_delivery_date: document.getElementById('modal_est_delivery').value || null,
      actual_delivery_date: document.getElementById('modal_actual_delivery').value || null,
      status_notes: document.getElementById('modal_status_notes').value,
      notes: document.getElementById('modal_notes').value,
      other: document.getElementById('modal_other').value
    };
    
    await app.api.put(`/requests/${requestId}`, updates);
    
    app.showAlert('✅ Request updated successfully!', 'success');
    
    await loadRequests(currentPage, true);
    await loadStats();
    
    setTimeout(() => {
      closeModal();
    }, 1000);
    
  } catch (error) {
    app.showAlert('❌ Failed to update: ' + error.message, 'error');
  }
}


function closePdfModal() {
  document.getElementById('detailModal').classList.remove('active');
  document.body.style.overflow = '';
  currentRequestData = null;
}

function closeModal() {
  closePdfModal();
}

// Make global
window.openEditModal = openEditModal;

// ✅ KEEP THIS - Full edit modal with all fields
async function openDetailModal(requestId) {
  try {
    app.showLoading(true);
    
    const response = await app.api.get(`/requests/${requestId}`);
    currentRequestData = response.request;
    
    // ✅ Null-safe helper
    const safeSet = (id, value) => {
      const el = document.getElementById(id);
      if (el) {
        if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') {
          el.value = value || '';
        } else {
          el.textContent = value || '-';
        }
      }
    };
    
    const safeSetHTML = (id, html) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = html || '-';
    };
    
    // Modal title
    safeSet('modalTitle', `Request ${currentRequestData.mrf_number}`);
    safeSet('modal_request_id', currentRequestData.id);
    
    // ✅ Handle imported requests (no user name)
    const requesterName = currentRequestData.first_name && currentRequestData.last_name
      ? `${currentRequestData.first_name} ${currentRequestData.last_name}`
      : 'Imported Request';
    
    // Read-only fields
    safeSet('modal_mrf_number', currentRequestData.mrf_number);
    safeSet('modal_request_date', app.formatDate(currentRequestData.request_date));
    safeSet('modal_year', currentRequestData.year || new Date(currentRequestData.request_date).getFullYear());
    safeSet('modal_requester', requesterName);
    safeSet('modal_user_code', currentRequestData.user_code);
    safeSet('modal_designation', currentRequestData.designation);
    safeSet('modal_office_ext', currentRequestData.office_extension);
    safeSet('modal_asset', currentRequestData.asset || currentRequestData.location);
    safeSet('modal_unit_tag', currentRequestData.unit_tag);
    safeSet('modal_discipline', currentRequestData.discipline);
    safeSet('modal_category', currentRequestData.material_category);
    safeSet('modal_work_order', currentRequestData.work_order_no);
    safeSet('modal_work_order_type', currentRequestData.work_order_type);
    safeSet('modal_reason', currentRequestData.reason);
    
    // Criticality badge
    safeSetHTML('modal_criticality', `<span class="badge ${app.getPriorityBadgeClass(currentRequestData.criticality)}">${currentRequestData.criticality}</span>`);
    
    // Editable fields
    safeSet('modal_status', currentRequestData.status || 'Pending');
    safeSet('modal_internal_ref', currentRequestData.internal_reference);
    safeSet('modal_action_pending', currentRequestData.action_pending);
    safeSet('modal_vendor', currentRequestData.vendor_name);
    safeSet('modal_blanket_order', currentRequestData.blanket_order_number);
    safeSet('modal_call_off', currentRequestData.call_off_number);
    safeSet('modal_quotation_ref', currentRequestData.quotation_reference);
    safeSet('modal_quotation_date', currentRequestData.quotation_approval_date);
    safeSet('modal_quote_usd', currentRequestData.quotation_amount_usd);
    safeSet('modal_quote_eur', currentRequestData.quotation_amount_eur);
    safeSet('modal_quote_ngn', currentRequestData.quotation_amount_ngn);
    safeSet('modal_est_delivery', currentRequestData.estimated_delivery_date);
    safeSet('modal_actual_delivery', currentRequestData.actual_delivery_date);
    safeSet('modal_status_notes', currentRequestData.status_notes);
    safeSet('modal_notes', currentRequestData.notes);
    safeSet('modal_other', currentRequestData.other);
    
    // Materials table
    const materialsBody = document.getElementById('modalMaterialsBody');
    if (materialsBody && currentRequestData.lines) {
      materialsBody.innerHTML = currentRequestData.lines.map(line => `
        <tr>
          <td>${line.line_no}</td>
          <td>${line.material_description}</td>
          <td>${line.oem_model || '-'}</td>
          <td>${line.part_number || '-'}</td>
          <td>${line.quantity}</td>
          <td>${line.quantity_unit}</td>
          <td>${line.received_quantity || 0}</td>
        </tr>
      `).join('');
    }
    
    // Show modal
    const modal = document.getElementById('detailModal');
    if (modal) {
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
    
  } catch (error) {
    app.showAlert('Failed to load request details: ' + error.message, 'error');
    console.error('Modal error:', error);
  } finally {
    app.showLoading(false);
  }
}

function closeModal() {
  document.getElementById('detailModal').classList.remove('active');
  document.body.style.overflow = '';
  currentRequestData = null;
}

// ✅ Professional Approval Status Badge (matches PDF)
function getApprovalStatusBadge(request) {
  const workflowStage = request.workflow_stage || request.status || 'MRF_CREATED';
  const status = request.status || '';
  
  // Map workflow stages to badge info (same as PDF)
  const statusMap = {
    'MRF_CREATED': { text: 'PENDING', bgColor: '#FEF3C7', textColor: '#92400E', borderColor: '#FCD34D' },
    'MRF_APPROVED': { text: 'APPROVED', bgColor: '#D1FAE5', textColor: '#065F46', borderColor: '#10B981' },
    'BLANKET_CHECK': { text: 'IN REVIEW', bgColor: '#DBEAFE', textColor: '#1E40AF', borderColor: '#3B82F6' },
    'QUOTATION_REQUESTED': { text: 'QUOTATION REQUESTED', bgColor: '#E0E7FF', textColor: '#3730A3', borderColor: '#6366F1' },
    'QUOTATION_SUBMITTED': { text: 'QUOTATION SUBMITTED', bgColor: '#E0E7FF', textColor: '#3730A3', borderColor: '#6366F1' },
    'QUOTATION_APPROVED': { text: 'QUOTATION APPROVED', bgColor: '#D1FAE5', textColor: '#065F46', borderColor: '#10B981' },
    'QUOTATION_ACCEPTED': { text: 'QUOTATION ACCEPTED', bgColor: '#D1FAE5', textColor: '#065F46', borderColor: '#10B981' },
    'PROFORMA_SUBMITTED': { text: 'PROFORMA SUBMITTED', bgColor: '#E0F2FE', textColor: '#0C4A6E', borderColor: '#0EA5E9' },
    'PROFORMA_APPROVED': { text: 'PROFORMA APPROVED', bgColor: '#D1FAE5', textColor: '#065F46', borderColor: '#10B981' },
    'SHIPPED': { text: 'SHIPPED', bgColor: '#FCE7F3', textColor: '#831843', borderColor: '#EC4899' },
    'COMPLIANCE_CHECK': { text: 'COMPLIANCE CHECK', bgColor: '#F3E8FF', textColor: '#6B21A8', borderColor: '#A855F7' },
    'RECEIVED': { text: 'RECEIVED', bgColor: '#D1FAE5', textColor: '#065F46', borderColor: '#10B981' },
    'CLOSED': { text: 'CLOSED', bgColor: '#F3F4F6', textColor: '#374151', borderColor: '#9CA3AF' },
    'REJECTED': { text: 'REJECTED', bgColor: '#FEE2E2', textColor: '#991B1B', borderColor: '#EF4444' },
    'RESCHEDULED': { text: 'RESCHEDULED', bgColor: '#FEF3C7', textColor: '#92400E', borderColor: '#FCD34D' }
  };
  
  // Try workflow stage first, then fallback to status
  let badgeInfo = statusMap[workflowStage];
  
  if (!badgeInfo) {
    // Fallback to status field
    const statusUpper = status.toUpperCase();
    if (statusUpper.includes('PENDING')) {
      badgeInfo = statusMap['MRF_CREATED'];
    } else if (statusUpper.includes('APPROVED')) {
      badgeInfo = statusMap['MRF_APPROVED'];
    } else if (statusUpper.includes('REJECTED')) {
      badgeInfo = statusMap['REJECTED'];
    } else if (statusUpper.includes('ORDERED') || statusUpper.includes('SHIPPED')) {
      badgeInfo = statusMap['SHIPPED'];
    } else if (statusUpper.includes('DELIVERED') || statusUpper.includes('RECEIVED')) {
      badgeInfo = statusMap['RECEIVED'];
    } else if (statusUpper.includes('COMPLETED') || statusUpper.includes('CLOSED')) {
      badgeInfo = statusMap['CLOSED'];
    } else {
      badgeInfo = statusMap['MRF_CREATED'];
    }
  }
  
  return `
    <div class="professional-status-badge" style="
      display: inline-block;
      padding: 0.5rem 1rem;
      background-color: ${badgeInfo.bgColor};
      color: ${badgeInfo.textColor};
      border: 2px solid ${badgeInfo.borderColor};
      border-radius: 6px;
      font-weight: 700;
      font-size: 0.875rem;
      text-align: center;
      white-space: nowrap;
      letter-spacing: 0.5px;
    ">
      ${badgeInfo.text}
    </div>
  `;
}

function closePdfModal() {
  document.getElementById('detailModal').classList.remove('active');
  document.body.style.overflow = '';
}

function editRequest(id) {
  closePdfModal();
  // Open old edit modal
  openDetailModal(id);
}

async function downloadPDF(id) {
  try {
    const blob = await app.api.download(`/requests/${id}/pdf`);
    const fileName = `MRF_${currentRequestData.mrf_number.replace(/\//g, '-')}.pdf`;
    app.downloadFile(blob, fileName);
    app.showAlert('✅ PDF downloaded successfully', 'success');
  } catch (error) {
    app.showAlert('Failed to download PDF: ' + error.message, 'error');
  }
}

async function downloadMRF(id) {
  try {
    const blob = await app.api.download(`/requests/${id}/mrf`);
    const fileName = `MRF_${currentRequestData.mrf_number.replace(/\//g, '-')}.pdf`;
    app.downloadFile(blob, fileName);
    app.showAlert('✅ Invoice downloaded successfully', 'success');
  } catch (error) {
    app.showAlert('Failed to download invoice: ' + error.message, 'error');
  }
}





function closeModal() {
  document.getElementById('detailModal').classList.remove('active');
  document.body.style.overflow = '';
  currentRequestData = null;
}

document.getElementById('detailModal')?.addEventListener('click', (e) => {
  if (e.target.id === 'detailModal') {
    closeModal();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.getElementById('detailModal').classList.contains('active')) {
    closeModal();
    return;
  }
  if (e.key === 'Escape' && document.getElementById('quotationsModal')?.classList.contains('active')) {
    closeQuotationsModal();
  }
});

document.getElementById('quotationsModal')?.addEventListener('click', (e) => {
  if (e.target.id === 'quotationsModal') {
    closeQuotationsModal();
  }
});

document.getElementById('modalUpdateForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const requestId = document.getElementById('modal_request_id').value;
  
  try {
    const updates = {
      status: document.getElementById('modal_status').value,
      internal_reference: document.getElementById('modal_internal_ref').value,
      action_pending: document.getElementById('modal_action_pending').value,
      vendor_name: document.getElementById('modal_vendor').value,
      blanket_order_number: document.getElementById('modal_blanket_order').value,
      call_off_number: document.getElementById('modal_call_off').value,
      quotation_reference: document.getElementById('modal_quotation_ref').value,
      quotation_approval_date: document.getElementById('modal_quotation_date').value || null,
      quotation_amount_usd: document.getElementById('modal_quote_usd').value || null,
      quotation_amount_eur: document.getElementById('modal_quote_eur').value || null,
      quotation_amount_ngn: document.getElementById('modal_quote_ngn').value || null,
      estimated_delivery_date: document.getElementById('modal_est_delivery').value || null,
      actual_delivery_date: document.getElementById('modal_actual_delivery').value || null,
      status_notes: document.getElementById('modal_status_notes').value,
      notes: document.getElementById('modal_notes').value,
      other: document.getElementById('modal_other').value
    };
    
    await app.api.put(`/requests/${requestId}`, updates);
    
    app.showAlert('✅ Request updated successfully!', 'success');
    
    await loadRequests(currentPage, true);
    await loadStats();
    
    setTimeout(() => {
      closeModal();
    }, 1000);
    
  } catch (error) {
    app.showAlert('❌ Failed to update: ' + error.message, 'error');
  }
});

async function deleteRequestFromModal() {
  if (!currentRequestData) return;
  
  if (!confirm(`Are you sure you want to delete ${currentRequestData.mrf_number}? This cannot be undone!`)) {
    return;
  }
  
  try {
    await app.api.delete(`/requests/${currentRequestData.id}`);
    app.showAlert(`✅ Request ${currentRequestData.mrf_number} deleted successfully`, 'success');
    
    closeModal();
    await loadRequests(currentPage);
    await loadStats();
  } catch (error) {
    app.showAlert(`❌ Failed to delete: ${error.message}`, 'error');
  }
}

// ✅ REPLACE exportData() function
async function exportData() {
  try {
    app.showAlert('📥 Preparing Excel export...', 'info');
    
    // ✅ Use current area filter for export
    const exportFilters = { ...currentFilters };
    
    const blob = await app.api.download('/exports', exportFilters);
    
    // ✅ Area-specific filename
    const areaLabel = currentArea === 'all' ? 'All_Areas' : 
                     currentArea === 'LAR' ? 'Land_Area' : 
                     currentArea === 'SAR' ? 'Swamp_Area' : 'PHC_POD';
    const fileName = `Oando_MRF_${areaLabel}_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    app.downloadFile(blob, fileName);
    app.showAlert('✅ Export completed successfully!', 'success');
  } catch (error) {
    app.showAlert('❌ Export failed: ' + error.message, 'error');
  }
}

function initQuotationCenter() {
  if (quotationsInitialized) {
    refreshQuotations();
    return;
  }
  const modal = document.getElementById('quotationsModal');
  if (!modal) return;

  document.querySelectorAll('.quote-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.quote-tab').forEach(btn => btn.classList.remove('active'));
      tab.classList.add('active');
      quotationFilters.status = tab.dataset.quoteStatus;
      loadQuotations(1);
    });
  });

  const quoteAreaFilter = document.getElementById('quoteAreaFilter');
  const quoteSearchInput = document.getElementById('quoteSearchInput');
  const quoteFromDate = document.getElementById('quoteFromDate');
  const quoteToDate = document.getElementById('quoteToDate');
  const quoteUploadAreaFilter = document.getElementById('quoteUploadAreaFilter');
  const quoteUploadSearchInput = document.getElementById('quoteUploadSearchInput');

  if (quoteAreaFilter) {
    quoteAreaFilter.value = quotationFilters.area;
    quoteAreaFilter.addEventListener('change', (e) => {
      quotationFilters.area = e.target.value;
      loadQuotations(1);
    });
  }

  if (quoteSearchInput) {
    quoteSearchInput.addEventListener('input', app.debounce((e) => {
      quotationFilters.search = e.target.value.trim();
      loadQuotations(1);
    }, 400));
  }

  if (quoteFromDate) {
    quoteFromDate.addEventListener('change', (e) => {
      quotationFilters.from = e.target.value;
      loadQuotations(1);
    });
  }

  if (quoteToDate) {
    quoteToDate.addEventListener('change', (e) => {
      quotationFilters.to = e.target.value;
      loadQuotations(1);
    });
  }

  if (quoteUploadAreaFilter) {
    quoteUploadAreaFilter.value = quotationUploadFilters.area;
    quoteUploadAreaFilter.addEventListener('change', (e) => {
      quotationUploadFilters.area = e.target.value;
      loadQuotationUploads();
    });
  }

  if (quoteUploadSearchInput) {
    quoteUploadSearchInput.addEventListener('input', app.debounce((e) => {
      quotationUploadFilters.search = e.target.value.trim();
      loadQuotationUploads();
    }, 400));
  }

  loadQuotationUploads();
  loadQuotations();
  quotationsInitialized = true;
}

async function loadQuotationUploads(silent = false) {
  const listEl = document.getElementById('quotationRequestList');
  if (!listEl) return;

  if (!silent) {
    listEl.innerHTML = `<div class="mini-loading"><div class="spinner"></div></div>`;
  }

  try {
    const params = { limit: 100 };
    if (quotationUploadFilters.area && quotationUploadFilters.area !== 'all') {
      params.area = quotationUploadFilters.area;
    }
    if (quotationUploadFilters.search) {
      params.mrf = quotationUploadFilters.search;
    }
    const response = await app.api.get('/requests', params);
    quotationUploadOptions = response.data.filter(req => (req.quotation_status || 'Not Submitted') !== 'Approved');
    renderQuotationUploadList(quotationUploadOptions);
  } catch (error) {
    listEl.innerHTML = `<p style="color: #ef4444;">Unable to load requests: ${error.message}</p>`;
  }
}

function renderQuotationUploadList(requests) {
  const listEl = document.getElementById('quotationRequestList');
  if (!listEl) return;

  if (!requests.length) {
    listEl.innerHTML = `
      <div class="empty-state small">
        <div class="empty-state-icon">📝</div>
        <div class="empty-state-title">Nothing to upload</div>
        <div class="empty-state-description">All requests in this area already have approved quotations.</div>
      </div>
    `;
    return;
  }

  const limited = requests.slice(0, 12);
  listEl.innerHTML = limited.map(request => `
    <div class="quotation-request-item">
      <div>
        <div class="mrf">${request.mrf_number}</div>
        <div class="meta">${request.asset || request.location || '-'} • ${request.discipline || '-'} • ${request.quotation_status || 'Not Submitted'}</div>
      </div>
      <button class="btn btn-sm btn-primary" onclick="openQuotationUploadModal(${request.id})">Upload PDF</button>
    </div>
  `).join('');
}

async function openQuotationUploadModal(requestId) {
  let request = quotationUploadOptions.find(req => req.id === requestId);
  if (!request) {
    try {
      const response = await app.api.get(`/requests/${requestId}`);
      request = response.request;
    } catch (error) {
      app.showAlert('Unable to load request details: ' + error.message, 'error');
      return;
    }
  }

  app.showModal(`Upload Quotation • ${request.mrf_number}`, `
    <form id="quotationUploadForm" class="quotation-upload-form">
      <div class="dropzone" id="quotationDropzone">
        <strong>Drag & drop a PDF</strong>
        <p>Only PDF files up to 5MB are allowed. Click to browse.</p>
        <div class="quotation-file-name" id="quotationFileName">No file selected yet</div>
      </div>
      <input type="file" id="quotationFileInput" accept="application/pdf" hidden>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Notes (optional)</label>
          <textarea id="quotationNotesInput" class="form-textarea" rows="2" placeholder="Add a short note about this quotation"></textarea>
        </div>
      </div>
      <div class="form-row" ${app.getUser().role === 'admin' ? '' : 'style="display:none;"'}>
        <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem;">
          <input type="checkbox" id="quotationMarkApproved">
          Mark as approved
        </label>
      </div>
      <div id="quotationUploadProgress" style="font-size: 0.85rem; color: #737373; margin-bottom: 0.75rem;"></div>
      <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
        <button type="button" class="btn btn-outline" onclick="document.getElementById('appModal')?.remove()">Cancel</button>
        <button type="submit" class="btn btn-primary">Upload PDF</button>
      </div>
    </form>
  `);

  const dropzone = document.getElementById('quotationDropzone');
  const fileInput = document.getElementById('quotationFileInput');
  const fileNameLabel = document.getElementById('quotationFileName');
  const form = document.getElementById('quotationUploadForm');
  const progressLabel = document.getElementById('quotationUploadProgress');
  let selectedFile = null;

  const handleFile = (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      app.showAlert('Only PDF files are allowed.', 'error');
      return;
    }
    selectedFile = file;
    fileNameLabel.textContent = file.name;
  };

  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));

  ['dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (eventName === 'dragover') {
        dropzone.classList.add('dragging');
      } else {
        dropzone.classList.remove('dragging');
      }
    });
  });

  dropzone.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files[0];
    handleFile(file);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      app.showAlert('Please select a PDF file first.', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('category', 'quotation');

    const notes = document.getElementById('quotationNotesInput').value.trim();
    if (notes) {
      formData.append('notes', notes);
    }

    const markApproved = document.getElementById('quotationMarkApproved');
    if (markApproved && markApproved.checked) {
      formData.append('status', 'approved');
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      await app.api.upload(`/requests/${requestId}/attachments`, formData, (progress) => {
        progressLabel.textContent = `Uploading ${(progress * 100).toFixed(0)}%`;
      });
      app.showAlert('Quotation uploaded successfully.', 'success');
      document.getElementById('appModal')?.remove();
      await loadQuotationUploads();
      await loadQuotations(quotationPage);
      await loadRequests(currentPage, true);
    } catch (error) {
      app.showAlert('Upload failed: ' + error.message, 'error');
    } finally {
      submitBtn.disabled = false;
    }
  });
}

async function loadQuotations(page = 1, silent = false) {
  const loadingEl = document.getElementById('quotationsLoading');
  const emptyState = document.getElementById('quotationsEmptyState');
  if (!document.getElementById('quotationsTableContainer')) return;

  if (!silent && loadingEl) {
    loadingEl.classList.remove('hidden');
  }
  emptyState?.classList.add('hidden');

  try {
    const params = {
      page,
      limit: QUOTATION_PAGE_SIZE,
      status: quotationFilters.status
    };
    if (quotationFilters.area && quotationFilters.area !== 'all') {
      params.area = quotationFilters.area;
    }
    if (quotationFilters.search) {
      params.search = quotationFilters.search;
    }
    if (quotationFilters.from) {
      params.from = quotationFilters.from;
    }
    if (quotationFilters.to) {
      params.to = quotationFilters.to;
    }

    const response = await app.api.get('/quotations', params);
    quotationPage = page;
    renderQuotationsTable(response.data, response.pagination);
    if (response.data.length === 0) {
      emptyState?.classList.remove('hidden');
    }
  } catch (error) {
    document.getElementById('quotationsTableContainer').innerHTML = `<p style="color: #ef4444;">Failed to load quotations: ${error.message}</p>`;
  } finally {
    loadingEl?.classList.add('hidden');
  }
}

function renderQuotationsTable(data, pagination) {
  const container = document.getElementById('quotationsTableContainer');
  if (!container) return;

  if (!data.length) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>MRF Number</th>
          <th>Uploaded</th>
          <th>Status</th>
          <th>Vendor / Area</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${data.map(item => {
          const statusBadge = getQuotationStatusBadge(item.status === 'uploaded' ? 'Pending' : item.status);
          const statusLabel = item.status === 'uploaded' ? 'Pending' : (item.status || 'Pending');
          const areaLabel = item.mrf_number?.split('-')[0] || 'N/A';
          return `
            <tr>
              <td>
                <div><strong>${item.mrf_number}</strong></div>
                <div style="font-size: 0.8rem; color: #737373;">${app.formatDate(item.request_date)}</div>
              </td>
              <td>
                <div>${app.formatDate(item.uploaded_at)}</div>
                <div style="font-size: 0.8rem; color: #737373;">By ${item.uploader_first_name || ''} ${item.uploader_last_name || ''}</div>
              </td>
              <td>
                <span class="badge ${statusBadge}">${statusLabel.charAt(0).toUpperCase() + statusLabel.slice(1)}</span>
              </td>
              <td>
                <div>${item.vendor_name || 'Vendor TBD'}</div>
                <div style="font-size: 0.8rem; color: #737373;">${areaLabel} • ${item.discipline || 'N/A'}</div>
              </td>
              <td>
                <div class="quotation-actions">
                  <button class="btn btn-sm btn-outline" onclick="window.open('${getAttachmentUrl(item.file_path)}', '_blank')">View PDF</button>
                  ${item.status === 'pending' || item.status === 'uploaded' ? `
                    <button class="btn btn-sm btn-primary" onclick="handleQuotationStatusChange(${item.id}, 'approved')">Approve</button>
                    <button class="btn btn-sm btn-outline" onclick="handleQuotationStatusChange(${item.id}, 'rejected')">Reject</button>
                  ` : ''}
                </div>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
    <div class="pagination" id="quotationPagination"></div>
  `;

  renderQuotationPagination(pagination);
}

function renderQuotationPagination(pagination) {
  const container = document.getElementById('quotationPagination');
  if (!container || pagination.totalPages <= 1) {
    if (container) container.innerHTML = '';
    return;
  }

  const { page, totalPages } = pagination;
  let html = `
    <button class="pagination-btn" onclick="loadQuotations(${page - 1})" ${page === 1 ? 'disabled' : ''}>←</button>
  `;

  const start = Math.max(1, page - 1);
  const end = Math.min(totalPages, page + 1);

  for (let i = start; i <= end; i++) {
    html += `<button class="pagination-btn ${i === page ? 'active' : ''}" onclick="loadQuotations(${i})">${i}</button>`;
  }

  html += `
    <button class="pagination-btn" onclick="loadQuotations(${page + 1})" ${page === totalPages ? 'disabled' : ''}>→</button>
  `;

  container.innerHTML = html;
}

async function handleQuotationStatusChange(id, status) {
  try {
    await app.api.put(`/quotations/${id}`, { status });
    const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
    app.showAlert(`Quotation ${statusLabel} successfully.`, 'success');
    await loadQuotations(quotationPage);
    await loadQuotationUploads(true);
    await loadRequests(currentPage, true);
  } catch (error) {
    app.showAlert('Failed to update quotation: ' + error.message, 'error');
  }
}

function refreshQuotations() {
  loadQuotationUploads();
  loadQuotations(quotationPage);
  loadRequests(currentPage, true);
}

function getAttachmentUrl(filePath) {
  if (!filePath) return '#';
  const normalized = filePath.replace(/\\/g, '/');
  const idx = normalized.lastIndexOf('/uploads/');
  if (idx !== -1) {
    return normalized.substring(idx);
  }
  const altIdx = normalized.indexOf('uploads/');
  if (altIdx !== -1) {
    return '/' + normalized.substring(altIdx);
  }
  return normalized;
}

function toggleMRFSort() {
  sortColumn = 'mrf';
  sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
  
  const icon = document.getElementById('mrfSortIcon');
  if (icon) {
    icon.textContent = sortDirection === 'asc' ? '↑' : '↓';
  }
  
  // Re-render with current data
  loadRequests(currentPage, true);
}

// ✅ Make it global
window.toggleMRFSort = toggleMRFSort;

window.openPdfStyleModal = openPdfStyleModal;
window.closePdfModal = closePdfModal;
window.editRequest = editRequest;
window.downloadPDF = downloadPDF;
window.downloadInvoice = downloadInvoice;