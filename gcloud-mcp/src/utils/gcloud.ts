import { exec } from 'child_process';
import { promisify } from 'util';
import { GCloudCommandResult, GCloudConfig } from '../types.js';

const execAsync = promisify(exec);

/**
 * Check if gcloud CLI is installed
 */
export async function checkGCloudInstalled(): Promise<boolean> {
  try {
    const { stdout } = await execAsync('which gcloud');
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Check if user is authenticated with gcloud
 */
export async function checkGCloudAuth(): Promise<{ authenticated: boolean; account?: string; error?: string }> {
  try {
    const { stdout, stderr } = await execAsync('gcloud auth list --format=json');
    if (stderr && stderr.includes('No credentialed accounts')) {
      return { authenticated: false, error: 'No authenticated accounts found. Please run: gcloud auth login' };
    }
    
    const accounts = JSON.parse(stdout);
    const activeAccount = accounts.find((acc: any) => acc.status === 'ACTIVE');
    
    if (!activeAccount) {
      return { authenticated: false, error: 'No active account found. Please run: gcloud auth login' };
    }
    
    return { authenticated: true, account: activeAccount.account };
  } catch (error) {
    return { 
      authenticated: false, 
      error: `Failed to check authentication: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
}

/**
 * Get current gcloud configuration
 */
export async function getGCloudConfig(): Promise<GCloudConfig> {
  const config: GCloudConfig = {};
  
  try {
    const { stdout: project } = await execAsync('gcloud config get-value project 2>/dev/null');
    config.project = project.trim() || undefined;
  } catch {}
  
  try {
    const { stdout: zone } = await execAsync('gcloud config get-value compute/zone 2>/dev/null');
    config.zone = zone.trim() || undefined;
  } catch {}
  
  try {
    const { stdout: region } = await execAsync('gcloud config get-value compute/region 2>/dev/null');
    config.region = region.trim() || undefined;
  } catch {}
  
  return config;
}

/**
 * Validate gcloud setup before executing commands
 */
export async function validateGCloudSetup(): Promise<{ valid: boolean; error?: string; config?: GCloudConfig }> {
  // Check if gcloud is installed
  const isInstalled = await checkGCloudInstalled();
  if (!isInstalled) {
    return {
      valid: false,
      error: 'gcloud CLI is not installed. Please install it from: https://cloud.google.com/sdk/docs/install'
    };
  }
  
  // Check authentication
  const authCheck = await checkGCloudAuth();
  if (!authCheck.authenticated) {
    return {
      valid: false,
      error: authCheck.error
    };
  }
  
  // Get current configuration
  const config = await getGCloudConfig();
  if (!config.project) {
    return {
      valid: false,
      error: 'No project is set. Please run: gcloud config set project PROJECT_ID'
    };
  }
  
  return { valid: true, config };
}

// Cache validation result for 5 minutes to avoid repeated checks
let validationCache: { result: { valid: boolean; error?: string; config?: GCloudConfig }, timestamp: number } | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Execute a gcloud command with validation
 */
export async function executeGCloudCommand(command: string, options?: { skipValidation?: boolean; timeout?: number }): Promise<GCloudCommandResult> {
  // Skip validation for certain commands or use cached result
  if (!options?.skipValidation) {
    let validation;
    
    // Check cache
    if (validationCache && Date.now() - validationCache.timestamp < CACHE_DURATION) {
      validation = validationCache.result;
    } else {
      validation = await validateGCloudSetup();
      validationCache = { result: validation, timestamp: Date.now() };
    }
    
    if (!validation.valid) {
      return {
        stdout: '',
        stderr: validation.error || 'Invalid gcloud setup',
        exitCode: 1
      };
    }
  }
  
  try {
    // Set default timeout to 30 seconds
    const timeout = options?.timeout || 30000;
    const { stdout, stderr } = await execAsync(command, {
      timeout,
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    });
    return {
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exitCode: 0
    };
  } catch (error: any) {
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || error.message,
      exitCode: error.code || 1
    };
  }
}

/**
 * Parse JSON output from gcloud commands
 */
export function parseGCloudJson<T>(output: string): T | null {
  try {
    return JSON.parse(output) as T;
  } catch {
    return null;
  }
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleString();
  } catch {
    return timestamp;
  }
}