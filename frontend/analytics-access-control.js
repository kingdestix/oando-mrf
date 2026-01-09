// Add this at the top of analytics.html or analytics.js
document.addEventListener('DOMContentLoaded', () => {
  const user = app.getUser();
  
  // Only POD Planner can access analytics
  if (!user || user.role !== 'pod_planner') {
    app.showAlert('Access Denied: Only POD Planners can view analytics', 'error');
    setTimeout(() => {
      window.location.href = '/admin-dashboard.html';
    }, 2000);
    return;
  }
});

