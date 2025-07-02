import { z } from 'zod';
import { ToolDefinition } from '../../types.js';
import { executeGCloudCommand } from '../../utils/gcloud.js';

const inputSchema = z.object({
  serviceAccount: z.string().describe('Service account email'),
  project: z.string().optional().describe('Project ID (uses current project if not specified)'),
  keyTypes: z.enum(['all', 'user-managed', 'system-managed']).optional().default('all').describe('Types of keys to list'),
});

const gcloudServiceAccountKeysListTool: ToolDefinition = {
  name: 'service_account_keys_list',
  description: 'List keys for a service account',
  category: 'iam',
  subcategory: 'service-accounts',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    let command = `gcloud iam service-accounts keys list --iam-account="${params.serviceAccount}"`;
    
    if (params.project) {
      command += ` --project="${params.project}"`;
    }
    
    if (params.keyTypes === 'user-managed') {
      command += ' --filter="keyType:USER_MANAGED"';
    } else if (params.keyTypes === 'system-managed') {
      command += ' --filter="keyType:SYSTEM_MANAGED"';
    }
    
    command += ' --format=json';
    
    const result = await executeGCloudCommand(command);
    
    if (result.exitCode !== 0) {
      return {
        content: [{
          type: 'text',
          text: `Error listing service account keys: ${result.stderr}`
        }],
        isError: true
      };
    }
    
    try {
      const keys = JSON.parse(result.stdout);
      
      if (!Array.isArray(keys) || keys.length === 0) {
        return {
          content: [{
            type: 'text',
            text: `No keys found for service account: ${params.serviceAccount}`
          }]
        };
      }
      
      let output = `Keys for Service Account: ${params.serviceAccount}\n\n`;
      output += `Total Keys: ${keys.length}\n\n`;
      
      const userKeys = keys.filter(k => k.keyType === 'USER_MANAGED');
      const systemKeys = keys.filter(k => k.keyType === 'SYSTEM_MANAGED');
      
      if (userKeys.length > 0) {
        output += `User-Managed Keys (${userKeys.length}):\n`;
        userKeys.forEach((key: any) => {
          output += `  - Key ID: ${key.name.split('/').pop()}\n`;
          output += `    Algorithm: ${key.keyAlgorithm || 'N/A'}\n`;
          output += `    Created: ${key.validAfterTime || 'N/A'}\n`;
          output += `    Expires: ${key.validBeforeTime || 'Never'}\n`;
          if (key.keyOrigin) {
            output += `    Origin: ${key.keyOrigin}\n`;
          }
          output += '\n';
        });
      }
      
      if (systemKeys.length > 0) {
        output += `System-Managed Keys (${systemKeys.length}):\n`;
        systemKeys.forEach((key: any) => {
          output += `  - Key ID: ${key.name.split('/').pop()}\n`;
          output += `    Algorithm: ${key.keyAlgorithm || 'N/A'}\n`;
          output += `    Created: ${key.validAfterTime || 'N/A'}\n`;
          output += '\n';
        });
      }
      
      output += '\nSecurity Note: Service account keys provide long-term authentication. Consider using short-lived credentials when possible.';
      
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
          text: `Error parsing service account keys data: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
};

export default gcloudServiceAccountKeysListTool;
