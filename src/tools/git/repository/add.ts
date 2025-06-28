import { z } from 'zod';
import { ToolDefinition } from '../../../types/index.js';
import { execSync } from 'child_process';

const inputSchema = z.object({
  paths: z.array(z.string()).min(1).describe('Files or directories to add'),
  all: z.boolean().optional().default(false).describe('Add all changes (equivalent to git add -A)'),
  update: z.boolean().optional().default(false).describe('Update tracked files only'),
  force: z.boolean().optional().default(false).describe('Add ignored files'),
  interactive: z.boolean().optional().default(false).describe('Interactive mode'),
  patch: z.boolean().optional().default(false).describe('Interactively add hunks'),
  dryRun: z.boolean().optional().default(false).describe('Show what would be added')
});

const gitAddTool: ToolDefinition = {
  name: 'add',
  description: 'Add file contents to the staging area',
  category: 'git',
  subcategory: 'repository',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    let command = 'git add';
    const args: string[] = [];
    
    // Handle special flags
    if (params.all) {
      args.push('-A');
    } else if (params.update) {
      args.push('-u');
    }
    
    if (params.force) args.push('-f');
    if (params.dryRun) args.push('-n');
    
    // Interactive modes are not supported in non-TTY environment
    if (params.interactive || params.patch) {
      return {
        content: [
          {
            type: 'text',
            text: 'Error: Interactive mode is not supported in this environment. Please use specific file paths instead.'
          }
        ]
      };
    }
    
    // Add paths
    if (!params.all && !params.update) {
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
      
      // Get status to show what was added
      const statusOutput = execSync('git status --short', { encoding: 'utf-8' });
      
      let message = params.dryRun ? 'Would add:\n' : 'Successfully added:\n';
      
      if (params.all) {
        message += 'All changes';
      } else if (params.update) {
        message += 'All modified tracked files';
      } else {
        message += params.paths.join(', ');
      }
      
      if (statusOutput) {
        message += '\n\nCurrent status:\n' + statusOutput;
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
              text: `Error: No files matched the specified paths: ${params.paths.join(', ')}`
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
            text: `Error executing git add: ${errorMessage}`
          }
        ]
      };
    }
  }
};

export default gitAddTool;