require("dotenv").config();

const {
    encrypt,
    decrypt
} = require("./services/encryptionService");

const originalData = {
    name: "Test User",
    email: "test@gmail.com",
    amount: 500
};

const encrypted =
    encrypt(originalData);

console.log("Encrypted:");
console.log(encrypted);

const decrypted =
    decrypt(encrypted);

console.log("\nDecrypted:");
console.log(decrypted);