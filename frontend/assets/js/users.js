// frontend/assets/js/users.js
let allUsers = [];
let editingUserId = null;

document.addEventListener('DOMContentLoaded', () => {
  if (!app.requireAuth()) return;
  
  // Allow admin and pod_planner to access users page
  const user = app.getUser();
  if (!user || (user.role !== 'admin' && user.role !== 'pod_planner')) {
    app.showAlert('Access denied. Admin or POD Planner access required.', 'error');
    setTimeout(() => {
      window.location.href = user?.role === 'admin' ? '/admin-dashboard.html' : '/approval-dashboard.html';
    }, 1500);
    return;
  }
  
  loadUsers();
});

async function loadUsers() {
  try {
    const role = document.getElementById('roleFilter').value;
    const status = document.getElementById('statusFilter').value;
    
    const response = await app.api.get('/admin/users', { role, is_active: status === 'active' ? true : status === 'inactive' ? false : undefined });
    allUsers = response.users;
    renderUsers(allUsers);
  } catch (error) {
    app.showAlert('Failed to load users: ' + error.message, 'error');
  }
}

function renderUsers(users) {
  const tbody = document.getElementById('usersTableBody');
  
  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center">No users found</td></tr>';
    return;
  }
  
  tbody.innerHTML = users.map(user => `
    <tr>
      <td><strong>${user.user_id}</strong></td>
      <td>${user.first_name} ${user.last_name}</td>
      <td>${user.email}</td>
      <td><span class="badge ${getRoleBadgeClass(user.role)}">${user.role}</span></td>
      <td>${user.department || '-'}</td>
      <td>${user.location || '-'}</td>
      <td>
        <span class="badge ${user.is_active ? 'badge-approved' : 'badge-rejected'}">
          ${user.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td>
        <button onclick="editUser(${user.id})" class="btn btn-sm btn-outline">Edit</button>
        <button onclick="toggleUserStatus(${user.id}, ${!user.is_active})" class="btn btn-sm ${user.is_active ? 'btn-danger' : 'btn-success'}">
          ${user.is_active ? 'Deactivate' : 'Activate'}
        </button>
        <button onclick="resetPassword(${user.id})" class="btn btn-sm btn-outline">Reset Password</button>
      </td>
    </tr>
  `).join('');
}

function getRoleBadgeClass(role) {
  const roleClasses = {
    'admin': 'badge-urgent',
    'pod_planner': 'badge-urgent',
    'discipline_manager': 'badge-high',
    'area_manager_land': 'badge-high',
    'area_manager_swamp': 'badge-high',
    'area_manager_phc': 'badge-high',
    'assistant_manager': 'badge-high',
    'discipline_unit': 'badge-medium',
    'technical_coordinator': 'badge-medium',
    'manager': 'badge-high',
    'worker': 'badge-medium'
  };
  return roleClasses[role] || 'badge-medium';
}

function updateRoleFields() {
  const role = document.getElementById('role').value;
  const disciplineRow = document.getElementById('disciplineAssignmentRow');
  const areaRow = document.getElementById('areaAssignmentRow');
  const disciplineSelect = document.getElementById('discipline_assignment');
  const areaSelect = document.getElementById('area_assignment');
  
  // Show discipline assignment for discipline_unit and discipline_manager
  if (role === 'discipline_unit' || role === 'discipline_manager') {
    disciplineRow.style.display = 'flex';
    disciplineSelect.required = true;
  } else {
    disciplineRow.style.display = 'none';
    disciplineSelect.required = false;
    disciplineSelect.value = '';
  }
  
  // Show area assignment for area managers
  if (role === 'area_manager_land' || role === 'area_manager_swamp' || role === 'area_manager_phc') {
    areaRow.style.display = 'flex';
    // Auto-set based on role
    if (role === 'area_manager_land') areaSelect.value = 'Land Area';
    if (role === 'area_manager_swamp') areaSelect.value = 'Swamp Area';
    if (role === 'area_manager_phc') areaSelect.value = 'PHC POD';
  } else {
    areaRow.style.display = 'none';
    areaSelect.value = '';
  }
}

function searchUsers() {
  const searchTerm = document.getElementById('searchInput').value.toLowerCase();
  const filtered = allUsers.filter(user => 
    user.user_id.toLowerCase().includes(searchTerm) ||
    user.first_name.toLowerCase().includes(searchTerm) ||
    user.last_name.toLowerCase().includes(searchTerm) ||
    user.email.toLowerCase().includes(searchTerm)
  );
  renderUsers(filtered);
}

function showAddUserModal() {
  editingUserId = null;
  document.getElementById('modalTitle').textContent = 'Add User';
  document.getElementById('userForm').reset();
  document.getElementById('userId').value = '';
  document.getElementById('passwordGroup').style.display = 'block';
  document.getElementById('password').required = true;
  document.getElementById('user_id').disabled = false;
  document.getElementById('email').disabled = false;
  document.getElementById('disciplineAssignmentRow').style.display = 'none';
  document.getElementById('areaAssignmentRow').style.display = 'none';
  document.getElementById('userModal').classList.remove('hidden');
}

async function editUser(id) {
  try {
    const user = allUsers.find(u => u.id === id);
    if (!user) return;
    
    editingUserId = id;
    document.getElementById('modalTitle').textContent = 'Edit User';
    document.getElementById('userId').value = id;
    document.getElementById('user_id').value = user.user_id;
    document.getElementById('email').value = user.email;
    document.getElementById('first_name').value = user.first_name;
    document.getElementById('last_name').value = user.last_name;
    document.getElementById('role').value = user.role;
    document.getElementById('designation').value = user.designation || '';
    document.getElementById('department').value = user.department || '';
    document.getElementById('location').value = user.location || '';
    document.getElementById('discipline_assignment').value = user.discipline_assignment || '';
    document.getElementById('area_assignment').value = user.area_assignment || '';
    document.getElementById('passwordGroup').style.display = 'none';
    document.getElementById('password').required = false;
    document.getElementById('user_id').disabled = true;
    document.getElementById('email').disabled = true;
    
    // Update role fields visibility
    updateRoleFields();
    
    document.getElementById('userModal').classList.remove('hidden');
  } catch (error) {
    app.showAlert('Failed to load user details', 'error');
  }
}

async function saveUser() {
  try {
    const userData = {
      user_id: document.getElementById('user_id').value,
      email: document.getElementById('email').value,
      first_name: document.getElementById('first_name').value,
      last_name: document.getElementById('last_name').value,
      role: document.getElementById('role').value,
      designation: document.getElementById('designation').value,
      department: document.getElementById('department').value,
      location: document.getElementById('location').value
    };
    
    // Add discipline assignment if applicable
    const disciplineAssignment = document.getElementById('discipline_assignment').value;
    if (disciplineAssignment) {
      userData.discipline_assignment = disciplineAssignment;
    }
    
    // Add area assignment if applicable
    const areaAssignment = document.getElementById('area_assignment').value;
    if (areaAssignment) {
      userData.area_assignment = areaAssignment;
    }
    
    const password = document.getElementById('password').value;
    if (password) {
      if (password.length < 6) {
        app.showAlert('Password must be at least 6 characters', 'error');
        return;
      }
      userData.password = password;
    }
    
    if (editingUserId) {
      await app.api.put(`/admin/users/${editingUserId}`, userData);
      app.showAlert('User updated successfully', 'success');
    } else {
      if (!password) {
        app.showAlert('Password is required for new users', 'error');
        return;
      }
      if (!userData.role) {
        app.showAlert('Please select a role', 'error');
        return;
      }
      // Validate discipline assignment for discipline roles
      if ((userData.role === 'discipline_unit' || userData.role === 'discipline_manager') && !disciplineAssignment) {
        app.showAlert('Discipline assignment is required for this role', 'error');
        return;
      }
      await app.api.post('/admin/users', userData);
      app.showAlert('User created successfully', 'success');
    }
    
    closeUserModal();
    loadUsers();
  } catch (error) {
    app.showAlert('Failed to save user: ' + error.message, 'error');
  }
}

async function toggleUserStatus(id, activate) {
  if (!confirm(`Are you sure you want to ${activate ? 'activate' : 'deactivate'} this user?`)) {
    return;
  }
  
  try {
    await app.api.put(`/admin/users/${id}/status`, { is_active: activate });
    app.showAlert(`User ${activate ? 'activated' : 'deactivated'} successfully`, 'success');
    loadUsers();
  } catch (error) {
    app.showAlert('Failed to update user status: ' + error.message, 'error');
  }
}

async function resetPassword(id) {
  const newPassword = prompt('Enter new password (minimum 6 characters):');
  if (!newPassword) return;
  
  if (newPassword.length < 6) {
    app.showAlert('Password must be at least 6 characters', 'error');
    return;
  }
  
  try {
    await app.api.put(`/admin/users/${id}/password`, { password: newPassword });
    app.showAlert('Password reset successfully', 'success');
  } catch (error) {
    app.showAlert('Failed to reset password: ' + error.message, 'error');
  }
}

function closeUserModal() {
  document.getElementById('userModal').classList.add('hidden');
  document.getElementById('userForm').reset();
  editingUserId = null;
}