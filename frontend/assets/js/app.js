// frontend/assets/js/app.js
// FIXED: Added upload() method for file uploads with authentication

const API_BASE_DEFAULT = 
  window.location.hostname === 'localhost'
    ? 'http://localhost:5000/api'
    : 'https://oando-mrf.onrender.com/api'; // ← PASTE YOUR RENDER URL HERE

const app = {
    API_BASE: API_BASE_DEFAULT,
    
    /**
     * API REQUEST HANDLER
     */
    api: {
      async request(endpoint, options = {}) {
        const token = localStorage.getItem('token');
        const headers = {
          'Content-Type': 'application/json',
          ...options.headers
        };
        
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        try {
          const response = await fetch(`${app.API_BASE}${endpoint}`, {
            ...options,
            headers
          });
          
          if (response.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/index.html';
            throw new Error('Unauthorized');
          }
          
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Request failed');
          }
          
          return await response.json();
        } catch (error) {
          console.error('API Error:', error);
          throw error;
        }
      },
      
      async get(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        return this.request(url, { method: 'GET' });
      },
      
      async post(endpoint, data) {
        return this.request(endpoint, {
          method: 'POST',
          body: JSON.stringify(data)
        });
      },
      
      async put(endpoint, data) {
        return this.request(endpoint, {
          method: 'PUT',
          body: JSON.stringify(data)
        });
      },
      
      async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
      },
      
      /**
       * ✅ UPLOAD METHOD FOR FILES
       * Handles file uploads with authentication and progress
       */
      async upload(endpoint, formData, onProgress) {
        const token = localStorage.getItem('token');
        
        return new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          
          // Progress tracking
          if (onProgress) {
            xhr.upload.addEventListener('progress', (e) => {
              if (e.lengthComputable) {
                const progress = (e.loaded / e.total);
                onProgress(progress);
              }
            });
          }
          
          // Response handler
          xhr.addEventListener('load', () => {
            if (xhr.status === 401) {
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              window.location.href = '/index.html';
              reject(new Error('Unauthorized'));
              return;
            }
            
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const response = JSON.parse(xhr.responseText);
                resolve(response);
              } catch (e) {
                reject(new Error('Invalid JSON response'));
              }
            } else {
              try {
                const error = JSON.parse(xhr.responseText);
                reject(new Error(error.message || 'Upload failed'));
              } catch (e) {
                reject(new Error(`Upload failed with status ${xhr.status}`));
              }
            }
          });
          
          // Error handler
          xhr.addEventListener('error', () => {
            reject(new Error('Network error'));
          });
          
          // Send request
          xhr.open('POST', `${app.API_BASE}${endpoint}`);
          if (token) {
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          }
          xhr.send(formData);
        });
      },
      
      /**
       * DOWNLOAD FILE
       */
      async download(endpoint, params = {}) {
        const token = localStorage.getItem('token');
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${app.API_BASE}${endpoint}?${queryString}` : `${app.API_BASE}${endpoint}`;
        
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Download failed');
        }
        
        return await response.blob();
      }
    },
    
    /**
     * AUTHENTICATION
     */
    isAuthenticated() {
      const token = localStorage.getItem('token');
      return !!token;
    },
    
    requireAuth() {
      const token = localStorage.getItem('token');
      if (!token) {
        window.location.href = '/index.html';
        return false;
      }
      return true;
    },
    
    requireRole(role) {
      const user = this.getUser();
      if (!user || user.role !== role) {
        app.showAlert('Access denied', 'error');
        setTimeout(() => {
          window.location.href = user.role === 'worker' ? '/worker-dashboard.html' : '/admin-dashboard.html';
        }, 2000);
        return false;
      }
      return true;
    },
    
    getUser() {
      const userStr = localStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    },
    
    saveAuth(token, user) {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    },
    
    /**
     * UI HELPERS
     */
    showAlert(message, type = 'info') {
      const container = document.getElementById('alertContainer');
      if (!container) return;
      
      const colors = {
        success: { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
        error: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' },
        warning: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
        info: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' }
      };
      
      const color = colors[type] || colors.info;
      
      const alert = document.createElement('div');
      alert.className = `alert alert-${type}`;
      alert.style.cssText = `
        padding: 1rem 1.25rem;
        border-radius: 0.375rem;
        margin-bottom: 1rem;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        background-color: ${color.bg};
        border-left: 4px solid ${color.border};
        color: ${color.text};
      `;
      alert.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()" style="margin-left: auto; background: none; border: none; font-size: 1.25rem; cursor: pointer; opacity: 0.7; color: inherit;">×</button>
      `;
      
      container.appendChild(alert);
      
      setTimeout(() => alert.remove(), 5000);
    },
    
    showLoading(show) {
      const loading = document.getElementById('loading');
      if (loading) {
        loading.classList.toggle('hidden', !show);
      }
    },
    
    showModal(title, content) {
      // Remove existing modal if any
      const existingModal = document.getElementById('appModal');
      if (existingModal) {
        existingModal.remove();
      }
      
      const modal = document.createElement('div');
      modal.id = 'appModal';
      modal.className = 'modal-overlay';
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        padding: 1rem;
      `;
      
      modal.innerHTML = `
        <div class="modal-content" style="background: white; border-radius: 0.5rem; max-width: 1000px; max-height: 90vh; overflow-y: auto; width: 100%; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);">
          <div style="padding: 1.5rem; border-bottom: 1px solid #e5e5e5; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; background: white; z-index: 10;">
            <h2 style="color: #00205B; margin: 0; font-size: 1.25rem; font-weight: 700;">${title}</h2>
            <button onclick="document.getElementById('appModal').remove()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #737373; padding: 0; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 0.25rem;">×</button>
          </div>
          <div style="padding: 1.5rem;">
            ${content}
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      // Close on background click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.remove();
        }
      });
    },
    
    /**
     * FORMATTERS
     */
    formatDate(dateStr) {
      if (!dateStr) return '-';
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    },
    
    formatNumber(num) {
      return new Intl.NumberFormat('en-US').format(num);
    },
    
    /**
     * BADGE HELPERS
     */
    getStatusBadgeClass(status) {
      const classes = {
        'Pending': 'badge-pending',
        'Approved': 'badge-approved',
        'Rejected': 'badge-rejected',
        'Ordered': 'badge-ordered',
        'Delivered': 'badge-delivered',
        'Completed': 'badge-completed'
      };
      return classes[status] || 'badge-pending';
    },
    
    getPriorityBadgeClass(priority) {
      const classes = {
        'Critical': 'badge-critical',
        'High': 'badge-high',
        'Medium': 'badge-medium',
        'Low': 'badge-low'
      };
      return classes[priority] || 'badge-medium';
    },
    
    /**
     * DOWNLOAD FILE HELPER
     */
    downloadFile(blob, filename) {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    
    /**
     * DEBOUNCE HELPER
     */
    debounce(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    }
  };
  
  /**
   * NAVBAR INITIALIZATION
   */
  document.addEventListener('DOMContentLoaded', () => {
    const user = app.getUser();
    if (!user) return;
    
    // Populate navbar menu
    const navbarMenu = document.querySelector('.navbar-menu');
    if (navbarMenu && user.role === 'admin') {
      navbarMenu.innerHTML = `
        <a href="/admin-dashboard.html" class="nav-link">Dashboard</a>
        <a href="/analytics.html" class="nav-link">Analytics</a>
        <a href="/inventory.html" class="nav-link">Inventory</a>
        <a href="/import.html" class="nav-link">Import</a>
        <a href="/users.html" class="nav-link">Users</a>
      `;
    } else if (navbarMenu && user.role === 'worker') {
      navbarMenu.innerHTML = `
        <a href="/worker-dashboard.html" class="nav-link">My Requests</a>
        <a href="/new-request.html" class="nav-link">New Request</a>
      `;
    }

    const currentPath = window.location.pathname;
    document.querySelectorAll('.nav-link').forEach(link => {
      const href = link.getAttribute('href');
      if (!href) return;
      const normalizedHref = href.startsWith('/') ? href : `/${href}`;
      const isActive = currentPath === normalizedHref
        || currentPath.endsWith(normalizedHref)
        || (currentPath === '/' && normalizedHref === '/index.html');
      if (isActive) {
        link.classList.add('active');
      }
    });
    
    // Populate navbar user
    const navbarUser = document.querySelector('.navbar-user');
    if (navbarUser) {
      navbarUser.innerHTML = `
        <div class="user-info">
          <div class="user-name">${user.first_name} ${user.last_name}</div>
          <div class="user-role">${user.role}</div>
        </div>
        <button onclick="logout()" class="btn btn-sm btn-outline">Logout</button>
      `;
    }
    
    // Mobile menu toggle
    const menuToggle = document.querySelector('.menu-toggle');
    const navMenu = document.querySelector('.navbar-menu');
    if (menuToggle && navMenu) {
      menuToggle.addEventListener('click', () => {
        navMenu.classList.toggle('active');
      });
    }
  });
  
  /**
   * LOGOUT FUNCTION
   */
  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/index.html';
  }