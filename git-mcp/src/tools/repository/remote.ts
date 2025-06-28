import { z } from 'zod';
import { ToolDefinition } from '../../types.js';
import { execSync } from 'child_process';

const inputSchema = z.object({
  action: z.enum(['list', 'add', 'remove', 'rename', 'show', 'set-url']).default('list').describe('Remote action'),
  name: z.string().optional().describe('Remote name'),
  url: z.string().optional().describe('Remote URL (for add/set-url)'),
  newName: z.string().optional().describe('New name (for rename)'),
  verbose: z.boolean().optional().default(false).describe('Show remote URLs')
});

const gitRemoteTool: ToolDefinition = {
  name: 'remote',
  description: 'Manage set of tracked repositories',
  category: 'git',
  subcategory: 'repository',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    let command = 'git remote';
    const args: string[] = [];
    
    switch (params.action) {
      case 'list':
        if (params.verbose) args.push('-v');
        break;
        
      case 'add':
        if (!params.name || !params.url) {
          return {
            content: [{
              type: 'text',
              text: 'Error: Name and URL are required for add action'
            }]
          };
        }
        args.push('add', params.name, params.url);
        break;
        
      case 'remove':
        if (!params.name) {
          return {
            content: [{
              type: 'text',
              text: 'Error: Remote name is required for remove action'
            }]
          };
        }
        args.push('remove', params.name);
        break;
        
      case 'rename':
        if (!params.name || !params.newName) {
          return {
            content: [{
              type: 'text',
              text: 'Error: Current name and new name are required for rename action'
            }]
          };
        }
        args.push('rename', params.name, params.newName);
        break;
        
      case 'show':
        args.push('show');
        if (params.name) args.push(params.name);
        break;
        
      case 'set-url':
        if (!params.name || !params.url) {
          return {
            content: [{
              type: 'text',
              text: 'Error: Name and URL are required for set-url action'
            }]
          };
        }
        args.push('set-url', params.name, params.url);
        break;
    }
    
    if (args.length > 0) {
      command += ' ' + args.join(' ');
    }
    
    try {
      const output = execSync(command, { 
        encoding: 'utf-8',
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });
      
      let message = '';
      
      switch (params.action) {
        case 'list':
          message = output || 'No remotes configured';
          break;
        case 'add':
          message = `Remote '${params.name}' added with URL: ${params.url}`;
          break;
        case 'remove':
          message = `Remote '${params.name}' removed`;
          break;
        case 'rename':
          message = `Remote '${params.name}' renamed to '${params.newName}'`;
          break;
        case 'show':
          message = output || 'No information available';
          break;
        case 'set-url':
          message = `URL for remote '${params.name}' set to: ${params.url}`;
          break;
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
      
      if (errorMessage.includes('No such remote')) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: Remote '${params.name}' not found`
            }
          ]
        };
      }
      
      if (errorMessage.includes('already exists')) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: Remote '${params.name || params.newName}' already exists`
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
            text: `Error executing git remote: ${errorMessage}`
          }
        ]
      };
    }
  }
};

export default gitRemoteTool;