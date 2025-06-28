import { z } from 'zod';
import { ToolDefinition } from '../../types.js';
import { execSync } from 'child_process';

const inputSchema = z.object({
  remote: z.string().optional().default('origin').describe('Remote to fetch from'),
  branch: z.string().optional().describe('Specific branch to fetch'),
  all: z.boolean().optional().default(false).describe('Fetch all remotes'),
  prune: z.boolean().optional().default(false).describe('Remove remote-tracking branches that no longer exist'),
  tags: z.boolean().optional().default(true).describe('Fetch tags'),
  depth: z.number().optional().describe('Limit fetching to specified number of commits'),
  force: z.boolean().optional().default(false).describe('Force update local branches')
});

const gitFetchTool: ToolDefinition = {
  name: 'fetch',
  description: 'Download objects and refs from another repository',
  category: 'git',
  subcategory: 'repository',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    let command = 'git fetch';
    const args: string[] = [];
    
    if (params.all) args.push('--all');
    if (params.prune) args.push('--prune');
    if (!params.tags) args.push('--no-tags');
    if (params.depth) args.push('--depth', params.depth.toString());
    if (params.force) args.push('--force');
    
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
        maxBuffer: 1024 * 1024 * 50 // 50MB buffer
      });
      
      // Get updated remote info
      const remoteBranches = execSync('git branch -r', { encoding: 'utf-8' });
      
      let message = output || 'Fetch completed';
      
      if (params.all) {
        message = 'Fetched from all remotes\n' + message;
      } else {
        message = `Fetched from ${params.remote}` + (params.branch ? ` (${params.branch})` : '') + '\n' + message;
      }
      
      if (params.prune && output.includes('pruned')) {
        const pruned = output.split('\n').filter(line => line.includes('pruned')).join('\n');
        message += '\n\nPruned branches:\n' + pruned;
      }
      
      // Show summary of remote branches
      const branchCount = remoteBranches.trim().split('\n').length;
      message += `\n\nRemote branches: ${branchCount}`;
      
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
      
      if (errorMessage.includes('Could not read from remote')) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: Could not fetch from remote '${params.remote}'. Check connection and permissions.`
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
            text: `Error executing git fetch: ${errorMessage}`
          }
        ]
      };
    }
  }
};

export default gitFetchTool;