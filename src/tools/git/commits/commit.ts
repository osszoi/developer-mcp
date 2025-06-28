import { z } from 'zod';
import { ToolDefinition } from '../../../types/index.js';
import { execSync } from 'child_process';

const inputSchema = z.object({
  message: z.string().describe('Commit message'),
  amend: z.boolean().optional().default(false).describe('Amend the previous commit'),
  all: z.boolean().optional().default(false).describe('Automatically stage all modified files'),
  author: z.string().optional().describe('Override author (format: "Name <email>")'),
  date: z.string().optional().describe('Override commit date'),
  noVerify: z.boolean().optional().default(false).describe('Skip pre-commit hooks'),
  signoff: z.boolean().optional().default(false).describe('Add Signed-off-by line'),
  allowEmpty: z.boolean().optional().default(false).describe('Allow empty commit')
});

const gitCommitTool: ToolDefinition = {
  name: 'commit',
  description: 'Record changes to the repository',
  category: 'git',
  subcategory: 'commits',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    let command = 'git commit';
    const args: string[] = [];
    
    // Add message
    args.push('-m', params.message);
    
    // Add flags
    if (params.amend) args.push('--amend');
    if (params.all) args.push('-a');
    if (params.noVerify) args.push('--no-verify');
    if (params.signoff) args.push('--signoff');
    if (params.allowEmpty) args.push('--allow-empty');
    
    // Add optional parameters
    if (params.author) args.push('--author', params.author);
    if (params.date) args.push('--date', params.date);
    
    if (args.length > 0) {
      command += ' ' + args.map(arg => {
        // Properly escape arguments that contain spaces
        if (arg.includes(' ') && !arg.startsWith('"')) {
          return `"${arg}"`;
        }
        return arg;
      }).join(' ');
    }
    
    try {
      const output = execSync(command, { 
        encoding: 'utf-8',
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });
      
      // Get the commit hash
      const commitHash = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
      const shortHash = commitHash.substring(0, 7);
      
      let message = params.amend ? 'Commit amended successfully\n' : 'Commit created successfully\n';
      message += `Commit: ${shortHash}\n`;
      message += output;
      
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
      
      if (errorMessage.includes('nothing to commit')) {
        return {
          content: [
            {
              type: 'text',
              text: 'Error: Nothing to commit. Working tree is clean.'
            }
          ]
        };
      }
      
      if (errorMessage.includes('no changes added to commit')) {
        return {
          content: [
            {
              type: 'text',
              text: 'Error: No changes added to commit. Use git_add to stage changes first, or use the "all" option.'
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
            text: `Error executing git commit: ${errorMessage}`
          }
        ]
      };
    }
  }
};

export default gitCommitTool;