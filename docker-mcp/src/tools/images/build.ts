import { z } from 'zod';
import { ToolDefinition } from '../../types.js';
import { spawn } from 'child_process';

const inputSchema = z.object({
  context: z.string().describe('Build context path (directory containing Dockerfile)'),
  dockerfile: z.string().optional().describe('Name of the Dockerfile (default: Dockerfile)'),
  tag: z.string().optional().describe('Name and optionally tag for the image (name:tag)'),
  target: z.string().optional().describe('Target build stage to build'),
  buildArgs: z.record(z.string()).optional().describe('Build-time variables'),
  noCache: z.boolean().optional().default(false).describe('Do not use cache when building'),
  pull: z.boolean().optional().default(false).describe('Always pull newer version of base image'),
  platform: z.string().optional().describe('Set platform for build (e.g., linux/amd64)'),
  quiet: z.boolean().optional().default(false).describe('Suppress build output')
});

const dockerBuildTool: ToolDefinition = {
  name: 'build',
  description: 'Build a Docker image from a Dockerfile',
  category: 'docker',
  subcategory: 'images',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    // Build docker build command
    const args: string[] = ['build'];
    
    if (params.tag) args.push('-t', params.tag);
    if (params.dockerfile) args.push('-f', params.dockerfile);
    if (params.target) args.push('--target', params.target);
    if (params.noCache) args.push('--no-cache');
    if (params.pull) args.push('--pull');
    if (params.platform) args.push('--platform', params.platform);
    if (params.quiet) args.push('--quiet');
    
    // Add build arguments
    if (params.buildArgs) {
      Object.entries(params.buildArgs).forEach(([key, value]) => {
        args.push('--build-arg', `${key}=${value}`);
      });
    }
    
    // Add context path (must be last)
    args.push(params.context);
    
    try {
      return new Promise((resolve) => {
        const docker = spawn('docker', args, { stdio: 'pipe' });
        
        let output = '';
        let errorOutput = '';
        let lastStep = '';
        
        docker.stdout.on('data', (data) => {
          const text = data.toString();
          output += text;
          
          // Extract build steps for progress tracking
          const stepMatch = text.match(/Step \d+\/\d+ : .*/);
          if (stepMatch) {
            lastStep = stepMatch[0];
          }
        });
        
        docker.stderr.on('data', (data) => {
          const text = data.toString();
          // Docker sends build output to stderr as well
          output += text;
          errorOutput += text;
        });
        
        docker.on('error', (error) => {
          resolve({
            content: [
              {
                type: 'text',
                text: `Error starting docker build: ${error.message}`
              }
            ]
          });
        });
        
        docker.on('close', (code) => {
          if (code === 0) {
            let successMessage = 'Image built successfully';
            if (params.tag) {
              successMessage += ` with tag: ${params.tag}`;
            }
            if (!params.quiet && lastStep) {
              successMessage += `\n\nLast step: ${lastStep}`;
            }
            
            resolve({
              content: [
                {
                  type: 'text',
                  text: successMessage
                }
              ]
            });
          } else {
            // Extract meaningful error from output
            const errorLines = output.split('\n').filter(line => 
              line.includes('ERROR') || 
              line.includes('error') || 
              line.includes('failed')
            ).slice(-5); // Last 5 error lines
            
            const errorMessage = errorLines.length > 0 
              ? `Build failed:\n${errorLines.join('\n')}`
              : `Build failed with exit code ${code}`;
            
            resolve({
              content: [
                {
                  type: 'text',
                  text: errorMessage
                }
              ]
            });
          }
        });
        
        // Set a reasonable timeout for building images
        setTimeout(() => {
          docker.kill();
          resolve({
            content: [
              {
                type: 'text',
                text: 'Build operation timeout (10 minutes). The build might be too complex or stuck.'
              }
            ]
          });
        }, 600000); // 10 minutes
      });
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error executing docker build: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
};

export default dockerBuildTool;