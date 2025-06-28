import { z } from 'zod';
import { ToolDefinition } from '../../../types/index.js';
import { execSync } from 'child_process';

const inputSchema = z.object({
  action: z.enum(['save', 'list', 'show', 'pop', 'apply', 'drop', 'clear']).default('save').describe('Stash action'),
  message: z.string().optional().describe('Stash message (for save)'),
  stashRef: z.string().optional().default('stash@{0}').describe('Stash reference (for show/pop/apply/drop)'),
  includeUntracked: z.boolean().optional().default(false).describe('Include untracked files'),
  keepIndex: z.boolean().optional().default(false).describe('Keep staged changes in index'),
  patch: z.boolean().optional().default(false).describe('Interactively select hunks')
});

const gitStashTool: ToolDefinition = {
  name: 'stash',
  description: 'Stash changes in a dirty working directory',
  category: 'git',
  subcategory: 'repository',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    // Interactive mode not supported
    if (params.patch) {
      return {
        content: [{
          type: 'text',
          text: 'Error: Interactive patch mode is not supported in this environment'
        }]
      };
    }
    
    let command = 'git stash';
    const args: string[] = [];
    
    switch (params.action) {
      case 'save':
        args.push('push');
        if (params.includeUntracked) args.push('-u');
        if (params.keepIndex) args.push('-k');
        if (params.message) args.push('-m', params.message);
        break;
        
      case 'list':
        args.push('list');
        break;
        
      case 'show':
        args.push('show', params.stashRef);
        break;
        
      case 'pop':
        args.push('pop', params.stashRef);
        break;
        
      case 'apply':
        args.push('apply', params.stashRef);
        break;
        
      case 'drop':
        args.push('drop', params.stashRef);
        break;
        
      case 'clear':
        args.push('clear');
        break;
    }
    
    if (args.length > 0) {
      command += ' ' + args.join(' ');
    }
    
    try {
      const output = execSync(command, { 
        encoding: 'utf-8',
        maxBuffer: 1024 * 1024 * 50 // 50MB buffer
      });
      
      let message = '';
      
      switch (params.action) {
        case 'save':
          const stashList = execSync('git stash list -1', { encoding: 'utf-8' }).trim();
          message = output.includes('No local changes') 
            ? 'No changes to stash'
            : `Stashed changes successfully\n${stashList}`;
          break;
          
        case 'list':
          message = output || 'No stashes found';
          break;
          
        case 'show':
          message = output || 'No information for this stash';
          break;
          
        case 'pop':
        case 'apply':
          const status = execSync('git status --short', { encoding: 'utf-8' });
          message = `Stash ${params.action === 'pop' ? 'popped' : 'applied'} successfully`;
          if (status) {
            message += '\n\nCurrent status:\n' + status;
          }
          break;
          
        case 'drop':
          message = `Dropped ${params.stashRef}`;
          break;
          
        case 'clear':
          message = 'All stashes cleared';
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
      
      if (errorMessage.includes('No stash entries found')) {
        return {
          content: [
            {
              type: 'text',
              text: 'Error: No stashes available'
            }
          ]
        };
      }
      
      if (errorMessage.includes('is not a valid reference')) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: Invalid stash reference '${params.stashRef}'`
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
            text: `Error executing git stash: ${errorMessage}`
          }
        ]
      };
    }
  }
};

export default gitStashTool;