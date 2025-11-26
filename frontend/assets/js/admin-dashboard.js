// frontend/assets/js/admin-dashboard.js
// FIXED: Added CALL OFF NUMBER and REMARKS columns

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
  if (!app.requireAuth() || !app.requireRole('admin')) return;
  
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
    
    const pending = requests.filter(r => r.status === 'Pending').length;
    const thisMonth = requests.filter(r => {
      const date = new Date(r.request_date);
      const now = new Date();
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }).length;
    
    document.getElementById('statTotal').textContent = requests.length;
    document.getElementById('statPending').textContent = pending;
    document.getElementById('statMonth').textContent = thisMonth;
    
    const summaryResponse = await app.api.get('/analytics/summary');
    if (summaryResponse.success) {
      const value = summaryResponse.summary.totalValueUSD || 0;
      document.getElementById('statValue').textContent = '$' + app.formatNumber(value.toFixed(0));
    }
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
    const params = {
      page,
      limit: pageSize,
      ...currentFilters
    };
    
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

function renderRequests(requests, pagination) {
  const tbody = document.getElementById('requestsTableBody');
  
  tbody.innerHTML = requests.map((request, index) => {
    const sn = ((pagination.page - 1) * pagination.limit) + index + 1;
    const year = request.request_date ? new Date(request.request_date).getFullYear() : '';
    const reason = (request.reason || '').substring(0, 50) + (request.reason && request.reason.length > 50 ? '...' : '');
    const serviceMaterial = (request.service_material || '-').substring(0, 40) + (request.service_material && request.service_material.length > 40 ? '...' : '');
    const quotationStatus = request.quotation_status || 'Not Submitted';
    const quoteBadgeClass = getQuotationStatusBadge(quotationStatus);
    
    return `
      <tr onclick="openDetailModal(${request.id})" style="cursor: pointer;">
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
  const { page, totalPages } = pagination;
  
  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }
  
  let html = `
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
  
  container.innerHTML = html;
}

function setupFilters() {
  document.getElementById('filterStatus').addEventListener('change', (e) => {
    if (e.target.value) {
      currentFilters.status = e.target.value;
    } else {
      delete currentFilters.status;
    }
    loadRequests(1);
  });
  
  document.getElementById('filterPageSize').addEventListener('change', (e) => {
    pageSize = parseInt(e.target.value);
    loadRequests(1);
  });
  
  document.getElementById('filterDiscipline').addEventListener('change', (e) => {
    if (e.target.value) {
      currentFilters.discipline = e.target.value;
    } else {
      delete currentFilters.discipline;
    }
    loadRequests(1);
  });
  
  document.getElementById('filterFrom').addEventListener('change', (e) => {
    if (e.target.value) {
      currentFilters.from = e.target.value;
    } else {
      delete currentFilters.from;
    }
    loadRequests(1);
  });
  
  document.getElementById('filterTo').addEventListener('change', (e) => {
    if (e.target.value) {
      currentFilters.to = e.target.value;
    } else {
      delete currentFilters.to;
    }
    loadRequests(1);
  });
  
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

async function openDetailModal(requestId) {
  try {
    app.showLoading(true);
    
    const response = await app.api.get(`/requests/${requestId}`);
    currentRequestData = response.request;
    
    document.getElementById('modalTitle').textContent = `Request ${currentRequestData.mrf_number}`;
    document.getElementById('modal_request_id').value = currentRequestData.id;
    
    // Populate read-only fields
    document.getElementById('modal_mrf_number').textContent = currentRequestData.mrf_number;
    document.getElementById('modal_request_date').textContent = app.formatDate(currentRequestData.request_date);
    document.getElementById('modal_year').textContent = currentRequestData.year || new Date(currentRequestData.request_date).getFullYear();
    document.getElementById('modal_requester').textContent = `${currentRequestData.first_name} ${currentRequestData.last_name}`;
    document.getElementById('modal_user_code').textContent = currentRequestData.user_code;
    document.getElementById('modal_designation').textContent = currentRequestData.designation || '-';
    document.getElementById('modal_office_ext').textContent = currentRequestData.office_extension || '-';
    document.getElementById('modal_asset').textContent = currentRequestData.asset || currentRequestData.location || '-';
    document.getElementById('modal_unit_tag').textContent = currentRequestData.unit_tag || '-';
    document.getElementById('modal_discipline').textContent = currentRequestData.discipline;
    document.getElementById('modal_category').textContent = currentRequestData.material_category || '-';
    document.getElementById('modal_criticality').innerHTML = `<span class="badge ${app.getPriorityBadgeClass(currentRequestData.criticality)}">${currentRequestData.criticality}</span>`;
    document.getElementById('modal_work_order').textContent = currentRequestData.work_order_no || '-';
    document.getElementById('modal_work_order_type').textContent = currentRequestData.work_order_type || '-';
    document.getElementById('modal_reason').textContent = currentRequestData.reason;
    
    // Populate editable fields
    document.getElementById('modal_status').value = currentRequestData.status || 'Pending';
    document.getElementById('modal_internal_ref').value = currentRequestData.internal_reference || '';
    document.getElementById('modal_action_pending').value = currentRequestData.action_pending || '';
    document.getElementById('modal_vendor').value = currentRequestData.vendor_name || '';
    document.getElementById('modal_blanket_order').value = currentRequestData.blanket_order_number || '';
    document.getElementById('modal_call_off').value = currentRequestData.call_off_number || '';
    document.getElementById('modal_quotation_ref').value = currentRequestData.quotation_reference || '';
    document.getElementById('modal_quotation_date').value = currentRequestData.quotation_approval_date || '';
    document.getElementById('modal_quote_usd').value = currentRequestData.quotation_amount_usd || '';
    document.getElementById('modal_quote_eur').value = currentRequestData.quotation_amount_eur || '';
    document.getElementById('modal_quote_ngn').value = currentRequestData.quotation_amount_ngn || '';
    document.getElementById('modal_est_delivery').value = currentRequestData.estimated_delivery_date || '';
    document.getElementById('modal_actual_delivery').value = currentRequestData.actual_delivery_date || '';
    document.getElementById('modal_status_notes').value = currentRequestData.status_notes || '';
    document.getElementById('modal_notes').value = currentRequestData.notes || '';
    document.getElementById('modal_other').value = currentRequestData.other || '';
    
    // Render materials
    const materialsBody = document.getElementById('modalMaterialsBody');
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
    
    document.getElementById('detailModal').classList.add('active');
    document.body.style.overflow = 'hidden';
    
  } catch (error) {
    app.showAlert('Failed to load request details: ' + error.message, 'error');
  } finally {
    app.showLoading(false);
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

async function exportData() {
  try {
    app.showAlert('📥 Preparing Excel export...', 'info');
    
    const blob = await app.api.download('/exports', currentFilters);
    const fileName = `Oando_MRF_Export_${new Date().toISOString().split('T')[0]}.xlsx`;
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