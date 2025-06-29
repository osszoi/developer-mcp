import { z } from 'zod';
import { ToolDefinition } from '../../types.js';
import { executeGCloudCommand } from '../../utils/gcloud.js';

const inputSchema = z.object({
  bucket: z.string().describe('Name of the storage bucket (without gs:// prefix)'),
  project: z.string().optional().describe('GCP project ID (uses current project if not specified)')
});

const gcloudBucketDescribeTool: ToolDefinition = {
  name: 'bucket_describe',
  description: 'Get detailed information about a specific Cloud Storage bucket',
  category: 'storage',
  subcategory: 'buckets',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    // Remove gs:// prefix if provided
    const bucketName = params.bucket.replace('gs://', '');
    
    let command = `gsutil ls -L -b gs://${bucketName}`;
    
    if (params.project) {
      command = `gsutil -o "GSUtil:default_project_id=${params.project}" ls -L -b gs://${bucketName}`;
    }
    
    const result = await executeGCloudCommand(command);
    
    if (result.exitCode !== 0) {
      return {
        content: [{
          type: 'text',
          text: `Error describing bucket: ${result.stderr}`
        }],
        isError: true
      };
    }
    
    let output = `Bucket Details: ${bucketName}\n`;
    output += '='.repeat(60) + '\n\n';
    
    // Parse detailed bucket information
    const lines = result.stdout.split('\n');
    let inACLSection = false;
    let inLifecycleSection = false;
    let inCORSSection = false;
    
    output += 'Basic Information:\n';
    output += '-'.repeat(30) + '\n';
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Detect sections
      if (trimmed.startsWith('ACL:')) {
        inACLSection = true;
        output += '\nAccess Control:\n';
        output += '-'.repeat(30) + '\n';
        continue;
      }
      if (trimmed.startsWith('Lifecycle configuration:')) {
        inLifecycleSection = true;
        inACLSection = false;
        output += '\nLifecycle Rules:\n';
        output += '-'.repeat(30) + '\n';
        continue;
      }
      if (trimmed.startsWith('CORS configuration:')) {
        inCORSSection = true;
        inLifecycleSection = false;
        output += '\nCORS Configuration:\n';
        output += '-'.repeat(30) + '\n';
        continue;
      }
      
      // Parse basic information
      if (!inACLSection && !inLifecycleSection && !inCORSSection) {
        if (trimmed.startsWith('Location type:')) {
          output += `Location Type: ${trimmed.replace('Location type:', '').trim()}\n`;
        } else if (trimmed.startsWith('Location constraint:')) {
          output += `Location: ${trimmed.replace('Location constraint:', '').trim()}\n`;
        } else if (trimmed.startsWith('Storage class:')) {
          output += `Storage Class: ${trimmed.replace('Storage class:', '').trim()}\n`;
        } else if (trimmed.startsWith('Versioning enabled:')) {
          output += `Versioning: ${trimmed.replace('Versioning enabled:', '').trim()}\n`;
        } else if (trimmed.startsWith('Logging configuration:')) {
          output += `Logging: ${trimmed.replace('Logging configuration:', '').trim()}\n`;
        } else if (trimmed.startsWith('Website configuration:')) {
          output += `Website: ${trimmed.replace('Website configuration:', '').trim()}\n`;
        } else if (trimmed.startsWith('Time created:')) {
          output += `Created: ${trimmed.replace('Time created:', '').trim()}\n`;
        } else if (trimmed.startsWith('Time updated:')) {
          output += `Updated: ${trimmed.replace('Time updated:', '').trim()}\n`;
        } else if (trimmed.startsWith('Metageneration:')) {
          output += `Metageneration: ${trimmed.replace('Metageneration:', '').trim()}\n`;
        } else if (trimmed.startsWith('Bucket Policy Only enabled:')) {
          output += `Uniform Bucket Access: ${trimmed.replace('Bucket Policy Only enabled:', '').trim()}\n`;
        } else if (trimmed.startsWith('Public access prevention:')) {
          output += `Public Access Prevention: ${trimmed.replace('Public access prevention:', '').trim()}\n`;
        }
      }
      
      // Parse ACL information
      if (inACLSection && trimmed && !trimmed.startsWith('Lifecycle configuration:')) {
        output += `  ${trimmed}\n`;
      }
      
      // Parse lifecycle information
      if (inLifecycleSection && trimmed && !trimmed.startsWith('CORS configuration:')) {
        output += `  ${trimmed}\n`;
      }
      
      // Parse CORS information
      if (inCORSSection && trimmed) {
        output += `  ${trimmed}\n`;
      }
    }
    
    // Get bucket size information
    output += '\n\nStorage Statistics:\n';
    output += '-'.repeat(30) + '\n';
    
    const sizeCommand = `gsutil du -s gs://${bucketName}`;
    const sizeResult = await executeGCloudCommand(sizeCommand);
    
    if (sizeResult.exitCode === 0) {
      const sizeMatch = sizeResult.stdout.match(/^(\d+)\s+gs:\/\//);
      if (sizeMatch) {
        const bytes = parseInt(sizeMatch[1]);
        const sizeMB = (bytes / 1024 / 1024).toFixed(2);
        const sizeGB = (bytes / 1024 / 1024 / 1024).toFixed(2);
        output += `Total Size: ${sizeGB} GB (${sizeMB} MB)\n`;
      }
    }
    
    // Get object count
    const countCommand = `gsutil ls gs://${bucketName}/** | wc -l`;
    const countResult = await executeGCloudCommand(countCommand);
    
    if (countResult.exitCode === 0) {
      const count = parseInt(countResult.stdout.trim()) || 0;
      output += `Object Count: ${count}\n`;
    }
    
    return {
      content: [{
        type: 'text',
        text: output.trim()
      }]
    };
  }
};

export default gcloudBucketDescribeTool;