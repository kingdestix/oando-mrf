// Run migration to add material_sent_to_requestor columns
const { query } = require('../config/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    console.log('🔄 Running migration: Add material_sent_to_requestor columns...');
    
    const sql = fs.readFileSync(
      path.join(__dirname, '../models/add-material-sent-to-requestor-columns.sql'),
      'utf8'
    );
    
    await query(sql);
    console.log('✅ Migration completed successfully!');
    
    // Verify the columns were added
    const verifyResult = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'material_requests' 
      AND column_name IN ('material_sent_to_requestor', 'material_sent_to_requestor_date')
      ORDER BY column_name;
    `);
    
    console.log('📊 Verification:', verifyResult.rows);
    
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runMigration();

