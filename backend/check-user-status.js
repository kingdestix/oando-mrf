// check-user-status.js
// Quick script to check user status in database
// Run: node check-user-status.js <email>

const { query } = require('./config/database');
require('dotenv').config();

async function checkUser(email) {
  try {
    console.log(`\n🔍 Checking user: ${email}\n`);
    
    const result = await query(
      `SELECT 
        id,
        user_id,
        first_name,
        last_name,
        email,
        role,
        is_active,
        approval_level,
        area_assignment,
        location_assignment,
        discipline_assignment,
        CASE 
          WHEN password_hash IS NULL THEN 'NO PASSWORD'
          WHEN LENGTH(password_hash) < 50 THEN 'INVALID HASH'
          WHEN password_hash LIKE '$2b$10$%' THEN 'VALID BCRYPT'
          ELSE 'UNKNOWN FORMAT'
        END as password_status,
        created_at
       FROM users 
       WHERE email = $1`,
      [email]
    );
    
    if (result.rows.length === 0) {
      console.log('❌ User not found in database');
      return;
    }
    
    const user = result.rows[0];
    
    console.log('📋 User Details:');
    console.log('─────────────────────────────────────');
    console.log(`ID: ${user.id}`);
    console.log(`User ID: ${user.user_id}`);
    console.log(`Name: ${user.first_name} ${user.last_name}`);
    console.log(`Email: ${user.email}`);
    console.log(`Role: ${user.role}`);
    console.log(`Active: ${user.is_active ? '✅ YES' : '❌ NO'}`);
    console.log(`Approval Level: ${user.approval_level || 0}`);
    console.log(`Area Assignment: ${user.area_assignment || 'None'}`);
    console.log(`Location Assignment: ${user.location_assignment || 'None'}`);
    console.log(`Discipline Assignment: ${user.discipline_assignment || 'None'}`);
    console.log(`Password Status: ${user.password_status}`);
    console.log(`Created: ${user.created_at}`);
    console.log('─────────────────────────────────────\n');
    
    if (!user.is_active) {
      console.log('⚠️  WARNING: User is INACTIVE!');
      console.log('   Run this to activate:');
      console.log(`   UPDATE users SET is_active = true WHERE email = '${email}';`);
    }
    
    if (user.password_status !== 'VALID BCRYPT') {
      console.log('⚠️  WARNING: Password hash issue!');
      console.log(`   Status: ${user.password_status}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

// Get email from command line or check all test users
const email = process.argv[2];

if (email) {
  checkUser(email);
} else {
  console.log('Usage: node check-user-status.js <email>');
  console.log('\nExample: node check-user-status.js requestor@oando.com');
  console.log('\nOr check all test users:');
  
  const testUsers = [
    'requestor@oando.com',
    'tech.coord@oando.com',
    'asst.mgr@oando.com',
    'lar.mgr@oando.com',
    'pod.planner@oando.com'
  ];
  
  (async () => {
    for (const testEmail of testUsers) {
      await checkUser(testEmail);
    }
  })();
}

