import { z } from 'zod';
import { ToolDefinition } from '../../../types/index.js';
import { execSync } from 'child_process';

const inputSchema = z.object({
  all: z.boolean().optional().default(false).describe('Show all images (default hides intermediate images)'),
  digests: z.boolean().optional().default(false).describe('Show digests'),
  filter: z.string().optional().describe('Filter output based on conditions'),
  format: z.enum(['table', 'json', 'id']).optional().default('table').describe('Output format'),
  noTrunc: z.boolean().optional().default(false).describe('Do not truncate output')
});

const dockerImagesTool: ToolDefinition = {
  name: 'images',
  description: 'List Docker images with various filtering and formatting options',
  category: 'docker',
  subcategory: 'images',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const { all, digests, filter, format, noTrunc } = inputSchema.parse(input);
    
    let command = 'docker images';
    
    // Build command arguments
    const args: string[] = [];
    
    if (all) args.push('-a');
    if (digests) args.push('--digests');
    if (filter) args.push(`--filter "${filter}"`);
    if (noTrunc) args.push('--no-trunc');
    
    // Handle different formats
    switch (format) {
      case 'json':
        args.push('--format "{{json .}}"');
        break;
      case 'id':
        args.push('-q');
        break;
      // 'table' is default
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
            text: formattedOutput || 'No images found'
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error executing docker images: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
};

export default dockerImagesTool;