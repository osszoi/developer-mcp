import { z } from 'zod';
import { ToolDefinition } from '../../types.js';
import { executeGCloudCommand } from '../../utils/gcloud.js';

const inputSchema = z.object({
  pod: z.string().describe('Pod name (or part of it)'),
  cluster: z.string().describe('Name of the GKE cluster'), 
  namespace: z.string().optional().default('default').describe('Kubernetes namespace'),
  lines: z.number().optional().default(50).describe('Number of recent log lines'),
  grep: z.string().optional().describe('Filter logs containing this text'),
  region: z.string().optional().describe('Region where the cluster is located (e.g., us-east1)')
});

const gcloudLogsSimpleTool: ToolDefinition = {
  name: 'logs_simple',
  description: 'Quickly get recent logs from a pod using Cloud Logging',
  category: 'kubernetes', 
  subcategory: 'logs',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    // Build a simple but effective Cloud Logging query
    let filter = `resource.type="k8s_container"`;
    filter += ` AND resource.labels.cluster_name="${params.cluster}"`;
    filter += ` AND resource.labels.namespace_name="${params.namespace}"`;
    filter += ` AND resource.labels.pod_name:"${params.pod}"`;
    
    // Add text filter if provided
    if (params.grep) {
      filter += ` AND textPayload:"${params.grep}"`;
    }
    
    // Get current project if not specified
    const projectResult = await executeGCloudCommand('gcloud config get-value project', { timeout: 5000 });
    const project = projectResult.stdout.trim();
    
    // Use gcloud logging read with simple output format
    let logsCommand = `gcloud logging read "${filter}" --limit=${params.lines} --format="value(timestamp,textPayload)" --project=${project}`;
    
    // Add region hint if provided (helps with performance)
    if (params.region) {
      logsCommand += ` --location=${params.region}`;
    }
    
    const logsResult = await executeGCloudCommand(logsCommand, { timeout: 20000 });
    
    let output = `Logs for pods matching "${params.pod}" in ${params.namespace}@${params.cluster}:\n`;
    output += '='.repeat(70) + '\n\n';
    
    if (logsResult.exitCode === 0 && logsResult.stdout.trim()) {
      // Cloud Logging returns newest first, so reverse for chronological order
      const lines = logsResult.stdout.split('\n').filter(line => line.trim());
      const formattedLines: string[] = [];
      
      for (const line of lines) {
        const parts = line.split('\t');
        if (parts.length >= 2) {
          const timestamp = new Date(parts[0]).toLocaleTimeString();
          const message = parts.slice(1).join('\t');
          formattedLines.push(`[${timestamp}] ${message}`);
        } else {
          formattedLines.push(line);
        }
      }
      
      // Reverse to show chronological order
      output += formattedLines.reverse().join('\n');
      
      if (params.grep) {
        output += `\n\n(Filtered for: "${params.grep}")`;
      }
    } else if (logsResult.exitCode !== 0) {
      output += `Error: ${logsResult.stderr}\n\n`;
      output += 'Troubleshooting:\n';
      output += '1. Check if the cluster name is correct\n';
      output += '2. Verify the pod name (use workloads_list to see available pods)\n';
      output += '3. Ensure you have access to Cloud Logging\n';
    } else {
      output += 'No logs found. Possible reasons:\n';
      output += `1. No pods match "${params.pod}" in namespace "${params.namespace}"\n`;
      output += '2. The pod exists but has not generated any logs recently\n';
      output += '3. The pod name is misspelled\n\n';
      output += 'Use workloads_list to see available pods.';
    }
    
    return {
      content: [{
        type: 'text',
        text: output.trim()
      }]
    };
  }
};

export default gcloudLogsSimpleTool;