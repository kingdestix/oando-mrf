// verify-database-connection.js
// Script to verify which database the application is connected to

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'dpg-d4jld2gdl3ps73eio7sg-a.oregon-postgres.render.com',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'oando_mrf',
  user: process.env.DB_USER || 'oando_admin',
  password: process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false } 
    : false,
});

async function verifyConnection() {
  const client = await pool.connect();
  
  try {
    console.log('\n🔍 DATABASE CONNECTION VERIFICATION\n');
    console.log('='.repeat(60));
    
    // Get connection info
    const dbInfo = await client.query('SELECT current_database() as db_name, current_user as db_user, version() as db_version');
    const dbName = dbInfo.rows[0].db_name;
    const dbUser = dbInfo.rows[0].db_user;
    const dbVersion = dbInfo.rows[0].db_version.split(',')[0]; // First line of version
    
    console.log('\n📊 CONNECTION DETAILS:');
    console.log(`   Host: ${process.env.DB_HOST || 'dpg-d4jld2gdl3ps73eio7sg-a.oregon-postgres.render.com'}`);
    console.log(`   Database: ${dbName}`);
    console.log(`   User: ${dbUser}`);
    console.log(`   PostgreSQL Version: ${dbVersion}`);
    
    // Check if material_requests table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'material_requests'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('\n❌ ERROR: material_requests table does not exist!');
      console.log('   This database may not be the correct one for this application.');
      return;
    }
    
    // Get table count
    const countResult = await client.query('SELECT COUNT(*) as total FROM material_requests');
    const totalRequests = countResult.rows[0].total;
    
    console.log(`\n✅ Database is connected and has ${totalRequests} material requests`);
    
    // Check for signature columns
    const signatureCols = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'material_requests' 
      AND column_name LIKE '%signature%'
      ORDER BY column_name;
    `);
    
    console.log(`\n📝 Signature columns found: ${signatureCols.rows.length}`);
    if (signatureCols.rows.length > 0) {
      signatureCols.rows.forEach(col => {
        console.log(`   ✅ ${col.column_name}`);
      });
    } else {
      console.log('   ⚠️  No signature columns found. Run: node check-and-add-signature-columns.js');
    }
    
    // Check users table
    const userCount = await client.query('SELECT COUNT(*) as total FROM users');
    console.log(`\n👥 Users in database: ${userCount.rows[0].total}`);
    
    // Check for discipline managers
    const disciplineManagers = await client.query(`
      SELECT id, email, first_name, last_name, discipline_assignment 
      FROM users 
      WHERE role = 'discipline_manager' AND is_active = true;
    `);
    
    console.log(`\n🎯 Discipline Managers: ${disciplineManagers.rows.length}`);
    if (disciplineManagers.rows.length > 0) {
      disciplineManagers.rows.forEach(dm => {
        console.log(`   ✅ ${dm.first_name} ${dm.last_name} (${dm.email}) - ${dm.discipline_assignment || 'No discipline assigned'}`);
      });
    } else {
      console.log('   ⚠️  No discipline managers found. Ensure discipline managers are created with discipline_assignment.');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('\n✅ Database connection verified successfully!\n');
    
  } catch (error) {
    console.error('\n❌ DATABASE CONNECTION ERROR:');
    console.error('   ', error.message);
    console.error('\n💡 TROUBLESHOOTING:');
    console.error('   1. Check your .env file for correct DB credentials');
    console.error('   2. Ensure PostgreSQL is running');
    console.error('   3. Verify network connectivity to database host');
    console.error('   4. Check if you are using the correct database\n');
  } finally {
    client.release();
    await pool.end();
  }
}

verifyConnection();

