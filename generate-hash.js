// Generate Bcrypt Hash for Testing@2025
// Run this in Node.js: node generate-hash.js

const bcrypt = require('bcrypt');

const password = 'Testing@2025';
const saltRounds = 10;

console.log('🔐 Generating bcrypt hash...\n');
console.log(`Password: "${password}"`);
console.log(`Salt Rounds: ${saltRounds}\n`);

// Generate hash
bcrypt.hash(password, saltRounds, (err, hash) => {
  if (err) {
    console.error('❌ Error generating hash:', err);
    return;
  }
  
  console.log('✅ Hash generated successfully!\n');
  console.log('📋 Copy this hash for your SQL file:');
  console.log('─'.repeat(70));
  console.log(hash);
  console.log('─'.repeat(70));
  console.log('\n');
  
  // Verify the hash works
  bcrypt.compare(password, hash, (err, result) => {
    if (err) {
      console.error('Error verifying:', err);
      return;
    }
    
    console.log('🔍 Verification test:');
    console.log(`Password matches hash: ${result ? '✅ YES' : '❌ NO'}`);
    
    if (result) {
      console.log('\n📝 SQL UPDATE statement:');
      console.log('─'.repeat(70));
      console.log(`UPDATE users SET password_hash = '${hash}' WHERE email = 'requestor@oando.com';`);
      console.log('─'.repeat(70));
    }
  });
});

// Alternative: Using async/await (cleaner)
async function generateHashAsync() {
  try {
    const hash = await bcrypt.hash(password, saltRounds);
    const isValid = await bcrypt.compare(password, hash);
    
    console.log('\n\n🔄 Async version (same result):');
    console.log(`Hash: ${hash}`);
    console.log(`Valid: ${isValid}`);
  } catch (error) {
    console.error('Error:', error);
  }
}

// Uncomment to run async version
// generateHashAsync();