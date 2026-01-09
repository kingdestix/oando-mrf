// find-and-switch-database.js
// Script to help identify and switch to the correct local database

const { Pool } = require('pg');
require('dotenv').config();

// Test both potential databases
const localConfig = {
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: process.env.DB_PASSWORD || 'diebuka',
  ssl: false
};

const renderConfig = {
  host: 'dpg-d4jld2gdl3ps73eio7sg-a.oregon-postgres.render.com',
  port: 5432,
  user: 'oando_admin',
  password: process.env.DB_PASSWORD_RENDER || '', // You'll need to provide this
  ssl: { rejectUnauthorized: false }
};

async function checkDatabase(config, dbName, label) {
  const pool = new Pool({ ...config, database: dbName });
  
  try {
    const client = await pool.connect();
    
    try {
      // Check if material_requests table exists
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'material_requests'
        );
      `);
      
      if (!tableCheck.rows[0].exists) {
        console.log(`   ❌ ${label}: Table 'material_requests' does not exist`);
        return null;
      }
      
      // Get request count
      const countResult = await client.query('SELECT COUNT(*) as total FROM material_requests');
      const requestCount = countResult.rows[0].total;
      
      // Get user count
      const userCount = await client.query('SELECT COUNT(*) as total FROM users');
      const usersCount = userCount.rows[0].total;
      
      // Check for signature columns
      const sigCols = await client.query(`
        SELECT COUNT(*) as count 
        FROM information_schema.columns 
        WHERE table_name = 'material_requests' 
        AND column_name LIKE '%signature%'
      `);
      
      // Check for workflow columns
      const workflowCols = await client.query(`
        SELECT COUNT(*) as count 
        FROM information_schema.columns 
        WHERE table_name = 'material_requests' 
        AND column_name = 'workflow_stage'
      `);
      
      // Check for discipline_assignment in users
      const disciplineCols = await client.query(`
        SELECT COUNT(*) as count 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'discipline_assignment'
      `);
      
      return {
        label,
        host: config.host,
        database: dbName,
        requestCount: parseInt(requestCount),
        usersCount: parseInt(usersCount),
        hasSignatures: parseInt(sigCols.rows[0].count) > 0,
        hasWorkflow: parseInt(workflowCols.rows[0].count) > 0,
        hasDisciplineAssignment: parseInt(disciplineCols.rows[0].count) > 0,
        isComplete: parseInt(sigCols.rows[0].count) > 0 && 
                    parseInt(workflowCols.rows[0].count) > 0 &&
                    parseInt(disciplineCols.rows[0].count) > 0
      };
    } finally {
      client.release();
      await pool.end();
    }
  } catch (error) {
    console.log(`   ❌ ${label}: Connection failed - ${error.message}`);
    return null;
  }
}

async function listAllDatabases(config) {
  const pool = new Pool({ ...config, database: 'postgres' }); // Connect to default postgres DB
  
  try {
    const client = await pool.connect();
    const result = await client.query(`
      SELECT datname 
      FROM pg_database 
      WHERE datistemplate = false 
      AND datname NOT IN ('postgres', 'template0', 'template1')
      ORDER BY datname
    `);
    client.release();
    await pool.end();
    return result.rows.map(r => r.datname);
  } catch (error) {
    console.error(`   Error listing databases: ${error.message}`);
    return [];
  }
}

async function main() {
  console.log('\n🔍 FINDING YOUR DATABASES\n');
  console.log('='.repeat(70));
  
  // List all databases on localhost
  console.log('\n📋 LOCAL DATABASES (localhost):');
  const localDbs = await listAllDatabases(localConfig);
  if (localDbs.length > 0) {
    localDbs.forEach(db => {
      console.log(`   - ${db}`);
    });
  } else {
    console.log('   ⚠️  Could not connect to localhost or no databases found');
  }
  
  console.log('\n🔍 CHECKING DATABASES...\n');
  
  const results = [];
  
  // Check common database names on localhost
  const commonNames = ['oando_mrf', 'mrf_db', 'mrf_project', 'oando', 'material_requests'];
  
  for (const dbName of commonNames) {
    if (localDbs.includes(dbName)) {
      const result = await checkDatabase(localConfig, dbName, `Local: ${dbName}`);
      if (result) results.push(result);
    }
  }
  
  // Also check the one from .env
  if (process.env.DB_NAME && localDbs.includes(process.env.DB_NAME)) {
    const result = await checkDatabase(localConfig, process.env.DB_NAME, `Local: ${process.env.DB_NAME} (from .env)`);
    if (result) results.push(result);
  }
  
  // Check Render database if password is available
  if (process.env.DB_PASSWORD_RENDER) {
    const renderResult = await checkDatabase(renderConfig, 'oando_mrf', 'Render: oando_mrf');
    if (renderResult) results.push(renderResult);
  }
  
  console.log('\n📊 DATABASE COMPARISON:\n');
  console.log('='.repeat(70));
  
  if (results.length === 0) {
    console.log('❌ No valid databases found!');
    console.log('\n💡 Make sure:');
    console.log('   1. PostgreSQL is running');
    console.log('   2. Your .env file has the correct DB_PASSWORD');
    console.log('   3. The database exists');
    return;
  }
  
  results.forEach((db, index) => {
    console.log(`\n${index + 1}. ${db.label}`);
    console.log(`   Host: ${db.host}`);
    console.log(`   Database: ${db.database}`);
    console.log(`   Requests: ${db.requestCount}`);
    console.log(`   Users: ${db.usersCount}`);
    console.log(`   Has Signatures: ${db.hasSignatures ? '✅' : '❌'}`);
    console.log(`   Has Workflow: ${db.hasWorkflow ? '✅' : '❌'}`);
    console.log(`   Has Discipline Assignment: ${db.hasDisciplineAssignment ? '✅' : '❌'}`);
    console.log(`   Complete Setup: ${db.isComplete ? '✅ YES' : '❌ NO'}`);
  });
  
  console.log('\n' + '='.repeat(70));
  console.log('\n💡 RECOMMENDATION:\n');
  
  // Find the most complete database
  const completeDbs = results.filter(r => r.isComplete);
  const mostComplete = results.reduce((best, current) => {
    if (!best) return current;
    if (current.isComplete && !best.isComplete) return current;
    if (current.requestCount > best.requestCount) return current;
    return best;
  }, null);
  
  if (mostComplete) {
    console.log(`✅ Use this database for local testing:`);
    console.log(`   Database: ${mostComplete.database}`);
    console.log(`   Host: ${mostComplete.host}`);
    console.log(`\n📝 Update your .env file with:`);
    console.log(`   DB_HOST=${mostComplete.host === 'localhost' ? 'localhost' : mostComplete.host}`);
    console.log(`   DB_NAME=${mostComplete.database}`);
    console.log(`   DB_USER=${mostComplete.host === 'localhost' ? 'postgres' : 'oando_admin'}`);
    console.log(`   DB_PASSWORD=your_password`);
    
    if (mostComplete.host !== 'localhost') {
      console.log(`\n⚠️  WARNING: This is a remote database (Render).`);
      console.log(`   For local testing, you should use a local database.`);
      console.log(`   Consider creating a new local database or migrating data.`);
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('\n');
}

main().catch(console.error);

