// test-workflow.js
// Test script to verify workflow is working correctly
const { query } = require('./config/database');
require('dotenv').config();

async function testWorkflow() {
  try {
    console.log('\n🔍 Testing Workflow Configuration...\n');
    
    // 1. Check recent requests
    const recentRequests = await query(`
      SELECT id, mrf_number, workflow_stage, workflow_location, area, created_at
      FROM material_requests
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    console.log('📋 Recent Requests:');
    recentRequests.rows.forEach(req => {
      console.log(`  ${req.mrf_number}: Stage=${req.workflow_stage}, Location=${req.workflow_location || req.area}`);
    });
    
    // 2. Check tech coordinator users
    const techCoords = await query(`
      SELECT id, email, role, location_assignment, area_assignment
      FROM users
      WHERE role = 'technical_coordinator'
    `);
    
    console.log('\n👥 Technical Coordinators:');
    techCoords.rows.forEach(user => {
      console.log(`  ${user.email}: Location=${user.location_assignment || 'ALL'}, Area=${user.area_assignment || 'ALL'}`);
    });
    
    // 3. Check requests at tech coordinator stage
    const pendingTechCoord = await query(`
      SELECT COUNT(*) as count
      FROM material_requests
      WHERE workflow_stage = 'TECHNICAL_COORDINATOR_REVIEW'
    `);
    
    console.log(`\n📊 Requests at TECHNICAL_COORDINATOR_REVIEW: ${pendingTechCoord.rows[0].count}`);
    
    // 4. Check POD users
    const podUsers = await query(`
      SELECT id, email, role
      FROM users
      WHERE role = 'pod_planner'
    `);
    
    console.log('\n👥 POD Planners:');
    podUsers.rows.forEach(user => {
      console.log(`  ${user.email}`);
    });
    
    console.log('\n✅ Test complete!\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

testWorkflow();

