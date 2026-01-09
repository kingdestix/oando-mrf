// fix-passwords.js
// Run this to fix all password hashes
// node fix-passwords.js

const { query } = require('./config/database');
require('dotenv').config();

const CORRECT_HASH = '$2b$10$hqHOJdvsqftvYQZlD8hWiugJRqgRIKLIFmMHMN7ea7eycEiWD6TBO';
const TEST_USERS = [
  'requestor@oando.com',
  'worker@oando.com',
  'tech.coord@oando.com',
  'asst.mgr@oando.com',
  'lar.mgr@oando.com',
  'sar.mgr@oando.com',
  'phc.mgr@oando.com',
  'pod.planner@oando.com',
  'discipline.unit@oando.com',
  'discipline.mgr@oando.com',
  'admin@oando.com'
];

async function fixPasswords() {
  try {
    console.log('\n🔧 Fixing Password Hashes...\n');
    
    // Check current database
    const dbCheck = await query('SELECT current_database() as db_name');
    console.log(`📊 Connected to: ${dbCheck.rows[0].db_name}\n`);
    
    if (dbCheck.rows[0].db_name !== 'oando_mrf') {
      console.log('⚠️  WARNING: Not connected to oando_mrf database!');
      console.log('   Please connect to the correct database first.\n');
      return;
    }
    
    // Update passwords
    const updateResult = await query(
      `UPDATE users
       SET password_hash = $1,
           is_active = true,
           updated_at = CURRENT_TIMESTAMP
       WHERE email = ANY($2::text[])`,
      [CORRECT_HASH, TEST_USERS]
    );
    
    console.log(`✅ Updated ${updateResult.rowCount} users\n`);
    
    // Verify
    console.log('🔍 Verifying updates:\n');
    const verifyResult = await query(
      `SELECT 
        email,
        role,
        is_active,
        CASE 
          WHEN password_hash = $1 THEN '✅ CORRECT'
          ELSE '❌ WRONG'
        END as status
       FROM users
       WHERE email = ANY($2::text[])
       ORDER BY email`,
      [CORRECT_HASH, TEST_USERS]
    );
    
    verifyResult.rows.forEach(user => {
      console.log(`   ${user.email.padEnd(30)} | ${user.role.padEnd(25)} | ${user.status}`);
    });
    
    const allCorrect = verifyResult.rows.every(u => u.status === '✅ CORRECT');
    
    console.log('\n═══════════════════════════════════════════════════════');
    if (allCorrect) {
      console.log('✅ SUCCESS! All password hashes updated correctly!');
      console.log('\n📋 Login Credentials:');
      console.log('   Email: (any test user email)');
      console.log('   Password: Test@2025');
    } else {
      console.log('⚠️  Some passwords were not updated correctly');
    }
    console.log('═══════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('\nStack:', error.stack);
  } finally {
    process.exit(0);
  }
}

fixPasswords();

