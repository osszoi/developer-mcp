import { z } from 'zod';
import { ToolDefinition } from '../../../types/index.js';
import { execSync } from 'child_process';

const inputSchema = z.object({
  remote: z.string().optional().default('origin').describe('Remote repository name'),
  branch: z.string().optional().describe('Branch to push (default: current branch)'),
  force: z.boolean().optional().default(false).describe('Force push (overwrite remote)'),
  forceLease: z.boolean().optional().default(false).describe('Force push with lease (safer)'),
  tags: z.boolean().optional().default(false).describe('Push tags'),
  setUpstream: z.boolean().optional().default(false).describe('Set upstream branch'),
  delete: z.boolean().optional().default(false).describe('Delete remote branch'),
  all: z.boolean().optional().default(false).describe('Push all branches'),
  dryRun: z.boolean().optional().default(false).describe('Show what would be pushed')
});

const gitPushTool: ToolDefinition = {
  name: 'push',
  description: 'Update remote refs along with associated objects',
  category: 'git',
  subcategory: 'repository',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    let command = 'git push';
    const args: string[] = [];
    
    if (params.force) args.push('--force');
    else if (params.forceLease) args.push('--force-with-lease');
    if (params.tags) args.push('--tags');
    if (params.setUpstream) args.push('--set-upstream');
    if (params.delete) args.push('--delete');
    if (params.all) args.push('--all');
    if (params.dryRun) args.push('--dry-run');
    
    // Add remote
    args.push(params.remote);
    
    // Add branch or ref
    if (!params.all && params.branch) {
      args.push(params.branch);
    }
    
    if (args.length > 0) {
      command += ' ' + args.join(' ');
    }
    
    try {
      const output = execSync(command, { 
        encoding: 'utf-8',
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });
      
      let message = '';
      
      if (params.dryRun) {
        message = 'Dry run - would push:\n' + output;
      } else if (params.delete) {
        message = `Deleted remote branch ${params.branch}`;
      } else {
        message = output || 'Push completed successfully';
        
        // Add helpful info about the push
        if (params.setUpstream) {
          message += `\nUpstream set to ${params.remote}/${params.branch || 'current branch'}`;
        }
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
      
      if (errorMessage.includes('no upstream branch')) {
        return {
          content: [
            {
              type: 'text',
              text: 'Error: No upstream branch set. Use setUpstream=true or specify branch name.'
            }
          ]
        };
      }
      
      if (errorMessage.includes('rejected')) {
        return {
          content: [
            {
              type: 'text',
              text: 'Error: Push rejected. Remote has changes not in local. Pull first or use force=true.'
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
            text: `Error executing git push: ${errorMessage}`
          }
        ]
      };
    }
  }
};

export default gitPushTool;