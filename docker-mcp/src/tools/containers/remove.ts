import { z } from 'zod';
import { ToolDefinition } from '../../types.js';
import { execSync } from 'child_process';

const inputSchema = z.object({
  containers: z.array(z.string()).min(1).describe('Container names or IDs to remove'),
  force: z.boolean().optional().default(false).describe('Force removal of running container'),
  volumes: z.boolean().optional().default(false).describe('Remove volumes associated with container')
});

const dockerRemoveTool: ToolDefinition = {
  name: 'remove',
  description: 'Remove one or more Docker containers',
  category: 'docker',
  subcategory: 'containers',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const { containers, force, volumes } = inputSchema.parse(input);
    
    const results: { container: string; status: string; error?: string }[] = [];
    
    for (const container of containers) {
      try {
        let command = 'docker rm';
        if (force) command += ' -f';
        if (volumes) command += ' -v';
        command += ` ${container}`;
        
        execSync(command, { encoding: 'utf-8' }).trim();
        
        results.push({
          container,
          status: 'removed',
          error: undefined
        });
      } catch (error) {
        results.push({
          container,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    // Format results
    const successCount = results.filter(r => r.status === 'removed').length;
    const failureCount = results.filter(r => r.status === 'failed').length;
    
    let resultText = `Removed ${successCount} container(s)`;
    if (failureCount > 0) {
      resultText += `, ${failureCount} failed`;
    }
    resultText += '\n\n';
    
    results.forEach(result => {
      if (result.status === 'removed') {
        resultText += `✓ ${result.container}: removed\n`;
      } else {
        resultText += `✗ ${result.container}: ${result.error}\n`;
      }
    });
    
    return {
      content: [
        {
          type: 'text',
          text: resultText.trim()
        }
      ]
    };
  }
};

export default dockerRemoveTool;