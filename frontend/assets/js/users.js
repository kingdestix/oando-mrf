// frontend/assets/js/users.js
let allUsers = [];
let editingUserId = null;

document.addEventListener('DOMContentLoaded', () => {
  if (!app.requireAuth() || !app.requireRole('admin')) return;
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
  return {
    'admin': 'badge-urgent',
    'manager': 'badge-high',
    'worker': 'badge-medium'
  }[role] || 'badge-medium';
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
    document.getElementById('passwordGroup').style.display = 'none';
    document.getElementById('password').required = false;
    document.getElementById('user_id').disabled = true;
    document.getElementById('email').disabled = true;
    
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