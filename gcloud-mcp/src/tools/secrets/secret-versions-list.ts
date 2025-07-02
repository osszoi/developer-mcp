import { z } from 'zod';
import { ToolDefinition } from '../../types.js';
import { executeGCloudCommand } from '../../utils/gcloud.js';

const inputSchema = z.object({
  secret: z.string().describe('Name of the secret'),
  project: z.string().optional().describe('Project ID (uses current project if not specified)'),
  limit: z.number().optional().default(10).describe('Maximum number of versions to return'),
  includeDestroyed: z.boolean().optional().default(false).describe('Include destroyed versions'),
});

const gcloudSecretVersionsListTool: ToolDefinition = {
  name: 'secret_versions_list',
  description: 'List versions of a secret',
  category: 'secrets',
  subcategory: 'versions',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    let command = `gcloud secrets versions list "${params.secret}"`;
    
    if (params.project) {
      command += ` --project="${params.project}"`;
    }
    
    if (!params.includeDestroyed) {
      command += ' --filter="state:enabled"';
    }
    
    command += ` --limit=${params.limit}`;
    command += ' --format=json';
    
    const result = await executeGCloudCommand(command);
    
    if (result.exitCode !== 0) {
      return {
        content: [{
          type: 'text',
          text: `Error listing secret versions: ${result.stderr}`
        }],
        isError: true
      };
    }
    
    try {
      const versions = JSON.parse(result.stdout);
      
      if (!Array.isArray(versions) || versions.length === 0) {
        return {
          content: [{
            type: 'text',
            text: `No versions found for secret: ${params.secret}`
          }]
        };
      }
      
      let output = `Secret Versions for: ${params.secret}\n\n`;
      output += `Total Versions: ${versions.length}\n\n`;
      
      versions.forEach((version: any) => {
        const versionNumber = version.name.split('/').pop();
        output += `Version: ${versionNumber}\n`;
        output += `  State: ${version.state || 'N/A'}\n`;
        
        if (version.createTime) {
          output += `  Created: ${new Date(version.createTime).toLocaleString()}\n`;
        }
        
        if (version.destroyTime) {
          output += `  Destroyed: ${new Date(version.destroyTime).toLocaleString()}\n`;
        }
        
        if (version.etag) {
          output += `  ETag: ${version.etag}\n`;
        }
        
        if (version.replicationStatus) {
          const replications = version.replicationStatus.automatic?.customerManagedEncryption || 
                              version.replicationStatus.userManaged?.replicas || [];
          if (replications.length > 0) {
            output += `  Replication Status: ${replications.length} replicas\n`;
          }
        }
        
        output += '\n';
      });
      
      output += '\nNote: Use secret_get to retrieve the value of a specific version.';
      
      return {
        content: [{
          type: 'text',
          text: output.trim()
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error parsing secret versions data: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
};

export default gcloudSecretVersionsListTool;
