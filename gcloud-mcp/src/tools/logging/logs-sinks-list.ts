import { z } from 'zod';
import { ToolDefinition } from '../../types.js';
import { executeGCloudCommand, parseGCloudJson } from '../../utils/gcloud.js';

const inputSchema = z.object({
  project: z.string().optional().describe('GCP project ID (uses current project if not specified)'),
  limit: z.number().optional().default(50).describe('Maximum number of sinks to return')
});

interface LogSink {
  name: string;
  destination: string;
  filter?: string;
  description?: string;
  disabled?: boolean;
  createTime?: string;
  updateTime?: string;
  writerIdentity?: string;
  includeChildren?: boolean;
}

const gcloudLogsSinksListTool: ToolDefinition = {
  name: 'logs_sinks_list',
  description: 'List all log sinks (log routing destinations) in the project',
  category: 'logging',
  subcategory: 'sinks',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    let command = 'gcloud logging sinks list --format=json';
    
    if (params.limit) {
      command += ` --limit=${params.limit}`;
    }
    
    if (params.project) {
      command += ` --project=${params.project}`;
    }
    
    const result = await executeGCloudCommand(command);
    
    if (result.exitCode !== 0) {
      return {
        content: [{
          type: 'text',
          text: `Error listing log sinks: ${result.stderr}`
        }],
        isError: true
      };
    }
    
    const sinks = parseGCloudJson<LogSink[]>(result.stdout);
    
    if (!sinks || sinks.length === 0) {
      return {
        content: [{
          type: 'text',
          text: 'No log sinks found in the project'
        }]
      };
    }
    
    let output = `Found ${sinks.length} log sink${sinks.length !== 1 ? 's' : ''}:\n`;
    output += '='.repeat(60) + '\n\n';
    
    sinks.forEach(sink => {
      output += `Sink: ${sink.name}\n`;
      
      // Destination type
      let destType = 'Unknown';
      if (sink.destination.includes('storage.googleapis.com')) {
        destType = 'Cloud Storage';
      } else if (sink.destination.includes('bigquery.googleapis.com')) {
        destType = 'BigQuery';
      } else if (sink.destination.includes('pubsub.googleapis.com')) {
        destType = 'Pub/Sub';
      } else if (sink.destination.includes('logging.googleapis.com')) {
        destType = 'Cloud Logging';
      }
      
      output += `  Type: ${destType}\n`;
      output += `  Destination: ${sink.destination}\n`;
      
      if (sink.filter) {
        output += `  Filter: ${sink.filter}\n`;
      } else {
        output += `  Filter: (none - exports all logs)\n`;
      }
      
      if (sink.description) {
        output += `  Description: ${sink.description}\n`;
      }
      
      output += `  Status: ${sink.disabled ? 'DISABLED' : 'ACTIVE'}\n`;
      
      if (sink.includeChildren) {
        output += `  Include Children: Yes\n`;
      }
      
      if (sink.writerIdentity) {
        output += `  Writer Identity: ${sink.writerIdentity}\n`;
      }
      
      if (sink.createTime) {
        output += `  Created: ${new Date(sink.createTime).toLocaleString()}\n`;
      }
      
      if (sink.updateTime) {
        output += `  Updated: ${new Date(sink.updateTime).toLocaleString()}\n`;
      }
      
      output += '\n';
    });
    
    // Summary by destination type
    const sinksByType: Record<string, number> = {};
    sinks.forEach(sink => {
      let type = 'Other';
      if (sink.destination.includes('storage.googleapis.com')) {
        type = 'Cloud Storage';
      } else if (sink.destination.includes('bigquery.googleapis.com')) {
        type = 'BigQuery';
      } else if (sink.destination.includes('pubsub.googleapis.com')) {
        type = 'Pub/Sub';
      } else if (sink.destination.includes('logging.googleapis.com')) {
        type = 'Cloud Logging';
      }
      sinksByType[type] = (sinksByType[type] || 0) + 1;
    });
    
    output += 'Summary by Type:\n';
    output += '-'.repeat(30) + '\n';
    Object.entries(sinksByType).forEach(([type, count]) => {
      output += `  ${type}: ${count}\n`;
    });
    
    const activeSinks = sinks.filter(s => !s.disabled).length;
    const disabledSinks = sinks.filter(s => s.disabled).length;
    
    output += `\nStatus: ${activeSinks} active, ${disabledSinks} disabled\n`;
    
    return {
      content: [{
        type: 'text',
        text: output.trim()
      }]
    };
  }
};

export default gcloudLogsSinksListTool;