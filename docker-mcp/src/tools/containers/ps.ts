import { z } from 'zod';
import { ToolDefinition } from '../../types.js';
import { execSync } from 'child_process';

const inputSchema = z.object({
  all: z.boolean().optional().default(false).describe('Show all containers (default shows just running)'),
  filter: z.string().optional().describe('Filter output based on conditions (e.g., "status=running")'),
  format: z.enum(['table', 'json', 'id', 'name']).optional().default('table').describe('Output format'),
  last: z.number().optional().describe('Show n last created containers'),
  size: z.boolean().optional().default(false).describe('Display total file sizes')
});

const dockerPsTool: ToolDefinition = {
  name: 'ps',
  description: 'List Docker containers with various filtering and formatting options',
  category: 'docker',
  subcategory: 'containers',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const { all, filter, format, last, size } = inputSchema.parse(input);
    
    let command = 'docker ps';
    
    // Build command arguments
    const args: string[] = [];
    
    if (all) args.push('-a');
    if (filter) args.push(`--filter "${filter}"`);
    if (last) args.push(`--last ${last}`);
    if (size) args.push('-s');
    
    // Handle different formats
    switch (format) {
      case 'json':
        args.push('--format "{{json .}}"');
        break;
      case 'id':
        args.push('-q');
        break;
      case 'name':
        args.push('--format "{{.Names}}"');
        break;
      // 'table' is default, no additional args needed
    }
    
    if (args.length > 0) {
      command += ' ' + args.join(' ');
    }
    
    try {
      const output = execSync(command, { encoding: 'utf-8' });
      
      let formattedOutput = output;
      
      // If JSON format, parse and pretty-print
      if (format === 'json' && output.trim()) {
        const lines = output.trim().split('\n');
        const jsonObjects = lines.map(line => JSON.parse(line));
        formattedOutput = JSON.stringify(jsonObjects, null, 2);
      }
      
      return {
        content: [
          {
            type: 'text',
            text: formattedOutput || 'No containers found'
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error executing docker ps: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
};

export default dockerPsTool;