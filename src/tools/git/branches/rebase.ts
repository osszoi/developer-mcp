import { z } from 'zod';
import { ToolDefinition } from '../../../types/index.js';
import { execSync } from 'child_process';

const inputSchema = z.object({
  onto: z.string().describe('Branch or commit to rebase onto'),
  branch: z.string().optional().describe('Branch to rebase (default: current branch)'),
  interactive: z.boolean().optional().default(false).describe('Interactive rebase'),
  continue: z.boolean().optional().default(false).describe('Continue after resolving conflicts'),
  abort: z.boolean().optional().default(false).describe('Abort current rebase'),
  skip: z.boolean().optional().default(false).describe('Skip current commit'),
  autosquash: z.boolean().optional().default(false).describe('Auto-squash fixup commits'),
  preserveMerges: z.boolean().optional().default(false).describe('Preserve merge commits')
});

const gitRebaseTool: ToolDefinition = {
  name: 'rebase',
  description: 'Reapply commits on top of another base tip',
  category: 'git',
  subcategory: 'branches',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    // Handle rebase operations
    if (params.continue) {
      try {
        const output = execSync('git rebase --continue', { encoding: 'utf-8' });
        return {
          content: [{
            type: 'text',
            text: 'Rebase continued successfully\n' + output
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Error continuing rebase: ${error instanceof Error ? error.message : String(error)}`
          }]
        };
      }
    }
    
    if (params.abort) {
      try {
        execSync('git rebase --abort', { encoding: 'utf-8' });
        return {
          content: [{
            type: 'text',
            text: 'Rebase aborted successfully'
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Error aborting rebase: ${error instanceof Error ? error.message : String(error)}`
          }]
        };
      }
    }
    
    if (params.skip) {
      try {
        const output = execSync('git rebase --skip', { encoding: 'utf-8' });
        return {
          content: [{
            type: 'text',
            text: 'Skipped current commit\n' + output
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Error skipping commit: ${error instanceof Error ? error.message : String(error)}`
          }]
        };
      }
    }
    
    // Interactive rebase not supported in non-TTY
    if (params.interactive) {
      return {
        content: [{
          type: 'text',
          text: 'Error: Interactive rebase is not supported in this environment'
        }]
      };
    }
    
    let command = 'git rebase';
    const args: string[] = [];
    
    if (params.autosquash) args.push('--autosquash');
    if (params.preserveMerges) args.push('--preserve-merges');
    
    // Add onto target
    args.push(params.onto);
    
    // Add branch if specified
    if (params.branch) {
      args.push(params.branch);
    }
    
    if (args.length > 0) {
      command += ' ' + args.join(' ');
    }
    
    try {
      const output = execSync(command, { 
        encoding: 'utf-8',
        maxBuffer: 1024 * 1024 * 50 // 50MB buffer
      });
      
      const status = execSync('git status --short', { encoding: 'utf-8' });
      
      let message = output || 'Rebase completed successfully';
      
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
      
      if (errorMessage.includes('CONFLICT')) {
        const conflicts = execSync('git diff --name-only --diff-filter=U', { encoding: 'utf-8' });
        return {
          content: [
            {
              type: 'text',
              text: `Rebase conflict in:\n${conflicts}\nResolve conflicts, stage changes, then use continue=true`
            }
          ]
        };
      }
      
      if (errorMessage.includes('There is no tracking information')) {
        return {
          content: [
            {
              type: 'text',
              text: 'Error: No tracking information for current branch'
            }
          ]
        };
      }
      
      return {
        content: [
          {
            type: 'text',
            text: `Error executing git rebase: ${errorMessage}`
          }
        ]
      };
    }
  }
};

export default gitRebaseTool;