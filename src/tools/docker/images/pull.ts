import { z } from 'zod';
import { ToolDefinition } from '../../../types/index.js';
import { spawn } from 'child_process';

const inputSchema = z.object({
  image: z.string().describe('Image name with optional tag (e.g., "ubuntu:latest")'),
  platform: z.string().optional().describe('Platform to pull for (e.g., "linux/amd64")'),
  allTags: z.boolean().optional().default(false).describe('Download all tagged images'),
  quiet: z.boolean().optional().default(false).describe('Suppress verbose output')
});

const dockerPullTool: ToolDefinition = {
  name: 'pull',
  description: 'Pull a Docker image from a registry',
  category: 'docker',
  subcategory: 'images',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    // Build docker pull command
    const args: string[] = ['pull'];
    
    if (params.allTags) args.push('--all-tags');
    if (params.quiet) args.push('--quiet');
    if (params.platform) args.push('--platform', params.platform);
    
    args.push(params.image);
    
    try {
      return new Promise((resolve) => {
        const docker = spawn('docker', args, { stdio: 'pipe' });
        
        let output = '';
        let errorOutput = '';
        let lastProgress = '';
        
        docker.stdout.on('data', (data) => {
          const text = data.toString();
          output += text;
          
          // Extract last progress update for cleaner output
          const lines = text.split('\n').filter((line: string) => line.trim());
          if (lines.length > 0) {
            lastProgress = lines[lines.length - 1];
          }
        });
        
        docker.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });
        
        docker.on('error', (error) => {
          resolve({
            content: [
              {
                type: 'text',
                text: `Error starting docker pull: ${error.message}`
              }
            ]
          });
        });
        
        docker.on('close', (code) => {
          if (code === 0) {
            const successMessage = params.quiet 
              ? `Successfully pulled ${params.image}`
              : `Successfully pulled ${params.image}\n\nFinal status: ${lastProgress}`;
              
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
                  text: `Failed to pull image: ${errorOutput || 'Unknown error'}`
                }
              ]
            });
          }
        });
        
        // Set a reasonable timeout for pulling images
        setTimeout(() => {
          docker.kill();
          resolve({
            content: [
              {
                type: 'text',
                text: 'Pull operation timeout (5 minutes). The image might be too large or the connection is slow.'
              }
            ]
          });
        }, 300000); // 5 minutes
      });
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error executing docker pull: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
};

export default dockerPullTool;