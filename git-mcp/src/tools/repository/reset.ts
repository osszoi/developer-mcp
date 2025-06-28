import { z } from 'zod';
import { ToolDefinition } from '../../types.js';
import { execSync } from 'child_process';

const inputSchema = z.object({
  target: z.string().optional().default('HEAD').describe('Commit to reset to (default: HEAD)'),
  mode: z.enum(['soft', 'mixed', 'hard']).optional().default('mixed').describe('Reset mode'),
  paths: z.array(z.string()).optional().describe('Specific paths to reset')
});

const gitResetTool: ToolDefinition = {
  name: 'reset',
  description: 'Reset current HEAD to specified state',
  category: 'git',
  subcategory: 'repository',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    let command = 'git reset';
    const args: string[] = [];
    
    // Add mode
    args.push(`--${params.mode}`);
    
    // Add target
    args.push(params.target);
    
    // Add specific paths if provided
    if (params.paths && params.paths.length > 0) {
      args.push('--');
      args.push(...params.paths);
    }
    
    if (args.length > 0) {
      command += ' ' + args.join(' ');
    }
    
    try {
      execSync(command, { 
        encoding: 'utf-8',
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });
      
      // Get current status
      const status = execSync('git status --short', { encoding: 'utf-8' });
      const currentCommit = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
      
      let message = `Reset ${params.mode} to ${params.target}\n`;
      message += `HEAD is now at ${currentCommit}\n`;
      
      switch (params.mode) {
        case 'soft':
          message += '\nChanges kept in staging area';
          break;
        case 'mixed':
          message += '\nChanges kept in working directory (unstaged)';
          break;
        case 'hard':
          message += '\nAll changes discarded';
          break;
      }
      
      if (status) {
        message += '\n\nCurrent status:\n' + status;
      }
      
      return {
        content: [
          {
            type: 'text',
            text: message
          }
        ]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('unknown revision')) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: Invalid target '${params.target}'`
            }
          ]
        };
      }
      
      if (errorMessage.includes('not a git repository')) {
        return {
          content: [
            {
              type: 'text',
              text: 'Error: Not in a git repository'
            }
          ]
        };
      }
      
      return {
        content: [
          {
            type: 'text',
            text: `Error executing git reset: ${errorMessage}`
          }
        ]
      };
    }
  }
};

export default gitResetTool;