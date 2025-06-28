import { z } from 'zod';
import { ToolDefinition } from '../../../types/index.js';
import { execSync } from 'child_process';

const inputSchema = z.object({
  containers: z.array(z.string()).min(1).describe('Container names or IDs to stop'),
  time: z.number().optional().default(10).describe('Seconds to wait before killing the container')
});

const dockerStopTool: ToolDefinition = {
  name: 'stop',
  description: 'Stop one or more running Docker containers',
  category: 'docker',
  subcategory: 'containers',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const { containers, time } = inputSchema.parse(input);
    
    const results: { container: string; status: string; error?: string }[] = [];
    
    for (const container of containers) {
      try {
        const command = `docker stop -t ${time} ${container}`;
        execSync(command, { encoding: 'utf-8' }).trim();
        
        results.push({
          container,
          status: 'stopped',
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
    const successCount = results.filter(r => r.status === 'stopped').length;
    const failureCount = results.filter(r => r.status === 'failed').length;
    
    let resultText = `Stopped ${successCount} container(s)`;
    if (failureCount > 0) {
      resultText += `, ${failureCount} failed`;
    }
    resultText += '\n\n';
    
    results.forEach(result => {
      if (result.status === 'stopped') {
        resultText += `✓ ${result.container}: stopped\n`;
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

export default dockerStopTool;