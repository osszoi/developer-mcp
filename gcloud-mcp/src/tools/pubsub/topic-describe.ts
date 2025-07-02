import { z } from 'zod';
import { ToolDefinition } from '../../types.js';
import { executeGCloudCommand } from '../../utils/gcloud.js';

const inputSchema = z.object({
  topic: z.string().describe('Name of the Pub/Sub topic'),
  project: z.string().optional().describe('Project ID (uses current project if not specified)'),
});

const gcloudPubsubTopicDescribeTool: ToolDefinition = {
  name: 'pubsub_topic_describe',
  description: 'Get detailed information about a Pub/Sub topic',
  category: 'pubsub',
  subcategory: 'topics',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    let command = `gcloud pubsub topics describe "${params.topic}"`;
    
    if (params.project) {
      command += ` --project="${params.project}"`;
    }
    
    command += ' --format=json';
    
    const result = await executeGCloudCommand(command);
    
    if (result.exitCode !== 0) {
      return {
        content: [{
          type: 'text',
          text: `Error describing Pub/Sub topic: ${result.stderr}`
        }],
        isError: true
      };
    }
    
    try {
      const topic = JSON.parse(result.stdout);
      const topicName = topic.name.split('/').pop();
      
      let output = `Pub/Sub Topic: ${topicName}\n\n`;
      
      output += `Details:\n`;
      output += `  Full Name: ${topic.name}\n`;
      
      if (topic.labels && Object.keys(topic.labels).length > 0) {
        output += `  Labels:\n`;
        Object.entries(topic.labels).forEach(([key, value]) => {
          output += `    ${key}: ${value}\n`;
        });
      }
      
      if (topic.messageStoragePolicy) {
        output += `\nMessage Storage Policy:\n`;
        if (topic.messageStoragePolicy.allowedPersistenceRegions) {
          output += `  Allowed Regions: ${topic.messageStoragePolicy.allowedPersistenceRegions.join(', ')}\n`;
        }
      }
      
      if (topic.kmsKeyName) {
        output += `\nEncryption:\n`;
        output += `  Type: Customer-managed (CMEK)\n`;
        output += `  Key: ${topic.kmsKeyName}\n`;
      } else {
        output += `\nEncryption: Google-managed\n`;
      }
      
      if (topic.schemaSettings) {
        output += `\nSchema Settings:\n`;
        output += `  Schema: ${topic.schemaSettings.schema || 'N/A'}\n`;
        output += `  Encoding: ${topic.schemaSettings.encoding || 'N/A'}\n`;
      }
      
      if (topic.messageRetentionDuration) {
        output += `\nMessage Retention: ${topic.messageRetentionDuration}\n`;
      }
      
      // Get subscriptions for this topic
      output += '\nSubscriptions:\n';
      const subCommand = `gcloud pubsub subscriptions list --filter="topic:${topicName}" --format="value(name)"`;
      const subResult = await executeGCloudCommand(subCommand);
      
      if (subResult.exitCode === 0 && subResult.stdout.trim()) {
        const subscriptions = subResult.stdout.trim().split('\n');
        subscriptions.forEach(sub => {
          const subName = sub.split('/').pop();
          output += `  - ${subName}\n`;
        });
      } else {
        output += `  No subscriptions found\n`;
      }
      
      // Get IAM policy summary
      const iamCommand = `gcloud pubsub topics get-iam-policy "${params.topic}" --format=json`;
      const iamResult = await executeGCloudCommand(iamCommand);
      
      if (iamResult.exitCode === 0) {
        try {
          const policy = JSON.parse(iamResult.stdout);
          if (policy.bindings && policy.bindings.length > 0) {
            output += `\nIAM Bindings: ${policy.bindings.length} role(s) assigned\n`;
          }
        } catch (e) {
          // Ignore IAM parsing errors
        }
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
          text: `Error parsing Pub/Sub topic data: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
};

export default gcloudPubsubTopicDescribeTool;
