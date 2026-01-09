// check-database-schema.js
// This script will tell you EXACTLY which database you're connected to
// and whether the migrations have been run

const { query } = require('./config/database');
require('dotenv').config();

async function checkSchema() {
  try {
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🔍 DATABASE CONNECTION CHECK');
    console.log('═══════════════════════════════════════════════════════\n');
    
    // 1. Check current database
    const dbInfo = await query('SELECT current_database() as db_name, current_user as db_user, version() as pg_version');
    console.log('📊 DATABASE INFO:');
    console.log(`   Database Name: ${dbInfo.rows[0].db_name}`);
    console.log(`   Database User: ${dbInfo.rows[0].db_user}`);
    console.log(`   PostgreSQL: ${dbInfo.rows[0].pg_version.split(',')[0]}\n`);
    
    // 2. Check connection string from config
    console.log('📋 EXPECTED CONNECTION:');
    console.log(`   Host: ${process.env.DB_HOST || 'dpg-d4jld2gdl3ps73eio7sg-a.oregon-postgres.render.com'}`);
    console.log(`   Database: ${process.env.DB_NAME || 'oando_mrf'}`);
    console.log(`   User: ${process.env.DB_USER || 'oando_admin'}\n`);
    
    // 3. Check if users table exists
    const tableExists = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      ) as exists
    `);
    
    if (!tableExists.rows[0].exists) {
      console.log('❌ ERROR: users table does not exist!');
      console.log('   You are NOT connected to the correct database.\n');
      return;
    }
    
    console.log('✅ users table exists\n');
    
    // 4. Check users table schema
    console.log('🔍 CHECKING SCHEMA VERSION:\n');
    
    const columns = await query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name IN ('role', 'approval_level', 'area_assignment', 'discipline_assignment', 'location_assignment')
      ORDER BY column_name
    `);
    
    const foundColumns = columns.rows.map(r => r.column_name);
    
    console.log('   Schema Check:');
    console.log(`   - role column: ${foundColumns.includes('role') ? '✅ EXISTS' : '❌ MISSING'}`);
    if (foundColumns.includes('role')) {
      const roleCol = columns.rows.find(r => r.column_name === 'role');
      console.log(`     Type: ${roleCol.data_type}(${roleCol.character_maximum_length || 'N/A'})`);
      if (roleCol.character_maximum_length === 20) {
        console.log(`     ⚠️  WARNING: role is VARCHAR(20) - too small for new roles!`);
        console.log(`     ⚠️  Migration NOT applied!`);
      } else if (roleCol.character_maximum_length >= 50) {
        console.log(`     ✅ Size is correct (VARCHAR(50))`);
      }
    }
    
    console.log(`   - approval_level: ${foundColumns.includes('approval_level') ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`   - area_assignment: ${foundColumns.includes('area_assignment') ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`   - discipline_assignment: ${foundColumns.includes('discipline_assignment') ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`   - location_assignment: ${foundColumns.includes('location_assignment') ? '✅ EXISTS' : '❌ MISSING'}\n`);
    
    // 5. Check role constraint
    const constraints = await query(`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'users'::regclass
      AND conname = 'users_role_check'
    `);
    
    if (constraints.rows.length > 0) {
      const constraintDef = constraints.rows[0].definition;
      console.log('   Role Constraint:');
      console.log(`   ${constraintDef}\n`);
      
      if (constraintDef.includes("'technical_coordinator'")) {
        console.log('   ✅ New roles are allowed\n');
      } else {
        console.log('   ⚠️  WARNING: Only old roles (worker, manager, admin) are allowed');
        console.log('   ⚠️  Migration NOT applied!\n');
      }
    } else {
      console.log('   ⚠️  No role constraint found\n');
    }
    
    // 6. Check workflow_stage column in material_requests
    const workflowCol = await query(`
      SELECT column_name, column_default
      FROM information_schema.columns
      WHERE table_name = 'material_requests'
      AND column_name = 'workflow_stage'
    `);
    
    if (workflowCol.rows.length > 0) {
      console.log('   workflow_stage in material_requests: ✅ EXISTS');
      console.log(`   Default: ${workflowCol.rows[0].column_default || 'NULL'}\n`);
    } else {
      console.log('   workflow_stage in material_requests: ❌ MISSING\n');
    }
    
    // 7. Check test users
    console.log('👥 CHECKING TEST USERS:\n');
    const testUsers = await query(`
      SELECT email, role, is_active, 
             CASE WHEN password_hash LIKE '$2b$10$hqHOJdvsqftvYQZlD8hWiugJRqgRIKLIFmMHMN7ea7eycEiWD6TBO' 
                  THEN '✅ CORRECT' 
                  ELSE '❌ WRONG HASH' 
             END as hash_status
      FROM users
      WHERE email IN ('requestor@oando.com', 'tech.coord@oando.com', 'admin@oando.com')
      ORDER BY email
    `);
    
    if (testUsers.rows.length === 0) {
      console.log('   ❌ No test users found!\n');
    } else {
      testUsers.rows.forEach(user => {
        console.log(`   ${user.email}:`);
        console.log(`     Role: ${user.role}`);
        console.log(`     Active: ${user.is_active ? '✅' : '❌'}`);
        console.log(`     Password Hash: ${user.hash_status}\n`);
      });
    }
    
    // 8. Summary
    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 SUMMARY');
    console.log('═══════════════════════════════════════════════════════');
    
    const isCorrectDB = dbInfo.rows[0].db_name === (process.env.DB_NAME || 'oando_mrf');
    const hasNewColumns = foundColumns.includes('area_assignment') && foundColumns.includes('discipline_assignment');
    const hasCorrectRoleSize = columns.rows.find(r => r.column_name === 'role')?.character_maximum_length >= 50;
    
    console.log(`Database Name Match: ${isCorrectDB ? '✅' : '❌'} ${dbInfo.rows[0].db_name}`);
    console.log(`Schema Migrated: ${hasNewColumns && hasCorrectRoleSize ? '✅ YES' : '❌ NO'}`);
    
    if (!isCorrectDB) {
      console.log('\n⚠️  YOU ARE CONNECTED TO THE WRONG DATABASE!');
      console.log(`   Expected: ${process.env.DB_NAME || 'oando_mrf'}`);
      console.log(`   Actual: ${dbInfo.rows[0].db_name}`);
      console.log('\n   To fix:');
      console.log('   1. In pgAdmin, find the correct database');
      console.log('   2. Right-click → Connect');
      console.log('   3. Run migration-workflow-system.sql');
    } else if (!hasNewColumns || !hasCorrectRoleSize) {
      console.log('\n⚠️  MIGRATIONS NOT APPLIED!');
      console.log('   Run: backend/models/migration-workflow-system.sql');
    } else {
      console.log('\n✅ Everything looks good!');
    }
    
    console.log('═══════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('\nThis might mean:');
    console.error('1. Database connection failed');
    console.error('2. Wrong credentials in .env file');
    console.error('3. Database server not accessible\n');
  } finally {
    process.exit(0);
  }
}

checkSchema();

