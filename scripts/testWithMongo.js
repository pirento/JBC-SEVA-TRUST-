// Runs the whole test suite against a temporary MongoDB.
// Usage: npm run test:mongo
const { spawn } = require("child_process");
const { MongoMemoryServer } = require("mongodb-memory-server");

(async () => {
  const mongo = await MongoMemoryServer.create();
  const child = spawn(process.execPath, ["--test", "--test-force-exit"], {
    stdio: "inherit",
    env: { ...process.env, MONGODB_URI: mongo.getUri(), MONGODB_DB: "jbc_test" },
  });
  child.on("exit", async (code) => {
    await mongo.stop();
    process.exit(code);
  });
})();
