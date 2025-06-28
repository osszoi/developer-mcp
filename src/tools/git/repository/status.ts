import { z } from 'zod';
import { ToolDefinition } from '../../../types/index.js';
import { execSync } from 'child_process';

const inputSchema = z.object({
  short: z.boolean().optional().default(false).describe('Give output in short format'),
  branch: z.boolean().optional().default(true).describe('Show branch information'),
  porcelain: z.boolean().optional().default(false).describe('Machine-readable output'),
  ignored: z.boolean().optional().default(false).describe('Show ignored files'),
  untracked: z.enum(['normal', 'all', 'no']).optional().default('normal').describe('Show untracked files')
});

const gitStatusTool: ToolDefinition = {
  name: 'status',
  description: 'Show the working tree status',
  category: 'git',
  subcategory: 'repository',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    let command = 'git status';
    const args: string[] = [];
    
    if (params.short) {
      args.push('-s');
    }
    
    if (params.branch && !params.porcelain) {
      args.push('-b');
    }
    
    if (params.porcelain) {
      args.push('--porcelain=v1');
    }
    
    if (params.ignored) {
      args.push('--ignored');
    }
    
    // Handle untracked files
    if (params.untracked === 'all') {
      args.push('-u');
    } else if (params.untracked === 'no') {
      args.push('-uno');
    }
    
    if (args.length > 0) {
      command += ' ' + args.join(' ');
    }
    
    try {
      const output = execSync(command, { 
        encoding: 'utf-8',
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });
      
      if (!output.trim() && (params.short || params.porcelain)) {
        return {
          content: [
            {
              type: 'text',
              text: 'Working tree clean'
            }
          ]
        };
      }
      
      return {
        content: [
          {
            type: 'text',
            text: output || 'No status information available'
          }
        ]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
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
            text: `Error executing git status: ${errorMessage}`
          }
        ]
      };
    }
  }
};

export default gitStatusTool;