import { z } from 'zod';
import { ToolDefinition } from '../../types.js';
import { spawn } from 'child_process';

const inputSchema = z.object({
  image: z.string().describe('Docker image to run'),
  name: z.string().optional().describe('Container name'),
  detach: z.boolean().optional().default(false).describe('Run container in background'),
  rm: z.boolean().optional().default(false).describe('Remove container after it exits'),
  interactive: z.boolean().optional().default(false).describe('Keep STDIN open'),
  tty: z.boolean().optional().default(false).describe('Allocate a pseudo-TTY'),
  ports: z.array(z.string()).optional().describe('Port mappings (e.g., ["8080:80", "3000:3000"])'),
  volumes: z.array(z.string()).optional().describe('Volume mappings (e.g., ["/host/path:/container/path"])'),
  env: z.record(z.string()).optional().describe('Environment variables'),
  command: z.string().optional().describe('Command to run in container'),
  workdir: z.string().optional().describe('Working directory inside the container'),
  network: z.string().optional().describe('Network mode'),
  restart: z.enum(['no', 'always', 'unless-stopped', 'on-failure']).optional().describe('Restart policy')
});

const dockerRunTool: ToolDefinition = {
  name: 'run',
  description: 'Run a Docker container with various configuration options',
  category: 'docker',
  subcategory: 'containers',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    // Build docker run command
    const args: string[] = ['run'];
    
    if (params.detach) args.push('-d');
    if (params.rm) args.push('--rm');
    if (params.interactive) args.push('-i');
    if (params.tty) args.push('-t');
    if (params.name) args.push('--name', params.name);
    if (params.workdir) args.push('-w', params.workdir);
    if (params.network) args.push('--network', params.network);
    if (params.restart) args.push('--restart', params.restart);
    
    // Add port mappings
    if (params.ports) {
      params.ports.forEach(port => {
        args.push('-p', port);
      });
    }
    
    // Add volume mappings
    if (params.volumes) {
      params.volumes.forEach(volume => {
        args.push('-v', volume);
      });
    }
    
    // Add environment variables
    if (params.env) {
      Object.entries(params.env).forEach(([key, value]) => {
        args.push('-e', `${key}=${value}`);
      });
    }
    
    // Add image
    args.push(params.image);
    
    // Add command if provided
    if (params.command) {
      args.push(...params.command.split(' '));
    }
    
    try {
      return new Promise((resolve) => {
        const docker = spawn('docker', args, { 
          stdio: params.detach ? 'pipe' : ['pipe', 'pipe', 'pipe']
        });
        
        let output = '';
        let errorOutput = '';
        
        docker.stdout?.on('data', (data) => {
          output += data.toString();
        });
        
        docker.stderr?.on('data', (data) => {
          errorOutput += data.toString();
        });
        
        docker.on('close', (code) => {
          if (code === 0) {
            const successMessage = params.detach 
              ? `Container started successfully. Container ID: ${output.trim()}`
              : output || 'Container ran successfully';
              
            resolve({
              content: [
                {
                  type: 'text',
                  text: successMessage
                }
              ]
            });
          } else {
            resolve({
              content: [
                {
                  type: 'text',
                  text: `Error running container: ${errorOutput || 'Unknown error'}`
                }
              ]
            });
          }
        });
        
        // For non-detached containers, limit execution time
        if (!params.detach) {
          setTimeout(() => {
            docker.kill();
            resolve({
              content: [
                {
                  type: 'text',
                  text: 'Container execution timeout (30 seconds). Use detach mode for long-running containers.'
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
            text: `Error executing docker run: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
};

export default dockerRunTool;