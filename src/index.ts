import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';

interface LogEntry {
  scope: string;
  timestamp: string;
  status: 'success' | 'error';
  token: string;
  expiresAt: string;
}

interface AgentKeyOptions {
  expiresIn?: number; // seconds
}

const LOG_FILE = 'agent-keys.log';

/**
 * Generates a fake scoped token (UUID) and executes the provided function
 * @param scope - The scope for the agent key (e.g., "github:repos.read")
 * @param fn - The function to execute with the agent key
 * @param options - Optional configuration for the agent key
 * @returns Promise that resolves to the result of the function execution
 */
export async function withAgentKey<T>(
  scope: string,
  fn: (token: string) => Promise<T> | T,
  options: AgentKeyOptions = {}
): Promise<T> {
  const { expiresIn = 10 } = options;
  
  // Generate a fake scoped token (UUID)
  const token = uuidv4();
  
  // Calculate expiration time
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  
  const logEntry: LogEntry = {
    scope,
    timestamp: new Date().toISOString(),
    status: 'success',
    token,
    expiresAt
  };
  
  try {
    // Execute the function with the token
    const result = await fn(token);
    
    // Log successful usage
    await logUsage(logEntry);
    
    return result;
  } catch (error) {
    // Log failed usage
    logEntry.status = 'error';
    await logUsage(logEntry);
    
    throw error;
  }
}

/**
 * Logs usage information to the local JSON file
 * @param entry - The log entry to write
 */
async function logUsage(entry: LogEntry): Promise<void> {
  try {
    let logs: LogEntry[] = [];
    
    // Read existing logs if file exists
    if (fs.existsSync(LOG_FILE)) {
      const fileContent = fs.readFileSync(LOG_FILE, 'utf-8');
      if (fileContent.trim()) {
        logs = JSON.parse(fileContent);
      }
    }
    
    // Add new entry
    logs.push(entry);
    
    // Write back to file
    fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
  } catch (error) {
    console.error('Failed to log usage:', error);
  }
}

/**
 * Reads and returns all logs from the log file
 * @returns Promise that resolves to an array of log entries
 */
export async function getLogs(): Promise<LogEntry[]> {
  try {
    if (!fs.existsSync(LOG_FILE)) {
      return [];
    }
    
    const fileContent = fs.readFileSync(LOG_FILE, 'utf-8');
    if (!fileContent.trim()) {
      return [];
    }
    
    return JSON.parse(fileContent);
  } catch (error) {
    console.error('Failed to read logs:', error);
    return [];
  }
}

/**
 * Clears all logs from the log file
 */
export async function clearLogs(): Promise<void> {
  try {
    if (fs.existsSync(LOG_FILE)) {
      fs.unlinkSync(LOG_FILE);
    }
  } catch (error) {
    console.error('Failed to clear logs:', error);
  }
}
