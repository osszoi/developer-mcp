import { z } from 'zod';
import { ToolDefinition } from '../../types.js';
import { spawn } from 'child_process';

const inputSchema = z.object({
  container: z.string().describe('Container name or ID'),
  command: z.string().describe('Command to execute in the container'),
  interactive: z.boolean().optional().default(false).describe('Keep STDIN open'),
  tty: z.boolean().optional().default(false).describe('Allocate a pseudo-TTY'),
  user: z.string().optional().describe('Username or UID to run command as'),
  workdir: z.string().optional().describe('Working directory inside the container'),
  env: z.record(z.string()).optional().describe('Environment variables to set'),
  detach: z.boolean().optional().default(false).describe('Run command in background')
});

const dockerExecTool: ToolDefinition = {
  name: 'exec',
  description: 'Execute a command inside a running Docker container',
  category: 'docker',
  subcategory: 'containers',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    // Build docker exec command
    const args: string[] = ['exec'];
    
    if (params.detach) args.push('-d');
    if (params.interactive) args.push('-i');
    if (params.tty) args.push('-t');
    if (params.user) args.push('-u', params.user);
    if (params.workdir) args.push('-w', params.workdir);
    
    // Add environment variables
    if (params.env) {
      Object.entries(params.env).forEach(([key, value]) => {
        args.push('-e', `${key}=${value}`);
      });
    }
    
    // Add container and command
    args.push(params.container);
    
    // Split command into arguments
    const commandParts = params.command.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    args.push(...commandParts.map(part => part.replace(/^"|"$/g, '')));
    
    try {
      return new Promise((resolve) => {
        const docker = spawn('docker', args, { stdio: 'pipe' });
        
        let output = '';
        let errorOutput = '';
        
        docker.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        docker.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });
        
        docker.on('error', (error) => {
          resolve({
            content: [
              {
                type: 'text',
                text: `Error starting docker exec: ${error.message}`
              }
            ]
          });
        });
        
        docker.on('close', (code) => {
          if (code === 0) {
            const result = params.detach 
              ? 'Command started in background'
              : output || 'Command executed successfully (no output)';
              
            resolve({
              content: [
                {
                  type: 'text',
                  text: result
                }
              ]
            });
          } else {
            resolve({
              content: [
                {
                  type: 'text',
                  text: `Command failed with exit code ${code}: ${errorOutput || output || 'No output'}`
                }
              ]
            });
          }
        });
        
        // Limit execution time for non-detached commands
        if (!params.detach) {
          setTimeout(() => {
            docker.kill();
            resolve({
              content: [
                {
                  type: 'text',
                  text: 'Command execution timeout (30 seconds)'
                }
              ]
            });
          }, 30000);
        }
      });
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error executing docker exec: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
};

export default dockerExecTool;