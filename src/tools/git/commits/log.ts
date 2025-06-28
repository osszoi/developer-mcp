import { z } from 'zod';
import { ToolDefinition } from '../../../types/index.js';
import { execSync } from 'child_process';

const inputSchema = z.object({
  count: z.number().optional().default(20).describe('Number of commits to show'),
  oneline: z.boolean().optional().default(false).describe('Show each commit on one line'),
  graph: z.boolean().optional().default(false).describe('Show ASCII graph of branch structure'),
  author: z.string().optional().describe('Filter by author name or email'),
  since: z.string().optional().describe('Show commits since date (e.g., "2 weeks ago")'),
  until: z.string().optional().describe('Show commits until date'),
  grep: z.string().optional().describe('Filter commits by message'),
  branch: z.string().optional().describe('Show commits from specific branch'),
  format: z.enum(['full', 'medium', 'short', 'oneline', 'hash']).optional().default('medium').describe('Output format')
});

const gitLogTool: ToolDefinition = {
  name: 'log',
  description: 'List Git commits with their hashes and information',
  category: 'git',
  subcategory: 'commits',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    let command = 'git log';
    const args: string[] = [];
    
    // Add count limit
    args.push(`-n ${params.count}`);
    
    // Handle format
    if (params.format === 'hash') {
      args.push('--pretty=format:%H');
    } else if (params.format === 'oneline' || params.oneline) {
      args.push('--oneline');
    } else if (params.format === 'short') {
      args.push('--pretty=short');
    } else if (params.format === 'full') {
      args.push('--pretty=full');
    } else {
      // Default medium format with hash, author, date, and message
      args.push('--pretty=format:%C(yellow)%H%C(reset) - %C(blue)%an%C(reset) (%C(green)%ar%C(reset))%n  %s%n');
    }
    
    if (params.graph) args.push('--graph');
    if (params.author) args.push(`--author="${params.author}"`);
    if (params.since) args.push(`--since="${params.since}"`);
    if (params.until) args.push(`--until="${params.until}"`);
    if (params.grep) args.push(`--grep="${params.grep}"`);
    if (params.branch) args.push(params.branch);
    
    if (args.length > 0) {
      command += ' ' + args.join(' ');
    }
    
    try {
      const output = execSync(command, { 
        encoding: 'utf-8',
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });
      
      return {
        content: [
          {
            type: 'text',
            text: output || 'No commits found'
          }
        ]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Check if it's a git repository
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
            text: `Error executing git log: ${errorMessage}`
          }
        ]
      };
    }
  }
};

export default gitLogTool;