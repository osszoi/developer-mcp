import { z } from 'zod';
import { ToolDefinition } from '../../types.js';
import { spawn } from 'child_process';
import path from 'path';

const inputSchema = z.object({
  projectPath: z.string().describe('Path to directory containing docker-compose.yml'),
  file: z.string().optional().describe('Specify alternate compose file (default: docker-compose.yml)'),
  detach: z.boolean().optional().default(true).describe('Run containers in background'),
  build: z.boolean().optional().default(false).describe('Build images before starting'),
  forceRecreate: z.boolean().optional().default(false).describe('Recreate containers even if config unchanged'),
  noRecreate: z.boolean().optional().default(false).describe('Do not recreate existing containers'),
  noDeps: z.boolean().optional().default(false).describe('Do not start linked services'),
  removeOrphans: z.boolean().optional().default(false).describe('Remove containers for undefined services'),
  scale: z.record(z.number()).optional().describe('Scale services (e.g., {"web": 3})'),
  services: z.array(z.string()).optional().describe('Only start specified services')
});

const dockerComposeUpTool: ToolDefinition = {
  name: 'compose_up',
  description: 'Create and start Docker Compose services',
  category: 'docker',
  subcategory: 'compose',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    // Build docker-compose up command
    const args: string[] = [];
    
    // Add file option if specified
    if (params.file) {
      args.push('-f', path.join(params.projectPath, params.file));
    }
    
    args.push('up');
    
    if (params.detach) args.push('-d');
    if (params.build) args.push('--build');
    if (params.forceRecreate) args.push('--force-recreate');
    if (params.noRecreate) args.push('--no-recreate');
    if (params.noDeps) args.push('--no-deps');
    if (params.removeOrphans) args.push('--remove-orphans');
    
    // Add scale options
    if (params.scale) {
      Object.entries(params.scale).forEach(([service, count]) => {
        args.push('--scale', `${service}=${count}`);
      });
    }
    
    // Add specific services if provided
    if (params.services && params.services.length > 0) {
      args.push(...params.services);
    }
    
    try {
      return new Promise((resolve) => {
        const docker = spawn('docker-compose', args, { 
          stdio: 'pipe',
          cwd: params.projectPath
        });
        
        let output = '';
        let errorOutput = '';
        
        docker.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        docker.stderr.on('data', (data) => {
          // Docker Compose sends normal output to stderr
          const text = data.toString();
          output += text;
          errorOutput += text;
        });
        
        docker.on('error', (error) => {
          // Try docker compose (new syntax) if docker-compose fails
          if (error.message.includes('ENOENT')) {
            const dockerNew = spawn('docker', ['compose', ...args], {
              stdio: 'pipe',
              cwd: params.projectPath
            });
            
            let newOutput = '';
            let newErrorOutput = '';
            
            dockerNew.stdout.on('data', (data) => {
              newOutput += data.toString();
            });
            
            dockerNew.stderr.on('data', (data) => {
              const text = data.toString();
              newOutput += text;
              newErrorOutput += text;
            });
            
            dockerNew.on('close', (code) => {
              if (code === 0) {
                const services = params.services?.join(', ') || 'all services';
                const successMessage = params.detach
                  ? `Started ${services} in background`
                  : `Started ${services}`;
                  
                resolve({
                  content: [
                    {
                      type: 'text',
                      text: successMessage + '\n\n' + newOutput.slice(-500) // Last 500 chars
                    }
                  ]
                });
              } else {
                resolve({
                  content: [
                    {
                      type: 'text',
                      text: `Failed to start services: ${newErrorOutput || 'Unknown error'}`
                    }
                  ]
                });
              }
            });
            
            return;
          }
          
          resolve({
            content: [
              {
                type: 'text',
                text: `Error starting docker-compose: ${error.message}`
              }
            ]
          });
        });
        
        docker.on('close', (code) => {
          if (code === 0) {
            const services = params.services?.join(', ') || 'all services';
            const successMessage = params.detach
              ? `Started ${services} in background`
              : `Started ${services}`;
              
            resolve({
              content: [
                {
                  type: 'text',
                  text: successMessage + '\n\n' + output.slice(-500) // Last 500 chars
                }
              ]
            });
          } else {
            resolve({
              content: [
                {
                  type: 'text',
                  text: `Failed to start services: ${errorOutput || 'Unknown error'}`
                }
              ]
            });
          }
        });
        
        // For non-detached mode, limit execution time
        if (!params.detach) {
          setTimeout(() => {
            docker.kill();
            resolve({
              content: [
                {
                  type: 'text',
                  text: 'Compose operation timeout (2 minutes). Use detach mode for long-running services.'
                }
              ]
            });
          }, 120000); // 2 minutes
        }
      });
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error executing docker-compose: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
};

export default dockerComposeUpTool;