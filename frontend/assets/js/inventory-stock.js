// frontend/assets/js/inventory-stock.js
// Inventory Stock Management

let warehouses = [];

document.addEventListener('DOMContentLoaded', () => {
  if (!app.requireAuth() || !app.requireRole('admin')) return;
  
  loadWarehouses();
  loadStock();
  setupEditStockForm();
});

async function loadWarehouses() {
  try {
    const response = await app.api.get('/inventory/warehouses');
    warehouses = response.warehouses;
    
    const warehouseSelect = document.getElementById('filterWarehouse');
    
    warehouses.forEach(wh => {
      const option = document.createElement('option');
      option.value = wh.id;
      option.textContent = `${wh.warehouse_code} - ${wh.warehouse_name}`;
      warehouseSelect.appendChild(option);
    });
  } catch (error) {
    console.error('Load warehouses error:', error);
  }
}

async function loadStock() {
  try {
    app.showLoading(true);
    
    const params = {};
    
    const warehouseId = document.getElementById('filterWarehouse').value;
    if (warehouseId) params.warehouse_id = warehouseId;
    
    const search = document.getElementById('searchMaterial').value;
    if (search) params.search = search;
    
    const lowStockOnly = document.getElementById('lowStockOnly').checked;
    if (lowStockOnly) params.low_stock_only = 'true';
    
    const response = await app.api.get('/inventory/stock', params);
    
    if (response.success) {
      renderStock(response.stock);
    }
  } catch (error) {
    console.error('Load stock error:', error);
    app.showAlert('Failed to load inventory stock', 'error');
  } finally {
    app.showLoading(false);
  }
}

function renderStock(stock) {
  const tbody = document.getElementById('stockTableBody');
  
  if (stock.length === 0) {
    tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; padding: 2rem;">No stock items found</td></tr>';
    return;
  }
  
  tbody.innerHTML = stock.map(item => {
    const available = parseFloat(item.quantity_available);
    const reorderLevel = item.reorder_level ? parseFloat(item.reorder_level) : null;
    const isLow = reorderLevel && available <= reorderLevel;
    const isZero = available === 0;
    
    let rowClass = '';
    if (isZero) rowClass = 'stock-zero';
    else if (isLow) rowClass = 'stock-low';
    
    return `
      <tr class="${rowClass}">
        <td>${item.warehouse_code}</td>
        <td style="font-weight: 600; color: #00205B;">${item.material_description}</td>
        <td>${item.oem_model || '-'}</td>
        <td>${item.part_number || '-'}</td>
        <td style="font-weight: 700; color: ${isZero ? '#ef4444' : isLow ? '#f59e0b' : '#10b981'};">
          ${app.formatNumber(available)}
        </td>
        <td>${item.quantity_unit}</td>
        <td>${reorderLevel ? app.formatNumber(reorderLevel) : '-'}</td>
        <td>${item.shelf_location || '-'}</td>
        <td>${item.last_received_date ? new Date(item.last_received_date).toLocaleDateString() : '-'}</td>
        <td>${item.last_issued_date ? new Date(item.last_issued_date).toLocaleDateString() : '-'}</td>
        <td>
          <button onclick="editStockItem(${item.id}, '${item.material_description.replace(/'/g, "\\'")}', ${available}, ${reorderLevel || 'null'}, '${(item.shelf_location || '').replace(/'/g, "\\'")}', '${(item.remarks || '').replace(/'/g, "\\'")}')" class="btn btn-sm btn-secondary edit-stock-btn">Edit</button>
        </td>
      </tr>
    `;
  }).join('');
}

function editStockItem(id, materialDesc, availableQty, reorderLevel, shelfLocation, remarks) {
  document.getElementById('editStockId').value = id;
  document.getElementById('editMaterialDesc').value = materialDesc;
  document.getElementById('editAvailableQty').value = availableQty;
  document.getElementById('editReorderLevel').value = reorderLevel || '';
  document.getElementById('editShelfLocation').value = shelfLocation || '';
  document.getElementById('editRemarks').value = remarks || '';
  
  document.getElementById('editStockModal').style.display = 'flex';
}

function closeEditStockModal() {
  document.getElementById('editStockModal').style.display = 'none';
  document.getElementById('editStockForm').reset();
}

function setupEditStockForm() {
  document.getElementById('editStockForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = document.getElementById('editStockId').value;
    const data = {
      reorder_level: document.getElementById('editReorderLevel').value || null,
      shelf_location: document.getElementById('editShelfLocation').value || null,
      remarks: document.getElementById('editRemarks').value || null
    };
    
    try {
      app.showLoading(true);
      const response = await app.api.put(`/inventory/stock/${id}`, data);
      
      if (response.success) {
        app.showAlert('✅ Stock item updated successfully!', 'success');
        closeEditStockModal();
        loadStock();
      }
    } catch (error) {
      app.showAlert('Failed to update stock item: ' + error.message, 'error');
    } finally {
      app.showLoading(false);
    }
  });
  
  // Close modal on background click
  document.getElementById('editStockModal').addEventListener('click', (e) => {
    if (e.target.id === 'editStockModal') {
      closeEditStockModal();
    }
  });
}

// Make functions globally accessible
window.loadStock = loadStock;
window.editStockItem = editStockItem;
window.closeEditStockModal = closeEditStockModal;

