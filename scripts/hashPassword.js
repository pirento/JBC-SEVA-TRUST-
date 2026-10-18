// Prints a bcrypt hash for ADMIN_PASSWORD_HASH in .env
// Usage: npm run hash-password -- "your-strong-password"
const bcrypt = require("bcrypt");

const password = process.argv[2];

if (!password || password.length < 10) {
  console.error('Usage: npm run hash-password -- "password (at least 10 characters)"');
  process.exit(1);
}

bcrypt.hash(password, 12).then((hash) => {
  console.log(`ADMIN_PASSWORD_HASH=${hash}`);
});
