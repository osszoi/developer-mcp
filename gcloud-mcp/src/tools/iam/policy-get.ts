import { z } from 'zod';
import { ToolDefinition } from '../../types.js';
import { executeGCloudCommand } from '../../utils/gcloud.js';

const inputSchema = z.object({
  resource: z.string().describe('Resource to get IAM policy for (e.g., project ID, bucket name, etc.)'),
  resourceType: z.enum(['project', 'bucket', 'dataset', 'instance', 'topic', 'subscription', 'secret']).describe('Type of resource'),
  filter: z.string().optional().describe('Filter expression for policy bindings'),
});

const gcloudIamPolicyGetTool: ToolDefinition = {
  name: 'iam_policy_get',
  description: 'Get IAM policy for a resource',
  category: 'iam',
  subcategory: 'policy',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    let command = '';
    
    switch (params.resourceType) {
      case 'project':
        command = `gcloud projects get-iam-policy "${params.resource}"`;
        break;
      case 'bucket':
        command = `gcloud storage buckets get-iam-policy "gs://${params.resource}"`;
        break;
      case 'dataset':
        command = `gcloud bigquery datasets get-iam-policy "${params.resource}"`;
        break;
      case 'instance':
        command = `gcloud compute instances get-iam-policy "${params.resource}"`;
        break;
      case 'topic':
        command = `gcloud pubsub topics get-iam-policy "${params.resource}"`;
        break;
      case 'subscription':
        command = `gcloud pubsub subscriptions get-iam-policy "${params.resource}"`;
        break;
      case 'secret':
        command = `gcloud secrets get-iam-policy "${params.resource}"`;
        break;
    }
    
    if (params.filter) {
      command += ` --filter="${params.filter}"`;
    }
    
    command += ' --format=json';
    
    const result = await executeGCloudCommand(command);
    
    if (result.exitCode !== 0) {
      return {
        content: [{
          type: 'text',
          text: `Error getting IAM policy: ${result.stderr}`
        }],
        isError: true
      };
    }
    
    try {
      const policy = JSON.parse(result.stdout);
      
      if (!policy.bindings || policy.bindings.length === 0) {
        return {
          content: [{
            type: 'text',
            text: `No IAM policy bindings found for ${params.resourceType}: ${params.resource}`
          }]
        };
      }
      
      let output = `IAM Policy for ${params.resourceType}: ${params.resource}\n\n`;
      output += `Version: ${policy.version || '1'}\n`;
      output += `ETag: ${policy.etag || 'N/A'}\n\n`;
      
      output += `Bindings (${policy.bindings.length}):\n\n`;
      
      policy.bindings.forEach((binding: any, index: number) => {
        output += `${index + 1}. Role: ${binding.role}\n`;
        output += `   Members (${binding.members?.length || 0}):\n`;
        
        if (binding.members && binding.members.length > 0) {
          binding.members.forEach((member: string) => {
            output += `   - ${member}\n`;
          });
        }
        
        if (binding.condition) {
          output += `   Condition:\n`;
          output += `     Title: ${binding.condition.title || 'N/A'}\n`;
          output += `     Expression: ${binding.condition.expression || 'N/A'}\n`;
          if (binding.condition.description) {
            output += `     Description: ${binding.condition.description}\n`;
          }
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
          text: `Error parsing IAM policy data: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
};

export default gcloudIamPolicyGetTool;
