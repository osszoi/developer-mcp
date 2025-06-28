import { z } from 'zod';
import { ToolDefinition } from '../../../types/index.js';
import { execSync } from 'child_process';

const inputSchema = z.object({
  commit: z.string().default('HEAD').describe('Commit hash or reference (default: HEAD)'),
  stat: z.boolean().optional().default(false).describe('Show file statistics'),
  nameOnly: z.boolean().optional().default(false).describe('Show only file names'),
  patch: z.boolean().optional().default(true).describe('Show patch/diff'),
  format: z.enum(['full', 'summary', 'patch']).optional().default('full').describe('Output format')
});

const gitShowTool: ToolDefinition = {
  name: 'show',
  description: 'Show commit changes and information',
  category: 'git',
  subcategory: 'commits',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    let command = 'git show';
    const args: string[] = [];
    
    // Add commit reference
    args.push(params.commit);
    
    // Handle format options
    if (params.format === 'summary' || params.nameOnly) {
      args.push('--name-only');
    } else if (params.stat) {
      args.push('--stat');
    }
    
    if (!params.patch && params.format !== 'patch') {
      args.push('--no-patch');
    }
    
    if (args.length > 0) {
      command += ' ' + args.join(' ');
    }
    
    try {
      const output = execSync(command, { 
        encoding: 'utf-8',
        maxBuffer: 1024 * 1024 * 50 // 50MB buffer for large commits
      });
      
      return {
        content: [
          {
            type: 'text',
            text: output || 'No commit information found'
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
              text: `Error: Commit '${params.commit}' not found`
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
            text: `Error executing git show: ${errorMessage}`
          }
        ]
      };
    }
  }
};

export default gitShowTool;