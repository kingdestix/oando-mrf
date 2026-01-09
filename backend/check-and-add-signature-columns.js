// check-and-add-signature-columns.js
// Script to check and add signature columns to material_requests table

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'mrf_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

async function checkAndAddColumns() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking for signature columns...\n');
    
    // Check which columns exist
    const checkResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'material_requests' 
      AND column_name LIKE '%signature%'
      ORDER BY column_name;
    `);
    
    console.log('Existing signature columns:');
    if (checkResult.rows.length === 0) {
      console.log('  ❌ No signature columns found\n');
    } else {
      checkResult.rows.forEach(row => {
        console.log(`  ✅ ${row.column_name}`);
      });
      console.log('');
    }
    
    // List of required columns
    const requiredColumns = [
      'technical_coordinator_signature',
      'assistant_manager_signature',
      'area_manager_signature',
      'pod_planner_signature',
      'discipline_unit_signature',
      'discipline_manager_signature'
    ];
    
    const existingColumns = checkResult.rows.map(r => r.column_name);
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
    
    if (missingColumns.length === 0) {
      console.log('✅ All signature columns already exist!');
      return;
    }
    
    console.log('📝 Missing columns:');
    missingColumns.forEach(col => console.log(`  - ${col}`));
    console.log('\n🔧 Adding missing columns...\n');
    
    // Add missing columns
    for (const column of missingColumns) {
      try {
        await client.query(`
          ALTER TABLE material_requests 
          ADD COLUMN IF NOT EXISTS ${column} VARCHAR(500);
        `);
        console.log(`  ✅ Added: ${column}`);
      } catch (error) {
        console.error(`  ❌ Failed to add ${column}:`, error.message);
      }
    }
    
    // Also add contract columns if needed
    const contractColumns = [
      { name: 'contract_amount_usd', type: 'NUMERIC(15,2)' },
      { name: 'contract_amount_eur', type: 'NUMERIC(15,2)' },
      { name: 'contract_amount_ngn', type: 'NUMERIC(15,2)' },
      { name: 'contract_number', type: 'VARCHAR(200)' },
      { name: 'contract_validity', type: 'DATE' },
      { name: 'vendor_name_discipline', type: 'VARCHAR(200)' }
    ];
    
    console.log('\n📝 Checking contract columns...\n');
    for (const col of contractColumns) {
      try {
        const checkCol = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'material_requests' 
          AND column_name = $1;
        `, [col.name]);
        
        if (checkCol.rows.length === 0) {
          await client.query(`
            ALTER TABLE material_requests 
            ADD COLUMN IF NOT EXISTS ${col.name} ${col.type};
          `);
          console.log(`  ✅ Added: ${col.name}`);
        } else {
          console.log(`  ✅ Already exists: ${col.name}`);
        }
      } catch (error) {
        console.error(`  ❌ Failed to add ${col.name}:`, error.message);
      }
    }
    
    console.log('\n✅ Done! All required columns have been added.');
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

checkAndAddColumns()
  .then(() => {
    console.log('\n✨ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

