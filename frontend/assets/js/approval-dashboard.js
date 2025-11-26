// frontend/assets/js/approval-dashboard.js
/**
 * Approval workflow dashboard aligned with the material request flow.
 */

let currentPage = 1;
let currentFilters = {};
let currentAction = null;
let currentRequest = null;
let approvalsCompletedToday = 0;

const APPROVAL_LEVEL_NAMES = {
  0: 'Worker',
  1: 'Supervisor',
  2: 'Assistant Manager',
  3: 'Area Manager',
  4: 'Administrator'
};

const WORKFLOW_SEQUENCE = [
  { stage: 'MRF_CREATED', label: 'MRF Check', owner: 'Maintenance Discipline SPV/Coord.' },
  { stage: 'MRF_APPROVED', label: 'Area/Deputy Manager Sign-off', owner: 'Maintenance Assistant Manager' },
  { stage: 'BLANKET_CHECK', label: 'Blanket / Contract Check', owner: 'PHC Discipline Responsible' },
  { stage: 'QUOTATION_REQUESTED', label: 'Quotation Request', owner: 'PHC POD (DODM/MM)' },
  { stage: 'QUOTATION_SUBMITTED', label: 'Quotation Submission', owner: 'Contractor' },
  { stage: 'QUOTATION_APPROVED', label: 'Quotation Approval', owner: 'PHC POD Management' },
  { stage: 'QUOTATION_ACCEPTED', label: 'Quotation Acceptance', owner: 'Maintenance Lead' },
  { stage: 'PROFORMA_SUBMITTED', label: 'Pro Forma Review', owner: 'Contractor' },
  { stage: 'PROFORMA_APPROVED', label: 'Pro Forma Approval', owner: 'PHC POD Management' },
  { stage: 'SHIPPED', label: 'Materials Shipment', owner: 'Contractor' },
  { stage: 'COMPLIANCE_CHECK', label: 'Material Compliance', owner: 'Material Specialist' },
  { stage: 'RECEIVED', label: 'Materials Received', owner: 'Maintenance Team' },
  { stage: 'CLOSED', label: 'MRF Closed', owner: 'System' }
];

const NEXT_STAGE_MAP = {
  MRF_CREATED: 'MRF_APPROVED',
  MRF_APPROVED: 'BLANKET_CHECK',
  BLANKET_CHECK: 'QUOTATION_REQUESTED',
  QUOTATION_REQUESTED: 'QUOTATION_SUBMITTED',
  QUOTATION_SUBMITTED: 'QUOTATION_APPROVED',
  QUOTATION_APPROVED: 'QUOTATION_ACCEPTED',
  QUOTATION_ACCEPTED: 'PROFORMA_SUBMITTED',
  PROFORMA_SUBMITTED: 'PROFORMA_APPROVED',
  PROFORMA_APPROVED: 'SHIPPED',
  SHIPPED: 'COMPLIANCE_CHECK',
  COMPLIANCE_CHECK: 'RECEIVED',
  RECEIVED: 'CLOSED'
};

document.addEventListener('DOMContentLoaded', () => {
  if (!app.requireAuth()) return;

  const user = app.getUser();
  const levelEl = document.getElementById('statApprovalLevel');
  if (levelEl) {
    levelEl.textContent = APPROVAL_LEVEL_NAMES[user?.approval_level || 0];
  }

  bindFilterEvents();
  bindBlanketToggle();
  loadPendingApprovals();
});

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
    const { data, pagination } = await app.api.get('/approval/pending', params);

    currentPage = page;
    document.getElementById('statPending').textContent = pagination.total;
    document.getElementById('statApprovedToday').textContent = approvalsCompletedToday;

    if (!data.length) {
      document.getElementById('requestsContainer').classList.add('hidden');
      document.getElementById('emptyState').classList.remove('hidden');
      document.getElementById('pagination').innerHTML = '';
      return;
    }

    document.getElementById('requestsContainer').classList.remove('hidden');
    renderRequests(data);
    renderPagination(pagination);
  } catch (error) {
    app.showAlert('Failed to load pending approvals: ' + error.message, 'error');
  } finally {
    app.showLoading(false);
  }
}

function renderRequests(requests) {
  const tbody = document.getElementById('requestsTableBody');
  tbody.innerHTML = requests.map((request) => {
    const stageBadge = getWorkflowStageBadge(request.workflow_stage);
    const requester = request.requester_name || `${request.first_name} ${request.last_name}`;

    return `
      <tr>
        <td><strong>${request.mrf_number}</strong></td>
        <td>${app.formatDate(request.request_date)}</td>
        <td>${requester}</td>
        <td>${request.asset || '-'}</td>
        <td>${request.discipline || '-'}</td>
        <td>${stageBadge}</td>
        <td style="text-align:center;">${request.line_items_count || 0}</td>
        <td>
          <div class="approval-actions">
            <button class="btn btn-sm btn-primary" onclick="openApprovalModal(${request.id})">
              Review
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function getWorkflowStageBadge(stage) {
  const labels = {
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
    RECEIVED: 'Received',
    CLOSED: 'Closed',
    REJECTED: 'Rejected'
  };

  const classes = {
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
    RECEIVED: 'stage-received',
    CLOSED: 'stage-closed',
    REJECTED: 'stage-rejected'
  };

  return `<span class="workflow-stage-badge ${classes[stage] || 'stage-created'}">${labels[stage] || stage}</span>`;
}

function renderPagination(pagination) {
  const container = document.getElementById('pagination');
  const { page, totalPages } = pagination;

  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = `
    <button class="pagination-btn" onclick="loadPendingApprovals(${page - 1})" ${page === 1 ? 'disabled' : ''}>
      ← Previous
    </button>
  `;

  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);

  for (let i = start; i <= end; i++) {
    html += `
      <button class="pagination-btn ${i === page ? 'active' : ''}" onclick="loadPendingApprovals(${i})">
        ${i}
      </button>
    `;
  }

  html += `
    <button class="pagination-btn" onclick="loadPendingApprovals(${page + 1})" ${page === totalPages ? 'disabled' : ''}>
      Next →
    </button>
  `;

  container.innerHTML = html;
}

async function openApprovalModal(requestId) {
  try {
    app.showLoading(true);
    resetApprovalForm();

    const [requestResponse, historyResponse] = await Promise.all([
      app.api.get(`/requests/${requestId}`),
      app.api.get(`/approval/${requestId}/history`)
    ]);

    currentRequest = requestResponse.request;
    const history = historyResponse.history || [];

    document.getElementById('modal_request_id').value = requestId;
    document.getElementById('modal_mrf').textContent = currentRequest.mrf_number;
    document.getElementById('modal_stage').innerHTML = getWorkflowStageBadge(currentRequest.workflow_stage);
    document.getElementById('modal_requestor').textContent = `${currentRequest.first_name} ${currentRequest.last_name}`;
    document.getElementById('modal_location').textContent = currentRequest.asset || '-';
    document.getElementById('modalTitle').textContent = `Approve ${currentRequest.mrf_number}`;

    const stageMeta = getStageMeta(currentRequest.workflow_stage);
    document.getElementById('modal_stage_owner').textContent = stageMeta?.owner || 'N/A';
    document.getElementById('modal_next_stage').textContent = getStageMeta(getNextStage(currentRequest.workflow_stage))?.label || '—';

    const blanketSection = document.getElementById('blanketOrderSection');
    if (blanketSection) {
      blanketSection.style.display = currentRequest.workflow_stage === 'BLANKET_CHECK' ? 'block' : 'none';
    }

    renderApprovalTimeline(history);
    renderWorkflowRoadmap(currentRequest.workflow_stage);

    document.getElementById('approvalModal').classList.add('active');
    document.body.style.overflow = 'hidden';
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

function closeApprovalModal() {
  document.getElementById('approvalModal')?.classList.remove('active');
  document.body.style.overflow = '';
  resetApprovalForm();
}

function setApprovalAction(action) {
  currentAction = action;
  const buttons = document.querySelectorAll('#approvalModal .approval-action-btn');
  buttons.forEach((btn) => {
    if (btn.dataset.action === action) {
      btn.classList.add('btn-selected');
    } else {
      btn.classList.remove('btn-selected');
    }
  });

  document.getElementById('rescheduleSection').style.display = action === 'reschedule' ? 'block' : 'none';
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
    const hasBlanket = document.getElementById('hasBlanketOrder').checked;
    const blanketRef = document.getElementById('blanketOrderRef').value.trim();

    if (currentRequest.workflow_stage === 'BLANKET_CHECK' && hasBlanket && !blanketRef) {
      app.showAlert('Enter the blanket order reference.', 'warning');
      return;
    }

    await app.api.post(`/approval/${currentRequest.id}/approve`, {
      comments: comments || null,
      has_blanket_order: hasBlanket,
      blanket_order_ref: hasBlanket ? blanketRef : null
    });

    approvalsCompletedToday += 1;
    app.showAlert('Request approved successfully.', 'success');
    closeApprovalModal();
    loadPendingApprovals(currentPage);
  } catch (error) {
    app.showAlert('Failed to approve request: ' + error.message, 'error');
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
    await app.api.post(`/approval/${currentRequest.id}/reject`, { reason });
    app.showAlert('Request rejected.', 'success');
    closeApprovalModal();
    loadPendingApprovals(currentPage);
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

function resetApprovalForm() {
  currentAction = null;
  currentRequest = null;
  document.getElementById('approvalComments').value = '';
  document.getElementById('rescheduleDate').value = '';
  document.getElementById('hasBlanketOrder').checked = false;
  const refInput = document.getElementById('blanketOrderRef');
  if (refInput) {
    refInput.style.display = 'none';
    refInput.value = '';
  }
  const buttons = document.querySelectorAll('#approvalModal .approval-action-btn');
  buttons.forEach(btn => btn.classList.remove('btn-selected'));
  document.getElementById('rescheduleSection').style.display = 'none';
}

function getStageMeta(stage) {
  return WORKFLOW_SEQUENCE.find(step => step.stage === stage);
}

function getNextStage(stage) {
  return NEXT_STAGE_MAP[stage] || null;
}

window.openApprovalModal = openApprovalModal;
window.closeApprovalModal = closeApprovalModal;
window.setApprovalAction = setApprovalAction;
window.submitApproval = submitApproval;
