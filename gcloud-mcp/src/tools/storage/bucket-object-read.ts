import { z } from 'zod';
import { ToolDefinition } from '../../types.js';
import { executeGCloudCommand } from '../../utils/gcloud.js';

const inputSchema = z.object({
  bucket: z.string().describe('Name of the storage bucket (without gs:// prefix)'),
  object: z.string().describe('Path to the object within the bucket'),
  limit: z.number().optional().default(1000).describe('Maximum number of lines to read (for text files)'),
  generation: z.string().optional().describe('Specific object generation/version to read'),
  project: z.string().optional().describe('GCP project ID (uses current project if not specified)')
});

const gcloudBucketObjectReadTool: ToolDefinition = {
  name: 'bucket_object_read',
  description: 'Read the contents of an object from a Cloud Storage bucket',
  category: 'storage',
  subcategory: 'objects',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    // Remove gs:// prefix if provided
    const bucketName = params.bucket.replace('gs://', '');
    let objectPath = `gs://${bucketName}/${params.object}`;
    
    if (params.generation) {
      objectPath += `#${params.generation}`;
    }
    
    // First, check object metadata to determine if it's readable
    let statCommand = `gsutil stat ${objectPath}`;
    
    if (params.project) {
      statCommand = `gsutil -o "GSUtil:default_project_id=${params.project}" stat ${objectPath}`;
    }
    
    const statResult = await executeGCloudCommand(statCommand);
    
    if (statResult.exitCode !== 0) {
      return {
        content: [{
          type: 'text',
          text: `Error accessing object: ${statResult.stderr}`
        }],
        isError: true
      };
    }
    
    // Parse object metadata
    let contentType = 'application/octet-stream';
    let contentLength = 0;
    
    const statLines = statResult.stdout.split('\n');
    for (const line of statLines) {
      if (line.includes('Content-Type:')) {
        contentType = line.split('Content-Type:')[1].trim();
      } else if (line.includes('Content-Length:')) {
        contentLength = parseInt(line.split('Content-Length:')[1].trim()) || 0;
      }
    }
    
    let output = `Object: ${params.object}\n`;
    output += `Bucket: ${bucketName}\n`;
    output += `Content-Type: ${contentType}\n`;
    output += `Size: ${(contentLength / 1024).toFixed(2)} KB\n`;
    output += '\n' + '='.repeat(60) + '\n\n';
    
    // Check if it's a binary file
    const binaryTypes = ['image/', 'video/', 'audio/', 'application/pdf', 'application/zip', 'application/x-'];
    const isBinary = binaryTypes.some(type => contentType.startsWith(type));
    
    if (isBinary) {
      output += `This is a binary file (${contentType}). Cannot display contents.\n`;
      output += `\nTo download this file, use:\n`;
      output += `gsutil cp ${objectPath} <local_destination>`;
      
      return {
        content: [{
          type: 'text',
          text: output
        }]
      };
    }
    
    // For text files, read the content
    let catCommand = `gsutil cat ${objectPath}`;
    
    if (params.project) {
      catCommand = `gsutil -o "GSUtil:default_project_id=${params.project}" cat ${objectPath}`;
    }
    
    // Add head command to limit lines for large files
    if (params.limit && params.limit > 0) {
      catCommand += ` | head -n ${params.limit}`;
    }
    
    const catResult = await executeGCloudCommand(catCommand);
    
    if (catResult.exitCode !== 0) {
      return {
        content: [{
          type: 'text',
          text: `Error reading object content: ${catResult.stderr}`
        }],
        isError: true
      };
    }
    
    output += 'Content:\n';
    output += '-'.repeat(30) + '\n';
    output += catResult.stdout;
    
    // Check if content was truncated
    const lineCount = catResult.stdout.split('\n').length;
    if (lineCount >= params.limit) {
      output += `\n\n... Content truncated at ${params.limit} lines. Use a higher limit to see more.`;
    }
    
    return {
      content: [{
        type: 'text',
        text: output
      }]
    };
  }
};

export default gcloudBucketObjectReadTool;