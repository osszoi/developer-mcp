import { z } from 'zod';
import { ToolDefinition } from '../../../types/index.js';
import { execSync } from 'child_process';

const inputSchema = z.object({
  branch: z.string().describe('Branch to merge into current branch'),
  noCommit: z.boolean().optional().default(false).describe('Perform merge but do not commit'),
  noFf: z.boolean().optional().default(false).describe('Create merge commit even for fast-forward'),
  ffOnly: z.boolean().optional().default(false).describe('Refuse to merge unless fast-forward'),
  squash: z.boolean().optional().default(false).describe('Squash commits into single commit'),
  strategy: z.string().optional().describe('Merge strategy (recursive, ours, theirs, etc.)'),
  message: z.string().optional().describe('Custom merge commit message'),
  abort: z.boolean().optional().default(false).describe('Abort current merge')
});

const gitMergeTool: ToolDefinition = {
  name: 'merge',
  description: 'Join two or more development histories together',
  category: 'git',
  subcategory: 'branches',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    // Handle merge abort
    if (params.abort) {
      try {
        execSync('git merge --abort', { encoding: 'utf-8' });
        return {
          content: [
            {
              type: 'text',
              text: 'Merge aborted successfully'
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error aborting merge: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
      }
    }
    
    let command = 'git merge';
    const args: string[] = [];
    
    if (params.noCommit) args.push('--no-commit');
    if (params.noFf) args.push('--no-ff');
    if (params.ffOnly) args.push('--ff-only');
    if (params.squash) args.push('--squash');
    if (params.strategy) args.push('--strategy', params.strategy);
    if (params.message) args.push('-m', params.message);
    
    // Add branch to merge
    args.push(params.branch);
    
    if (args.length > 0) {
      command += ' ' + args.join(' ');
    }
    
    try {
      const output = execSync(command, { 
        encoding: 'utf-8',
        maxBuffer: 1024 * 1024 * 50 // 50MB buffer
      });
      
      // Get merge status
      const status = execSync('git status --short', { encoding: 'utf-8' });
      
      let message = output || 'Merge completed successfully';
      
      if (params.squash && params.noCommit) {
        message += '\n\nChanges staged for commit. Use git_commit to complete.';
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
      
      if (errorMessage.includes('CONFLICT')) {
        const conflicts = execSync('git diff --name-only --diff-filter=U', { encoding: 'utf-8' });
        return {
          content: [
            {
              type: 'text',
              text: `Merge conflict in:\n${conflicts}\nResolve conflicts, stage changes, and commit. Or use abort=true to cancel.`
            }
          ]
        };
      }
      
      if (errorMessage.includes('not something we can merge')) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: Branch '${params.branch}' not found or cannot be merged`
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
            text: `Error executing git merge: ${errorMessage}`
          }
        ]
      };
    }
  }
};

export default gitMergeTool;