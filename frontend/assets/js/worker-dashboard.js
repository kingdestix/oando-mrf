// frontend/assets/js/worker-dashboard.js
// Worker Dashboard - View own requests only

let workerCurrentPage = 1;
let workerCurrentFilters = {};

document.addEventListener('DOMContentLoaded', () => {
  if (!app.requireAuth()) return;
  
  const user = app.getUser();
  if (user.role === 'admin') {
    window.location.href = '/admin-dashboard.html';
    return;
  }
  
  loadStats();
  loadRequests();
  setupFilters();
});

async function loadStats() {
  try {
    const response = await app.api.get('/requests', { limit: 1000 });
    const requests = response.data;
    
    const pending = requests.filter(r => r.status === 'Pending').length;
    const approved = requests.filter(r => r.status === 'Approved').length;
    const thisMonth = requests.filter(r => {
      const date = new Date(r.request_date);
      const now = new Date();
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }).length;
    
    document.getElementById('statTotal').textContent = requests.length;
    document.getElementById('statPending').textContent = pending;
    document.getElementById('statApproved').textContent = approved;
    document.getElementById('statThisMonth').textContent = thisMonth;
  } catch (error) {
    console.error('Load stats error:', error);
  }
}

async function loadRequests(page = 1) {
  app.showLoading(true);
  document.getElementById('emptyState').classList.add('hidden');
  
  try {
    const params = {
      page,
      limit: 25,
      ...workerCurrentFilters
    };
    
    const response = await app.api.get('/requests', params);
    const { data, pagination } = response;
    
    workerCurrentPage = page;
    
    if (data.length === 0) {
      document.getElementById('requestsContainer').classList.add('hidden');
      document.getElementById('emptyState').classList.remove('hidden');
      document.getElementById('pagination').innerHTML = '';
    } else {
      document.getElementById('requestsContainer').classList.remove('hidden');
      renderRequests(data);
      renderPagination(pagination);
    }
  } catch (error) {
    app.showAlert('Failed to load requests', 'error');
  } finally {
    app.showLoading(false);
  }
}

// Map workflow stages to user-friendly names
function getWorkflowStageName(stage) {
  const stageMap = {
    'REQUESTOR_SUBMITTED': 'Submitted',
    'TECHNICAL_COORDINATOR_REVIEW': 'Technical Coordinator Review',
    'ASSISTANT_MANAGER_REVIEW': 'Assistant Manager Review',
    'AREA_MANAGER_REVIEW': 'Area Manager Review',
    'POD_PLANNER_REVIEW': 'POD Planner Review',
    'DISCIPLINE_UNIT_REVIEW': 'Discipline Unit Review',
    'DISCIPLINE_MANAGER_APPROVAL': 'Discipline Manager Approval',
    'COMMERCIAL_REVIEW': 'Commercial Review',
    'COMMERCIAL_APPROVED': 'Commercial Approved',
    'MATERIAL_DELIVERY': 'Material Delivery',
    'MATERIAL_RECEIVED': 'Material Received',
    'CLOSED': 'Closed',
    'COMPLETED': 'Completed',
    'REJECTED': 'Rejected'
  };
  return stageMap[stage] || stage || 'Submitted';
}

function getWorkflowStageBadgeClass(stage) {
  if (!stage) return 'badge-pending';
  if (stage === 'COMPLETED') return 'badge-completed';
  if (stage === 'REJECTED') return 'badge-rejected';
  if (stage.includes('REVIEW') || stage.includes('APPROVAL')) return 'badge-pending';
  return 'badge-pending';
}

function renderRequests(requests) {
  const tbody = document.getElementById('requestsTableBody');
  
  tbody.innerHTML = requests.map((request) => {
    const workflowStage = request.workflow_stage || 'REQUESTOR_SUBMITTED';
    const stageName = getWorkflowStageName(workflowStage);
    const stageBadgeClass = getWorkflowStageBadgeClass(workflowStage);
    
    return `
      <tr>
        <td><strong>${request.mrf_number}</strong></td>
        <td>${app.formatDate(request.request_date)}</td>
        <td>${request.discipline}</td>
        <td style="text-align: center;">${request.line_items_count || 0}</td>
        <td><span class="badge ${app.getPriorityBadgeClass(request.criticality)}">${request.criticality}</span></td>
        <td><span class="badge ${app.getStatusBadgeClass(request.status)}">${request.status}</span></td>
        <td><span class="badge ${stageBadgeClass}" title="${workflowStage}">${stageName}</span></td>
        <td>
          <button onclick="viewRequest(${request.id})" class="btn btn-sm btn-outline">View</button>
          ${workflowStage === 'MATERIAL_DELIVERY' ? `
            <button onclick="openMaterialDeliveryModal(${request.id})" class="btn btn-sm btn-primary" style="margin-left: 0.5rem; background: #10b981;">
              📦 Review Delivery
            </button>
          ` : ''}
        </td>
      </tr>
    `;
  }).join('');
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
      workerCurrentFilters.status = e.target.value;
    } else {
      delete workerCurrentFilters.status;
    }
    loadRequests(1);
  });
  
  document.getElementById('filterPriority').addEventListener('change', (e) => {
    if (e.target.value) {
      workerCurrentFilters.criticality = e.target.value;
    } else {
      delete workerCurrentFilters.criticality;
    }
    loadRequests(1);
  });
  
  const searchInput = document.getElementById('searchInput');
  searchInput.addEventListener('input', app.debounce((e) => {
    if (e.target.value.trim()) {
      workerCurrentFilters.material = e.target.value.trim();
    } else {
      delete workerCurrentFilters.material;
    }
    loadRequests(1);
  }, 500));
}

function viewRequest(requestId) {
  window.location.href = `/request-detail.html?id=${requestId}`;
}

// Open material delivery modal for requestor to acknowledge receipt
// This should open a modal on the worker dashboard, not redirect
async function openMaterialDeliveryModal(requestId) {
  // Check if approval modal functions are available (they should be loaded via script tag)
  if (typeof openApprovalModal === 'function') {
    // Open the approval modal directly
    await openApprovalModal(requestId);
  } else {
    // Fallback: redirect if modal functions not available
    console.warn('Approval modal functions not available, redirecting...');
    window.location.href = `/approval-dashboard.html?requestId=${requestId}`;
  }
}