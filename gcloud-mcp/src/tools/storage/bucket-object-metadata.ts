import { z } from 'zod';
import { ToolDefinition } from '../../types.js';
import { executeGCloudCommand } from '../../utils/gcloud.js';

const inputSchema = z.object({
  bucket: z.string().describe('Name of the storage bucket (without gs:// prefix)'),
  object: z.string().describe('Path to the object within the bucket'),
  generation: z.string().optional().describe('Specific object generation/version'),
  project: z.string().optional().describe('GCP project ID (uses current project if not specified)')
});

const gcloudBucketObjectMetadataTool: ToolDefinition = {
  name: 'bucket_object_metadata',
  description: 'Get detailed metadata for an object in a Cloud Storage bucket',
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
    
    // Get object metadata
    let statCommand = `gsutil stat ${objectPath}`;
    
    if (params.project) {
      statCommand = `gsutil -o "GSUtil:default_project_id=${params.project}" stat ${objectPath}`;
    }
    
    const statResult = await executeGCloudCommand(statCommand);
    
    if (statResult.exitCode !== 0) {
      return {
        content: [{
          type: 'text',
          text: `Error getting object metadata: ${statResult.stderr}`
        }],
        isError: true
      };
    }
    
    let output = `Object Metadata: ${params.object}\n`;
    output += '='.repeat(60) + '\n\n';
    output += statResult.stdout + '\n';
    
    // Get ACL information
    output += '\nAccess Control:\n';
    output += '-'.repeat(30) + '\n';
    
    let aclCommand = `gsutil acl get ${objectPath}`;
    
    if (params.project) {
      aclCommand = `gsutil -o "GSUtil:default_project_id=${params.project}" acl get ${objectPath}`;
    }
    
    const aclResult = await executeGCloudCommand(aclCommand);
    
    if (aclResult.exitCode === 0) {
      // Parse and format ACL information
      try {
        const acl = JSON.parse(aclResult.stdout);
        
        if (acl.length > 0) {
          acl.forEach((entry: any) => {
            output += `  Entity: ${entry.entity}\n`;
            output += `  Role: ${entry.role}\n`;
            if (entry.email) {
              output += `  Email: ${entry.email}\n`;
            }
            output += '\n';
          });
        } else {
          output += '  No ACL entries found\n';
        }
      } catch {
        // If not JSON, display raw output
        output += aclResult.stdout;
      }
    } else {
      output += '  Unable to retrieve ACL information\n';
    }
    
    // Get object versions if versioning is enabled
    if (!params.generation) {
      output += '\nObject Versions:\n';
      output += '-'.repeat(30) + '\n';
      
      let versionsCommand = `gsutil ls -a ${objectPath}`;
      
      if (params.project) {
        versionsCommand = `gsutil -o "GSUtil:default_project_id=${params.project}" ls -a ${objectPath}`;
      }
      
      const versionsResult = await executeGCloudCommand(versionsCommand);
      
      if (versionsResult.exitCode === 0) {
        const versionLines = versionsResult.stdout.split('\n').filter(line => line.trim());
        
        if (versionLines.length > 1) {
          versionLines.forEach(versionUrl => {
            if (versionUrl.includes('#')) {
              const generation = versionUrl.split('#')[1];
              output += `  Generation: ${generation}\n`;
            }
          });
        } else {
          output += '  Only one version exists\n';
        }
      }
    }
    
    // Get custom metadata
    const metadataMatch = statResult.stdout.match(/Metadata:\s*\n([\s\S]*?)(?:\n\S|$)/);
    if (metadataMatch && metadataMatch[1].trim()) {
      output += '\nCustom Metadata:\n';
      output += '-'.repeat(30) + '\n';
      output += metadataMatch[1];
    }
    
    return {
      content: [{
        type: 'text',
        text: output.trim()
      }]
    };
  }
};

export default gcloudBucketObjectMetadataTool;