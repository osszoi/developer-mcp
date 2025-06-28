import { z } from 'zod';
import { ToolDefinition } from '../../types.js';
import { execSync } from 'child_process';
import path from 'path';

const inputSchema = z.object({
  url: z.string().describe('Repository URL to clone'),
  directory: z.string().optional().describe('Directory to clone into'),
  branch: z.string().optional().describe('Branch to checkout after cloning'),
  depth: z.number().optional().describe('Create shallow clone with history depth'),
  recursive: z.boolean().optional().default(false).describe('Initialize submodules'),
  bare: z.boolean().optional().default(false).describe('Create bare repository'),
  quiet: z.boolean().optional().default(false).describe('Suppress output')
});

const gitCloneTool: ToolDefinition = {
  name: 'clone',
  description: 'Clone a repository into a new directory',
  category: 'git',
  subcategory: 'repository',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    let command = 'git clone';
    const args: string[] = [];
    
    if (params.branch) args.push('-b', params.branch);
    if (params.depth) args.push('--depth', params.depth.toString());
    if (params.recursive) args.push('--recursive');
    if (params.bare) args.push('--bare');
    if (params.quiet) args.push('--quiet');
    
    // Add URL
    args.push(params.url);
    
    // Add directory if specified
    if (params.directory) {
      args.push(params.directory);
    }
    
    if (args.length > 0) {
      command += ' ' + args.join(' ');
    }
    
    try {
      const output = execSync(command, { 
        encoding: 'utf-8',
        maxBuffer: 1024 * 1024 * 50 // 50MB buffer
      });
      
      // Extract repository name from URL if directory not specified
      const repoName = params.directory || path.basename(params.url, '.git');
      
      let message = `Successfully cloned repository to ${repoName}`;
      
      if (params.branch) {
        message += `\nChecked out branch: ${params.branch}`;
      }
      
      if (params.depth) {
        message += `\nShallow clone with depth: ${params.depth}`;
      }
      
      if (!params.quiet && output) {
        message += '\n\n' + output;
      }
      
      // Show basic info about the cloned repo
      try {
        const repoPath = params.directory || repoName;
        const branchInfo = execSync(`cd ${repoPath} && git branch --show-current`, { encoding: 'utf-8' }).trim();
        const commitInfo = execSync(`cd ${repoPath} && git log -1 --oneline`, { encoding: 'utf-8' }).trim();
        
        message += `\n\nCurrent branch: ${branchInfo}`;
        message += `\nLatest commit: ${commitInfo}`;
      } catch {
        // Ignore errors getting repo info
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
      
      if (errorMessage.includes('already exists and is not an empty directory')) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: Directory '${params.directory || path.basename(params.url, '.git')}' already exists`
            }
          ]
        };
      }
      
      if (errorMessage.includes('Repository not found') || errorMessage.includes('Could not read from remote')) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: Could not access repository '${params.url}'. Check URL and permissions.`
            }
          ]
        };
      }
      
      return {
        content: [
          {
            type: 'text',
            text: `Error executing git clone: ${errorMessage}`
          }
        ]
      };
    }
  }
};

export default gitCloneTool;