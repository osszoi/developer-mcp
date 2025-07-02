import { z } from 'zod';
import { ToolDefinition } from '../../types.js';
import { executeGCloudCommand } from '../../utils/gcloud.js';

const inputSchema = z.object({
  project: z.string().optional().describe('Project ID (uses current project if not specified)'),
  filter: z.string().optional().describe('Filter expression for topics'),
  limit: z.number().optional().default(100).describe('Maximum number of topics to return'),
});

const gcloudPubsubTopicsListTool: ToolDefinition = {
  name: 'pubsub_topics_list',
  description: 'List Pub/Sub topics',
  category: 'pubsub',
  subcategory: 'topics',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    let command = 'gcloud pubsub topics list';
    
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
          text: `Error listing Pub/Sub topics: ${result.stderr}`
        }],
        isError: true
      };
    }
    
    try {
      const topics = JSON.parse(result.stdout);
      
      if (!Array.isArray(topics) || topics.length === 0) {
        return {
          content: [{
            type: 'text',
            text: 'No Pub/Sub topics found'
          }]
        };
      }
      
      let output = `Pub/Sub Topics (${topics.length} found):\n\n`;
      
      for (const topic of topics) {
        const topicName = topic.name.split('/').pop();
        output += `Topic: ${topicName}\n`;
        output += `  Full Name: ${topic.name}\n`;
        
        if (topic.labels && Object.keys(topic.labels).length > 0) {
          const labels = Object.entries(topic.labels).map(([k, v]) => `${k}=${v}`).join(', ');
          output += `  Labels: ${labels}\n`;
        }
        
        if (topic.messageStoragePolicy?.allowedPersistenceRegions) {
          output += `  Storage Regions: ${topic.messageStoragePolicy.allowedPersistenceRegions.join(', ')}\n`;
        }
        
        if (topic.kmsKeyName) {
          output += `  Encryption: Customer-managed (CMEK)\n`;
        }
        
        if (topic.messageRetentionDuration) {
          output += `  Message Retention: ${topic.messageRetentionDuration}\n`;
        }
        
        output += '\n';
      }
      
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
          text: `Error parsing Pub/Sub topics data: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
};

export default gcloudPubsubTopicsListTool;
