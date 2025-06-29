import { z } from 'zod';
import { ToolDefinition } from '../../types.js';
import { executeGCloudCommand, formatTimestamp } from '../../utils/gcloud.js';

const inputSchema = z.object({
  query: z.string().describe('Advanced log query using Cloud Logging query language'),
  orderBy: z.enum(['timestamp asc', 'timestamp desc']).optional().default('timestamp desc').describe('Sort order for results'),
  limit: z.number().optional().default(100).describe('Maximum number of results'),
  pageSize: z.number().optional().default(50).describe('Results per page'),
  project: z.string().optional().describe('GCP project ID (uses current project if not specified)')
});

const gcloudLogsQueryTool: ToolDefinition = {
  name: 'logs_query',
  description: 'Execute advanced queries against Cloud Logging using the full query language',
  category: 'logging',
  subcategory: 'logs',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    // Validate query syntax basics
    if (!params.query || params.query.trim().length === 0) {
      return {
        content: [{
          type: 'text',
          text: 'Error: Query cannot be empty'
        }],
        isError: true
      };
    }
    
    let command = `gcloud logging read "${params.query}"`;
    command += ` --limit=${params.limit}`;
    command += ` --page-size=${params.pageSize}`;
    command += ` --order="${params.orderBy}"`;
    command += ' --format=json';
    
    if (params.project) {
      command += ` --project=${params.project}`;
    }
    
    let output = 'Executing Log Query:\n';
    output += '='.repeat(60) + '\n';
    output += `Query: ${params.query}\n`;
    output += `Order: ${params.orderBy}\n`;
    output += `Limit: ${params.limit}\n\n`;
    
    const result = await executeGCloudCommand(command);
    
    if (result.exitCode !== 0) {
      return {
        content: [{
          type: 'text',
          text: `Error executing query: ${result.stderr}\n\nQuery Syntax Help:\n- Basic: resource.type="k8s_container"\n- With severity: severity>=ERROR\n- Time range: timestamp>="2023-01-01T00:00:00Z"\n- Combine: resource.type="k8s_container" AND severity>=ERROR\n- Text search: textPayload:"error message"\n- JSON field: jsonPayload.user="john@example.com"`
        }],
        isError: true
      };
    }
    
    let entries: any[] = [];
    try {
      entries = JSON.parse(result.stdout || '[]');
    } catch {
      return {
        content: [{
          type: 'text',
          text: 'No results found or invalid response format'
        }]
      };
    }
    
    if (entries.length === 0) {
      output += 'No log entries found matching the query.\n\n';
      output += 'Query Tips:\n';
      output += '- Check timestamp range\n';
      output += '- Verify resource.type values\n';
      output += '- Use gcloud logging resource-descriptors list to see available resource types\n';
      
      return {
        content: [{
          type: 'text',
          text: output
        }]
      };
    }
    
    output += `Found ${entries.length} result${entries.length !== 1 ? 's' : ''}:\n`;
    output += '-'.repeat(60) + '\n\n';
    
    // Group results by resource type for better organization
    const entriesByResource: Record<string, any[]> = {};
    entries.forEach(entry => {
      const resourceType = entry.resource?.type || 'unknown';
      if (!entriesByResource[resourceType]) {
        entriesByResource[resourceType] = [];
      }
      entriesByResource[resourceType].push(entry);
    });
    
    // Display entries grouped by resource
    Object.entries(entriesByResource).forEach(([resourceType, resourceEntries]) => {
      output += `\nResource Type: ${resourceType} (${resourceEntries.length} entries)\n`;
      output += '~'.repeat(40) + '\n';
      
      resourceEntries.forEach((entry, index) => {
        output += `\n[${index + 1}] ${formatTimestamp(entry.timestamp)} | ${entry.severity || 'DEFAULT'}\n`;
        
        // Resource labels
        if (entry.resource?.labels) {
          const importantLabels = ['container_name', 'pod_name', 'cluster_name', 'instance_id'];
          const labels = Object.entries(entry.resource.labels)
            .filter(([k]) => importantLabels.includes(k))
            .map(([k, v]) => `${k}=${v}`)
            .join(', ');
          if (labels) {
            output += `    ${labels}\n`;
          }
        }
        
        // Message content
        if (entry.textPayload) {
          // Truncate long messages
          const message = entry.textPayload.length > 200 
            ? entry.textPayload.substring(0, 200) + '...' 
            : entry.textPayload;
          output += `    ${message}\n`;
        } else if (entry.jsonPayload) {
          // Show key fields from JSON payload
          const json = entry.jsonPayload;
          if (json.message) {
            output += `    Message: ${json.message}\n`;
          }
          if (json.error) {
            output += `    Error: ${JSON.stringify(json.error)}\n`;
          }
          if (json.level) {
            output += `    Level: ${json.level}\n`;
          }
          // Show other keys
          const otherKeys = Object.keys(json).filter(k => !['message', 'error', 'level'].includes(k));
          if (otherKeys.length > 0) {
            output += `    Other fields: ${otherKeys.join(', ')}\n`;
          }
        } else if (entry.protoPayload) {
          output += `    Proto: ${entry.protoPayload['@type'] || 'Unknown'}\n`;
          if (entry.protoPayload.methodName) {
            output += `    Method: ${entry.protoPayload.methodName}\n`;
          }
          if (entry.protoPayload.status) {
            output += `    Status: ${JSON.stringify(entry.protoPayload.status)}\n`;
          }
        }
        
        // Error details if present
        if (entry.errorGroups) {
          output += `    Error Groups: ${entry.errorGroups.join(', ')}\n`;
        }
      });
    });
    
    // Statistics
    output += '\n\nQuery Statistics:\n';
    output += '-'.repeat(30) + '\n';
    output += `Total Results: ${entries.length}\n`;
    output += `Resource Types: ${Object.keys(entriesByResource).length}\n`;
    
    // Severity breakdown
    const severityCounts: Record<string, number> = {};
    entries.forEach(entry => {
      const severity = entry.severity || 'DEFAULT';
      severityCounts[severity] = (severityCounts[severity] || 0) + 1;
    });
    
    output += '\nBy Severity:\n';
    Object.entries(severityCounts)
      .sort(([, a], [, b]) => b - a)
      .forEach(([severity, count]) => {
        output += `  ${severity}: ${count}\n`;
      });
    
    if (entries.length >= params.limit) {
      output += `\nNote: Results limited to ${params.limit} entries. Use a higher limit to see more.`;
    }
    
    return {
      content: [{
        type: 'text',
        text: output.trim()
      }]
    };
  }
};

export default gcloudLogsQueryTool;