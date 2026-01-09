// verify-database.js
// Script to verify database connection and check users
// Run: node verify-database.js

const { query } = require('./config/database');
require('dotenv').config();

async function verifyDatabase() {
  try {
    console.log('\n🔍 Verifying Database Connection...\n');
    
    // 1. Check current database
    const dbResult = await query('SELECT current_database(), current_user');
    console.log('✅ Connected to database:', dbResult.rows[0].current_database);
    console.log('✅ Connected as user:', dbResult.rows[0].current_user);
    console.log('');
    
    // 2. Check if users table exists
    const tableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      )
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('❌ ERROR: users table does not exist!');
      console.log('   Make sure you\'re connected to the correct database.');
      return;
    }
    
    console.log('✅ users table exists');
    
    // 3. Check total users
    const userCount = await query('SELECT COUNT(*) as total FROM users');
    console.log(`✅ Total users in database: ${userCount.rows[0].total}`);
    console.log('');
    
    // 4. Check test users
    console.log('📋 Checking Test Users:\n');
    const testEmails = [
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
    
    for (const email of testEmails) {
      const result = await query(
        'SELECT email, role, is_active, approval_level FROM users WHERE email = $1',
        [email]
      );
      
      if (result.rows.length > 0) {
        const user = result.rows[0];
        const status = user.is_active ? '✅' : '❌';
        console.log(`${status} ${email.padEnd(30)} | ${user.role.padEnd(25)} | Active: ${user.is_active}`);
      } else {
        console.log(`❌ ${email.padEnd(30)} | NOT FOUND`);
      }
    }
    
    console.log('\n');
    
    // 5. Check workflow columns
    console.log('🔍 Checking Workflow Columns:\n');
    const columnsCheck = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('approval_level', 'area_assignment', 'discipline_assignment', 'location_assignment')
      ORDER BY column_name
    `);
    
    const existingColumns = columnsCheck.rows.map(r => r.column_name);
    const requiredColumns = ['approval_level', 'area_assignment', 'discipline_assignment', 'location_assignment'];
    
    requiredColumns.forEach(col => {
      if (existingColumns.includes(col)) {
        console.log(`✅ ${col}`);
      } else {
        console.log(`❌ ${col} - MISSING!`);
      }
    });
    
    console.log('\n');
    
    // 6. Check workflow_stage column in material_requests
    const workflowCheck = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'material_requests' 
      AND column_name = 'workflow_stage'
    `);
    
    if (workflowCheck.rows.length > 0) {
      console.log('✅ workflow_stage column exists in material_requests');
    } else {
      console.log('❌ workflow_stage column MISSING in material_requests');
      console.log('   Run migration-workflow-system.sql');
    }
    
    console.log('\n');
    
    // 7. Test password hash for one user
    console.log('🔐 Testing Password Hash:\n');
    const testUser = await query(
      'SELECT email, password_hash FROM users WHERE email = $1',
      ['requestor@oando.com']
    );
    
    if (testUser.rows.length > 0) {
      const hash = testUser.rows[0].password_hash;
      if (hash && hash.startsWith('$2b$10$')) {
        console.log('✅ Password hash format is correct');
        console.log(`   Hash preview: ${hash.substring(0, 30)}...`);
      } else {
        console.log('❌ Password hash format is INVALID');
        console.log(`   Current hash: ${hash ? hash.substring(0, 50) : 'NULL'}`);
      }
    } else {
      console.log('❌ Test user not found');
    }
    
    console.log('\n');
    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 SUMMARY');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Database: ${dbResult.rows[0].current_database}`);
    console.log(`Users table: ${tableCheck.rows[0].exists ? 'EXISTS' : 'MISSING'}`);
    console.log(`Total users: ${userCount.rows[0].total}`);
    console.log(`Workflow columns: ${existingColumns.length}/4`);
    console.log('═══════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('\nThis might mean:');
    console.error('1. Wrong database connection');
    console.error('2. Database credentials incorrect');
    console.error('3. Database server not accessible');
    console.error('\nCheck your .env file or database.js config\n');
  } finally {
    process.exit(0);
  }
}

verifyDatabase();

