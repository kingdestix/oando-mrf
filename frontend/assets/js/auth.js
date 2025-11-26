// frontend/assets/js/auth.js
// Authentication Page Logic

document.addEventListener('DOMContentLoaded', () => {
    // Redirect if already logged in
    if (app.isAuthenticated()) {
      const user = app.getUser();
      window.location.href = user.role === 'admin' 
        ? '/admin-dashboard.html' 
        : '/worker-dashboard.html';
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
          window.location.href = response.user.role === 'admin'
            ? '/admin-dashboard.html'
            : '/worker-dashboard.html';
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