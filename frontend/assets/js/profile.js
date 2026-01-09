// frontend/assets/js/profile.js
// User Profile Management

document.addEventListener('DOMContentLoaded', () => {
  if (!app.requireAuth()) return;
  
  loadUserProfile();
  setupSignatureUpload();
});

async function loadUserProfile() {
  try {
    const user = app.getUser();
    if (!user) {
      app.showAlert('User not found', 'error');
      return;
    }

    // Populate personal information
    document.getElementById('firstName').value = user.first_name || '';
    document.getElementById('lastName').value = user.last_name || '';
    document.getElementById('email').value = user.email || '';
    document.getElementById('userId').value = user.user_id || '';
    document.getElementById('role').value = user.role || '';
    document.getElementById('designation').value = user.designation || '';

    // Load signature if exists
    if (user.signature_path) {
      showSignaturePreview(user.signature_path);
    }
  } catch (error) {
    console.error('Load profile error:', error);
    app.showAlert('Failed to load profile', 'error');
  }
}

function setupSignatureUpload() {
  const fileInput = document.getElementById('signatureFile');
  if (!fileInput) return;

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      app.showAlert('Please upload an image file', 'error');
      fileInput.value = '';
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      app.showAlert('File size must be less than 2MB', 'error');
      fileInput.value = '';
      return;
    }

    // Preview image
    const reader = new FileReader();
    reader.onload = (event) => {
      const previewContainer = document.getElementById('signaturePreviewContainer');
      const preview = document.getElementById('signaturePreview');
      if (previewContainer && preview) {
        preview.innerHTML = `<img src="${event.target.result}" alt="Signature Preview">`;
        previewContainer.style.display = 'block';
      }
    };
    reader.readAsDataURL(file);
  });
}

function showSignaturePreview(signaturePath) {
  const previewContainer = document.getElementById('signaturePreviewContainer');
  const preview = document.getElementById('signaturePreview');
  if (previewContainer && preview) {
    preview.innerHTML = `<img src="${signaturePath}" alt="Current Signature" onerror="this.parentElement.parentElement.style.display='none'">`;
    previewContainer.style.display = 'block';
  }
}

async function saveSignature() {
  try {
    const fileInput = document.getElementById('signatureFile');
    if (!fileInput || !fileInput.files[0]) {
      app.showAlert('Please select a signature image to upload', 'warning');
      return;
    }

    const file = fileInput.files[0];
    
    // Validate file
    if (!file.type.startsWith('image/')) {
      app.showAlert('Please upload an image file', 'error');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      app.showAlert('File size must be less than 2MB', 'error');
      return;
    }

    app.showLoading(true);
    const saveBtn = document.getElementById('saveSignatureBtn');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Uploading...';
    }

    // Upload signature
    const formData = new FormData();
    formData.append('signature', file);

    const response = await app.api.upload('/profile/signature', formData);

    if (response.success) {
      app.showAlert('Signature saved successfully! It will be used automatically for all future approvals.', 'success');
      
      // Update user object in localStorage
      const user = app.getUser();
      if (user) {
        user.signature_path = response.signature_path;
        localStorage.setItem('user', JSON.stringify(user));
      }

      // Show preview
      if (response.signature_path) {
        showSignaturePreview(response.signature_path);
      }

      // Clear file input
      fileInput.value = '';
    } else {
      app.showAlert(response.message || 'Failed to save signature', 'error');
    }
  } catch (error) {
    console.error('Save signature error:', error);
    app.showAlert('Failed to save signature: ' + error.message, 'error');
  } finally {
    app.showLoading(false);
    const saveBtn = document.getElementById('saveSignatureBtn');
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Signature';
    }
  }
}

async function removeSignature() {
  if (!confirm('Are you sure you want to remove your signature? You will need to upload it again for future approvals.')) {
    return;
  }

  try {
    app.showLoading(true);
    const response = await app.api.post('/profile/signature/remove');

    if (response.success) {
      app.showAlert('Signature removed successfully', 'success');
      
      // Update user object
      const user = app.getUser();
      if (user) {
        user.signature_path = null;
        localStorage.setItem('user', JSON.stringify(user));
      }

      // Hide preview
      const previewContainer = document.getElementById('signaturePreviewContainer');
      if (previewContainer) {
        previewContainer.style.display = 'none';
      }

      // Clear file input
      const fileInput = document.getElementById('signatureFile');
      if (fileInput) {
        fileInput.value = '';
      }
    } else {
      app.showAlert(response.message || 'Failed to remove signature', 'error');
    }
  } catch (error) {
    console.error('Remove signature error:', error);
    app.showAlert('Failed to remove signature: ' + error.message, 'error');
  } finally {
    app.showLoading(false);
  }
}

async function changePassword() {
  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  if (!currentPassword || !newPassword || !confirmPassword) {
    app.showAlert('Please fill in all password fields', 'warning');
    return;
  }

  if (newPassword !== confirmPassword) {
    app.showAlert('New passwords do not match', 'error');
    return;
  }

  if (newPassword.length < 8) {
    app.showAlert('New password must be at least 8 characters long', 'error');
    return;
  }

  try {
    app.showLoading(true);
    const response = await app.api.post('/profile/password', {
      current_password: currentPassword,
      new_password: newPassword
    });

    if (response.success) {
      app.showAlert('Password changed successfully', 'success');
      
      // Clear password fields
      document.getElementById('currentPassword').value = '';
      document.getElementById('newPassword').value = '';
      document.getElementById('confirmPassword').value = '';
    } else {
      app.showAlert(response.message || 'Failed to change password', 'error');
    }
  } catch (error) {
    console.error('Change password error:', error);
    app.showAlert('Failed to change password: ' + error.message, 'error');
  } finally {
    app.showLoading(false);
  }
}

window.saveSignature = saveSignature;
window.removeSignature = removeSignature;
window.changePassword = changePassword;

