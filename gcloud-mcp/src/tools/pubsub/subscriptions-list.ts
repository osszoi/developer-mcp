import { z } from 'zod';
import { ToolDefinition } from '../../types.js';
import { executeGCloudCommand } from '../../utils/gcloud.js';

const inputSchema = z.object({
  project: z.string().optional().describe('Project ID (uses current project if not specified)'),
  topic: z.string().optional().describe('Filter by topic name'),
  filter: z.string().optional().describe('Filter expression for subscriptions'),
  limit: z.number().optional().default(100).describe('Maximum number of subscriptions to return'),
});

const gcloudPubsubSubscriptionsListTool: ToolDefinition = {
  name: 'pubsub_subscriptions_list',
  description: 'List Pub/Sub subscriptions',
  category: 'pubsub',
  subcategory: 'subscriptions',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    let command = 'gcloud pubsub subscriptions list';
    
    if (params.project) {
      command += ` --project="${params.project}"`;
    }
    
    let filter = params.filter || '';
    if (params.topic) {
      const topicFilter = `topic:${params.topic}`;
      filter = filter ? `${filter} AND ${topicFilter}` : topicFilter;
    }
    
    if (filter) {
      command += ` --filter="${filter}"`;
    }
    
    command += ` --limit=${params.limit}`;
    command += ' --format=json';
    
    const result = await executeGCloudCommand(command);
    
    if (result.exitCode !== 0) {
      return {
        content: [{
          type: 'text',
          text: `Error listing Pub/Sub subscriptions: ${result.stderr}`
        }],
        isError: true
      };
    }
    
    try {
      const subscriptions = JSON.parse(result.stdout);
      
      if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
        return {
          content: [{
            type: 'text',
            text: 'No Pub/Sub subscriptions found'
          }]
        };
      }
      
      let output = `Pub/Sub Subscriptions (${subscriptions.length} found):\n\n`;
      
      subscriptions.forEach((sub: any) => {
        const subName = sub.name.split('/').pop();
        const topicName = sub.topic ? sub.topic.split('/').pop() : 'N/A';
        
        output += `Subscription: ${subName}\n`;
        output += `  Topic: ${topicName}\n`;
        output += `  Full Name: ${sub.name}\n`;
        
        if (sub.pushConfig?.pushEndpoint) {
          output += `  Type: Push\n`;
          output += `  Endpoint: ${sub.pushConfig.pushEndpoint}\n`;
        } else {
          output += `  Type: Pull\n`;
        }
        
        if (sub.ackDeadlineSeconds) {
          output += `  Ack Deadline: ${sub.ackDeadlineSeconds} seconds\n`;
        }
        
        if (sub.messageRetentionDuration) {
          output += `  Message Retention: ${sub.messageRetentionDuration}\n`;
        }
        
        if (sub.expirationPolicy?.ttl) {
          output += `  Expiration: ${sub.expirationPolicy.ttl}\n`;
        }
        
        if (sub.deadLetterPolicy) {
          const dlTopic = sub.deadLetterPolicy.deadLetterTopic?.split('/').pop() || 'N/A';
          output += `  Dead Letter Topic: ${dlTopic}\n`;
          output += `  Max Delivery Attempts: ${sub.deadLetterPolicy.maxDeliveryAttempts || 'N/A'}\n`;
        }
        
        if (sub.labels && Object.keys(sub.labels).length > 0) {
          const labels = Object.entries(sub.labels).map(([k, v]) => `${k}=${v}`).join(', ');
          output += `  Labels: ${labels}\n`;
        }
        
        if (sub.enableMessageOrdering) {
          output += `  Message Ordering: Enabled\n`;
        }
        
        if (sub.filter) {
          output += `  Filter: ${sub.filter}\n`;
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
          text: `Error parsing Pub/Sub subscriptions data: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
};

export default gcloudPubsubSubscriptionsListTool;
