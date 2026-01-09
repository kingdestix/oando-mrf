// Script to create DODM user
// Run: node backend/scripts/create-dodm-user.js

const bcrypt = require('bcrypt');
const { query } = require('../config/database');

async function createDODMUser() {
  try {
    console.log('🔍 Checking for existing DODM user...');
    
    // Check if DODM user exists
    const existing = await query(
      'SELECT id, user_id, email, role FROM users WHERE role = $1',
      ['dodm']
    );
    
    if (existing.rows.length > 0) {
      console.log('✅ DODM user already exists:');
      existing.rows.forEach(user => {
        console.log(`  - ${user.user_id} (${user.email})`);
      });
      process.exit(0);
    }
    
    console.log('📝 Creating DODM user...');
    
    // Default password: "Test@2025" (change this after first login!)
    const password = 'Test@2025';
    const password_hash = await bcrypt.hash(password, 10);
    console.log('Generated password hash for Test@2025:', password_hash);
    
    const result = await query(
      `INSERT INTO users (
        user_id, 
        first_name, 
        last_name, 
        email, 
        password_hash, 
        role, 
        designation, 
        is_active,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      RETURNING id, user_id, email, role, first_name, last_name`,
      [
        'DODM001',
        'Divisional',
        'Operations Manager',
        'dodm@oando.com',  // CHANGE THIS EMAIL after creation
        password_hash,
        'dodm',
        'Divisional Operations & Development Manager',
        true
      ]
    );
    
    console.log('✅ DODM user created successfully!');
    console.log('📧 Login credentials:');
    console.log(`   Email: ${result.rows[0].email}`);
    console.log(`   Password: ${password}`);
    console.log(`   Role: ${result.rows[0].role}`);
    console.log('\n⚠️  IMPORTANT: Change the email and password after first login!');
    
    process.exit(0);
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      console.log('ℹ️  DODM user already exists (user_id conflict)');
      const existing = await query(
        'SELECT id, user_id, email, role FROM users WHERE role = $1',
        ['dodm']
      );
      existing.rows.forEach(user => {
        console.log(`  - ${user.user_id} (${user.email})`);
      });
    } else {
      console.error('❌ Error creating DODM user:', error);
    }
    process.exit(1);
  }
}

createDODMUser();

