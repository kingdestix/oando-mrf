// frontend/assets/js/auth.js
// Authentication Page Logic

// Toggle password visibility
function togglePasswordVisibility() {
  const passwordInput = document.getElementById('password');
  const toggleBtn = document.getElementById('togglePassword');
  
  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    toggleBtn.textContent = '🙈';
  } else {
    passwordInput.type = 'password';
    toggleBtn.textContent = '👁️';
  }
}

// Make function available globally
window.togglePasswordVisibility = togglePasswordVisibility;

document.addEventListener('DOMContentLoaded', () => {
    // Redirect if already logged in
    if (app.isAuthenticated()) {
      const user = app.getUser();
      const role = user?.role || 'worker';
      let dashboard = '/worker-dashboard.html';
      
      if (role === 'admin') {
        dashboard = '/admin-dashboard.html';
      } else if (['pod_planner', 'technical_coordinator', 'assistant_manager', 'area_manager_land', 'area_manager_swamp', 'area_manager_phc', 'discipline_unit', 'discipline_manager', 'dodm'].includes(role)) {
        dashboard = '/approval-dashboard.html';
      }
      
      window.location.href = dashboard;
      return;
    }
  
    // Handle login form submission
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', handleLogin);
    }
  
    // Handle register link (for demo, just show alert)
    const registerLink = document.getElementById('registerLink');
    if (registerLink) {
      registerLink.addEventListener('click', (e) => {
        e.preventDefault();
        app.showAlert(
          'Please contact your system administrator to create an account.',
          'info'
        );
      });
    }
  });
  
  async function handleLogin(e) {
    e.preventDefault();
  
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
  
    // Basic validation
    if (!email || !password) {
      app.showAlert('Please enter both email and password', 'error');
      return;
    }
  
    // Show loading state
    const loginBtn = document.getElementById('loginBtn');
    const loginBtnText = document.getElementById('loginBtnText');
    const loginSpinner = document.getElementById('loginSpinner');
    
    loginBtn.disabled = true;
    loginBtnText.classList.add('hidden');
    loginSpinner.classList.remove('hidden');
  
    try {
      // Call login API
      const response = await app.api.post('/auth/login', {
        email,
        password
      });
  
      if (response.success) {
        // Save auth data
        app.saveAuth(response.token, response.user);
  
        // Show success message
        app.showAlert('Login successful! Redirecting...', 'success');
  
        // Redirect based on role
        setTimeout(() => {
          const role = response.user.role;
          let dashboard = '/worker-dashboard.html';
          
          // Route to appropriate dashboard based on role
          if (role === 'admin') {
            dashboard = '/admin-dashboard.html';
          } else if (['pod_planner', 'technical_coordinator', 'assistant_manager', 'area_manager_land', 'area_manager_swamp', 'area_manager_phc', 'discipline_unit', 'discipline_manager', 'dodm'].includes(role)) {
            dashboard = '/approval-dashboard.html';
          } else {
            dashboard = '/worker-dashboard.html';
          }
          
          window.location.href = dashboard;
        }, 1000);
      }
    } catch (error) {
      console.error('Login error:', error);
      app.showAlert(
        error.message || 'Login failed. Please check your credentials.',
        'error'
      );
      
      // Reset button state
      loginBtn.disabled = false;
      loginBtnText.classList.remove('hidden');
      loginSpinner.classList.add('hidden');
    }
  }