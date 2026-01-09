// frontend/assets/js/warehouse-receipts.js
// Warehouse Receipts Management

let currentPage = 1;
let warehouses = [];
let receiptLineItems = [];

document.addEventListener('DOMContentLoaded', () => {
  if (!app.requireAuth() || !app.requireRole('admin')) return;
  
  loadWarehouses();
  loadReceipts();
  setupReceiptForm();
  
  // Set default date to today
  document.getElementById('received_date').valueAsDate = new Date();
});

async function loadWarehouses() {
  try {
    const response = await app.api.get('/inventory/warehouses');
    warehouses = response.warehouses;
    
    const warehouseSelect = document.getElementById('warehouse_id');
    const filterWarehouseSelect = document.getElementById('filterWarehouse');
    
    warehouses.forEach(wh => {
      const option1 = document.createElement('option');
      option1.value = wh.id;
      option1.textContent = `${wh.warehouse_code} - ${wh.warehouse_name}`;
      warehouseSelect.appendChild(option1);
      
      const option2 = document.createElement('option');
      option2.value = wh.id;
      option2.textContent = `${wh.warehouse_code} - ${wh.warehouse_name}`;
      filterWarehouseSelect.appendChild(option2);
    });
  } catch (error) {
    console.error('Load warehouses error:', error);
    app.showAlert('Failed to load warehouses', 'error');
  }
}

function showNewReceiptForm() {
  document.getElementById('newReceiptForm').style.display = 'block';
  document.getElementById('newReceiptForm').scrollIntoView({ behavior: 'smooth' });
  addReceiptLineItem();
}

function cancelReceiptForm() {
  document.getElementById('newReceiptForm').style.display = 'none';
  document.getElementById('receiptForm').reset();
  receiptLineItems = [];
  document.getElementById('receiptItemsContainer').innerHTML = '';
}

function addReceiptLineItem() {
  const itemId = Date.now();
  receiptLineItems.push({
    id: itemId,
    material_description: '',
    oem_model: '',
    part_number: '',
    quantity_received: '',
    quantity_unit: 'pcs',
    condition: 'Good',
    shelf_location: '',
    remarks: ''
  });
  
  renderReceiptLineItems();
}

function removeReceiptLineItem(itemId) {
  receiptLineItems = receiptLineItems.filter(item => item.id !== itemId);
  renderReceiptLineItems();
}

function renderReceiptLineItems() {
  const container = document.getElementById('receiptItemsContainer');
  container.innerHTML = '';
  
  receiptLineItems.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'line-item-row';
    row.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center;">
        <span style="font-weight: 600; color: #00205B;">${index + 1}</span>
      </div>
      <div class="form-group" style="margin: 0;">
        <label class="form-label required">Material Description</label>
        <input type="text" class="form-input" data-field="material_description" data-id="${item.id}" value="${item.material_description}" required>
      </div>
      <div class="form-group" style="margin: 0;">
        <label class="form-label">OEM/Model</label>
        <input type="text" class="form-input" data-field="oem_model" data-id="${item.id}" value="${item.oem_model}">
      </div>
      <div class="form-group" style="margin: 0;">
        <label class="form-label">Part Number</label>
        <input type="text" class="form-input" data-field="part_number" data-id="${item.id}" value="${item.part_number}">
      </div>
      <div class="form-group" style="margin: 0;">
        <label class="form-label required">Quantity</label>
        <input type="number" step="0.01" class="form-input" data-field="quantity_received" data-id="${item.id}" value="${item.quantity_received}" required>
      </div>
      <div class="form-group" style="margin: 0;">
        <label class="form-label">Unit</label>
        <input type="text" class="form-input" data-field="quantity_unit" data-id="${item.id}" value="${item.quantity_unit}">
      </div>
      <div class="form-group" style="margin: 0;">
        <label class="form-label">Shelf Location</label>
        <input type="text" class="form-input" data-field="shelf_location" data-id="${item.id}" value="${item.shelf_location}">
      </div>
      <button type="button" onclick="removeReceiptLineItem(${item.id})" class="remove-line-btn" title="Remove Item">×</button>
    `;
    container.appendChild(row);
  });
  
  // Add event listeners
  container.querySelectorAll('input').forEach(input => {
    input.addEventListener('change', (e) => {
      const itemId = parseInt(e.target.dataset.id);
      const field = e.target.dataset.field;
      const item = receiptLineItems.find(i => i.id === itemId);
      if (item) {
        item[field] = e.target.value;
      }
    });
  });
}

function setupReceiptForm() {
  document.getElementById('receiptForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (receiptLineItems.length === 0) {
      app.showAlert('Please add at least one material item', 'warning');
      return;
    }
    
    // Update line items from form
    receiptLineItems.forEach(item => {
      const row = document.querySelector(`[data-id="${item.id}"]`).closest('.line-item-row');
      if (row) {
        item.material_description = row.querySelector('[data-field="material_description"]').value;
        item.oem_model = row.querySelector('[data-field="oem_model"]').value;
        item.part_number = row.querySelector('[data-field="part_number"]').value;
        item.quantity_received = parseFloat(row.querySelector('[data-field="quantity_received"]').value);
        item.quantity_unit = row.querySelector('[data-field="quantity_unit"]').value || 'pcs';
        item.shelf_location = row.querySelector('[data-field="shelf_location"]').value;
      }
    });
    
    const formData = {
      warehouse_id: parseInt(document.getElementById('warehouse_id').value),
      request_id: document.getElementById('request_id').value ? parseInt(document.getElementById('request_id').value) : null,
      received_date: document.getElementById('received_date').value,
      received_by: document.getElementById('received_by').value,
      contractor_name: document.getElementById('contractor_name').value || null,
      delivery_note_ref: document.getElementById('delivery_note_ref').value || null,
      invoice_ref: document.getElementById('invoice_ref').value || null,
      condition: document.getElementById('condition').value,
      remarks: document.getElementById('remarks').value || null,
      items: receiptLineItems
    };
    
    try {
      app.showLoading(true);
      const response = await app.api.post('/inventory/receipts', formData);
      
      if (response.success) {
        app.showAlert('✅ Receipt created successfully!', 'success');
        cancelReceiptForm();
        loadReceipts();
      }
    } catch (error) {
      app.showAlert('Failed to create receipt: ' + error.message, 'error');
    } finally {
      app.showLoading(false);
    }
  });
}

async function loadReceipts(page = 1) {
  try {
    app.showLoading(true);
    currentPage = page;
    
    const params = {
      page,
      limit: 25
    };
    
    const warehouseId = document.getElementById('filterWarehouse').value;
    if (warehouseId) params.warehouse_id = warehouseId;
    
    const fromDate = document.getElementById('filterFromDate').value;
    if (fromDate) params.from_date = fromDate;
    
    const toDate = document.getElementById('filterToDate').value;
    if (toDate) params.to_date = toDate;
    
    const response = await app.api.get('/inventory/receipts', params);
    
    if (response.success) {
      renderReceipts(response.receipts);
      renderReceiptsPagination(response.pagination);
    }
  } catch (error) {
    console.error('Load receipts error:', error);
    app.showAlert('Failed to load receipts', 'error');
  } finally {
    app.showLoading(false);
  }
}

function renderReceipts(receipts) {
  const tbody = document.getElementById('receiptsTableBody');
  
  if (receipts.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">No receipts found</td></tr>';
    return;
  }
  
  tbody.innerHTML = receipts.map(receipt => `
    <tr>
      <td style="font-weight: 600; color: #00205B;">${receipt.receipt_number}</td>
      <td>${new Date(receipt.received_date).toLocaleDateString()}</td>
      <td>${receipt.warehouse_code}</td>
      <td>${receipt.received_by}</td>
      <td>${receipt.contractor_name || '-'}</td>
      <td>${receipt.item_count || 0} items</td>
      <td><span class="badge badge-${receipt.condition === 'Good' ? 'success' : 'warning'}">${receipt.condition}</span></td>
      <td>
        <button onclick="viewReceipt(${receipt.id})" class="btn btn-sm btn-secondary">View</button>
      </td>
    </tr>
  `).join('');
}

function renderReceiptsPagination(pagination) {
  const container = document.getElementById('receiptsPagination');
  
  if (pagination.pages <= 1) {
    container.innerHTML = '';
    return;
  }
  
  let html = '<div style="display: flex; gap: 0.5rem; justify-content: center; align-items: center; margin-top: 1rem;">';
  
  if (pagination.page > 1) {
    html += `<button onclick="loadReceipts(${pagination.page - 1})" class="btn btn-sm btn-secondary">Previous</button>`;
  }
  
  html += `<span style="padding: 0 1rem;">Page ${pagination.page} of ${pagination.pages}</span>`;
  
  if (pagination.page < pagination.pages) {
    html += `<button onclick="loadReceipts(${pagination.page + 1})" class="btn btn-sm btn-secondary">Next</button>`;
  }
  
  html += '</div>';
  container.innerHTML = html;
}

async function viewReceipt(id) {
  try {
    const response = await app.api.get(`/inventory/receipts/${id}`);
    
    if (response.success) {
      const receipt = response.receipt;
      let html = `
        <div style="padding: 2rem;">
          <h2 style="color: #00205B; margin-bottom: 1.5rem;">Receipt: ${receipt.receipt_number}</h2>
          
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 2rem;">
            <div><strong>Warehouse:</strong> ${receipt.warehouse_name}</div>
            <div><strong>Date:</strong> ${new Date(receipt.received_date).toLocaleDateString()}</div>
            <div><strong>Received By:</strong> ${receipt.received_by}</div>
            <div><strong>Contractor:</strong> ${receipt.contractor_name || '-'}</div>
            <div><strong>Condition:</strong> ${receipt.condition}</div>
            <div><strong>Items:</strong> ${receipt.items.length}</div>
          </div>
          
          <h3 style="color: #00205B; margin-bottom: 1rem;">Items</h3>
          <table class="receipts-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Material Description</th>
                <th>OEM/Model</th>
                <th>Part Number</th>
                <th>Quantity</th>
                <th>Unit</th>
                <th>Shelf Location</th>
              </tr>
            </thead>
            <tbody>
              ${receipt.items.map((item, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${item.material_description}</td>
                  <td>${item.oem_model || '-'}</td>
                  <td>${item.part_number || '-'}</td>
                  <td>${item.quantity_received}</td>
                  <td>${item.quantity_unit}</td>
                  <td>${item.shelf_location || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
      
      app.showModal('Receipt Details', html);
    }
  } catch (error) {
    app.showAlert('Failed to load receipt details', 'error');
  }
}

// Make functions globally accessible
window.addReceiptLineItem = addReceiptLineItem;
window.removeReceiptLineItem = removeReceiptLineItem;
window.showNewReceiptForm = showNewReceiptForm;
window.cancelReceiptForm = cancelReceiptForm;
window.loadReceipts = loadReceipts;
window.viewReceipt = viewReceipt;



