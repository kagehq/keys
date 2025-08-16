# agent-keys

Scoped, expiring keys for AI agents — in 5 minutes.

## Why?
By default, AI agents get **full API keys** with unlimited access. That’s a disaster waiting to happen.
`agent-keys` gives you **scoped, temporary tokens** for each action, so your agents stay safe and auditable.

Stop giving your AI agents full API keys. 🔑 agent-keys lets you issue scoped, expiring tokens for agent actions in seconds.

✅ Scoped by service/action (e.g. github:repos.read)
✅ Auto-expires after 10s (configurable)
✅ Logs every action for debugging & compliance
✅ Drop-in wrapper around any async function

🔥 Perfect for debugging, demos, and making your AI agents safer today.


## Installation

```bash
npm install agent-keys
```

## Usage

### Basic Usage

```javascript
//const { withAgentKey, getLogs } = require("agent-keys");
import { withAgentKey, getLogs } from "agent-keys";

async function example() {
  await withAgentKey("github:repos.read", async (token) => {
    console.log("Agent is calling GitHub API...");
    console.log(`Using token: ${token}`);
    // Your API call logic here
  });
  
  // Get usage logs
  const logs = await getLogs();
  console.log(logs);
}
```

### With Custom Expiration

```javascript
await withAgentKey("aws:s3.read", async (token) => {
  // Your AWS S3 operations here
}, { expiresIn: 30 }); // 30 seconds
```

### Error Handling

```javascript
try {
  await withAgentKey("database:write", async (token) => {
    throw new Error("Database connection failed");
  });
} catch (error) {
  console.log("Operation failed:", error.message);
}
```

## API Reference

### `withAgentKey(scope, fn, options?)`

Generates a fake scoped token and executes the provided function.

**Parameters:**
- `scope` (string): The scope for the agent key (e.g., "github:repos.read")
- `fn` (function): The function to execute with the agent key
- `options` (object, optional): Configuration options
  - `expiresIn` (number, optional): Token expiration time in seconds (default: 10)

**Returns:** Promise that resolves to the result of the function execution

### `getLogs()`

Reads and returns all logs from the log file.

**Returns:** Promise that resolves to an array of log entries

### `clearLogs()`

Clears all logs from the log file.

**Returns:** Promise that resolves when logs are cleared

## Log Format

Logs are stored in `agent-keys.log` with the following structure:

```json
[
  {
    "scope": "github:repos.read",
    "timestamp": "2024-01-01T12:00:00.000Z",
    "status": "success",
    "token": "550e8400-e29b-41d4-a716-446655440000",
    "expiresAt": "2024-01-01T12:00:10.000Z"
  }
]
```

## Example

See the `examples/demo.js` file for a complete demonstration of all features.

```bash
# Run the demo
node examples/demo.js
```

Roadmap
	•	✅ Scoped, expiring tokens
	•	✅ Local logging
	•	⬜ Real API proxy integration
	•	⬜ Live revoke + approvals
	•	⬜ Enterprise dashboard


## License

This project is licensed under the FSL-1.1-MIT License. See the LICENSE file for details.
