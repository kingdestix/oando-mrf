// frontend/assets/js/worker-dashboard.js
// Worker Dashboard - View own requests only

let currentPage = 1;
let currentFilters = {};

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
      renderRequests(data);
      renderPagination(pagination);
    }
  } catch (error) {
    app.showAlert('Failed to load requests', 'error');
  } finally {
    app.showLoading(false);
  }
}

function renderRequests(requests) {
  const tbody = document.getElementById('requestsTableBody');
  
  tbody.innerHTML = requests.map((request) => {
    return `
      <tr>
        <td><strong>${request.mrf_number}</strong></td>
        <td>${app.formatDate(request.request_date)}</td>
        <td>${request.discipline}</td>
        <td style="text-align: center;">${request.line_items_count || 0}</td>
        <td><span class="badge ${app.getPriorityBadgeClass(request.criticality)}">${request.criticality}</span></td>
        <td><span class="badge ${app.getStatusBadgeClass(request.status)}">${request.status}</span></td>
        <td>
          <button onclick="viewRequest(${request.id})" class="btn btn-sm btn-outline">View</button>
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
      currentFilters.status = e.target.value;
    } else {
      delete currentFilters.status;
    }
    loadRequests(1);
  });
  
  document.getElementById('filterPriority').addEventListener('change', (e) => {
    if (e.target.value) {
      currentFilters.criticality = e.target.value;
    } else {
      delete currentFilters.criticality;
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
}

function viewRequest(requestId) {
  window.location.href = `/request-detail.html?id=${requestId}`;
}