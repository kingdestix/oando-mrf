// backend/createAdmin.js
// Script to create admin user with correct password hash

require('dotenv').config();
const bcrypt = require('bcrypt');
const { query } = require('./config/database');

function parseArgs() {
  const args = process.argv.slice(2);
  return args.reduce((acc, current) => {
    const [key, value] = current.split('=');
    if (key && value) {
      acc[key.replace(/^--/, '')] = value;
    }
    return acc;
  }, {});
}

async function createAdmin() {
  try {
    const overrides = parseArgs();
    const config = {
      email: overrides.email || process.env.ADMIN_EMAIL || 'admin@oando.com',
      password: overrides.password || process.env.ADMIN_PASSWORD || 'Admin@123',
      firstName: overrides.firstName || 'System',
      lastName: overrides.lastName || 'Administrator',
      userId: overrides.userId || 'ADMIN001',
      role: overrides.role || 'admin',
      approvalLevel: Number(overrides.approvalLevel ?? process.env.APPROVAL_LEVEL ?? 4),
      designation: overrides.designation || 'System Administrator',
      location: overrides.location || 'Head Office'
    };

    if (Number.isNaN(config.approvalLevel)) {
      throw new Error('approvalLevel must be a number (0-4).');
    }

    console.log(`Creating user ${config.email} with role "${config.role}" (approval level ${config.approvalLevel})...`);

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(config.password, salt);

    await query('DELETE FROM users WHERE email = $1', [config.email]);
    console.log('Deleted existing user with same email (if any).');

    const result = await query(
      `INSERT INTO users (
        user_id, first_name, last_name, email, password_hash, role, approval_level,
        designation, location, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
      RETURNING id, email, role, approval_level`,
      [
        config.userId,
        config.firstName,
        config.lastName,
        config.email,
        passwordHash,
        config.role,
        config.approvalLevel,
        config.designation,
        config.location
      ]
    );

    console.log('✓ User created:', result.rows[0]);

    console.log('\n=================================');
    console.log('Login credentials');
    console.log('=================================');
    console.log(`Email:    ${config.email}`);
    console.log(`Password: ${config.password}`);
    console.log(`Role:     ${config.role}`);
    console.log(`Level:    ${config.approvalLevel}`);
    console.log('=================================\n');

    process.exit(0);
  } catch (error) {
    console.error('Error creating admin:', error);
    process.exit(1);
  }
}

createAdmin();