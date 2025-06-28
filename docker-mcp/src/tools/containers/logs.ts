import { z } from 'zod';
import { ToolDefinition } from '../../types.js';
import { spawn } from 'child_process';

const inputSchema = z.object({
  container: z.string().describe('Container name or ID'),
  follow: z.boolean().optional().default(false).describe('Follow log output (stream)'),
  tail: z.number().optional().describe('Number of lines to show from the end of logs'),
  since: z.string().optional().describe('Show logs since timestamp (e.g., "2023-01-01T00:00:00")'),
  until: z.string().optional().describe('Show logs before timestamp'),
  timestamps: z.boolean().optional().default(false).describe('Show timestamps'),
  details: z.boolean().optional().default(false).describe('Show extra details')
});

const dockerLogsTool: ToolDefinition = {
  name: 'logs',
  description: 'Fetch logs from a Docker container',
  category: 'docker',
  subcategory: 'containers',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    // Build docker logs command
    const args: string[] = ['logs'];
    
    if (params.follow) args.push('-f');
    if (params.timestamps) args.push('-t');
    if (params.details) args.push('--details');
    if (params.tail !== undefined) args.push('--tail', params.tail.toString());
    if (params.since) args.push('--since', params.since);
    if (params.until) args.push('--until', params.until);
    
    args.push(params.container);
    
    try {
      return new Promise((resolve) => {
        const docker = spawn('docker', args, { stdio: 'pipe' });
        
        let output = '';
        let errorOutput = '';
        let lineCount = 0;
        const maxLines = 500; // Limit output to prevent overwhelming response
        
        const handleData = (data: Buffer) => {
          const text = data.toString();
          const lines = text.split('\n');
          
          for (const line of lines) {
            if (lineCount < maxLines) {
              output += line + '\n';
              lineCount++;
            } else if (lineCount === maxLines) {
              output += '\n... (output truncated, showing first 500 lines)';
              lineCount++;
              
              // Kill the process if we're following
              if (params.follow) {
                docker.kill();
              }
            }
          }
        };
        
        docker.stdout.on('data', handleData);
        docker.stderr.on('data', handleData);
        
        docker.on('error', (error) => {
          resolve({
            content: [
              {
                type: 'text',
                text: `Error starting docker logs: ${error.message}`
              }
            ]
          });
        });
        
        docker.on('close', (code) => {
          if (code === 0 || output) {
            resolve({
              content: [
                {
                  type: 'text',
                  text: output || 'No logs found for this container'
                }
              ]
            });
          } else {
            resolve({
              content: [
                {
                  type: 'text',
                  text: `Error fetching logs: ${errorOutput || 'Unknown error'}`
                }
              ]
            });
          }
        });
        
        // For follow mode, limit execution time
        if (params.follow) {
          setTimeout(() => {
            docker.kill();
            output += '\n... (stopped following after 10 seconds)';
          }, 10000);
        }
      });
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error executing docker logs: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
};

export default dockerLogsTool;