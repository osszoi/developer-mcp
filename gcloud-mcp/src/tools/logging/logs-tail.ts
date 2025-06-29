import { z } from 'zod';
import { ToolDefinition } from '../../types.js';
import { executeGCloudCommand } from '../../utils/gcloud.js';

const inputSchema = z.object({
  filter: z.string().optional().describe('Log filter query (e.g., resource.type="k8s_container" AND severity>=ERROR)'),
  resource: z.string().optional().describe('Resource name to filter logs (e.g., k8s_container, gce_instance)'),
  logName: z.string().optional().describe('Specific log name to tail'),
  severity: z.enum(['DEFAULT', 'DEBUG', 'INFO', 'NOTICE', 'WARNING', 'ERROR', 'CRITICAL', 'ALERT', 'EMERGENCY']).optional().describe('Minimum severity level'),
  duration: z.number().optional().default(10).describe('Duration in seconds to tail logs'),
  project: z.string().optional().describe('GCP project ID (uses current project if not specified)')
});

const gcloudLogsTailTool: ToolDefinition = {
  name: 'logs_tail',
  description: 'Tail logs in real-time from Cloud Logging (streams for specified duration)',
  category: 'logging',
  subcategory: 'logs',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    let command = 'gcloud logging tail';
    
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
    
    if (filters.length > 0) {
      const filterString = filters.join(' AND ');
      command += ` "${filterString}"`;
    }
    
    if (params.project) {
      command += ` --project=${params.project}`;
    }
    
    // Add timeout to prevent indefinite streaming
    command = `timeout ${params.duration}s ${command}`;
    
    let output = `Tailing logs for ${params.duration} seconds...\n`;
    output += 'Filter: ' + (filters.length > 0 ? filters.join(' AND ') : 'None') + '\n';
    output += '='.repeat(60) + '\n\n';
    
    const result = await executeGCloudCommand(command);
    
    // timeout command returns 124 when it times out, which is expected
    if (result.exitCode !== 0 && result.exitCode !== 124) {
      return {
        content: [{
          type: 'text',
          text: `Error tailing logs: ${result.stderr}`
        }],
        isError: true
      };
    }
    
    if (!result.stdout || result.stdout.trim() === '') {
      output += 'No log entries received during the tail period.\n';
      output += '\nPossible reasons:\n';
      output += '- No logs matching the filter criteria\n';
      output += '- No new logs generated during this period\n';
      output += '- Filter might be too restrictive\n';
      
      return {
        content: [{
          type: 'text',
          text: output
        }]
      };
    }
    
    // Process the streamed output
    const lines = result.stdout.split('\n').filter(line => line.trim());
    let entryCount = 0;
    
    lines.forEach(line => {
      // Skip the initial connection messages
      if (line.includes('This will read logs from') || line.includes('Logs from Cloud Logging')) {
        return;
      }
      
      output += line + '\n';
      
      // Count actual log entries (they typically start with a timestamp)
      if (line.match(/^\d{4}-\d{2}-\d{2}/) || line.match(/^\[\d+\]/)) {
        entryCount++;
      }
    });
    
    output += '\n' + '-'.repeat(60) + '\n';
    output += `Tail completed. Received ${entryCount} log entr${entryCount !== 1 ? 'ies' : 'y'} in ${params.duration} seconds.\n`;
    
    return {
      content: [{
        type: 'text',
        text: output.trim()
      }]
    };
  }
};

export default gcloudLogsTailTool;