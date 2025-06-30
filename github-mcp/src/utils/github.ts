import { exec } from 'child_process';
import { promisify } from 'util';
import { GitHubCommandResult } from '../types.js';

const execAsync = promisify(exec);

/**
 * Check if GitHub CLI is installed
 */
export async function checkGitHubCLIInstalled(): Promise<boolean> {
  try {
    const { stdout } = await execAsync('which gh');
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Check if user is authenticated with GitHub CLI
 */
export async function checkGitHubAuth(): Promise<{ authenticated: boolean; user?: string; error?: string }> {
  try {
    const { stdout, stderr } = await execAsync('gh auth status');
    
    // gh auth status returns non-zero exit code even when authenticated
    // so we need to parse the output
    if (stdout.includes('Logged in to github.com') || stderr.includes('Logged in to github.com')) {
      // Extract username
      const match = (stdout + stderr).match(/Logged in to github\.com as ([^\s]+)/);
      const user = match ? match[1] : undefined;
      return { authenticated: true, user };
    }
    
    return { authenticated: false, error: 'Not authenticated. Please run: gh auth login' };
  } catch (error: any) {
    // Check if the error output contains authentication info
    const output = error.stdout + error.stderr;
    if (output.includes('Logged in to github.com')) {
      const match = output.match(/Logged in to github\.com as ([^\s]+)/);
      const user = match ? match[1] : undefined;
      return { authenticated: true, user };
    }
    
    return { 
      authenticated: false, 
      error: 'Not authenticated. Please run: gh auth login'
    };
  }
}

/**
 * Validate GitHub CLI setup
 */
export async function validateGitHubSetup(): Promise<{ valid: boolean; error?: string; user?: string }> {
  // Check if GitHub CLI is installed
  const isInstalled = await checkGitHubCLIInstalled();
  if (!isInstalled) {
    return {
      valid: false,
      error: 'GitHub CLI (gh) is not installed. Please install it from: https://cli.github.com/'
    };
  }
  
  // Check authentication
  const authCheck = await checkGitHubAuth();
  if (!authCheck.authenticated) {
    return {
      valid: false,
      error: authCheck.error
    };
  }
  
  return { valid: true, user: authCheck.user };
}

// Cache validation result for 5 minutes
let validationCache: { result: { valid: boolean; error?: string; user?: string }, timestamp: number } | null = null;
const CACHE_DURATION = 5 * 60 * 1000;

/**
 * Execute a GitHub CLI command
 */
export async function executeGitHubCommand(
  command: string, 
  options?: { skipValidation?: boolean; timeout?: number }
): Promise<GitHubCommandResult> {
  // Skip validation for certain commands or use cached result
  if (!options?.skipValidation) {
    let validation;
    
    // Check cache
    if (validationCache && Date.now() - validationCache.timestamp < CACHE_DURATION) {
      validation = validationCache.result;
    } else {
      validation = await validateGitHubSetup();
      validationCache = { result: validation, timestamp: Date.now() };
    }
    
    if (!validation.valid) {
      return {
        stdout: '',
        stderr: validation.error || 'Invalid GitHub CLI setup',
        exitCode: 1
      };
    }
  }
  
  try {
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
 * Parse repository string (owner/repo format)
 */
export function parseRepository(repo: string): { owner: string; name: string } | null {
  const match = repo.match(/^([^\/]+)\/([^\/]+)$/);
  if (!match) {
    return null;
  }
  return {
    owner: match[1],
    name: match[2]
  };
}