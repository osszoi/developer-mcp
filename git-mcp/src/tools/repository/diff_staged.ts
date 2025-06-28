import { z } from 'zod';
import { ToolDefinition } from '../../types.js';
import { execSync } from 'child_process';

const inputSchema = z.object({
  nameOnly: z.boolean().optional().default(false).describe('Show only file names'),
  stat: z.boolean().optional().default(false).describe('Show file statistics'),
  numstat: z.boolean().optional().default(false).describe('Show numeric statistics'),
  color: z.boolean().optional().default(true).describe('Show colored diff'),
  unified: z.number().optional().default(3).describe('Number of context lines'),
  path: z.string().optional().describe('Limit diff to specific path or file'),
  cached: z.boolean().optional().default(true).describe('Show staged changes (always true for this tool)'),
  ignoreLockFiles: z.boolean().optional().default(true).describe('Ignore lock files (package-lock.json, yarn.lock, etc.)')
});

const LOCK_FILES = [
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'composer.lock',
  'Gemfile.lock',
  'poetry.lock',
  'Pipfile.lock',
  'cargo.lock',
  'go.sum',
  'pubspec.lock',
  'mix.lock',
  'flake.lock',
  'pdm.lock',
  'bun.lockb'
];

const gitDiffStagedTool: ToolDefinition = {
  name: 'diff_staged',
  description: 'Show staged changes ready to be committed',
  category: 'git',
  subcategory: 'repository',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    let command = 'git diff --cached';
    const args: string[] = [];
    
    // Add display options
    if (params.nameOnly) {
      args.push('--name-only');
    } else if (params.stat) {
      args.push('--stat');
    } else if (params.numstat) {
      args.push('--numstat');
    }
    
    if (!params.color) {
      args.push('--no-color');
    }
    
    args.push(`-U${params.unified}`);
    
    // Add exclusions for lock files
    if (params.ignoreLockFiles) {
      LOCK_FILES.forEach(lockFile => {
        args.push(`:(exclude)*/${lockFile}`);
        args.push(`:(exclude)${lockFile}`);
      });
    }
    
    // Add specific path if provided
    if (params.path) {
      args.push('--', params.path);
    }
    
    if (args.length > 0) {
      command += ' ' + args.join(' ');
    }
    
    try {
      const output = execSync(command, { 
        encoding: 'utf-8',
        maxBuffer: 1024 * 1024 * 100 // 100MB buffer
      });
      
      if (!output.trim()) {
        return {
          content: [
            {
              type: 'text',
              text: 'No staged changes found' + (params.ignoreLockFiles ? ' (lock files ignored)' : '')
            }
          ]
        };
      }
      
      return {
        content: [
          {
            type: 'text',
            text: output
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
            text: `Error executing git diff --cached: ${errorMessage}`
          }
        ]
      };
    }
  }
};

export default gitDiffStagedTool;