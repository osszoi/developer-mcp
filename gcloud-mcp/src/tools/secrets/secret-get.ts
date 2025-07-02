import { z } from 'zod';
import { ToolDefinition } from '../../types.js';
import { executeGCloudCommand } from '../../utils/gcloud.js';

const inputSchema = z.object({
  secret: z.string().describe('Name of the secret'),
  version: z.string().optional().default('latest').describe('Version of the secret (defaults to latest)'),
  project: z.string().optional().describe('Project ID (uses current project if not specified)'),
});

const gcloudSecretGetTool: ToolDefinition = {
  name: 'secret_get',
  description: 'Get the value of a secret (WARNING: This exposes sensitive data)',
  category: 'secrets',
  subcategory: 'secrets',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    // Security warning
    const warning = `
⚠️  SECURITY WARNING ⚠️
This tool retrieves and displays secret values.
Only use when absolutely necessary and ensure the output is not logged or exposed.
Consider using secret references or environment variables instead of retrieving raw values.
`;
    
    let command = `gcloud secrets versions access "${params.version}" --secret="${params.secret}"`;
    
    if (params.project) {
      command += ` --project="${params.project}"`;
    }
    
    const result = await executeGCloudCommand(command);
    
    if (result.exitCode !== 0) {
      return {
        content: [{
          type: 'text',
          text: `Error accessing secret: ${result.stderr}`
        }],
        isError: true
      };
    }
    
    // Get secret metadata
    let metadataCommand = `gcloud secrets describe "${params.secret}"`;
    if (params.project) {
      metadataCommand += ` --project="${params.project}"`;
    }
    metadataCommand += ' --format=json';
    
    const metadataResult = await executeGCloudCommand(metadataCommand);
    let metadata: any = {};
    
    if (metadataResult.exitCode === 0) {
      try {
        metadata = JSON.parse(metadataResult.stdout);
      } catch (e) {
        // Ignore metadata parsing errors
      }
    }
    
    const secretName = params.secret;
    const secretValue = result.stdout.trim();
    
    let output = warning + '\n\n';
    output += `Secret: ${secretName}\n`;
    output += `Version: ${params.version}\n`;
    
    if (metadata.createTime) {
      output += `Created: ${new Date(metadata.createTime).toLocaleString()}\n`;
    }
    
    output += '\n';
    output += '--- SECRET VALUE ---\n';
    output += secretValue;
    output += '\n--- END SECRET VALUE ---\n\n';
    
    output += 'Security Reminder: Do not share or log this value. Consider rotating the secret if it was accidentally exposed.';
    
    return {
      content: [{
        type: 'text',
        text: output
      }]
    };
  }
};

export default gcloudSecretGetTool;
