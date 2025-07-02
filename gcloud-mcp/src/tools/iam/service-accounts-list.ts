import { z } from 'zod';
import { ToolDefinition } from '../../types.js';
import { executeGCloudCommand } from '../../utils/gcloud.js';

const inputSchema = z.object({
  project: z.string().optional().describe('Project ID (uses current project if not specified)'),
  filter: z.string().optional().describe('Filter expression for service accounts'),
  limit: z.number().optional().default(100).describe('Maximum number of service accounts to return'),
});

const gcloudServiceAccountsListTool: ToolDefinition = {
  name: 'service_accounts_list',
  description: 'List service accounts in the project',
  category: 'iam',
  subcategory: 'service-accounts',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    let command = 'gcloud iam service-accounts list';
    
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
          text: `Error listing service accounts: ${result.stderr}`
        }],
        isError: true
      };
    }
    
    try {
      const accounts = JSON.parse(result.stdout);
      
      if (!Array.isArray(accounts) || accounts.length === 0) {
        return {
          content: [{
            type: 'text',
            text: 'No service accounts found'
          }]
        };
      }
      
      let output = `Service Accounts (${accounts.length} found):\n\n`;
      
      accounts.forEach((account: any) => {
        output += `Email: ${account.email}\n`;
        output += `  Name: ${account.name || 'N/A'}\n`;
        output += `  Display Name: ${account.displayName || 'N/A'}\n`;
        output += `  Project: ${account.projectId || 'N/A'}\n`;
        output += `  Unique ID: ${account.uniqueId || 'N/A'}\n`;
        
        if (account.disabled) {
          output += `  Status: DISABLED\n`;
        } else {
          output += `  Status: ACTIVE\n`;
        }
        
        if (account.description) {
          output += `  Description: ${account.description}\n`;
        }
        
        output += '\n';
      });
      
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
          text: `Error parsing service accounts data: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
};

export default gcloudServiceAccountsListTool;
