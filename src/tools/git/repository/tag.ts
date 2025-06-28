import { z } from 'zod';
import { ToolDefinition } from '../../../types/index.js';
import { execSync } from 'child_process';

const inputSchema = z.object({
  action: z.enum(['list', 'create', 'delete', 'show']).default('list').describe('Tag action'),
  name: z.string().optional().describe('Tag name'),
  message: z.string().optional().describe('Tag message (creates annotated tag)'),
  target: z.string().optional().default('HEAD').describe('Object to tag'),
  force: z.boolean().optional().default(false).describe('Replace existing tag'),
  list: z.string().optional().describe('List tags matching pattern'),
  sort: z.string().optional().describe('Sort tags by key')
});

const gitTagTool: ToolDefinition = {
  name: 'tag',
  description: 'Create, list, delete or verify tags',
  category: 'git',
  subcategory: 'repository',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    let command = 'git tag';
    const args: string[] = [];
    
    switch (params.action) {
      case 'list':
        if (params.list) args.push('-l', params.list);
        if (params.sort) args.push('--sort', params.sort);
        break;
        
      case 'create':
        if (!params.name) {
          return {
            content: [{
              type: 'text',
              text: 'Error: Tag name is required for create action'
            }]
          };
        }
        if (params.message) {
          args.push('-a', params.name, '-m', params.message);
        } else {
          args.push(params.name);
        }
        if (params.force) args.push('-f');
        args.push(params.target);
        break;
        
      case 'delete':
        if (!params.name) {
          return {
            content: [{
              type: 'text',
              text: 'Error: Tag name is required for delete action'
            }]
          };
        }
        args.push('-d', params.name);
        break;
        
      case 'show':
        if (!params.name) {
          return {
            content: [{
              type: 'text',
              text: 'Error: Tag name is required for show action'
            }]
          };
        }
        command = 'git show';
        args.push(params.name);
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
          message = output || 'No tags found';
          break;
        case 'create':
          const tagInfo = execSync(`git show-ref tags/${params.name}`, { encoding: 'utf-8' }).trim();
          message = `Tag '${params.name}' created`;
          if (params.message) {
            message += ' (annotated)';
          }
          message += `\n${tagInfo}`;
          break;
        case 'delete':
          message = `Tag '${params.name}' deleted`;
          break;
        case 'show':
          message = output;
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
      
      if (errorMessage.includes('already exists')) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: Tag '${params.name}' already exists. Use force=true to replace.`
            }
          ]
        };
      }
      
      if (errorMessage.includes('not found')) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: Tag '${params.name}' not found`
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
            text: `Error executing git tag: ${errorMessage}`
          }
        ]
      };
    }
  }
};

export default gitTagTool;