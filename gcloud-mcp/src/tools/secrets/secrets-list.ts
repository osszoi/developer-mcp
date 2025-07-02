import { z } from 'zod';
import { ToolDefinition } from '../../types.js';
import { executeGCloudCommand } from '../../utils/gcloud.js';

const inputSchema = z.object({
  project: z.string().optional().describe('Project ID (uses current project if not specified)'),
  filter: z.string().optional().describe('Filter expression for secrets'),
  limit: z.number().optional().default(100).describe('Maximum number of secrets to return'),
});

const gcloudSecretsListTool: ToolDefinition = {
  name: 'secrets_list',
  description: 'List secrets in Secret Manager',
  category: 'secrets',
  subcategory: 'secrets',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    let command = 'gcloud secrets list';
    
    if (params.project) {
      command += ` --project="${params.project}"`;
    }
    
    if (params.filter) {
      command += ` --filter="${params.filter}"`;
    }
    
    command += ` --limit=${params.limit}`;
    command += ' --format=json';
    
    const result = await executeGCloudCommand(command);
    
    if (result.exitCode !== 0) {
      return {
        content: [{
          type: 'text',
          text: `Error listing secrets: ${result.stderr}`
        }],
        isError: true
      };
    }
    
    try {
      const secrets = JSON.parse(result.stdout);
      
      if (!Array.isArray(secrets) || secrets.length === 0) {
        return {
          content: [{
            type: 'text',
            text: 'No secrets found'
          }]
        };
      }
      
      let output = `Secrets (${secrets.length} found):\n\n`;
      
      secrets.forEach((secret: any) => {
        const secretName = secret.name.split('/').pop();
        output += `Secret: ${secretName}\n`;
        
        if (secret.createTime) {
          output += `  Created: ${new Date(secret.createTime).toLocaleString()}\n`;
        }
        
        if (secret.replication) {
          if (secret.replication.automatic) {
            output += `  Replication: Automatic\n`;
          } else if (secret.replication.userManaged) {
            const locations = secret.replication.userManaged.replicas?.map((r: any) => r.location).join(', ') || 'N/A';
            output += `  Replication: User-managed (${locations})\n`;
          }
        }
        
        if (secret.labels) {
          const labels = Object.entries(secret.labels).map(([k, v]) => `${k}=${v}`).join(', ');
          output += `  Labels: ${labels}\n`;
        }
        
        if (secret.topics) {
          output += `  Topics: ${secret.topics.length} configured\n`;
        }
        
        output += '\n';
      });
      
      output += '\nNote: Use secret_versions_list to see versions of a specific secret.';
      
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
          text: `Error parsing secrets data: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
};

export default gcloudSecretsListTool;
