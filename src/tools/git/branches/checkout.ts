import { z } from 'zod';
import { ToolDefinition } from '../../../types/index.js';
import { execSync } from 'child_process';

const inputSchema = z.object({
  target: z.string().describe('Branch name, tag, or commit to checkout'),
  create: z.boolean().optional().default(false).describe('Create new branch'),
  force: z.boolean().optional().default(false).describe('Force checkout (discard local changes)'),
  track: z.boolean().optional().default(true).describe('Set up tracking for remote branch'),
  detach: z.boolean().optional().default(false).describe('Detach HEAD at the commit'),
  merge: z.boolean().optional().default(false).describe('Merge local changes when switching'),
  orphan: z.boolean().optional().default(false).describe('Create new orphan branch')
});

const gitCheckoutTool: ToolDefinition = {
  name: 'checkout',
  description: 'Switch branches or restore working tree files',
  category: 'git',
  subcategory: 'branches',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    let command = 'git checkout';
    const args: string[] = [];
    
    // Handle different checkout modes
    if (params.create) {
      args.push('-b');
    } else if (params.orphan) {
      args.push('--orphan');
    }
    
    if (params.force) args.push('-f');
    if (params.detach) args.push('--detach');
    if (params.merge) args.push('-m');
    if (!params.track && params.create) args.push('--no-track');
    
    // Add target
    args.push(params.target);
    
    if (args.length > 0) {
      command += ' ' + args.join(' ');
    }
    
    try {
      const output = execSync(command, { 
        encoding: 'utf-8',
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });
      
      // Get current branch info
      const currentBranch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
      const status = execSync('git status --short', { encoding: 'utf-8' });
      
      let message = '';
      if (params.create) {
        message = `Created and switched to new branch '${params.target}'`;
      } else if (params.orphan) {
        message = `Created orphan branch '${params.target}'`;
      } else if (currentBranch) {
        message = `Switched to branch '${currentBranch}'`;
      } else {
        message = `HEAD is now at ${params.target}`;
      }
      
      if (output.includes('Your branch is')) {
        message += '\n' + output.split('\n').find(line => line.includes('Your branch is'));
      }
      
      if (status) {
        message += '\n\nWorking tree status:\n' + status;
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
      
      if (errorMessage.includes('pathspec') && errorMessage.includes('did not match')) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: Branch or reference '${params.target}' not found`
            }
          ]
        };
      }
      
      if (errorMessage.includes('already exists')) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: Branch '${params.target}' already exists`
            }
          ]
        };
      }
      
      if (errorMessage.includes('Your local changes')) {
        return {
          content: [
            {
              type: 'text',
              text: 'Error: You have local changes that would be overwritten. Commit, stash, or use force=true to discard them.'
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
            text: `Error executing git checkout: ${errorMessage}`
          }
        ]
      };
    }
  }
};

export default gitCheckoutTool;