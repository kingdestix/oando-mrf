// frontend/assets/js/approval-dashboard.js
/**
 * Approval workflow dashboard aligned with the material request flow.
 */

let currentPage = 1;
let currentFilters = {};
let currentAction = null;
let currentRequest = null;
let approvalsCompletedToday = 0;
let currentTab = 'pending'; // 'pending', 'approved', or 'area'

const APPROVAL_LEVEL_NAMES = {
  0: 'Worker',
  1: 'Supervisor',
  2: 'Assistant Manager',
  3: 'Area Manager',
  4: 'Administrator'
};

const WORKFLOW_SEQUENCE = [
  { stage: 'REQUESTOR_SUBMITTED', label: 'Request Submitted', owner: 'Requestor' },
  { stage: 'TECHNICAL_COORDINATOR_REVIEW', label: 'Technical Coordinator Review', owner: 'Technical Coordinator' },
  { stage: 'ASSISTANT_MANAGER_REVIEW', label: 'Assistant Manager Review', owner: 'Assistant Manager' },
  { stage: 'AREA_MANAGER_REVIEW', label: 'Area Manager Review', owner: 'Area Manager' },
  { stage: 'POD_PLANNER_REVIEW', label: 'POD Planner Review', owner: 'POD Planner' },
  { stage: 'DISCIPLINE_UNIT_REVIEW', label: 'Discipline Unit Review', owner: 'Discipline Unit' },
  { stage: 'DISCIPLINE_MANAGER_APPROVAL', label: 'Discipline Manager Approval', owner: 'Discipline Manager' },
  { stage: 'COMMERCIAL_REVIEW', label: 'Commercial Review', owner: 'Discipline Unit / DODM' },
  { stage: 'COMMERCIAL_APPROVED', label: 'Commercial Approved', owner: 'DODM' },
  { stage: 'MATERIAL_DELIVERY', label: 'Material Delivery', owner: 'Discipline Unit' },
  { stage: 'MATERIAL_RECEIVED', label: 'Material Received', owner: 'Requisitor' },
  { stage: 'CLOSED', label: 'Closed', owner: 'System' }
];

const NEXT_STAGE_MAP = {
  REQUESTOR_SUBMITTED: 'TECHNICAL_COORDINATOR_REVIEW',
  TECHNICAL_COORDINATOR_REVIEW: 'ASSISTANT_MANAGER_REVIEW',
  ASSISTANT_MANAGER_REVIEW: 'AREA_MANAGER_REVIEW',
  AREA_MANAGER_REVIEW: 'POD_PLANNER_REVIEW',
  POD_PLANNER_REVIEW: 'DISCIPLINE_UNIT_REVIEW',
  DISCIPLINE_UNIT_REVIEW: 'DISCIPLINE_MANAGER_APPROVAL',
  DISCIPLINE_MANAGER_APPROVAL: 'COMPLETED'
};

// Get role-specific dashboard title
function getDashboardTitle(role) {
  const roleTitles = {
    'technical_coordinator': 'Technical Coordinator Dashboard',
    'assistant_manager': 'Assistant Manager Dashboard',
    'area_manager_land': 'Land Area Manager Dashboard',
    'area_manager_swamp': 'Swamp Area Manager Dashboard',
    'area_manager_phc': 'PHC POD Area Manager Dashboard',
    'pod_planner': 'POD Planner Dashboard',
    'discipline_unit': 'Discipline Unit - Material Requests & Commercial Processing',
    'discipline_manager': 'Discipline Manager Dashboard',
    'dodm': 'DODM - Commercial Approval Dashboard'
  };
  return roleTitles[role] || 'Approval Dashboard';
}

// Load total requests count based on role
async function loadTotalRequests() {
  try {
    const user = app.getUser();
    if (!user) return;

    // For discipline unit/manager, filter by their discipline assignment
    const params = { limit: 1 }; // We only need the count, not the actual data
    
    if ((user.role === 'discipline_unit' || user.role === 'discipline_manager') && user.discipline_assignment) {
      params.discipline = user.discipline_assignment;
    }

    const response = await app.api.get('/requests', params);
    
    if (response.success && response.pagination) {
      const totalEl = document.getElementById('statTotalRequests');
      if (totalEl) {
        totalEl.textContent = response.pagination.total || 0;
      }
    }
  } catch (error) {
    console.error('Load total requests error:', error);
    // Don't show error to user, just log it
    const totalEl = document.getElementById('statTotalRequests');
    if (totalEl) {
      totalEl.textContent = '0';
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (!app.requireAuth()) return;

  const user = app.getUser();
  
  // Update dashboard title based on role
  const titleEl = document.getElementById('dashboardTitle');
  if (titleEl && user?.role) {
    titleEl.textContent = getDashboardTitle(user.role);
  }
  
  // DODM: Customize dashboard layout
  if (user.role === 'dodm') {
    // Update title
    if (titleEl) {
      titleEl.textContent = '💰 Commercial Quotations - Pending Approval';
      titleEl.style.color = '#92400e';
    }
    
    // Hide filters for DODM (they see all quotations)
    const filtersCard = document.querySelector('.card.mb-3');
    if (filtersCard) {
      filtersCard.style.display = 'none';
    }
    
    // Hide tabs for DODM (only show pending quotations)
    const tabsContainer = document.querySelector('div[style*="border-bottom: 2px solid"]');
    if (tabsContainer) {
      tabsContainer.style.display = 'none';
    }
    
    // Hide table immediately, show card grid for DODM
    const table = document.getElementById('requestsTable');
    if (table) {
      table.style.display = 'none';
      console.log('✅ DODM: Table hidden on init');
    }
    
    // Show card container for DODM
    const cardContainer = document.getElementById('dodmQuotationsGrid');
    if (cardContainer) {
      cardContainer.style.display = 'grid';
      cardContainer.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(450px, 1fr)); gap: 1.5rem; margin-top: 1rem;';
      console.log('✅ DODM: Card grid container shown');
    } else {
      console.warn('⚠️ DODM: dodmQuotationsGrid not found in HTML');
    }
  }
  
  // Update stat labels based on role
  if (user.role === 'discipline_unit') {
    const statPendingLabel = document.getElementById('statPendingLabel');
    if (statPendingLabel) {
      statPendingLabel.textContent = 'Active Requests in My Discipline';
    }
    const statTotalLabel = document.getElementById('statTotalLabel');
    if (statTotalLabel) {
      statTotalLabel.textContent = user.discipline_assignment ? `Total ${user.discipline_assignment} Requests` : 'Total Requests';
    }
  } else if (user.role === 'discipline_manager') {
    const statTotalLabel = document.getElementById('statTotalLabel');
    if (statTotalLabel) {
      statTotalLabel.textContent = user.discipline_assignment ? `Total ${user.discipline_assignment} Requests` : 'Total Requests';
    }
  } else if (user.role === 'dodm') {
    const statPendingLabel = document.getElementById('statPendingLabel');
    if (statPendingLabel) {
      statPendingLabel.textContent = 'Pending Commercial Reviews';
    }
    const statTotalLabel = document.getElementById('statTotalLabel');
    if (statTotalLabel) {
      statTotalLabel.textContent = 'Approved Quotations';
    }
    // Add 4th stat card for total amounts
    const statsGrid = document.querySelector('.stats-grid');
    if (statsGrid && !document.getElementById('statTotalAmount')) {
      statsGrid.innerHTML += `
        <div class="stat-card">
          <div class="stat-label">Total Approved Amount (USD)</div>
          <div class="stat-value" id="statTotalAmount">$0.00</div>
        </div>
      `;
    }
    
    // Add "Approved Quotations" tab for DODM
    const tabsContainer = document.querySelector('div[style*="border-bottom: 2px solid"]');
    if (tabsContainer) {
      const approvedTab = document.createElement('button');
      approvedTab.id = 'dodmApprovedTab';
      approvedTab.onclick = () => switchDODMTab('approved');
      approvedTab.className = 'tab-button';
      approvedTab.style.cssText = 'padding: 0.75rem 1.5rem; background: #e5e5e5; color: #737373; border: none; cursor: pointer; font-weight: 600; border-radius: 0.5rem 0.5rem 0 0;';
      approvedTab.textContent = 'Approved Quotations';
      tabsContainer.querySelector('div').appendChild(approvedTab);
    }
  }
  
  // Set page header actions based on role
  const headerActions = document.getElementById('pageHeaderActions');
  if (headerActions) {
    if (user.role === 'discipline_unit' || user.role === 'discipline_manager' || user.role === 'dodm') {
      // DU, DM, and DODM stay on this page - no back button needed
      headerActions.innerHTML = `
        <button onclick="loadPendingApprovals()" class="btn btn-outline">🔄 Refresh</button>
      `;
    } else {
      headerActions.innerHTML = `
        <a href="/admin-dashboard.html" class="btn btn-outline">← Back to Overview</a>
      `;
    }
  }
  
  // Load DODM statistics
  if (user.role === 'dodm') {
    loadDODMStats();
  }

  // Show toggle for all approvers (except DODM and admin who have different views)
  const approverRoles = ['technical_coordinator', 'assistant_manager', 'area_manager_land', 'area_manager_swamp', 'area_manager_phc', 'pod_planner'];
  if (approverRoles.includes(user.role) || user.role.startsWith('area_manager_')) {
    const toggle = document.getElementById('showAllToggle');
    if (toggle) {
      toggle.style.display = 'block';
    }
  }

  // Show toggle for tech coordinators (keep for backward compatibility)
  if (user.role === 'technical_coordinator') {
    const toggle = document.getElementById('techCoordToggle');
    if (toggle) {
      toggle.style.display = 'block';
    }
  }

  // Show toggle for discipline managers
  if (user.role === 'discipline_manager') {
    const toggle = document.getElementById('disciplineManagerToggle');
    if (toggle) {
      toggle.style.display = 'block';
    }
    // Set showAll to true by default for discipline managers
    const checkbox = document.getElementById('showAllRequestsDM');
    if (checkbox) {
      checkbox.checked = true;
      currentFilters.showAll = 'true';
    }
  }

  // Show month filter for POD planners
  if (user.role === 'pod_planner') {
    const monthFilter = document.getElementById('podMonthFilter');
    if (monthFilter) {
      monthFilter.style.display = 'block';
      // Set default to current month
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const monthInput = document.getElementById('filterMonthApproval');
      if (monthInput) {
        monthInput.value = `${year}-${month}`;
        // Trigger load with current month
        currentFilters.month = `${year}-${month}`;
      }
    }
  }

  bindFilterEvents();
  bindBlanketToggle();
  // For DODM, load pending approvals immediately to show quotations
  if (user.role === 'dodm') {
    loadPendingApprovals();
  } else {
    loadPendingApprovals();
  }
  loadTotalRequests(); // Load total requests count
  
  // Check if there's a requestId in URL params (for worker dashboard redirect)
  const urlParams = new URLSearchParams(window.location.search);
  const requestId = urlParams.get('requestId');
  if (requestId) {
    // Open the approval modal for this specific request after ensuring all functions are loaded
    setTimeout(() => {
      // Ensure all functions are available before opening modal
      if (typeof openApprovalModal === 'function' && typeof rejectCommercial === 'function') {
        openApprovalModal(parseInt(requestId));
      } else {
        // Retry after a longer delay if functions aren't ready
        setTimeout(() => {
          openApprovalModal(parseInt(requestId));
        }, 1000);
      }
    }, 500);
  }
  
  // Show area requests tab for area managers
  if (user.role && user.role.startsWith('area_manager_')) {
    const areaTab = document.getElementById('areaRequestsTab');
    if (areaTab) {
      areaTab.style.display = 'block';
    }
  }
  
  // Show POD Planner 4-status tabs
  if (user.role === 'pod_planner') {
    const podTabs = ['podStatusTab1', 'podStatusTab2', 'podStatusTab3', 'podStatusTab4'];
    podTabs.forEach(tabId => {
      const tab = document.getElementById(tabId);
      if (tab) {
        tab.style.display = 'block';
      }
    });
    // Keep pending tab visible for POD Planner to route requests
    // Don't hide pendingTab - POD Planner needs it to see requests at POD_PLANNER_REVIEW stage
    // Set default to pending tab so they can see requests to route
    switchTab('pending');
  }
});

function toggleShowAll() {
  const checkbox = document.getElementById('showAllRequests');
  currentFilters.showAll = checkbox.checked ? 'true' : 'false';
  loadPendingApprovals(1);
}

function toggleShowAllDM() {
  const checkbox = document.getElementById('showAllRequestsDM');
  currentFilters.showAll = checkbox.checked ? 'true' : 'false';
  loadPendingApprovals(1);
}

// POD Planner: Switch between 4 status views
function switchPodStatus(status) {
  currentTab = 'pod_status';
  currentPage = 1;
  currentFilters.podStatus = status;
  
  // Update all POD status tabs
  const podTabs = ['podStatusTab1', 'podStatusTab2', 'podStatusTab3', 'podStatusTab4'];
  podTabs.forEach(tabId => {
    const tab = document.getElementById(tabId);
    if (tab) {
      tab.style.background = '#e5e5e5';
      tab.style.color = '#737373';
    }
  });
  
  // Activate selected tab
  let activeTabId = '';
  if (status === 'approved_mrf') activeTabId = 'podStatusTab1';
  else if (status === 'approved_commercial') activeTabId = 'podStatusTab2';
  else if (status === 'material_delivery') activeTabId = 'podStatusTab3';
  else if (status === 'material_received') activeTabId = 'podStatusTab4';
  
  const activeTab = document.getElementById(activeTabId);
  if (activeTab) {
    activeTab.style.background = '#00205B';
    activeTab.style.color = 'white';
  }
  
  loadPodStatusRequests(status, 1);
}

// Load POD Planner status-specific requests
// These show requests that POD has routed, filtered by current workflow stage
async function loadPodStatusRequests(status, page = 1) {
  try {
    app.showLoading(true);
    document.getElementById('emptyState').classList.add('hidden');
    
    // Use workflow_stage filter to get requests at specific stages
    // POD sections show requests that POD has routed (approved_by_pod_planner is set)
    let workflowStage = '';
    if (status === 'approved_mrf') {
      // Show requests after POD routing that are at COMMERCIAL_REVIEW (after DM approval)
      workflowStage = 'COMMERCIAL_REVIEW';
    } else if (status === 'approved_commercial') {
      workflowStage = 'COMMERCIAL_APPROVED';
    } else if (status === 'material_delivery') {
      workflowStage = 'MATERIAL_DELIVERY';
    } else if (status === 'material_received') {
      workflowStage = 'MATERIAL_RECEIVED';
    }
    
    // Get requests at this stage that POD has routed
    const params = { page, limit: 25, workflow_stage: workflowStage };
    const response = await app.api.get('/approval/pending', params);
    
    if (response.success) {
      const requests = response.requests || [];
      const pagination = response.pagination || { page, limit: 25, total: requests.length, totalPages: 1 };

      // Make sure table is visible
      const requestsContainer = document.getElementById('requestsContainer');
      if (requestsContainer) requestsContainer.classList.remove('hidden');
      document.getElementById('emptyState').classList.add('hidden');

      if (!requests || requests.length === 0) {
        if (requestsContainer) requestsContainer.classList.add('hidden');
        const emptyState = document.getElementById('emptyState');
        if (emptyState) {
          emptyState.classList.remove('hidden');
          const titleEl = emptyState.querySelector('.empty-state-title');
          const descEl = emptyState.querySelector('.empty-state-description');
          if (titleEl || descEl) {
            const statusLabel = status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            if (titleEl) titleEl.textContent = `No ${statusLabel} Requests`;
            if (descEl) descEl.textContent = `No requests found in ${statusLabel} status.`;
          }
        }
        const paginationEl = document.getElementById('pagination');
        if (paginationEl) paginationEl.innerHTML = '';
        return;
      }

      renderRequests(requests);
      renderPagination(pagination);
    } else {
      app.showAlert('Failed to load requests', 'error');
    }
  } catch (error) {
    console.error('Load POD status requests error:', error);
    app.showAlert('Failed to load requests', 'error');
  } finally {
    app.showLoading(false);
  }
}

// Switch between tabs
function switchTab(tab) {
  currentTab = tab;
  currentPage = 1;
  
  // Update tab buttons
  const pendingTab = document.getElementById('pendingTab');
  const approvedTab = document.getElementById('approvedTab');
  const areaTab = document.getElementById('areaRequestsTab');
  
  // For POD Planner, also update POD status tabs
  const user = app.getUser();
  if (user && user.role === 'pod_planner') {
    const podTabs = ['podStatusTab1', 'podStatusTab2', 'podStatusTab3', 'podStatusTab4'];
    podTabs.forEach(tabId => {
      const podTab = document.getElementById(tabId);
      if (podTab) {
        podTab.style.background = '#e5e5e5';
        podTab.style.color = '#737373';
      }
    });
  }
  
  if (pendingTab) {
    if (tab === 'pending') {
      pendingTab.classList.add('active');
      pendingTab.style.background = '#00205B';
      pendingTab.style.color = 'white';
    } else {
      pendingTab.classList.remove('active');
      pendingTab.style.background = '#e5e5e5';
      pendingTab.style.color = '#737373';
    }
  }
  
  if (approvedTab) {
    if (tab === 'approved') {
      approvedTab.classList.add('active');
      approvedTab.style.background = '#00205B';
      approvedTab.style.color = 'white';
    } else {
      approvedTab.classList.remove('active');
      approvedTab.style.background = '#e5e5e5';
      approvedTab.style.color = '#737373';
    }
  }
  
  if (areaTab) {
    if (tab === 'area') {
      areaTab.classList.add('active');
      areaTab.style.background = '#00205B';
      areaTab.style.color = 'white';
    } else {
      areaTab.classList.remove('active');
      areaTab.style.background = '#e5e5e5';
      areaTab.style.color = '#737373';
    }
  }
  
  // Load appropriate data
  if (tab === 'pending') {
    loadPendingApprovals(1);
  } else if (tab === 'approved') {
    loadApprovedRequests(1);
  } else if (tab === 'area') {
    loadAreaRequests(1);
  }
}

// Load approved requests
async function loadApprovedRequests(page = 1) {
  try {
    app.showLoading(true);
    document.getElementById('emptyState').classList.add('hidden');

    const params = { page, limit: 25 };
    if (currentFilters.status) params.status = currentFilters.status;
    
    const response = await app.api.get('/approval/approved', params);
    
    if (response.success) {
      const requests = response.requests || [];
      renderRequests(requests);
      renderPagination(response.pagination);
      
      if (requests.length === 0) {
        const emptyState = document.getElementById('emptyState');
        if (emptyState) {
          emptyState.classList.remove('hidden');
          const titleEl = emptyState.querySelector('.empty-state-title');
          const descEl = emptyState.querySelector('.empty-state-description');
          if (titleEl) titleEl.textContent = 'No Approved Requests';
          if (descEl) descEl.textContent = 'You haven\'t approved any requests yet.';
        }
      }
    } else {
      app.showAlert('Failed to load approved requests', 'error');
    }
  } catch (error) {
    console.error('Load approved requests error:', error);
    app.showAlert('Failed to load approved requests', 'error');
  } finally {
    app.showLoading(false);
  }
}

// Load area requests (for area managers)
async function loadAreaRequests(page = 1) {
  try {
    app.showLoading(true);
    document.getElementById('emptyState').classList.add('hidden');

    const params = { page, limit: 25 };
    if (currentFilters.status) params.status = currentFilters.status;
    
    const response = await app.api.get('/approval/area-requests', params);
    
    if (response.success) {
      const requests = response.requests || [];
      if (requests.length > 0) {
        document.getElementById('requestsContainer').classList.remove('hidden');
        document.getElementById('emptyState').classList.add('hidden');
        renderRequests(requests);
        renderPagination(response.pagination);
      } else {
        const requestsContainer = document.getElementById('requestsContainer');
        if (requestsContainer) requestsContainer.classList.add('hidden');
        const emptyState = document.getElementById('emptyState');
        if (emptyState) {
          emptyState.classList.remove('hidden');
          const titleEl = emptyState.querySelector('.empty-state-title');
          const descEl = emptyState.querySelector('.empty-state-description');
          if (titleEl) titleEl.textContent = 'No Area Requests';
          if (descEl) descEl.textContent = 'No requests found in your area.';
        }
        const paginationEl = document.getElementById('pagination');
        if (paginationEl) paginationEl.innerHTML = '';
      }
    } else {
      app.showAlert('Failed to load area requests', 'error');
      document.getElementById('requestsContainer').classList.add('hidden');
    }
  } catch (error) {
    console.error('Load area requests error:', error);
    app.showAlert('Failed to load area requests', 'error');
  } finally {
    app.showLoading(false);
  }
}

function bindFilterEvents() {
  const area = document.getElementById('filterArea');
  const discipline = document.getElementById('filterDiscipline');

  area?.addEventListener('change', () => {
    currentFilters.area = area.value;
    loadPendingApprovals(1);
  });

  discipline?.addEventListener('change', () => {
    currentFilters.discipline = discipline.value;
    loadPendingApprovals(1);
  });
}

function bindBlanketToggle() {
  const checkbox = document.getElementById('hasBlanketOrder');
  checkbox?.addEventListener('change', (e) => {
    const refInput = document.getElementById('blanketOrderRef');
    if (refInput) {
      refInput.style.display = e.target.checked ? 'block' : 'none';
      if (!e.target.checked) {
        refInput.value = '';
      }
    }
  });
}

async function loadPendingApprovals(page = 1) {
  try {
    app.showLoading(true);
    document.getElementById('emptyState').classList.add('hidden');

    const params = { page, limit: 25, ...currentFilters };
    
    // For tech coordinators and discipline managers, include showAll parameter
    const user = app.getUser();
    if (user && (user.role === 'technical_coordinator' || user.role === 'discipline_manager')) {
      let showAllCheckbox = null;
      if (user.role === 'technical_coordinator') {
        showAllCheckbox = document.getElementById('showAllRequests');
      } else if (user.role === 'discipline_manager') {
        showAllCheckbox = document.getElementById('showAllRequestsDM');
        // For discipline managers, always show all (pending + approved) by default
        params.showAll = showAllCheckbox && !showAllCheckbox.checked ? 'false' : 'true';
      } else {
        if (showAllCheckbox && showAllCheckbox.checked) {
          params.showAll = 'true';
        }
      }
    }
    
    // For POD planners, include month filter
    if (user && user.role === 'pod_planner') {
      const monthFilter = document.getElementById('filterMonthApproval');
      if (monthFilter && monthFilter.value) {
        params.month = monthFilter.value;
      }
    }
    
    console.log('Loading approvals with params:', params); // Debug log
    
    const response = await app.api.get('/approval/pending', params);
    
    // Handle both response formats: { data, pagination } or { success, requests, pagination }
    const requests = response.data || response.requests || [];
    const pagination = response.pagination || { total: 0, page: 1, totalPages: 1 };

    currentPage = page;
    const statPendingEl = document.getElementById('statPending');
    if (statPendingEl) statPendingEl.textContent = pagination.total || 0;
    const statApprovedTodayEl = document.getElementById('statApprovedToday');
    if (statApprovedTodayEl) statApprovedTodayEl.textContent = approvalsCompletedToday;

    if (!requests || requests.length === 0) {
      document.getElementById('requestsContainer').classList.add('hidden');
      document.getElementById('emptyState').classList.remove('hidden');
      document.getElementById('pagination').innerHTML = '';
      return;
    }

    document.getElementById('requestsContainer').classList.remove('hidden');
    document.getElementById('emptyState').classList.add('hidden');
    
    // For DODM, render in card layout; for others, render in table
    const currentUser = app.getUser();
    console.log('🔍 Rendering for role:', currentUser?.role, 'Requests count:', requests.length);
    if (currentUser && currentUser.role === 'dodm') {
      console.log('🔍 Calling renderDODMQuotations for DODM');
      renderDODMQuotations(requests);
    } else {
      console.log('🔍 Calling renderRequests for non-DODM');
      renderRequests(requests);
    }
    renderPagination(pagination);
  } catch (error) {
    app.showAlert('Failed to load pending approvals: ' + error.message, 'error');
  } finally {
    app.showLoading(false);
  }
}

function renderRequests(requests) {
  const tbody = document.getElementById('requestsTableBody');
  const user = app.getUser();
  
  // Ensure table is visible for non-DODM users
  const table = document.getElementById('requestsTable');
  if (table) table.style.display = 'table';
  const cardContainer = document.getElementById('dodmQuotationsGrid');
  if (cardContainer) cardContainer.style.display = 'none';
  
  tbody.innerHTML = requests.map((request) => {
    const stageBadge = getWorkflowStageBadge(request.workflow_stage);
    const requester = request.requester_name || `${request.first_name} ${request.last_name}`;
    
    // Check if already approved by current user
    let approvalStatus = '';
    let actionIndicator = '';
    
    // For Discipline Manager: Show approval status
    if (user.role === 'discipline_manager' && request.approved_by_discipline_manager) {
      const isApprovedByMe = request.approved_by_discipline_manager == user.id;
      if (isApprovedByMe) {
        approvalStatus = '<span style="color: #10b981; font-weight: 600; font-size: 0.75rem;">✓ Approved by You</span>';
      }
    }
    
    // For Discipline Unit: Show action indicators based on stage
    if (user.role === 'discipline_unit') {
      if (request.workflow_stage === 'DISCIPLINE_UNIT_REVIEW') {
        actionIndicator = '<div style="background: #dbeafe; color: #1e40af; padding: 0.375rem 0.5rem; border-radius: 0.375rem; font-size: 0.75rem; font-weight: 600; margin-top: 0.25rem; border-left: 3px solid #3b82f6;">📋 Needs Your Review</div>';
      } else if (request.workflow_stage === 'DISCIPLINE_MANAGER_APPROVAL') {
        actionIndicator = '<div style="background: #fef9c3; color: #854d0e; padding: 0.375rem 0.5rem; border-radius: 0.375rem; font-size: 0.75rem; font-weight: 600; margin-top: 0.25rem; border-left: 3px solid #eab308;">⏳ Pending DM Approval</div>';
      } else if (request.workflow_stage === 'COMMERCIAL_REVIEW') {
        // DM approved - check workflow steps
        if (!request.mrf_sent_to_contractor_date) {
          actionIndicator = '<div style="background: #fef3c7; color: #92400e; padding: 0.375rem 0.5rem; border-radius: 0.375rem; font-size: 0.75rem; font-weight: 600; margin-top: 0.25rem; border-left: 3px solid #f59e0b;">⚠️ Step 1: Send MRF to Contractor</div>';
        } else if (!request.quotation_received) {
          actionIndicator = '<div style="background: #e0f2fe; color: #0c4a6e; padding: 0.375rem 0.5rem; border-radius: 0.375rem; font-size: 0.75rem; font-weight: 600; margin-top: 0.25rem; border-left: 3px solid #0ea5e9;">📨 Step 2: Mark Quotation Received</div>';
        } else {
          actionIndicator = '<div style="background: #d1fae5; color: #065f46; padding: 0.375rem 0.5rem; border-radius: 0.375rem; font-size: 0.75rem; font-weight: 600; margin-top: 0.25rem; border-left: 3px solid #10b981;">✅ Step 3: Fill Commercial Details</div>';
        }
      } else if (request.workflow_stage === 'COMMERCIAL_APPROVED') {
        actionIndicator = '<div style="background: #d1fae5; color: #065f46; padding: 0.375rem 0.5rem; border-radius: 0.375rem; font-size: 0.75rem; font-weight: 600; margin-top: 0.25rem; border-left: 3px solid #10b981;">✅ DODM Approved - Quotation Approved - Proceed with Material Procurement</div>';
      } else if (request.workflow_stage === 'MATERIAL_DELIVERY') {
        actionIndicator = '<div style="background: #fef3c7; color: #92400e; padding: 0.375rem 0.5rem; border-radius: 0.375rem; font-size: 0.75rem; font-weight: 600; margin-top: 0.25rem; border-left: 3px solid #f59e0b;">🚚 In Transit</div>';
      } else if (request.workflow_stage === 'MATERIAL_RECEIVED') {
        actionIndicator = '<div style="background: #dcfce7; color: #166534; padding: 0.375rem 0.5rem; border-radius: 0.375rem; font-size: 0.75rem; font-weight: 600; margin-top: 0.25rem; border-left: 3px solid #22c55e;">📦 Delivered</div>';
      } else if (request.workflow_stage === 'CLOSED') {
        actionIndicator = '<div style="background: #f3f4f6; color: #374151; padding: 0.375rem 0.5rem; border-radius: 0.375rem; font-size: 0.75rem; font-weight: 600; margin-top: 0.25rem; border-left: 3px solid #6b7280;">✓ Closed</div>';
      }
    }
    
    // Determine if this user can take action based on role and stage
    let canTakeAction = false;
    if (user.role === 'discipline_manager' && request.workflow_stage === 'DISCIPLINE_MANAGER_APPROVAL') {
      canTakeAction = !request.approved_by_discipline_manager || request.approved_by_discipline_manager != user.id;
    } else if (user.role === 'discipline_unit') {
      canTakeAction = request.workflow_stage === 'DISCIPLINE_UNIT_REVIEW' || request.workflow_stage === 'COMMERCIAL_REVIEW';
    } else {
      canTakeAction = true; // Other roles can always take action at their stages
    }

    // Show MRF download button when request is past DM approval
    const showMRFButton = (
      request.workflow_stage === 'COMMERCIAL_REVIEW' || 
      request.workflow_stage === 'COMMERCIAL_APPROVED' || 
      request.workflow_stage === 'MATERIAL_DELIVERY' || 
      request.workflow_stage === 'MATERIAL_RECEIVED' || 
      request.workflow_stage === 'CLOSED' || 
      request.workflow_stage === 'COMPLETED' || 
      request.status === 'Approved'
    );

    return `
      <tr>
        <td><strong>${request.mrf_number}</strong></td>
        <td>${app.formatDate(request.request_date)}</td>
        <td>${requester}</td>
        <td>${request.asset || '-'}</td>
        <td>${request.discipline || '-'}</td>
        <td>
          <div>${stageBadge}</div>
          ${approvalStatus ? `<div style="margin-top: 0.25rem;">${approvalStatus}</div>` : ''}
          ${actionIndicator}
        </td>
        <td style="text-align:center;">${request.line_items_count || 0}</td>
        <td>
          <div class="approval-actions" style="display: flex; flex-wrap: wrap; gap: 0.25rem;">
            <button class="btn btn-sm ${canTakeAction ? 'btn-primary' : 'btn-outline'}" onclick="openApprovalModal(${request.id})">
              ${canTakeAction ? '📝 Review' : '👁️ View'}
            </button>
            ${showMRFButton ? 
              `<button class="btn btn-sm" style="background: #10b981; color: white;" onclick="downloadMRF(${request.id})" title="Download MRF PDF">
                📄 MRF
              </button>` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function getWorkflowStageBadge(stage) {
  const labels = {
    REQUESTOR_SUBMITTED: 'Request Submitted',
    TECHNICAL_COORDINATOR_REVIEW: 'Tech Coordinator',
    ASSISTANT_MANAGER_REVIEW: 'Assistant Manager',
    AREA_MANAGER_REVIEW: 'Area Manager',
    POD_PLANNER_REVIEW: 'POD Planner',
    DISCIPLINE_UNIT_REVIEW: 'Discipline Unit',
    DISCIPLINE_MANAGER_APPROVAL: 'DM Approval',
    COMMERCIAL_REVIEW: 'Commercial Review',
    COMMERCIAL_APPROVED: 'Commercial Approved',
    MATERIAL_DELIVERY: 'In Transit',
    MATERIAL_RECEIVED: 'Delivered',
    COMPLETED: 'Completed',
    REJECTED: 'Rejected',
    CLOSED: 'Closed',
    // Legacy stages (for backward compatibility)
    MRF_CREATED: 'MRF Created',
    MRF_APPROVED: 'MRF Approved',
    BLANKET_CHECK: 'Blanket Check',
    QUOTATION_REQUESTED: 'Quotation Requested',
    QUOTATION_SUBMITTED: 'Quotation Submitted',
    QUOTATION_APPROVED: 'Quotation Approved',
    QUOTATION_ACCEPTED: 'Quotation Accepted',
    PROFORMA_SUBMITTED: 'Pro Forma Submitted',
    PROFORMA_APPROVED: 'Pro Forma Approved',
    SHIPPED: 'Shipped',
    COMPLIANCE_CHECK: 'Compliance Check',
    RECEIVED: 'Received'
  };

  const classes = {
    REQUESTOR_SUBMITTED: 'stage-created',
    TECHNICAL_COORDINATOR_REVIEW: 'stage-created',
    ASSISTANT_MANAGER_REVIEW: 'stage-approved',
    AREA_MANAGER_REVIEW: 'stage-approved',
    POD_PLANNER_REVIEW: 'stage-quotation',
    DISCIPLINE_UNIT_REVIEW: 'stage-quotation',
    DISCIPLINE_MANAGER_APPROVAL: 'stage-approved',
    COMMERCIAL_REVIEW: 'stage-proforma',
    COMMERCIAL_APPROVED: 'stage-shipped',
    MATERIAL_DELIVERY: 'stage-shipped',
    MATERIAL_RECEIVED: 'stage-received',
    COMPLETED: 'stage-closed',
    REJECTED: 'stage-rejected',
    CLOSED: 'stage-closed',
    // Legacy stages
    MRF_CREATED: 'stage-created',
    MRF_APPROVED: 'stage-approved',
    BLANKET_CHECK: 'stage-blanket',
    QUOTATION_REQUESTED: 'stage-quotation',
    QUOTATION_SUBMITTED: 'stage-quotation',
    QUOTATION_APPROVED: 'stage-quotation',
    QUOTATION_ACCEPTED: 'stage-quotation',
    PROFORMA_SUBMITTED: 'stage-proforma',
    PROFORMA_APPROVED: 'stage-proforma',
    SHIPPED: 'stage-shipped',
    COMPLIANCE_CHECK: 'stage-compliance',
    RECEIVED: 'stage-received'
  };

  return `<span class="workflow-stage-badge ${classes[stage] || 'stage-created'}">${labels[stage] || stage}</span>`;
}

function renderPagination(pagination) {
  const container = document.getElementById('pagination');
  if (!container) return;

  // Backward/forward compatible pagination shape
  const page = parseInt(pagination?.page ?? 1);
  const total =
    parseInt(pagination?.total ?? pagination?.count ?? 0);
  const totalPages =
    parseInt(pagination?.totalPages ?? pagination?.pages ?? pagination?.pageCount ?? 1);

  if (totalPages <= 1) {
    container.innerHTML = total > 0 ? `<div style="text-align: center; color: #6b7280; padding: 1rem;">Showing ${total} request${total !== 1 ? 's' : ''}</div>` : '';
    return;
  }

  // Determine which function to call based on current tab
  let loadFunction = 'loadPendingApprovals';
  if (currentTab === 'pending') {
    loadFunction = 'loadPendingApprovals';
  } else if (currentTab === 'approved') {
    loadFunction = 'loadApprovedRequests';
  } else if (currentTab === 'area') {
    loadFunction = 'loadAreaRequests';
  } else if (currentTab === 'pod_status') {
    // For POD status tabs, construct the function call with status
    const status = currentFilters.podStatus || 'approved_mrf';
    loadFunction = `loadPodStatusRequests('${status}', `;
  }

  let html = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
      <div style="color: #6b7280; font-size: 0.875rem;">
        Showing ${((page - 1) * 25) + 1} - ${Math.min(page * 25, total)} of ${total} requests
      </div>
      <div style="display: flex; gap: 0.5rem;">
        <button class="pagination-btn" onclick="${loadFunction}(${page - 1})" ${page === 1 ? 'disabled' : ''}>
      ← Previous
    </button>
  `;

  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);

  for (let i = start; i <= end; i++) {
    html += `
      <button class="pagination-btn ${i === page ? 'active' : ''}" onclick="${loadFunction}(${i})">
        ${i}
      </button>
    `;
  }

  html += `
        <button class="pagination-btn" onclick="${loadFunction}(${page + 1})" ${page === totalPages ? 'disabled' : ''}>
      Next →
    </button>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

async function openApprovalModal(requestId) {
  // Check if approval modal exists FIRST (before any other operations)
  // This prevents errors when called from worker dashboard
  const approvalModal = document.getElementById('approvalModal');
  if (!approvalModal) {
      // If modal doesn't exist, redirect to approval dashboard immediately
      // Don't call any other functions that might access DOM elements
      window.location.href = `/approval-dashboard.html?requestId=${requestId}`;
      return Promise.resolve(); // Return resolved promise to prevent errors
  }

  try {
    app.showLoading(true);
    resetApprovalForm();

    const [requestResponse, historyResponse] = await Promise.all([
      app.api.get(`/requests/${requestId}`),
      app.api.get(`/approval/${requestId}/history`)
    ]);

    currentRequest = requestResponse.request;
    const history = historyResponse.history || [];

    const modalRequestId = document.getElementById('modal_request_id');
    if (modalRequestId) modalRequestId.value = requestId;
    
    const modalMrf = document.getElementById('modal_mrf');
    if (modalMrf) modalMrf.textContent = currentRequest.mrf_number;
    
    const modalStage = document.getElementById('modal_stage');
    if (modalStage) modalStage.innerHTML = getWorkflowStageBadge(currentRequest.workflow_stage);
    
    const modalRequestor = document.getElementById('modal_requestor');
    if (modalRequestor) modalRequestor.textContent = `${currentRequest.first_name} ${currentRequest.last_name}`;
    
    const modalLocation = document.getElementById('modal_location');
    if (modalLocation) modalLocation.textContent = currentRequest.asset || '-';
    
    const modalTitle = document.getElementById('modalTitle');
    if (modalTitle) modalTitle.textContent = `Approve ${currentRequest.mrf_number}`;

    const stageMeta = getStageMeta(currentRequest.workflow_stage);
    const modalStageOwner = document.getElementById('modal_stage_owner');
    if (modalStageOwner) modalStageOwner.textContent = stageMeta?.owner || 'N/A';
    
    const modalNextStage = document.getElementById('modal_next_stage');
    if (modalNextStage) modalNextStage.textContent = getStageMeta(getNextStage(currentRequest.workflow_stage))?.label || '—';

    // Show POD route section for POD Planner - ALWAYS show if POD planner and at POD stage
    const user = app.getUser();
    const podRouteSection = document.getElementById('podRouteSection');
    console.log('POD Routing Debug:', {
      userRole: user?.role,
      workflowStage: currentRequest?.workflow_stage,
      podRouteSectionExists: !!podRouteSection
    });
    
    if (podRouteSection) {
      // Show routing section if user is POD planner AND request is at POD_PLANNER_REVIEW stage
      const isPodPlanner = user?.role === 'pod_planner';
      const isAtPodStage = currentRequest?.workflow_stage === 'POD_PLANNER_REVIEW';
      const shouldShow = isPodPlanner && isAtPodStage;
      
      console.log('POD Routing Visibility:', { isPodPlanner, isAtPodStage, shouldShow });
      
      podRouteSection.style.display = shouldShow ? 'block' : 'none';
      
      // Pre-select discipline from request if available
      if (shouldShow) {
        const routeSelect = document.getElementById('routeDiscipline');
        if (routeSelect) {
          // Pre-select discipline from request if available
          if (currentRequest.discipline) {
            routeSelect.value = currentRequest.discipline;
          } else {
            routeSelect.value = ''; // Clear selection if no discipline
          }
          
          // Make the select required and add visual emphasis
          routeSelect.required = true;
          routeSelect.style.border = '2px solid #00205B';
          routeSelect.style.fontWeight = '600';
        }
        
        // Scroll to make it visible
        setTimeout(() => {
          podRouteSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
        
        // Update approve button text for POD planners
        const approveBtn = document.getElementById('approveBtn');
        if (approveBtn) {
          approveBtn.textContent = '✅ Approve & Route to Discipline';
          approveBtn.style.background = 'linear-gradient(135deg, #00205B 0%, #F58220 100%)';
        }
      } else {
        // Hide and reset if not showing
        const routeSelect = document.getElementById('routeDiscipline');
        if (routeSelect) {
          routeSelect.required = false;
          routeSelect.style.border = '';
          routeSelect.style.fontWeight = '';
        }
        
        // Reset approve button text
        const approveBtn = document.getElementById('approveBtn');
        if (approveBtn) {
          approveBtn.textContent = '✅ Approve';
          approveBtn.style.background = '';
        }
      }
    }

    // Hide discipline contract section for discipline_unit at DISCIPLINE_UNIT_REVIEW (not needed - confusing)
    // Commercial details should only appear after DM approval at COMMERCIAL_REVIEW stage
    const contractSection = document.getElementById('disciplineContractSection');
    if (contractSection) {
      contractSection.style.display = 'none'; // Always hide - commercial details handled at COMMERCIAL_REVIEW
    }
    
    // Show blanket order section for discipline unit (not POD) - only at DISCIPLINE_UNIT_REVIEW
    const blanketSection = document.getElementById('blanketOrderSection');
    if (blanketSection) {
      blanketSection.style.display = (user.role === 'discipline_unit' && currentRequest.workflow_stage === 'DISCIPLINE_UNIT_REVIEW') ? 'block' : 'none';
    }

    // Setup signature preview and removal
    setupSignatureUpload();
    
    // Show DODM commercial approval section
    const dodmSection = document.getElementById('dodmCommercialSection');
    const dodmApproveBtn = document.getElementById('dodmApproveBtn');
    const submitApprovalBtn = document.getElementById('submitApprovalBtn');
    const approvalActionsDiv = document.querySelector('.approval-actions');
    
    if (dodmSection) {
      const isDODM = user.role === 'dodm';
      const isCommercialReview = currentRequest.workflow_stage === 'COMMERCIAL_REVIEW';
      const hasCommercialDetails = currentRequest.quotation_reference && currentRequest.quotation_reference.trim() !== '';
      const shouldShow = isDODM && isCommercialReview && hasCommercialDetails;
      
      dodmSection.style.display = shouldShow ? 'block' : 'none';
      
      // Hide regular approval buttons for DODM at commercial review
      const approvalActionsDiv = document.getElementById('approvalActionsDiv');
      if (approvalActionsDiv) {
        approvalActionsDiv.style.display = shouldShow ? 'none' : 'grid';
      }
      if (submitApprovalBtn) {
        submitApprovalBtn.style.display = shouldShow ? 'none' : 'block';
      }
      
      if (shouldShow) {
        // Populate commercial details for display
        const displayContractorName = document.getElementById('displayContractorName');
        if (displayContractorName) displayContractorName.textContent = currentRequest.contractor_name || currentRequest.vendor_name || '-';
        
        const displayQuotationRef = document.getElementById('displayQuotationRef');
        if (displayQuotationRef) displayQuotationRef.textContent = currentRequest.quotation_reference || '-';
        
        const displayQuoteUSD = document.getElementById('displayQuoteUSD');
        if (displayQuoteUSD) displayQuoteUSD.textContent = currentRequest.quotation_amount_usd ? `$${parseFloat(currentRequest.quotation_amount_usd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-';
        
        const displayContractUSD = document.getElementById('displayContractUSD');
        if (displayContractUSD) displayContractUSD.textContent = currentRequest.contract_amount_usd ? `$${parseFloat(currentRequest.contract_amount_usd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-';
        
        const displayEstDelivery = document.getElementById('displayEstDelivery');
        if (displayEstDelivery) displayEstDelivery.textContent = currentRequest.estimated_delivery_date ? new Date(currentRequest.estimated_delivery_date).toLocaleDateString() : '-';
        
        // Scroll to DODM section
        setTimeout(() => {
          dodmSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    }
    
    // Show quotation received section for DU at COMMERCIAL_REVIEW
    const quotationReceivedSection = document.getElementById('quotationReceivedSection');
    if (quotationReceivedSection) {
      const isDU = user.role === 'discipline_unit';
      const isCommercialReview = currentRequest.workflow_stage === 'COMMERCIAL_REVIEW';
      const shouldShow = isDU && isCommercialReview;
      quotationReceivedSection.style.display = shouldShow ? 'block' : 'none';
      
      // Reset checkbox when modal opens
      const quotationCheckbox = document.getElementById('quotationReceivedCheckbox');
      if (quotationCheckbox) {
        // Check if quotation was already received (from database)
        quotationCheckbox.checked = currentRequest.quotation_received || false;
        // Update UI visibility without calling API
        const duCommercialDetailsSection = document.getElementById('duCommercialDetailsSection');
        if (duCommercialDetailsSection) {
          duCommercialDetailsSection.style.display = quotationCheckbox.checked ? 'block' : 'none';
        }
      }
    }
    
    // Hide old submit contractor quotation section
    const submitContractorQuotationSection = document.getElementById('submitContractorQuotationSection');
    if (submitContractorQuotationSection) {
      submitContractorQuotationSection.style.display = 'none';
    }
    
    // Show DU commercial details form section (for COMMERCIAL_REVIEW) - Only after quotation received checkbox is checked
    const duCommercialDetailsSection = document.getElementById('duCommercialDetailsSection');
    if (duCommercialDetailsSection) {
      const isDU = user.role === 'discipline_unit';
      const isCommercialReview = currentRequest.workflow_stage === 'COMMERCIAL_REVIEW';
      const quotationReceived = document.getElementById('quotationReceivedCheckbox')?.checked || currentRequest.quotation_received || false;
      
      // Only show if DU, at COMMERCIAL_REVIEW, AND quotation received checkbox is checked
      const shouldShowDetailsForm = isDU && isCommercialReview && quotationReceived;
      duCommercialDetailsSection.style.display = shouldShowDetailsForm ? 'block' : 'none';
      
      // Populate form fields if request already has some data
      if (shouldShowDetailsForm && currentRequest) {
        const contractorName = document.getElementById('duContractorName');
        if (contractorName) contractorName.value = currentRequest.contractor_name || currentRequest.vendor_name || '';
        
        const quotationRef = document.getElementById('duQuotationRef');
        if (quotationRef) quotationRef.value = currentRequest.quotation_reference || '';
        
        const quotationAmount = document.getElementById('duQuotationAmountUSD');
        if (quotationAmount) quotationAmount.value = currentRequest.quotation_amount_usd || '';
        
        const contractAmountUSD = document.getElementById('duContractAmountUSD');
        if (contractAmountUSD) contractAmountUSD.value = currentRequest.contract_amount_usd || '';
        
        const contractAmountEUR = document.getElementById('duContractAmountEUR');
        if (contractAmountEUR) contractAmountEUR.value = currentRequest.contract_amount_eur || '';
        
        const contractAmountNGN = document.getElementById('duContractAmountNGN');
        if (contractAmountNGN) contractAmountNGN.value = currentRequest.contract_amount_ngn || '';
        
        const estDelivery = document.getElementById('duEstDeliveryDate');
        if (estDelivery && currentRequest.estimated_delivery_date) {
          estDelivery.value = currentRequest.estimated_delivery_date.split('T')[0];
        }
      }
    }
    
    // Show DU commercial workflow section
    const duWorkflowSection = document.getElementById('duCommercialWorkflowSection');
    if (duWorkflowSection) {
      const isDU = user.role === 'discipline_unit';
      const isCommercialReview = currentRequest.workflow_stage === 'COMMERCIAL_REVIEW';
      const isCommercialApproved = currentRequest.workflow_stage === 'COMMERCIAL_APPROVED';
      const isMaterialDelivery = currentRequest.workflow_stage === 'MATERIAL_DELIVERY';
      
      // Show workflow section for other actions (mark sent, mark delivered, etc.)
      duWorkflowSection.style.display = (isDU && (isCommercialApproved || isMaterialDelivery)) ? 'block' : 'none';
      
      if (isDU && isCommercialReview) {
        // Show DM approval notice
        const dmApprovalNotice = document.getElementById('dmApprovalNotice');
        if (dmApprovalNotice) {
          dmApprovalNotice.style.display = 'block';
        }
        
        // Show MRF download for DU
        const mrfDownloadForDU = document.getElementById('mrfDownloadForDU');
        if (mrfDownloadForDU) {
          mrfDownloadForDU.style.display = 'block';
        }
        
        // STEP 1: Check if MRF sent to contractor checkbox needed
        const mrfSentCheckbox = document.getElementById('mrfSentToContractorSection');
        if (mrfSentCheckbox) {
          mrfSentCheckbox.style.display = !currentRequest.mrf_sent_to_contractor_date ? 'block' : 'none';
        }
        
        // STEP 2: Show quotation received checkbox only after MRF sent
        const quotationReceivedSection = document.getElementById('quotationReceivedSection');
        if (quotationReceivedSection) {
          quotationReceivedSection.style.display = currentRequest.mrf_sent_to_contractor_date && !currentRequest.quotation_received ? 'block' : 'none';
        }
        
        // STEP 3: Show commercial details form only after quotation received
        const duCommercialDetailsSection = document.getElementById('duCommercialDetailsSection');
        if (duCommercialDetailsSection) {
          duCommercialDetailsSection.style.display = currentRequest.quotation_received ? 'block' : 'none';
        }
      } else {
        // Hide all DU commercial sections if not at COMMERCIAL_REVIEW
        const dmApprovalNotice = document.getElementById('dmApprovalNotice');
        if (dmApprovalNotice) dmApprovalNotice.style.display = 'none';
        
        const mrfDownloadForDU = document.getElementById('mrfDownloadForDU');
        if (mrfDownloadForDU) mrfDownloadForDU.style.display = 'none';
        
        const mrfSentCheckbox = document.getElementById('mrfSentToContractorSection');
        if (mrfSentCheckbox) mrfSentCheckbox.style.display = 'none';
        
        const quotationReceivedSection = document.getElementById('quotationReceivedSection');
        if (quotationReceivedSection) quotationReceivedSection.style.display = 'none';
        
        const duCommercialDetailsSection = document.getElementById('duCommercialDetailsSection');
        if (duCommercialDetailsSection) duCommercialDetailsSection.style.display = 'none';
      }
      
      // Show material delivery tracking section for DU at COMMERCIAL_APPROVED or MATERIAL_DELIVERY stage
      if (user.role === 'discipline_unit' && (currentRequest.workflow_stage === 'COMMERCIAL_APPROVED' || currentRequest.workflow_stage === 'MATERIAL_DELIVERY')) {
        const duMaterialDeliverySection = document.getElementById('duMaterialDeliverySection');
        if (duMaterialDeliverySection) {
          duMaterialDeliverySection.style.display = 'block';
          
          // Show "Material Delivered by Contractor" section
          const materialDeliveredSection = document.getElementById('materialDeliveredByContractorSection');
          if (materialDeliveredSection) {
            materialDeliveredSection.style.display = 'block';
            const checkbox = document.getElementById('materialDeliveredByContractorCheckbox');
            if (checkbox) {
              checkbox.checked = currentRequest.material_delivered_to_du || false;
            }
          }
          
          // Show "Material Sent to Requestor" section only if material was delivered to DU
          const materialSentSection = document.getElementById('materialSentToRequestorSection');
          if (materialSentSection) {
            materialSentSection.style.display = currentRequest.material_delivered_to_du ? 'block' : 'none';
            const sentCheckbox = document.getElementById('materialSentToRequestorCheckbox');
            if (sentCheckbox) {
              sentCheckbox.checked = currentRequest.material_sent_to_requestor || false;
            }
          }
        }
      } else {
        const duMaterialDeliverySection = document.getElementById('duMaterialDeliverySection');
        if (duMaterialDeliverySection) duMaterialDeliverySection.style.display = 'none';
      }
      
      // Show requestor material receipt section for requestor at MATERIAL_DELIVERY stage
      const isWorker = user.role === 'worker';
      const isMaterialReadyForRequestor = currentRequest.workflow_stage === 'MATERIAL_DELIVERY' && currentRequest.material_sent_to_requestor;
      
      if (isWorker && isMaterialReadyForRequestor) {
        const requestorReceiptSection = document.getElementById('requestorMaterialReceiptSection');
        if (requestorReceiptSection) {
          requestorReceiptSection.style.display = 'block';
          
          // Populate line items for receipt acknowledgment
          setTimeout(() => {
            populateMaterialReceiptLineItems();
          }, 300);
        }
        
        // Hide approval/reject buttons for workers - they only confirm delivery
        const approvalActionsDiv = document.getElementById('approvalActionsDiv');
        if (approvalActionsDiv) {
          approvalActionsDiv.style.display = 'none';
        }
        const approveBtn = document.getElementById('approveBtn');
        if (approveBtn) approveBtn.style.display = 'none';
        
        const rejectBtn = document.querySelector('[data-action= "reject"]');
        if (rejectBtn) rejectBtn.style.display = 'none';
        
        const rescheduleBtn = document.querySelector('[data-action="reschedule"]');
        if (rescheduleBtn) rescheduleBtn.style.display = 'none';
        
        // Show MRF download for requestor (without commercial details)
        const mrfSection = document.getElementById('mrfDownloadSection');
        if (mrfSection && (currentRequest.workflow_stage === 'COMMERCIAL_REVIEW' || currentRequest.workflow_stage === 'COMMERCIAL_APPROVED' || currentRequest.workflow_stage === 'MATERIAL_DELIVERY' || currentRequest.workflow_stage === 'MATERIAL_RECEIVED')) {
          mrfSection.style.display = 'block';
        }
        
        // Update modal title for worker
        const modalTitleEl = document.getElementById('modalTitle');
        if (modalTitleEl) modalTitleEl.textContent = `Confirm Material Receipt - ${currentRequest.mrf_number}`;
      } else {
        const requestorReceiptSection = document.getElementById('requestorMaterialReceiptSection');
        if (requestorReceiptSection) requestorReceiptSection.style.display = 'none';
        
        // Show approval buttons for non-workers
        const approvalActionsSection = document.getElementById('approvalActionsSection');
        if (approvalActionsSection && !isWorker) {
          approvalActionsSection.style.display = 'block';
        }
        const approveBtn = document.getElementById('approveBtn');
        if (approveBtn && !isWorker) approveBtn.style.display = '';
        
        const rejectBtn = document.getElementById('rejectBtn');
        if (rejectBtn && !isWorker) rejectBtn.style.display = '';
        
        const rescheduleBtn = document.getElementById('rescheduleBtn');
        if (rescheduleBtn && !isWorker) rescheduleBtn.style.display = '';
      }
      
      if (isDU) {
        // Show "Mark Material Delivered" if at COMMERCIAL_APPROVED
        const markDeliveredSection = document.getElementById('markMaterialDeliveredSection');
        if (markDeliveredSection) {
          markDeliveredSection.style.display = isCommercialApproved ? 'block' : 'none';
          
          // Initialize checkbox if visible
          if (isCommercialApproved) {
            const checkbox = document.getElementById('markDeliveryCheckbox');
            if (checkbox) {
              checkbox.checked = currentRequest.material_delivered_to_du || false;
            }
          }
        }
      }
    }
    
    // Show MRF download if request is completed
    const mrfSection = document.getElementById('mrfDownloadSection');
    if (mrfSection) {
      mrfSection.style.display = (currentRequest.workflow_stage === 'CLOSED' || currentRequest.status === 'Completed') ? 'block' : 'none';
    }

    // Display attachments and remarks
    renderAttachmentsAndRemarks(currentRequest);

    renderApprovalTimeline(history);
    renderWorkflowRoadmap(currentRequest.workflow_stage);

    // Use the already-checked approvalModal variable
    if (approvalModal) {
      approvalModal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  } catch (error) {
    app.showAlert('Unable to load request details: ' + error.message, 'error');
  } finally {
    app.showLoading(false);
  }
}

function renderApprovalTimeline(history) {
  const container = document.getElementById('approvalTimeline');
  if (!container) return;

  if (!history.length) {
    container.innerHTML = `
      <div class="timeline-item">
        <div style="background:#fff;padding:0.75rem 1rem;border-radius:0.5rem;border:1px solid #e5e5e5;">
          <strong>No actions recorded yet.</strong>
          <div style="font-size:0.8125rem;color:#6b7280;">This request is waiting for its first approval.</div>
        </div>
      </div>
    `;
    return;
  }

  const sorted = [...history].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  container.innerHTML = sorted.map((entry) => {
    const timestamp = new Date(entry.created_at).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const classes = ['timeline-item'];
    if (entry.action === 'REJECTED') {
      classes.push('rejected');
    } else {
      classes.push('completed');
    }

    return `
      <div class="${classes.join(' ')}">
        <div style="background:#fff;padding:0.75rem 1rem;border-radius:0.5rem;border:1px solid #e5e5e5;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;">
            <strong style="color:#00205B;">${entry.approver_name || 'System Action'}</strong>
            <span style="font-size:0.75rem;color:#6b7280;">${timestamp}</span>
          </div>
          <div style="font-size:0.875rem;margin-top:0.25rem;">
            ${entry.action || '-'} ${entry.to_stage ? `→ ${entry.to_stage.replace(/_/g, ' ')}` : ''}
          </div>
          ${entry.comments ? `<div style="font-size:0.8125rem;color:#4b5563;margin-top:0.5rem;">${entry.comments}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function renderWorkflowRoadmap(currentStage) {
  const container = document.getElementById('workflowRoadmap');
  if (!container) return;

  const currentIndex = WORKFLOW_SEQUENCE.findIndex(step => step.stage === currentStage);
  container.innerHTML = WORKFLOW_SEQUENCE.map((step, index) => {
    const status = index < currentIndex ? 'completed' : index === currentIndex ? 'current' : 'upcoming';
    return `
      <div class="workflow-step ${status}">
        <div class="workflow-step-title">${step.label}</div>
        <div class="workflow-step-owner">${step.owner}</div>
        <div class="workflow-step-stage">${step.stage.replace(/_/g, ' ')}</div>
      </div>
    `;
  }).join('');
}

function renderAttachmentsAndRemarks(request) {
  // Handle remarks
  const remarksSection = document.getElementById('remarksSection');
  const remarksEl = document.getElementById('modal_remarks');
  const remarks = request.remarks || request.additional_remarks || request.reason || '';
  
  if (remarks && remarks.trim()) {
    if (remarksSection) remarksSection.style.display = 'block';
    if (remarksEl) remarksEl.textContent = remarks;
  } else {
    if (remarksSection) remarksSection.style.display = 'none';
  }

  // Handle attachments
  const attachmentsSection = document.getElementById('attachmentsSection');
  const attachmentsEl = document.getElementById('modal_attachments');
  const noAttachmentsMsg = document.getElementById('noAttachmentsMessage');
  
  const attachments = request.attachments || [];
  const hasAttachments = attachments.length > 0;
  const hasRemarks = remarks && remarks.trim();

  if (hasAttachments) {
    if (attachmentsSection) attachmentsSection.style.display = 'block';
    if (noAttachmentsMsg) noAttachmentsMsg.style.display = 'none';
    
    if (attachmentsEl) {
      attachmentsEl.innerHTML = attachments.map(att => {
        const fileUrl = att.file_path.startsWith('http') ? att.file_path : `${app.API_BASE.replace('/api', '')}/${att.file_path}`;
        const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(att.file_name);
        const isPdf = /\.pdf$/i.test(att.file_name);
        
        return `
          <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; background: white; border-radius: 0.375rem; border: 1px solid #d1d5db;">
            <div style="flex: 1;">
              <div style="font-weight: 600; color: #00205B; font-size: 0.875rem; margin-bottom: 0.25rem;">${att.file_name}</div>
              <div style="font-size: 0.75rem; color: #6b7280;">
                ${att.uploaded_by ? `Uploaded by: ${att.first_name || ''} ${att.last_name || ''}` : ''}
                ${att.uploaded_at ? ` • ${new Date(att.uploaded_at).toLocaleDateString()}` : ''}
                ${att.file_size ? ` • ${(att.file_size / 1024).toFixed(2)} KB` : ''}
              </div>
              ${att.notes ? `<div style="font-size: 0.75rem; color: #4b5563; margin-top: 0.25rem; font-style: italic;">${att.notes}</div>` : ''}
            </div>
            <div>
              <a href="${fileUrl}" target="_blank" class="btn btn-sm" style="background: #00205B; color: white; padding: 0.5rem 1rem; text-decoration: none; border-radius: 0.375rem;">
                ${isImage ? '🖼️ View' : isPdf ? '📄 View PDF' : '📎 Download'}
              </a>
            </div>
          </div>
        `;
      }).join('');
    }
  } else {
    if (attachmentsSection) attachmentsSection.style.display = 'none';
    if (!hasRemarks && noAttachmentsMsg) {
      noAttachmentsMsg.style.display = 'block';
    } else if (noAttachmentsMsg) {
      noAttachmentsMsg.style.display = 'none';
    }
  }
}

function closeApprovalModal() {
  document.getElementById('approvalModal')?.classList.remove('active');
  document.body.style.overflow = '';
  resetApprovalForm();
}

function setApprovalAction(action) {
  currentAction = action;
  const buttons = document.querySelectorAll('#approvalModal .approval-action-btn');
  const approveBtn = document.getElementById('approveBtn');
  
  buttons.forEach((btn) => {
    if (btn.dataset.action === action) {
      btn.classList.add('btn-selected');
      
      // Enhanced visual feedback for approve button
      if (action === 'approve' && approveBtn) {
        // Add checkmark and highlight
        approveBtn.innerHTML = '✅ <strong>APPROVE</strong> ✓ SELECTED';
        approveBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
        approveBtn.style.border = '3px solid #10b981';
        approveBtn.style.boxShadow = '0 0 0 4px rgba(16, 185, 129, 0.2), 0 4px 12px rgba(16, 185, 129, 0.4)';
        approveBtn.style.transform = 'scale(1.02)';
        approveBtn.style.fontWeight = '700';
        approveBtn.style.color = 'white';
        
        // Add pulse animation
        approveBtn.style.animation = 'pulse 2s infinite';
      } else if (action === 'reject') {
        btn.innerHTML = '❌ <strong>REJECT</strong> ✓ SELECTED';
        btn.style.border = '3px solid #ef4444';
        btn.style.boxShadow = '0 0 0 4px rgba(239, 68, 68, 0.2)';
      } else if (action === 'reschedule') {
        btn.innerHTML = '📅 <strong>RESCHEDULE</strong> ✓ SELECTED';
        btn.style.border = '3px solid #00205B';
        btn.style.boxShadow = '0 0 0 4px rgba(0, 32, 91, 0.2)';
      }
    } else {
      btn.classList.remove('btn-selected');
      // Reset button styles
      if (btn.dataset.action === 'approve') {
        btn.innerHTML = '✅ Approve';
        btn.style.background = '';
        btn.style.border = '';
        btn.style.boxShadow = '';
        btn.style.transform = '';
        btn.style.fontWeight = '';
        btn.style.animation = '';
      } else if (btn.dataset.action === 'reject') {
        btn.innerHTML = '❌ Reject';
        btn.style.border = '';
        btn.style.boxShadow = '';
      } else if (btn.dataset.action === 'reschedule') {
        btn.innerHTML = '📅 Reschedule';
        btn.style.border = '';
        btn.style.boxShadow = '';
      }
    }
  });

  document.getElementById('rescheduleSection').style.display = action === 'reschedule' ? 'block' : 'none';
  
  // Update submit button
  const submitBtn = document.getElementById('submitApprovalBtn');
  if (submitBtn) {
    if (action === 'approve') {
      submitBtn.textContent = '✅ Submit Approval';
      submitBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
      submitBtn.style.border = '2px solid #10b981';
    } else if (action === 'reject') {
      submitBtn.textContent = '❌ Submit Rejection';
      submitBtn.style.background = '#ef4444';
      submitBtn.style.border = '2px solid #ef4444';
    } else {
      submitBtn.textContent = '📅 Submit Reschedule';
      submitBtn.style.background = '';
      submitBtn.style.border = '';
    }
  }
}

async function submitApproval() {
  if (!currentRequest) {
    app.showAlert('Please select a request first.', 'warning');
    return;
  }

  if (!currentAction) {
    app.showAlert('Select an action (Approve, Reject, Reschedule).', 'warning');
    return;
  }

  if (currentAction === 'approve') {
    await handleApprove();
  } else if (currentAction === 'reject') {
    await handleReject();
  } else {
    await handleReschedule();
  }
}

async function handleApprove() {
  try {
    app.showLoading(true);
    const comments = document.getElementById('approvalComments').value.trim();
    const signatureFile = document.getElementById('approvalSignature')?.files[0];
    const user = app.getUser();
    
    // POD Planner: Route to Discipline Unit
    if (user.role === 'pod_planner' && currentRequest.workflow_stage === 'POD_PLANNER_REVIEW') {
      const selectedDiscipline = document.getElementById('routeDiscipline')?.value;
      if (!selectedDiscipline) {
        app.showAlert('⚠️ Please select a discipline unit to route this request to.', 'warning');
        app.showLoading(false);
        return;
      }
      
      // Check if user has a profile signature
      let signaturePath = null;
      if (signatureFile) {
        // Use uploaded signature if provided
        signaturePath = await uploadSignatureFile(signatureFile, user.role);
      } else if (user.signature_path) {
        // Use profile signature if available
        signaturePath = user.signature_path;
      }
      
      const routeData = {
        discipline: selectedDiscipline,
        comments: comments || `Request routed to ${selectedDiscipline} discipline unit`,
        signature_path: signaturePath
      };
      
      await app.api.post(`/approval/${currentRequest.id}/route`, routeData);
      approvalsCompletedToday += 1;
      app.showAlert(`✅ Request successfully routed to ${selectedDiscipline} Discipline Unit`, 'success');
      closeApprovalModal();
      await loadPendingApprovals(currentPage);
      return;
    }
    
    // Discipline Unit: Handle quotation upload, contract details, blanket order
    let contractData = null;
    let quotationUploaded = false;
    
    if (user.role === 'discipline_unit' && currentRequest.workflow_stage === 'DISCIPLINE_UNIT_REVIEW') {
      // Upload quotation if provided
      const quotationFile = document.getElementById('quotationFileUpload')?.files[0];
      if (quotationFile) {
        try {
          const formData = new FormData();
          formData.append('file', quotationFile);
          formData.append('category', 'quotation');
          const quotationNotes = document.getElementById('quotationNotes')?.value.trim();
          if (quotationNotes) {
            formData.append('notes', quotationNotes);
          }
          
          await app.api.upload(`/requests/${currentRequest.id}/attachments`, formData);
          quotationUploaded = true;
          document.getElementById('quotationUploadStatus').style.display = 'block';
          document.getElementById('quotationUploadStatus').textContent = '✅ Quotation uploaded successfully';
        } catch (error) {
          console.error('Quotation upload error:', error);
          app.showAlert('Warning: Quotation upload failed, but approval will continue.', 'warning');
        }
      }
      
      // Get contract details
      contractData = {
        contract_number: document.getElementById('contractNumber')?.value.trim() || null,
        contract_validity: document.getElementById('contractValidity')?.value || null,
        vendor_name: document.getElementById('vendorNameDiscipline')?.value.trim() || null,
        quotation_reference: document.getElementById('quotationReference')?.value.trim() || null,
        contract_amount_usd: parseFloat(document.getElementById('contractAmountUSD')?.value) || null,
        contract_amount_eur: parseFloat(document.getElementById('contractAmountEUR')?.value) || null,
        contract_amount_ngn: parseFloat(document.getElementById('contractAmountNGN')?.value) || null,
        quotation_amount_usd: parseFloat(document.getElementById('quotationAmountUSD')?.value) || null,
        estimated_delivery_date: document.getElementById('estimatedDeliveryDate')?.value || null
      };
      
      // Get blanket order info (for discipline unit)
      const hasBlanket = document.getElementById('disciplineBlanketOrder')?.checked || false;
      const blanketRef = document.getElementById('disciplineBlanketOrderRef')?.value.trim() || null;
      
      if (hasBlanket && !blanketRef) {
        app.showAlert('Enter the blanket order reference.', 'warning');
        app.showLoading(false);
        return;
      }
      
      // Check if user has a profile signature
      let signaturePath = null;
      if (signatureFile) {
        // Use uploaded signature if provided
        signaturePath = await uploadSignatureFile(signatureFile, user.role);
      } else if (user.signature_path) {
        // Use profile signature if available
        signaturePath = user.signature_path;
      }

    const approvalData = {
      comments: comments || null,
      signature_path: signaturePath,
        contract_details: contractData,
        has_blanket_order: hasBlanket,
        blanket_order_ref: hasBlanket ? blanketRef : null
      };
      
      try {
        const response = await app.api.post(`/approval/${currentRequest.id}/approve`, approvalData);
        
        if (response.success) {
          approvalsCompletedToday += 1;
          app.showAlert('✅ Request approved and routed to Discipline Manager', 'success');
          closeApprovalModal();
          // Reload approvals to update stats
          await loadPendingApprovals(currentPage);
        } else {
          app.showAlert('Failed to approve request: ' + (response.message || 'Unknown error'), 'error');
        }
      } catch (error) {
        console.error('Discipline unit approval error:', error);
        app.showAlert('Failed to approve request: ' + (error.message || 'Unknown error'), 'error');
      } finally {
        app.showLoading(false);
      }
      return;
    }
    
    // For other roles, use standard approval
    const hasBlanket = document.getElementById('hasBlanketOrder')?.checked || false;
    const blanketRef = document.getElementById('blanketOrderRef')?.value.trim() || null;

    if (currentRequest.workflow_stage === 'BLANKET_CHECK' && hasBlanket && !blanketRef) {
      app.showAlert('Enter the blanket order reference.', 'warning');
      app.showLoading(false);
      return;
    }

    // Check if user has a profile signature
    let signaturePath = null;
    if (signatureFile) {
      // Use uploaded signature if provided
      signaturePath = await uploadSignatureFile(signatureFile, user.role);
    } else if (user.signature_path) {
      // Use profile signature if available
      signaturePath = user.signature_path;
    }

    const approvalData = {
      comments: comments || null,
      has_blanket_order: hasBlanket,
      blanket_order_ref: hasBlanket ? blanketRef : null
    };
    
    // Only include signature_path if it was successfully uploaded
    if (signaturePath) {
      approvalData.signature_path = signaturePath;
    }
    
    // Only include contract_details if it's discipline unit
    if (contractData && Object.keys(contractData).length > 0) {
      approvalData.contract_details = contractData;
    }
    
    const response = await app.api.post(`/approval/${currentRequest.id}/approve`, approvalData);

    approvalsCompletedToday += 1;
    
    // If Discipline Manager approved and request is completed, show invoice download option
    // Note: user is already declared at the top of handleApprove function
    if (user.role === 'discipline_manager') {
      if (response.nextStage === 'COMMERCIAL_REVIEW') {
        app.showAlert('✅ Request approved successfully! Moved to Commercial Review stage. MRF PDF is now available for download.', 'success');
      } else {
        app.showAlert('✅ Request approved successfully! MRF PDF is now available for download.', 'success');
      }
      // Close modal and refresh the list
      closeApprovalModal();
      await loadPendingApprovals(currentPage);
    } else {
      app.showAlert('✅ Request approved successfully.', 'success');
      closeApprovalModal();
      await loadPendingApprovals(currentPage);
    }
  } catch (error) {
    // Enhanced error handling with detailed messages
    let errorMessage = 'Failed to approve request';
    
    if (error.message) {
      errorMessage = error.message;
      
      // Check if it's an "already approved" error
      if (error.message.includes('already been approved') || error.message.includes('already approved')) {
        errorMessage = `⚠️ ${error.message}. Please refresh the page to see the updated status.`;
        // Refresh the page after showing error
        setTimeout(() => {
          loadPendingApprovals(currentPage);
          openApprovalModal(currentRequest.id);
        }, 2000);
      } else if (error.message.includes('Cannot approve from current stage')) {
        errorMessage = `❌ ${error.message}. The request may have already been processed or is in an invalid state. Please refresh the page.`;
      } else if (error.message.includes('cannot approve requests at')) {
        errorMessage = `❌ ${error.message}. This request is not ready for your approval.`;
      }
    }
    
    app.showAlert(errorMessage, 'error');
    console.error('Approval error details:', error);
  } finally {
    app.showLoading(false);
  }
}

async function handleReject() {
  try {
    const reason = document.getElementById('approvalComments').value.trim();
    if (!reason || reason.length < 10) {
      app.showAlert('Provide a detailed rejection reason (min 10 characters).', 'warning');
      return;
    }

    app.showLoading(true);
    const user = app.getUser();
    
    // Discipline Manager uses reject-with-edit endpoint to allow requisitor editing
    let endpoint = `/approval/${currentRequest.id}/reject`;
    if (user.role === 'discipline_manager') {
      endpoint = `/approval/${currentRequest.id}/reject-with-edit`;
    }
    
    const response = await app.api.post(endpoint, { reason });
    
    if (response.success) {
      const message = user.role === 'discipline_manager' 
        ? 'Request rejected. Requisitor can now edit and resubmit.'
        : 'Request rejected.';
      app.showAlert(message, 'success');
    closeApprovalModal();
    loadPendingApprovals(currentPage);
    } else {
      app.showAlert('Failed to reject request: ' + (response.message || 'Unknown error'), 'error');
    }
  } catch (error) {
    app.showAlert('Failed to reject request: ' + error.message, 'error');
  } finally {
    app.showLoading(false);
  }
}

async function handleReschedule() {
  try {
    const reason = document.getElementById('approvalComments').value.trim();
    const newDate = document.getElementById('rescheduleDate').value;

    if (!newDate) {
      app.showAlert('Choose the new date for rescheduling.', 'warning');
      return;
    }
    if (!reason) {
      app.showAlert('Provide a short justification for the reschedule.', 'warning');
      return;
    }

    app.showLoading(true);
    await app.api.post(`/approval/${currentRequest.id}/reschedule`, {
      reason,
      new_date: newDate
    });

    app.showAlert('Request rescheduled.', 'success');
    closeApprovalModal();
    loadPendingApprovals(currentPage);
  } catch (error) {
    app.showAlert('Failed to reschedule request: ' + error.message, 'error');
  } finally {
    app.showLoading(false);
  }
}

function setupSignatureUpload() {
  const signatureInput = document.getElementById('approvalSignature');
  const removeBtn = document.getElementById('removeSignatureBtn');
  
  if (signatureInput) {
    signatureInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const preview = document.getElementById('signaturePreview');
        const previewImg = document.getElementById('signaturePreviewImg');
        const fileNameDiv = document.getElementById('signatureFileName');
        
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (e) => {
            if (preview && previewImg) {
              previewImg.src = e.target.result;
              previewImg.style.display = 'block';
              preview.style.display = 'block';
            }
          };
          reader.readAsDataURL(file);
        } else {
          // For PDF files, just show the filename
          if (preview) {
            preview.style.display = 'block';
            if (previewImg) previewImg.style.display = 'none';
          }
        }
        
        if (fileNameDiv) {
          fileNameDiv.textContent = file.name;
        }
        
        if (removeBtn) {
          removeBtn.style.display = 'block';
        }
      }
    });
  }
}

function removeSignature() {
  const signatureInput = document.getElementById('approvalSignature');
  const preview = document.getElementById('signaturePreview');
  const previewImg = document.getElementById('signaturePreviewImg');
  const fileNameDiv = document.getElementById('signatureFileName');
  const removeBtn = document.getElementById('removeSignatureBtn');
  
  if (signatureInput) {
    signatureInput.value = '';
  }
  
  if (preview) {
    preview.style.display = 'none';
  }
  
  if (previewImg) {
    previewImg.src = '';
    previewImg.style.display = 'block';
  }
  
  if (fileNameDiv) {
    fileNameDiv.textContent = '';
  }
  
  if (removeBtn) {
    removeBtn.style.display = 'none';
  }
}

function resetApprovalForm() {
  // Check if approval modal exists before trying to reset form elements
  const approvalModal = document.getElementById('approvalModal');
  if (!approvalModal) {
    // If modal doesn't exist, just reset the state variables
    currentAction = null;
    currentRequest = null;
    return;
  }

  currentAction = null;
  currentRequest = null;
  
  const approvalComments = document.getElementById('approvalComments');
  if (approvalComments) approvalComments.value = '';
  
  const rescheduleDate = document.getElementById('rescheduleDate');
  if (rescheduleDate) rescheduleDate.value = '';
  
  // Reset blanket order checkbox if it exists (for legacy support)
  const hasBlanketCheckbox = document.getElementById('hasBlanketOrder');
  if (hasBlanketCheckbox) {
    hasBlanketCheckbox.checked = false;
  }
  
  // Reset discipline blanket order checkbox
  const disciplineBlanketCheckbox = document.getElementById('disciplineBlanketOrder');
  if (disciplineBlanketCheckbox) {
    disciplineBlanketCheckbox.checked = false;
  }
  
  const refInput = document.getElementById('blanketOrderRef');
  if (refInput) {
    refInput.style.display = 'none';
    refInput.value = '';
  }
  
  const disciplineBlanketRef = document.getElementById('disciplineBlanketOrderRef');
  if (disciplineBlanketRef) {
    disciplineBlanketRef.style.display = 'none';
    disciplineBlanketRef.value = '';
  }
  
  const buttons = document.querySelectorAll('#approvalModal .approval-action-btn');
  if (buttons && buttons.length > 0) {
    buttons.forEach(btn => {
      if (btn && btn.classList) btn.classList.remove('btn-selected');
    });
  }
  
  const rescheduleSection = document.getElementById('rescheduleSection');
  if (rescheduleSection) rescheduleSection.style.display = 'none';
  
  removeSignature(); // Reset signature upload
  
  // Reset discipline contract section fields
  const contractNumber = document.getElementById('contractNumber');
  if (contractNumber) contractNumber.value = '';
  const contractValidity = document.getElementById('contractValidity');
  if (contractValidity) contractValidity.value = '';
  const vendorName = document.getElementById('vendorNameDiscipline');
  if (vendorName) vendorName.value = '';
  const quotationRef = document.getElementById('quotationReference');
  if (quotationRef) quotationRef.value = '';
  const contractAmountUSD = document.getElementById('contractAmountUSD');
  if (contractAmountUSD) contractAmountUSD.value = '';
  const contractAmountEUR = document.getElementById('contractAmountEUR');
  if (contractAmountEUR) contractAmountEUR.value = '';
  const contractAmountNGN = document.getElementById('contractAmountNGN');
  if (contractAmountNGN) contractAmountNGN.value = '';
  const quotationAmountUSD = document.getElementById('quotationAmountUSD');
  if (quotationAmountUSD) quotationAmountUSD.value = '';
  const estimatedDelivery = document.getElementById('estimatedDeliveryDate');
  if (estimatedDelivery) estimatedDelivery.value = '';
  const quotationNotes = document.getElementById('quotationNotes');
  if (quotationNotes) quotationNotes.value = '';
  const quotationFile = document.getElementById('quotationFileUpload');
  if (quotationFile) quotationFile.value = '';
  
  // Reset route discipline selector
  const routeDiscipline = document.getElementById('routeDiscipline');
  if (routeDiscipline) routeDiscipline.value = '';
}

function getStageMeta(stage) {
  return WORKFLOW_SEQUENCE.find(step => step.stage === stage);
}

// Helper function to upload signature file
async function uploadSignatureFile(signatureFile, role) {
  try {
    const formData = new FormData();
    formData.append('signature', signatureFile);
    formData.append('request_id', currentRequest.id);
    formData.append('role', role);
    
    const token = localStorage.getItem('token');
    const signatureResponse = await fetch(`${app.API_BASE}/approval/upload-signature`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    
    if (!signatureResponse.ok) {
      const errorData = await signatureResponse.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to upload signature');
    }
    
    const signatureResult = await signatureResponse.json();
    return signatureResult.signature_path;
  } catch (error) {
    console.error('Signature upload error:', error);
    app.showAlert('Warning: Signature upload failed, but approval will continue.', 'warning');
    return null;
  }
}

// Download MRF for completed requests
async function downloadMRF(id) {
  try {
    if (!id) {
      const requestId = document.getElementById('modal_request_id')?.value;
      if (requestId) {
        id = parseInt(requestId);
      } else {
        app.showAlert('Request ID not found', 'error');
        return;
      }
    }
    
    app.showLoading(true);
    const token = localStorage.getItem('token');
    const response = await fetch(`${app.API_BASE}/requests/${id}/mrf`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to download MRF');
    }
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MRF_${id}_${new Date().toISOString().split('T')[0]}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    app.showAlert('✅ MRF downloaded successfully', 'success');
  } catch (error) {
    console.error('Download MRF error:', error);
    app.showAlert('Failed to download MRF: ' + error.message, 'error');
  } finally {
    app.showLoading(false);
  }
}

function downloadMRFFromModal() {
  const requestId = document.getElementById('modal_request_id')?.value;
  if (requestId) {
    downloadMRF(parseInt(requestId));
  }
}

window.downloadMRF = downloadMRF;
window.downloadMRFFromModal = downloadMRFFromModal;

function getNextStage(stage) {
  return NEXT_STAGE_MAP[stage] || null;
}

// ===================================
// COMMERCIAL WORKFLOW FUNCTIONS
// ===================================

// DU: Mark MRF sent to contractor
async function markMRFSentToContractor() {
  try {
    if (!currentRequest) {
      app.showAlert('No request selected', 'error');
      return;
    }
    
    const contractorName = document.getElementById('contractorName').value.trim();
    const quotationDate = document.getElementById('contractorQuotationDate').value;
    
    if (!contractorName) {
      app.showAlert('Contractor name is required', 'error');
      return;
    }
    
    if (!quotationDate) {
      app.showAlert('Quotation date is required', 'error');
      return;
    }
    
    app.showLoading(true);
    const response = await app.api.post(`/approval/${currentRequest.id}/mark-sent-to-contractor`, {
      contractor_name: contractorName,
      quotation_date: quotationDate
    });
    
    if (response.success) {
      app.showAlert('MRF marked as sent to contractor', 'success');
      await openApprovalModal(currentRequest.id);
    } else {
      app.showAlert(response.message || 'Failed to mark MRF as sent', 'error');
    }
  } catch (error) {
    console.error('Mark MRF sent error:', error);
    app.showAlert('Failed to mark MRF as sent: ' + error.message, 'error');
  } finally {
    app.showLoading(false);
  }
}

// DU: Submit contractor quotation details
async function submitContractorQuotation() {
  try {
    if (!currentRequest) {
      app.showAlert('No request selected', 'error');
      return;
    }
    
    const contractDetails = {
      quotation_reference: document.getElementById('contractorQuotationRef').value.trim(),
      quotation_amount_usd: parseFloat(document.getElementById('contractorQuotationAmountUSD').value) || null,
      contract_amount_usd: parseFloat(document.getElementById('contractorContractAmountUSD').value) || null,
      contract_amount_eur: parseFloat(document.getElementById('contractorContractAmountEUR').value) || null,
      contract_amount_ngn: parseFloat(document.getElementById('contractorContractAmountNGN').value) || null,
      estimated_delivery_date: document.getElementById('contractorEstDeliveryDate').value || null
    };
    
    if (!contractDetails.quotation_reference) {
      app.showAlert('Quotation reference is required', 'error');
      return;
    }
    
    app.showLoading(true);
    
    // Upload quotation file if provided
    const quotationFile = document.getElementById('contractorQuotationFile')?.files[0];
    if (quotationFile) {
      try {
        const formData = new FormData();
        formData.append('file', quotationFile);
        formData.append('category', 'quotation');
        formData.append('status', 'pending'); // Quotation pending DODM approval
        
        const quotationNotes = document.getElementById('contractorQuotationNotes')?.value.trim();
        if (quotationNotes) {
          formData.append('notes', quotationNotes);
        }
        
        await app.api.upload(`/requests/${currentRequest.id}/attachments`, formData);
        console.log('✅ Quotation PDF uploaded successfully');
      } catch (uploadError) {
        console.error('Quotation upload error:', uploadError);
        app.showAlert('Warning: Quotation file upload failed, but will continue with details submission.', 'warning');
      }
    }
    
    const response = await app.api.post(`/approval/${currentRequest.id}/submit-contractor-quotation`, {
      contract_details: contractDetails
    });
    
    if (response.success) {
      app.showAlert('✅ Contractor quotation details submitted successfully! Quotation sent to DODM for approval.', 'success');
      await openApprovalModal(currentRequest.id);
      await loadPendingApprovals(currentPage);
    } else {
      app.showAlert(response.message || 'Failed to submit quotation', 'error');
    }
  } catch (error) {
    console.error('Submit contractor quotation error:', error);
    app.showAlert('Failed to submit quotation: ' + error.message, 'error');
  } finally {
    app.showLoading(false);
  }
}

// DODM: Approve commercial
async function approveCommercial() {
  try {
    if (!currentRequest) {
      app.showAlert('No request selected', 'error');
      return;
    }
    
    const comments = document.getElementById('commercialApprovalComments').value.trim();
    const signatureFile = document.getElementById('approvalSignature')?.files[0];
    const user = app.getUser();
    
    let signaturePath = null;
    if (signatureFile) {
      // Use uploaded signature if provided
      const formData = new FormData();
      formData.append('signature', signatureFile);
      
      const uploadResponse = await app.api.upload('/approval/upload-signature', formData);
      if (uploadResponse.success) {
        signaturePath = uploadResponse.signature_path;
      } else {
        app.showAlert('Failed to upload signature', 'error');
        return;
      }
    } else if (user && user.signature_path) {
      // Use profile signature if available
      signaturePath = user.signature_path;
    }
    
    app.showLoading(true);
    const response = await app.api.post(`/approval/${currentRequest.id}/approve-commercial`, {
      comments: comments || null,
      signature_path: signaturePath
    });
    
    if (response.success) {
      // Show success message with prominent feedback
      app.showAlert('✅ Commercial quotation approved successfully! DU has been notified and can proceed with material procurement.', 'success');
      
      // Add visual feedback to the approve button
      const approveBtn = document.getElementById('dodmApproveBtn');
      if (approveBtn) {
        approveBtn.innerHTML = '✅ Approved!';
        approveBtn.style.background = '#10b981';
        approveBtn.disabled = true;
      }
      
      // Close modal with smooth transition after showing success
      setTimeout(() => {
        closeApprovalModal();
        // Refresh dashboard to show updated list
        loadPendingApprovals(currentPage);
      }, 1500);
    } else {
      app.showAlert(response.message || 'Failed to approve commercial', 'error');
    }
  } catch (error) {
    console.error('Approve commercial error:', error);
    app.showAlert('Failed to approve commercial: ' + error.message, 'error');
  } finally {
    app.showLoading(false);
  }
}

// DODM: Reject commercial quotation
async function rejectCommercial() {
  try {
    if (!currentRequest) {
      app.showAlert('No request selected', 'error');
      return;
    }
    
    const comments = document.getElementById('commercialApprovalComments')?.value.trim();
    
    if (!comments || comments.length < 10) {
      app.showAlert('Rejection reason is required (minimum 10 characters)', 'warning');
      return;
    }
    
    if (!confirm('Are you sure you want to reject this commercial quotation?\n\nThe DU will be notified to review and resubmit with corrections.')) {
      return;
    }
    
    app.showLoading(true);
    const response = await app.api.post(`/approval/${currentRequest.id}/reject-commercial`, {
      comments: comments
    });
    
    if (response.success) {
      app.showAlert('❌ Commercial quotation rejected. DU has been notified to review and resubmit.', 'success');
      
      // Add visual feedback to the reject button
      const rejectBtn = document.getElementById('dodmRejectBtn');
      if (rejectBtn) {
        rejectBtn.innerHTML = '❌ Rejected!';
        rejectBtn.style.background = '#dc2626';
        rejectBtn.disabled = true;
      }
      
      // Close modal after showing success
      setTimeout(() => {
        closeApprovalModal();
        loadPendingApprovals(currentPage);
      }, 1500);
    } else {
      app.showAlert(response.message || 'Failed to reject commercial', 'error');
    }
  } catch (error) {
    console.error('Reject commercial error:', error);
    app.showAlert('Failed to reject commercial: ' + error.message, 'error');
  } finally {
    app.showLoading(false);
  }
}

// DU: Mark material delivered by contractor
// This function is exported as both markMaterialDelivered (for backward compatibility) and markMaterialDeliveredByContractor
async function markMaterialDeliveredByContractor() {
  try {
    if (!currentRequest) {
      app.showAlert('No request selected', 'error');
      return;
    }
    
    // Support both old and new checkbox IDs
    const checkbox = document.getElementById('materialDeliveredByContractorCheckbox') || document.getElementById('markDeliveryCheckbox');
    if (!checkbox) {
      console.error('Delivery checkbox not found');
      return;
    }
    
    // If checkbox is being checked, show confirmation dialog
    if (checkbox.checked) {
      const confirmed = confirm('Are you sure the materials have been delivered by the contractor to your unit?\n\nThis action will mark the materials as received and enable the next step.');
      if (!confirmed) {
        checkbox.checked = false;
        return;
      }
    } else {
      // If unchecking, just update without confirmation
      const confirmed = confirm('Unmark material delivery? This will hide the "Material Sent to Requestor" section.');
      if (!confirmed) {
        checkbox.checked = true;
        return;
      }
    }
    
    app.showLoading(true);
    const response = await app.api.post(`/approval/${currentRequest.id}/mark-material-delivered`, {
      material_delivered: checkbox.checked
    });
    
    if (response.success) {
      currentRequest.material_delivered_to_du = checkbox.checked;
      
      if (checkbox.checked) {
        app.showAlert('✅ Material delivery from contractor confirmed successfully!', 'success');
        
        // Show "Material Sent to Requestor" section
        const sentToRequestorSection = document.getElementById('materialSentToRequestorSection');
        if (sentToRequestorSection) {
          sentToRequestorSection.style.display = 'block';
        }
      } else {
        app.showAlert('Material delivery status updated', 'info');
        
        // Hide "Material Sent to Requestor" section
        const sentToRequestorSection = document.getElementById('materialSentToRequestorSection');
        if (sentToRequestorSection) {
          sentToRequestorSection.style.display = 'none';
        }
        const sentCheckbox = document.getElementById('materialSentToRequestorCheckbox');
        if (sentCheckbox) {
          sentCheckbox.checked = false;
        }
      }
    } else {
      checkbox.checked = !checkbox.checked; // Revert checkbox
      app.showAlert(response.message || 'Failed to mark delivery', 'error');
    }
  } catch (error) {
    console.error('Mark material delivered error:', error);
    const checkbox = document.getElementById('materialDeliveredByContractorCheckbox');
    if (checkbox) checkbox.checked = !checkbox.checked; // Revert checkbox
    app.showAlert('Failed to mark delivery: ' + error.message, 'error');
  } finally {
    app.showLoading(false);
  }
}

// DU: Mark material sent to requestor
async function markMaterialSentToRequestor() {
  try {
    if (!currentRequest) {
      app.showAlert('No request selected', 'error');
      return;
    }
    
    const checkbox = document.getElementById('materialSentToRequestorCheckbox');
    if (!checkbox) return;
    
    // If checkbox is being checked, show confirmation dialog
    if (checkbox.checked) {
      const confirmed = confirm('Are you sure the materials have been sent to the requestor?\n\nThis action will notify the requestor to acknowledge receipt of materials.');
      if (!confirmed) {
        checkbox.checked = false;
        return;
      }
    } else {
      // If unchecking, just update without closing modal
      const confirmed = confirm('Unmark material sent to requestor?');
      if (!confirmed) {
        checkbox.checked = true;
        return;
      }
    }
    
    app.showLoading(true);
    const response = await app.api.post(`/approval/${currentRequest.id}/mark-material-sent-to-requestor`, {
      material_sent: checkbox.checked ? true : false
    });
    
    if (response.success) {
      currentRequest.material_sent_to_requestor = checkbox.checked;
      
      if (checkbox.checked) {
        app.showAlert('✅ Material sent to requestor confirmed successfully! The requestor will be notified to acknowledge receipt.', 'success');
        // Don't close modal immediately - let DU see the confirmation
        setTimeout(() => {
          closeApprovalModal();
          loadPendingApprovals(currentPage);
        }, 2000);
      } else {
        app.showAlert('Material sent status updated', 'info');
      }
    } else {
      checkbox.checked = !checkbox.checked; // Revert checkbox
      app.showAlert(response.message || 'Failed to mark material sent', 'error');
    }
  } catch (error) {
    console.error('Mark material sent to requestor error:', error);
    const checkbox = document.getElementById('materialSentToRequestorCheckbox');
    if (checkbox) checkbox.checked = !checkbox.checked; // Revert checkbox
    app.showAlert('Failed to mark material sent: ' + error.message, 'error');
  } finally {
    app.showLoading(false);
  }
}

// Requestor: Acknowledge material receipt
async function acknowledgeMaterialReceipt(approved) {
  try {
    if (!currentRequest) {
      app.showAlert('No request selected', 'error');
      return;
    }
    
    const user = app.getUser();
    if (user.role !== 'worker') {
      app.showAlert('Only requestors can acknowledge material receipt', 'error');
      return;
    }
    
    // Collect received quantities for each line item
    const lineItems = [];
    const lineItemInputs = document.querySelectorAll('[data-line-id]');
    lineItemInputs.forEach(input => {
      const lineId = input.getAttribute('data-line-id');
      const receivedQty = parseFloat(input.value) || 0;
      lineItems.push({ line_id: lineId, received_quantity: receivedQty });
    });
    
    const comments = document.getElementById('materialReceiptComments')?.value.trim() || null;
    const complaintDetails = document.getElementById('deliveryComplaintDetails')?.value.trim() || null;
    const hasComplaint = approved === false && complaintDetails && complaintDetails.length >= 10;
    
    if (approved === false && (!complaintDetails || complaintDetails.length < 10)) {
      app.showAlert('Please provide complaint details (minimum 10 characters)', 'warning');
      return;
    }
    
    if (!confirm(approved 
      ? 'Confirm receipt of all materials as indicated?' 
      : 'Report this delivery issue? Your complaint will be reviewed by all approval levels.')) {
      return;
    }
    
    app.showLoading(true);
    const response = await app.api.post(`/approval/${currentRequest.id}/approve-material-delivery`, {
      approved: approved,
      comments: comments,
      line_items: lineItems,
      has_complaint: hasComplaint,
      complaint_details: complaintDetails
    });
    
    if (response.success) {
      app.showAlert(
        approved 
          ? 'Material receipt acknowledged successfully' 
          : 'Delivery complaint recorded. It will be reviewed by all approval levels.',
        'success'
      );
      closeApprovalModal();
      loadPendingApprovals(currentPage);
    } else {
      app.showAlert(response.message || 'Failed to acknowledge receipt', 'error');
    }
  } catch (error) {
    console.error('Acknowledge material receipt error:', error);
    app.showAlert('Failed to acknowledge receipt: ' + error.message, 'error');
  } finally {
    app.showLoading(false);
  }
}

// Show complaint form (simplified)
function showComplaintForm() {
  const section = document.getElementById('complaintFormSection');
  if (section) {
    section.style.display = 'block';
    section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// Hide complaint form
function hideComplaintForm() {
  const section = document.getElementById('complaintFormSection');
  if (section) {
    section.style.display = 'none';
    // Clear form
    const complaintDetails = document.getElementById('deliveryComplaintDetails');
    const comments = document.getElementById('materialReceiptComments');
    if (complaintDetails) complaintDetails.value = '';
    if (comments) comments.value = '';
  }
}

// Toggle complaint details section (legacy - kept for compatibility)
function toggleComplaintDetails() {
  const checkbox = document.getElementById('hasDeliveryComplaint');
  if (checkbox) {
    if (checkbox.checked) {
      showComplaintForm();
    } else {
      hideComplaintForm();
    }
  }
}

// Populate line items for material receipt acknowledgment
async function populateMaterialReceiptLineItems() {
  try {
    if (!currentRequest) {
      console.warn('No current request available for populating line items');
      return;
    }
    
    const lineItemsContainer = document.getElementById('materialReceiptLineItems');
    if (!lineItemsContainer) {
      console.warn('materialReceiptLineItems container not found');
      return;
    }
    
    // Show loading state
    lineItemsContainer.innerHTML = '<div style="text-align: center; padding: 2rem; color: #737373;">Loading line items...</div>';
    
    // Fetch line items for this request
    const response = await app.api.get(`/requests/${currentRequest.id}`);
    
    if (response.success && response.data) {
      const lineItems = response.data.line_items || [];
      
      if (lineItems.length === 0) {
        lineItemsContainer.innerHTML = '<div style="text-align: center; padding: 2rem; color: #737373;">No line items found for this request.</div>';
        return;
      }
      
      lineItemsContainer.innerHTML = lineItems.map((item, index) => {
        const requestedQty = parseFloat(item.quantity) || 0;
        const receivedQty = parseFloat(item.received_quantity) || 0;
        const unit = item.quantity_unit || 'pcs';
        
        return `
          <div style="padding: 1rem; background: white; border-radius: 0.375rem; border: 1px solid #e5e5e5; margin-bottom: 0.75rem;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
              <div style="flex: 1;">
                <div style="font-weight: 600; color: #00205B; margin-bottom: 0.25rem; font-size: 0.9375rem;">${item.material_description || 'Item ' + (index + 1)}</div>
                ${item.part_number ? `<div style="font-size: 0.8125rem; color: #737373; margin-bottom: 0.25rem;">Part #: ${item.part_number}</div>` : ''}
                <div style="font-size: 0.8125rem; color: #737373; margin-top: 0.25rem;">
                  <strong>Requested:</strong> ${requestedQty.toFixed(2)} ${unit}
                </div>
              </div>
            </div>
            <div class="form-group" style="margin-top: 0.75rem;">
              <label class="form-label" style="font-weight: 600;">Quantity Received *</label>
              <input type="number" 
                     data-line-id="${item.id}" 
                     class="form-input" 
                     min="0" 
                     step="0.01" 
                     value="${receivedQty > 0 ? receivedQty : requestedQty}" 
                     placeholder="Enter received quantity"
                     required>
              <small style="color: #737373; font-size: 0.8125rem;">Enter the actual quantity received for this item (Requested: ${requestedQty.toFixed(2)} ${unit})</small>
            </div>
          </div>
        `;
      }).join('');
    } else {
      lineItemsContainer.innerHTML = '<div style="text-align: center; padding: 2rem; color: #ef4444;">Failed to load line items. Please try again.</div>';
    }
  } catch (error) {
    console.error('Populate material receipt line items error:', error);
    const lineItemsContainer = document.getElementById('materialReceiptLineItems');
    if (lineItemsContainer) {
      lineItemsContainer.innerHTML = '<div style="text-align: center; padding: 2rem; color: #ef4444;">Error loading line items: ' + error.message + '</div>';
    }
  }
}

window.openApprovalModal = openApprovalModal;
window.closeApprovalModal = closeApprovalModal;
window.setApprovalAction = setApprovalAction;
window.submitApproval = submitApproval;
window.removeSignature = removeSignature;
window.toggleShowAllDM = toggleShowAllDM;
window.markMRFSentToContractor = markMRFSentToContractor;
// DU: Submit commercial details (simplified version for the new form)
async function submitDUCommercialDetails() {
  if (!currentRequest) {
    app.showAlert('No request selected', 'error');
    return;
  }
  
  const contractorName = document.getElementById('duContractorName')?.value.trim();
  const quotationRef = document.getElementById('duQuotationRef')?.value.trim();
  const quotationAmountUSD = document.getElementById('duQuotationAmountUSD')?.value;
  const contractAmountUSD = document.getElementById('duContractAmountUSD')?.value;
  const contractAmountEUR = document.getElementById('duContractAmountEUR')?.value;
  const contractAmountNGN = document.getElementById('duContractAmountNGN')?.value;
  const estDeliveryDate = document.getElementById('duEstDeliveryDate')?.value;
  const quotationFile = document.getElementById('duQuotationFile')?.files[0];
  const quotationNotes = document.getElementById('duQuotationNotes')?.value.trim();
  
  // Validation
  if (!contractorName) {
    app.showAlert('Contractor/Vendor name is required', 'error');
    return;
  }
  
  if (!quotationRef) {
    app.showAlert('Quotation reference is required', 'error');
    return;
  }
  
  if (!quotationAmountUSD || parseFloat(quotationAmountUSD) <= 0) {
    app.showAlert('Quotation amount (USD) is required', 'error');
    return;
  }
  
  if (!quotationFile) {
    app.showAlert('Please upload the quotation PDF scan', 'error');
    return;
  }
  
  // Get submit button and disable it, show loading state
  const submitBtn = document.querySelector('button[onclick="submitDUCommercialDetails()"]');
  const originalBtnText = submitBtn ? submitBtn.textContent : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.6';
    submitBtn.style.cursor = 'not-allowed';
    submitBtn.innerHTML = '⏳ Submitting...';
  }
  
  app.showLoading(true);
  
  try {
      // Upload quotation file first
      try {
        const formData = new FormData();
        formData.append('file', quotationFile);
        formData.append('category', 'quotation');
        formData.append('status', 'pending'); // Quotation pending DODM approval
        
        if (quotationNotes) {
          formData.append('notes', quotationNotes);
        }
        
        await app.api.upload(`/requests/${currentRequest.id}/attachments`, formData);
        console.log('✅ Quotation PDF uploaded successfully');
      } catch (uploadError) {
        console.error('Quotation upload error:', uploadError);
        app.showAlert('Failed to upload quotation file: ' + uploadError.message, 'error');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.style.opacity = '1';
          submitBtn.style.cursor = 'pointer';
          submitBtn.textContent = originalBtnText;
        }
        app.showLoading(false);
        return;
      }
      
      // Submit commercial details
      const contractDetails = {
        vendor_name: contractorName,
        quotation_reference: quotationRef,
        quotation_amount_usd: parseFloat(quotationAmountUSD),
        contract_amount_usd: contractAmountUSD ? parseFloat(contractAmountUSD) : null,
        contract_amount_eur: contractAmountEUR ? parseFloat(contractAmountEUR) : null,
        contract_amount_ngn: contractAmountNGN ? parseFloat(contractAmountNGN) : null,
        estimated_delivery_date: estDeliveryDate || null
      };
      
      const response = await app.api.post(`/approval/${currentRequest.id}/submit-contractor-quotation`, {
        contract_details: contractDetails,
        quotation_received: true // Mark quotation as received when submitting
      });
      
      if (response.success) {
        // Show success state on button
        if (submitBtn) {
          submitBtn.innerHTML = '✅ Submitted Successfully!';
          submitBtn.style.background = '#10b981';
          submitBtn.style.color = 'white';
        }
        
        app.showAlert('✅ Commercial details submitted successfully! Quotation sent to DODM for approval.', 'success');
        
        // Close modal and refresh after short delay
        setTimeout(async () => {
          closeApprovalModal();
          await loadPendingApprovals(currentPage);
        }, 1500);
      } else {
        app.showAlert(response.message || 'Failed to submit commercial details', 'error');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.style.opacity = '1';
          submitBtn.style.cursor = 'pointer';
          submitBtn.textContent = originalBtnText;
        }
      }
    } catch (error) {
      console.error('Submit DU commercial details error:', error);
      app.showAlert('Failed to submit commercial details: ' + error.message, 'error');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
        submitBtn.style.cursor = 'pointer';
        submitBtn.textContent = originalBtnText;
      }
    } finally {
      app.showLoading(false);
    }
}

// STEP 1: Mark MRF as sent to contractor
async function markMRFSent() {
  const checkbox = document.getElementById('mrfSentCheckbox');
  if (!checkbox || !checkbox.checked || !currentRequest) return;
  
  try {
    app.showLoading(true);
    const response = await app.api.post(`/approval/${currentRequest.id}/mark-sent-to-contractor`, {
      mrf_sent: true
    });
    
    if (response.success) {
      app.showAlert('✅ MRF marked as sent to contractor', 'success');
      // Reload modal to show next step
      await openApprovalModal(currentRequest.id);
    }
  } catch (error) {
    console.error('Mark MRF sent error:', error);
    app.showAlert('Failed to save: ' + error.message, 'error');
    checkbox.checked = false;
  } finally {
    app.showLoading(false);
  }
}

// STEP 2: Mark quotation as received
// Flag to prevent infinite loops
let isUpdatingQuotationStatus = false;

async function markQuotationReceived() {
  const checkbox = document.getElementById('quotationReceivedCheckbox');
  if (!checkbox || !currentRequest || isUpdatingQuotationStatus) return;
  
  // Only allow Discipline Unit to mark quotation received
  const user = app.getUser();
  if (user && user.role !== 'discipline_unit') {
    checkbox.checked = !checkbox.checked; // Revert checkbox
    app.showAlert('Only Discipline Unit can mark quotation received', 'warning');
    return;
  }
  
  // Check if request is at the correct stage
  if (currentRequest.workflow_stage !== 'COMMERCIAL_REVIEW') {
    checkbox.checked = !checkbox.checked; // Revert checkbox
    app.showAlert(`Cannot mark quotation received. Request must be at COMMERCIAL_REVIEW stage. Current stage: ${currentRequest.workflow_stage}`, 'warning');
    return;
  }
  
  isUpdatingQuotationStatus = true;
  
  try {
    app.showLoading(true);
    const response = await app.api.post(`/approval/${currentRequest.id}/mark-quotation-received`, {
      quotation_received: checkbox.checked
    });
    
    if (response.success) {
      // Update current request state
      currentRequest.quotation_received = checkbox.checked;
      
      // Update UI without reloading modal
      const duCommercialDetailsSection = document.getElementById('duCommercialDetailsSection');
      if (duCommercialDetailsSection) {
        duCommercialDetailsSection.style.display = checkbox.checked ? 'block' : 'none';
      }
      
      if (checkbox.checked) {
        app.showAlert('Quotation status updated. Commercial details form is now available.', 'success');
      }
    }
  } catch (error) {
    console.error('Mark quotation received error:', error);
    app.showAlert('Failed to update quotation status: ' + error.message, 'error');
    checkbox.checked = !checkbox.checked; // Revert checkbox
  } finally {
    app.showLoading(false);
    isUpdatingQuotationStatus = false;
  }
}

// Legacy function for compatibility - just updates UI, doesn't call API
function toggleQuotationDetailsForm() {
  const checkbox = document.getElementById('quotationReceivedCheckbox');
  if (!checkbox || !currentRequest) return;
  
  // Only update UI visibility, don't call API
  const duCommercialDetailsSection = document.getElementById('duCommercialDetailsSection');
  if (duCommercialDetailsSection) {
    duCommercialDetailsSection.style.display = checkbox.checked ? 'block' : 'none';
  }
}

// Export functions to window for global access
window.markMRFSent = markMRFSent;
window.markQuotationReceived = markQuotationReceived;
window.toggleQuotationDetailsForm = toggleQuotationDetailsForm;
window.submitContractorQuotation = submitContractorQuotation;
window.submitDUCommercialDetails = submitDUCommercialDetails;
window.approveCommercial = approveCommercial;
window.rejectCommercial = rejectCommercial;
window.switchDODMTab = switchDODMTab;
// Keep old function name for backward compatibility with HTML
window.markMaterialDelivered = markMaterialDeliveredByContractor;
window.markMaterialDeliveredByContractor = markMaterialDeliveredByContractor;
window.markMaterialSentToRequestor = markMaterialSentToRequestor;
window.acknowledgeMaterialReceipt = acknowledgeMaterialReceipt;
window.toggleComplaintDetails = toggleComplaintDetails;
window.showComplaintForm = showComplaintForm;
window.hideComplaintForm = hideComplaintForm;
window.populateMaterialReceiptLineItems = populateMaterialReceiptLineItems;

// DODM: Switch between pending and approved tabs
function switchDODMTab(tab) {
  window.currentDODMTab = tab;
  
  // Update tab buttons
  const pendingTab = document.getElementById('pendingTab');
  const approvedTab = document.getElementById('approvedTab');
  
  if (pendingTab && approvedTab) {
    if (tab === 'pending') {
      pendingTab.style.background = '#00205B';
      pendingTab.style.color = 'white';
      approvedTab.style.background = '#e5e5e5';
      approvedTab.style.color = '#737373';
      loadPendingApprovals(currentPage);
    } else {
      approvedTab.style.background = '#00205B';
      approvedTab.style.color = 'white';
      pendingTab.style.background = '#e5e5e5';
      pendingTab.style.color = '#737373';
      loadDODMApproved(currentPage);
    }
  }
}

// DODM: Load approved quotations
async function loadDODMApproved(page = 1) {
  try {
    app.showLoading(true);
    const response = await app.api.get('/dodm/approved', { page, limit: 25 });
    
    if (response.success) {
      renderDODMQuotations(response.data || []);
    } else {
      app.showAlert('Failed to load approved quotations', 'error');
    }
  } catch (error) {
    console.error('Load DODM approved error:', error);
    app.showAlert('Failed to load approved quotations', 'error');
  } finally {
    app.showLoading(false);
  }
}

// DODM: Render quotations in card layout
function renderDODMQuotations(requests) {
  console.log('🔍 renderDODMQuotations called with', requests.length, 'requests');
  const container = document.getElementById('requestsContainer');
  const user = app.getUser();
  
  // Store current tab for rendering logic
  window.currentDODMTab = window.currentDODMTab || 'pending';
  
  if (!container) {
    console.error('❌ requestsContainer not found!');
    return;
  }
  
  // Hide table, show card grid
  const table = document.getElementById('requestsTable');
  if (table) {
    table.style.display = 'none';
    console.log('✅ Table hidden');
  } else {
    console.warn('⚠️ requestsTable not found, trying querySelector');
    const tableAlt = container.querySelector('table');
    if (tableAlt) {
      tableAlt.style.display = 'none';
      console.log('✅ Table hidden via querySelector');
    }
  }
  
  // Get or create card container
  let cardContainer = document.getElementById('dodmQuotationsGrid');
  if (!cardContainer) {
    cardContainer = document.createElement('div');
    cardContainer.id = 'dodmQuotationsGrid';
    cardContainer.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(450px, 1fr)); gap: 1.5rem; margin-top: 1rem;';
    container.appendChild(cardContainer);
    console.log('✅ Created dodmQuotationsGrid container');
  } else {
    cardContainer.style.display = 'grid';
    console.log('✅ Using existing dodmQuotationsGrid container');
  }
  
  if (requests.length === 0) {
    cardContainer.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; background: white; border-radius: 0.5rem; border: 2px dashed #e5e5e5;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">✅</div>
        <div style="font-size: 1.25rem; font-weight: 600; color: #00205B; margin-bottom: 0.5rem;">No Quotations Pending Approval</div>
        <div style="color: #737373;">All commercial quotations have been reviewed.</div>
      </div>
    `;
    return;
  }
  
  cardContainer.innerHTML = requests.map((request) => {
    const requester = request.requester_name || `${request.first_name} ${request.last_name}`;
    const quotationUSD = request.quotation_amount_usd ? parseFloat(request.quotation_amount_usd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
    const quotationEUR = request.quotation_amount_eur ? parseFloat(request.quotation_amount_eur).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
    const quotationNGN = request.quotation_amount_ngn ? parseFloat(request.quotation_amount_ngn).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
    const contractUSD = request.contract_amount_usd ? parseFloat(request.contract_amount_usd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
    const contractEUR = request.contract_amount_eur ? parseFloat(request.contract_amount_eur).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
    const contractNGN = request.contract_amount_ngn ? parseFloat(request.contract_amount_ngn).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
    const estDelivery = request.estimated_delivery_date ? new Date(request.estimated_delivery_date).toLocaleDateString() : 'Not specified';
    const submittedDate = request.updated_at ? new Date(request.updated_at).toLocaleDateString() : '-';
    const approvedDate = request.commercial_approved_date ? new Date(request.commercial_approved_date).toLocaleDateString() : '-';
    const isApprovedView = window.currentDODMTab === 'approved';
    const cardBorderColor = isApprovedView ? '#10b981' : '#f59e0b';
    const cardBgColor = isApprovedView ? '#f0fdf4' : '#fef3c7';
    const statusColor = isApprovedView ? '#065f46' : '#92400e';
    
    return `
      <div class="quotation-card" style="background: white; border-radius: 0.75rem; border: 2px solid ${cardBorderColor}; padding: 1.5rem; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 12px rgba(0,0,0,0.15)'" onmouseout="this.style.transform=''; this.style.boxShadow='0 4px 6px rgba(0,0,0,0.1)'">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 2px solid ${cardBgColor};">
          <div>
            <div style="font-size: 0.75rem; color: ${statusColor}; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem;">${isApprovedView ? 'Quotation Approved' : 'Quotation Pending Approval'}</div>
            <div style="font-size: 1.25rem; font-weight: 700; color: #00205B;">${request.mrf_number}</div>
            <div style="font-size: 0.875rem; color: #737373; margin-top: 0.25rem;">${isApprovedView ? `Approved: ${approvedDate}` : `Submitted: ${submittedDate}`}</div>
          </div>
          <div style="background: ${cardBgColor}; color: ${statusColor}; padding: 0.5rem 0.75rem; border-radius: 0.5rem; font-weight: 600; font-size: 0.75rem;">${isApprovedView ? '✅ APPROVED' : '💰 AWAITING REVIEW'}</div>
        </div>
        
        <!-- Request Details -->
        <div style="margin-bottom: 1rem;">
          <div style="font-size: 0.75rem; color: #6b7280; font-weight: 600; text-transform: uppercase; margin-bottom: 0.5rem;">Request Information</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; font-size: 0.875rem;">
            <div>
              <div style="color: #6b7280;">Requestor:</div>
              <div style="color: #00205B; font-weight: 600;">${requester}</div>
            </div>
            <div>
              <div style="color: #6b7280;">Location:</div>
              <div style="color: #00205B; font-weight: 600;">${request.asset || '-'}</div>
            </div>
            <div>
              <div style="color: #6b7280;">Discipline:</div>
              <div style="color: #00205B; font-weight: 600;">${request.discipline || '-'}</div>
            </div>
            <div>
              <div style="color: #6b7280;">Line Items:</div>
              <div style="color: #00205B; font-weight: 600;">${request.line_items_count || 0}</div>
            </div>
          </div>
        </div>
        
        <!-- Quotation Details -->
        <div style="background: ${cardBgColor}; border-radius: 0.5rem; padding: 1rem; margin-bottom: 1rem; border-left: 4px solid ${cardBorderColor};">
          <div style="font-size: 0.75rem; color: ${statusColor}; font-weight: 700; text-transform: uppercase; margin-bottom: 0.75rem; letter-spacing: 0.05em;">📋 Quotation Details</div>
          <div style="display: grid; gap: 0.75rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid rgba(146, 64, 14, 0.1);">
              <div style="color: ${statusColor}; font-weight: 600; font-size: 0.875rem;">Contractor/Vendor:</div>
              <div style="color: #00205B; font-weight: 700; font-size: 0.9375rem;">${request.contractor_name || request.vendor_name || '-'}</div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid rgba(146, 64, 14, 0.1);">
              <div style="color: ${statusColor}; font-weight: 600; font-size: 0.875rem;">Quotation Reference:</div>
              <div style="color: #00205B; font-weight: 700; font-size: 0.9375rem;">${request.quotation_reference || '-'}</div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem; margin-top: 0.5rem;">
              <div style="background: white; padding: 0.75rem; border-radius: 0.375rem; border: 1px solid rgba(146, 64, 14, 0.2);">
                <div style="font-size: 0.75rem; color: ${statusColor}; font-weight: 600; margin-bottom: 0.25rem;">Quotation (USD)</div>
                <div style="font-size: 1.125rem; color: #00205B; font-weight: 700;">$${quotationUSD}</div>
              </div>
              <div style="background: white; padding: 0.75rem; border-radius: 0.375rem; border: 1px solid rgba(146, 64, 14, 0.2);">
                <div style="font-size: 0.75rem; color: ${statusColor}; font-weight: 600; margin-bottom: 0.25rem;">Quotation (EUR)</div>
                <div style="font-size: 1.125rem; color: #00205B; font-weight: 700;">€${quotationEUR}</div>
              </div>
              <div style="background: white; padding: 0.75rem; border-radius: 0.375rem; border: 1px solid rgba(146, 64, 14, 0.2);">
                <div style="font-size: 0.75rem; color: ${statusColor}; font-weight: 600; margin-bottom: 0.25rem;">Quotation (NGN)</div>
                <div style="font-size: 1.125rem; color: #00205B; font-weight: 700;">₦${quotationNGN}</div>
              </div>
            </div>
            ${contractUSD !== '-' || contractEUR !== '-' || contractNGN !== '-' ? `
            <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid rgba(146, 64, 14, 0.2);">
              <div style="font-size: 0.75rem; color: ${statusColor}; font-weight: 600; margin-bottom: 0.5rem;">Contract Amounts:</div>
              <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem;">
                ${contractUSD !== '-' ? `<div style="font-size: 0.8125rem; color: #00205B;"><strong>USD:</strong> $${contractUSD}</div>` : ''}
                ${contractEUR !== '-' ? `<div style="font-size: 0.8125rem; color: #00205B;"><strong>EUR:</strong> €${contractEUR}</div>` : ''}
                ${contractNGN !== '-' ? `<div style="font-size: 0.8125rem; color: #00205B;"><strong>NGN:</strong> ₦${contractNGN}</div>` : ''}
              </div>
            </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; margin-top: 0.5rem; border-top: 1px solid rgba(146, 64, 14, 0.2);">
              <div style="color: ${statusColor}; font-weight: 600; font-size: 0.875rem;">Estimated Delivery:</div>
              <div style="color: #00205B; font-weight: 600; font-size: 0.9375rem;">${estDelivery}</div>
            </div>
          </div>
        </div>
        
        <!-- Actions -->
        <div style="display: flex; gap: 0.75rem;">
          ${isApprovedView ? `
          <button onclick="openApprovalModal(${request.id})" class="btn" style="flex: 1; background: #00205B; color: white; font-weight: 600; padding: 0.75rem; border-radius: 0.5rem; cursor: pointer; border: none; font-size: 0.9375rem;">
            📋 View Details
          </button>
          ` : `
          <button onclick="openApprovalModal(${request.id})" class="btn" style="flex: 1; background: #10b981; color: white; font-weight: 600; padding: 0.75rem; border-radius: 0.5rem; cursor: pointer; border: none; font-size: 0.9375rem;">
            ✅ Review & Approve Quotation
          </button>
          `}
          <button onclick="downloadMRF(${request.id})" class="btn btn-outline" style="padding: 0.75rem 1rem; border-radius: 0.5rem; cursor: pointer; font-size: 0.875rem;">
            📄 View MRF
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Load DODM Statistics
async function loadDODMStats() {
  try {
    const response = await app.api.get('/dodm/stats');
    if (response.success && response.stats) {
      const stats = response.stats;
      document.getElementById('statPending').textContent = stats.pending_reviews || 0;
      document.getElementById('statApprovedToday').textContent = stats.total_approved || 0;
      document.getElementById('statTotalRequests').textContent = stats.approved_quotations || 0;
      const totalAmountEl = document.getElementById('statTotalAmount');
      if (totalAmountEl) {
        totalAmountEl.textContent = `$${stats.total_amount_usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
    }
  } catch (error) {
    console.error('Load DODM stats error:', error);
  }
}