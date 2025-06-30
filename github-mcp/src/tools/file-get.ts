import { z } from 'zod';
import { ToolDefinition } from '../types.js';
import { executeGitHubCommand, parseRepository } from '../utils/github.js';

const inputSchema = z.object({
  repository: z.string().describe('Repository in owner/repo format'),
  path: z.string().describe('Path to the file in the repository'),
  ref: z.string().optional().describe('Git reference (branch, tag, or commit SHA). Defaults to the default branch'),
  raw: z.boolean().optional().default(true).describe('Return raw file content without metadata')
});

const githubFileGetTool: ToolDefinition = {
  name: 'file_get',
  description: 'Get the content of a file from a GitHub repository',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    // Validate repository format
    const repoInfo = parseRepository(params.repository);
    if (!repoInfo) {
      return {
        content: [{
          type: 'text',
          text: 'Invalid repository format. Use: owner/repo'
        }],
        isError: true
      };
    }
    
    // Build the gh command
    let command = `gh api repos/${params.repository}/contents/${params.path}`;
    
    if (params.ref) {
      command += `?ref=${params.ref}`;
    }
    
    const result = await executeGitHubCommand(command);
    
    if (result.exitCode !== 0) {
      // Check if it's a 404 error
      if (result.stderr.includes('HTTP 404')) {
        return {
          content: [{
            type: 'text',
            text: `File not found: ${params.path} in ${params.repository}${params.ref ? ` at ${params.ref}` : ''}`
          }],
          isError: true
        };
      }
      
      return {
        content: [{
          type: 'text',
          text: `Error fetching file: ${result.stderr}`
        }],
        isError: true
      };
    }
    
    try {
      const fileData = JSON.parse(result.stdout);
      
      // Check if it's a directory
      if (Array.isArray(fileData)) {
        let output = `Directory listing for ${params.path} in ${params.repository}:\n\n`;
        fileData.forEach((item: any) => {
          const icon = item.type === 'dir' ? '📁' : '📄';
          output += `${icon} ${item.name}`;
          if (item.size) {
            output += ` (${item.size} bytes)`;
          }
          output += '\n';
        });
        
        return {
          content: [{
            type: 'text',
            text: output.trim()
          }]
        };
      }
      
      // It's a file
      if (fileData.type !== 'file') {
        return {
          content: [{
            type: 'text',
            text: `Error: ${params.path} is not a file (type: ${fileData.type})`
          }],
          isError: true
        };
      }
      
      // Decode base64 content
      const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
      
      if (params.raw) {
        return {
          content: [{
            type: 'text',
            text: content
          }]
        };
      }
      
      // Return with metadata
      let output = `File: ${params.path}\n`;
      output += `Repository: ${params.repository}\n`;
      output += `Size: ${fileData.size} bytes\n`;
      output += `SHA: ${fileData.sha}\n`;
      output += `URL: ${fileData.html_url}\n`;
      output += '\n' + '='.repeat(80) + '\n\n';
      output += content;
      
      return {
        content: [{
          type: 'text',
          text: output
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error processing file data: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
};

export default githubFileGetTool;