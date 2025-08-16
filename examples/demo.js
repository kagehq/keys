const { withAgentKey, getLogs } = require("../dist/index.js");

async function test() {
  console.log("🚀 Starting Kage Keys demo...\n");
  
  // Test successful execution
  await withAgentKey("github:repos.read", async (token) => {
    console.log("Agent is calling GitHub API...");
    console.log(`Using token: ${token.substring(0, 8)}...`);
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate API call
    console.log("✅ GitHub API call completed successfully!\n");
  });
  
  // Test with custom expiration time
  await withAgentKey("aws:s3.read", async (token) => {
    console.log("Agent is calling AWS S3 API...");
    console.log(`Using token: ${token.substring(0, 8)}...`);
    await new Promise(resolve => setTimeout(resolve, 50)); // Simulate API call
    console.log("✅ AWS S3 API call completed successfully!\n");
  }, { expiresIn: 30 });
  
  // Test error handling
  try {
    await withAgentKey("database:write", async (token) => {
      console.log("Agent is attempting database write...");
      console.log(`Using token: ${token.substring(0, 8)}...`);
      throw new Error("Database connection failed");
    });
  } catch (error) {
    console.log(`❌ Database operation failed: ${error.message}\n`);
  }
  
  // Display logs
  console.log("📊 Usage Logs:");
  const logs = await getLogs();
  console.log(JSON.stringify(logs, null, 2));
}

test().catch(console.error);
