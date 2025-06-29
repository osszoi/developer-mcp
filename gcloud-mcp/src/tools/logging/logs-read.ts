import { z } from 'zod';
import { ToolDefinition } from '../../types.js';
import { executeGCloudCommand, formatTimestamp } from '../../utils/gcloud.js';

const inputSchema = z.object({
  filter: z.string().optional().describe('Log filter query (e.g., resource.type="k8s_container" AND severity>=ERROR)'),
  resource: z.string().optional().describe('Resource name to filter logs (e.g., k8s_container, gce_instance)'),
  logName: z.string().optional().describe('Specific log name to read'),
  severity: z.enum(['DEFAULT', 'DEBUG', 'INFO', 'NOTICE', 'WARNING', 'ERROR', 'CRITICAL', 'ALERT', 'EMERGENCY']).optional().describe('Minimum severity level'),
  since: z.string().optional().default('1h').describe('Time range (e.g., 1h, 2d, 2023-01-01T00:00:00Z)'),
  limit: z.number().optional().default(50).describe('Maximum number of log entries to return'),
  project: z.string().optional().describe('GCP project ID (uses current project if not specified)')
});

const gcloudLogsReadTool: ToolDefinition = {
  name: 'logs_read',
  description: 'Read logs from Cloud Logging with various filters',
  category: 'logging',
  subcategory: 'logs',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    let command = 'gcloud logging read';
    
    // Build filter
    const filters: string[] = [];
    
    if (params.filter) {
      filters.push(`(${params.filter})`);
    }
    
    if (params.resource) {
      filters.push(`resource.type="${params.resource}"`);
    }
    
    if (params.logName) {
      filters.push(`logName="${params.logName}"`);
    }
    
    if (params.severity) {
      filters.push(`severity>=${params.severity}`);
    }
    
    // Add timestamp filter
    if (params.since) {
      // Check if it's a relative time (e.g., 1h, 2d) or absolute
      if (params.since.match(/^\d+[hdm]$/)) {
        // Relative time
        const unit = params.since.slice(-1);
        const value = parseInt(params.since.slice(0, -1));
        
        let timestamp = new Date();
        if (unit === 'h') {
          timestamp.setHours(timestamp.getHours() - value);
        } else if (unit === 'd') {
          timestamp.setDate(timestamp.getDate() - value);
        } else if (unit === 'm') {
          timestamp.setMinutes(timestamp.getMinutes() - value);
        }
        
        filters.push(`timestamp>="${timestamp.toISOString()}"`);
      } else {
        // Absolute timestamp
        filters.push(`timestamp>="${params.since}"`);
      }
    }
    
    if (filters.length > 0) {
      const filterString = filters.join(' AND ');
      command += ` "${filterString}"`;
    }
    
    command += ` --limit=${params.limit}`;
    command += ' --format=json';
    
    if (params.project) {
      command += ` --project=${params.project}`;
    }
    
    const result = await executeGCloudCommand(command);
    
    if (result.exitCode !== 0) {
      return {
        content: [{
          type: 'text',
          text: `Error reading logs: ${result.stderr}`
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
          text: 'No log entries found or invalid response format'
        }]
      };
    }
    
    if (entries.length === 0) {
      return {
        content: [{
          type: 'text',
          text: 'No log entries found matching the specified criteria'
        }]
      };
    }
    
    let output = `Found ${entries.length} log entr${entries.length !== 1 ? 'ies' : 'y'}:\n`;
    output += '='.repeat(60) + '\n\n';
    
    // Process entries (they come in reverse chronological order from gcloud)
    entries.forEach((entry, index) => {
      output += `[${index + 1}] ${formatTimestamp(entry.timestamp)} | ${entry.severity || 'DEFAULT'}\n`;
      
      // Resource information
      if (entry.resource) {
        output += `    Resource: ${entry.resource.type}`;
        if (entry.resource.labels) {
          const labelPairs = Object.entries(entry.resource.labels)
            .map(([k, v]) => `${k}=${v}`)
            .join(', ');
          output += ` (${labelPairs})`;
        }
        output += '\n';
      }
      
      // Log name
      if (entry.logName) {
        const shortLogName = entry.logName.split('/').slice(-1)[0];
        output += `    Log: ${shortLogName}\n`;
      }
      
      // Message content
      if (entry.textPayload) {
        output += `    Message: ${entry.textPayload}\n`;
      } else if (entry.jsonPayload) {
        output += `    JSON Payload:\n`;
        const jsonStr = JSON.stringify(entry.jsonPayload, null, 2);
        jsonStr.split('\n').forEach(line => {
          output += `      ${line}\n`;
        });
      } else if (entry.protoPayload) {
        output += `    Proto Payload: ${entry.protoPayload['@type'] || 'Unknown type'}\n`;
        if (entry.protoPayload.methodName) {
          output += `      Method: ${entry.protoPayload.methodName}\n`;
        }
      }
      
      // Labels
      if (entry.labels && Object.keys(entry.labels).length > 0) {
        output += `    Labels: ${JSON.stringify(entry.labels)}\n`;
      }
      
      // Trace
      if (entry.trace) {
        output += `    Trace: ${entry.trace}\n`;
      }
      
      output += '\n';
    });
    
    // Summary by severity
    const severityCounts: Record<string, number> = {};
    entries.forEach(entry => {
      const severity = entry.severity || 'DEFAULT';
      severityCounts[severity] = (severityCounts[severity] || 0) + 1;
    });
    
    output += 'Summary by Severity:\n';
    output += '-'.repeat(30) + '\n';
    Object.entries(severityCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([severity, count]) => {
        output += `  ${severity}: ${count}\n`;
      });
    
    return {
      content: [{
        type: 'text',
        text: output.trim()
      }]
    };
  }
};

export default gcloudLogsReadTool;