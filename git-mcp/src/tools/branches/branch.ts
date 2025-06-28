import { z } from 'zod';
import { ToolDefinition } from '../../types.js';
import { execSync } from 'child_process';

const inputSchema = z.object({
  action: z.enum(['list', 'create', 'delete', 'rename']).default('list').describe('Branch operation'),
  name: z.string().optional().describe('Branch name (for create/delete/rename)'),
  newName: z.string().optional().describe('New branch name (for rename)'),
  all: z.boolean().optional().default(false).describe('Show all branches including remote'),
  remote: z.boolean().optional().default(false).describe('Show only remote branches'),
  merged: z.boolean().optional().default(false).describe('Show only merged branches'),
  noMerged: z.boolean().optional().default(false).describe('Show only unmerged branches'),
  force: z.boolean().optional().default(false).describe('Force delete even if not merged'),
  verbose: z.boolean().optional().default(false).describe('Show more information')
});

const gitBranchTool: ToolDefinition = {
  name: 'branch',
  description: 'List, create, delete, or rename branches',
  category: 'git',
  subcategory: 'branches',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    let command = 'git branch';
    const args: string[] = [];
    
    switch (params.action) {
      case 'list':
        if (params.all) args.push('-a');
        else if (params.remote) args.push('-r');
        if (params.merged) args.push('--merged');
        if (params.noMerged) args.push('--no-merged');
        if (params.verbose) args.push('-v');
        break;
        
      case 'create':
        if (!params.name) {
          return {
            content: [{
              type: 'text',
              text: 'Error: Branch name is required for create action'
            }]
          };
        }
        args.push(params.name);
        break;
        
      case 'delete':
        if (!params.name) {
          return {
            content: [{
              type: 'text',
              text: 'Error: Branch name is required for delete action'
            }]
          };
        }
        args.push(params.force ? '-D' : '-d', params.name);
        break;
        
      case 'rename':
        if (!params.name || !params.newName) {
          return {
            content: [{
              type: 'text',
              text: 'Error: Both current name and new name are required for rename action'
            }]
          };
        }
        args.push('-m', params.name, params.newName);
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
          message = output || 'No branches found';
          break;
        case 'create':
          message = `Branch '${params.name}' created successfully`;
          break;
        case 'delete':
          message = `Branch '${params.name}' deleted successfully`;
          break;
        case 'rename':
          message = `Branch '${params.name}' renamed to '${params.newName}'`;
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
              text: `Error: Branch '${params.name}' already exists`
            }
          ]
        };
      }
      
      if (errorMessage.includes('not fully merged')) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: Branch '${params.name}' is not fully merged. Use force=true to delete anyway.`
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
            text: `Error executing git branch: ${errorMessage}`
          }
        ]
      };
    }
  }
};

export default gitBranchTool;