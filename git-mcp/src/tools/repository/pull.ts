import { z } from 'zod';
import { ToolDefinition } from '../../types.js';
import { execSync } from 'child_process';

const inputSchema = z.object({
  remote: z.string().optional().default('origin').describe('Remote repository name'),
  branch: z.string().optional().describe('Remote branch to pull from'),
  rebase: z.boolean().optional().default(false).describe('Rebase instead of merge'),
  noCommit: z.boolean().optional().default(false).describe('Perform merge but do not commit'),
  noFf: z.boolean().optional().default(false).describe('Create merge commit even for fast-forward'),
  ffOnly: z.boolean().optional().default(false).describe('Refuse to merge unless fast-forward'),
  strategy: z.string().optional().describe('Merge strategy to use'),
  all: z.boolean().optional().default(false).describe('Fetch all remotes')
});

const gitPullTool: ToolDefinition = {
  name: 'pull',
  description: 'Fetch from and integrate with another repository or branch',
  category: 'git',
  subcategory: 'repository',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    let command = 'git pull';
    const args: string[] = [];
    
    if (params.rebase) args.push('--rebase');
    if (params.noCommit) args.push('--no-commit');
    if (params.noFf) args.push('--no-ff');
    if (params.ffOnly) args.push('--ff-only');
    if (params.all) args.push('--all');
    if (params.strategy) args.push('--strategy', params.strategy);
    
    // Add remote and branch
    if (!params.all) {
      args.push(params.remote);
      if (params.branch) {
        args.push(params.branch);
      }
    }
    
    if (args.length > 0) {
      command += ' ' + args.join(' ');
    }
    
    try {
      const output = execSync(command, { 
        encoding: 'utf-8',
        maxBuffer: 1024 * 1024 * 50 // 50MB buffer for large pulls
      });
      
      // Get updated status
      const status = execSync('git status --short', { encoding: 'utf-8' });
      
      let message = output || 'Pull completed successfully';
      
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
      
      if (errorMessage.includes('no tracking information')) {
        return {
          content: [
            {
              type: 'text',
              text: 'Error: No tracking information for current branch. Specify remote and branch.'
            }
          ]
        };
      }
      
      if (errorMessage.includes('Automatic merge failed')) {
        return {
          content: [
            {
              type: 'text',
              text: 'Error: Merge conflict occurred. Resolve conflicts and commit the result.'
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
            text: `Error executing git pull: ${errorMessage}`
          }
        ]
      };
    }
  }
};

export default gitPullTool;