// Script to migrate COMPLETED requests to COMMERCIAL_REVIEW
// Run: node backend/scripts/migrate-completed-to-commercial-review.js

const { query } = require('../config/database');
const fs = require('fs');
const path = require('path');

async function migrateCompletedToCommercialReview() {
  try {
    console.log('🔄 Starting migration: COMPLETED → COMMERCIAL_REVIEW');
    
    // First, check what we're working with
    const checkResult = await query(`
      SELECT 
        workflow_stage,
        COUNT(*) as count,
        discipline
      FROM material_requests
      WHERE approved_by_discipline_manager IS NOT NULL
        AND status != 'Rejected'
      GROUP BY workflow_stage, discipline
      ORDER BY discipline, workflow_stage
    `);
    
    console.log('\n📊 Current state:');
    checkResult.rows.forEach(row => {
      console.log(`  ${row.discipline || 'N/A'}: ${row.workflow_stage} = ${row.count}`);
    });
    
    // Update COMPLETED requests that should be at COMMERCIAL_REVIEW
    const updateResult = await query(`
      UPDATE material_requests
      SET 
        workflow_stage = 'COMMERCIAL_REVIEW',
        status = 'Approved',
        commercial_status = 'COMMERCIAL_REVIEW',
        updated_at = CURRENT_TIMESTAMP
      WHERE 
        workflow_stage = 'COMPLETED'
        AND approved_by_discipline_manager IS NOT NULL
        AND (quotation_reference IS NULL OR quotation_reference = '')
        AND (contractor_name IS NULL OR contractor_name = '')
        AND status != 'Rejected'
      RETURNING id, mrf_number, discipline, workflow_stage
    `);
    
    console.log(`\n✅ Updated ${updateResult.rowCount} requests to COMMERCIAL_REVIEW`);
    
    if (updateResult.rows.length > 0) {
      console.log('\n📋 Updated requests:');
      updateResult.rows.forEach(row => {
        console.log(`  - ${row.mrf_number} (${row.discipline || 'N/A'})`);
      });
    }
    
    // Show final state
    const finalResult = await query(`
      SELECT 
        workflow_stage,
        COUNT(*) as count,
        discipline
      FROM material_requests
      WHERE approved_by_discipline_manager IS NOT NULL
        AND status != 'Rejected'
      GROUP BY workflow_stage, discipline
      ORDER BY discipline, workflow_stage
    `);
    
    console.log('\n📊 Final state:');
    finalResult.rows.forEach(row => {
      console.log(`  ${row.discipline || 'N/A'}: ${row.workflow_stage} = ${row.count}`);
    });
    
    console.log('\n✅ Migration complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
}

// Run migration
migrateCompletedToCommercialReview();

