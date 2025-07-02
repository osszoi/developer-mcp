import { z } from 'zod';
import { ToolDefinition } from '../../types.js';
import { executeGCloudCommand } from '../../utils/gcloud.js';

const inputSchema = z.object({
  deployment: z.string().describe('Deployment name (e.g., example-app, backend-service)'),
  cluster: z.string().describe('Name of the GKE cluster'),
  namespace: z.string().optional().default('default').describe('Kubernetes namespace'),
  lines: z.number().optional().default(20).describe('Number of recent log lines per pod'),
  severity: z.enum(['DEFAULT', 'DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']).optional().describe('Minimum severity level'),
  since: z.string().optional().default('10m').describe('Time range (e.g., 5m, 1h, 2d)'),
  region: z.string().optional().describe('Region where the cluster is located')
});

const gcloudDeploymentLogsTool: ToolDefinition = {
  name: 'deployment_logs', 
  description: 'Get aggregated logs from all pods in a deployment',
  category: 'kubernetes',
  subcategory: 'logs',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    // Get current project
    const projectResult = await executeGCloudCommand('gcloud config get-value project', { timeout: 5000 });
    const project = projectResult.stdout.trim();
    
    // Build Cloud Logging filter for deployment
    // Most deployments use app labels like app=deployment-name
    let filter = `resource.type="k8s_container"`;
    filter += ` AND resource.labels.cluster_name="${params.cluster}"`;
    filter += ` AND resource.labels.namespace_name="${params.namespace}"`;
    filter += ` AND labels."k8s-pod/app"="${params.deployment}"`;
    
    // Add severity filter if specified
    if (params.severity && params.severity !== 'DEFAULT') {
      filter += ` AND severity>=${params.severity}`;
    }
    
    // Build gcloud command
    let logsCommand = `gcloud logging read "${filter}" --limit=${params.lines * 5} --freshness=${params.since} --project=${project}`;
    logsCommand += ` --format="table(timestamp.sub('[TZ]',''),labels.'k8s-pod/pod-template-hash':label=POD_HASH,severity,textPayload.sub('\\n',' '))"`;
    
    if (params.region) {
      logsCommand += ` --location=${params.region}`;
    }
    
    const logsResult = await executeGCloudCommand(logsCommand, { timeout: 25000 });
    
    let output = `Logs for deployment "${params.deployment}" in ${params.namespace}@${params.cluster}:\n`;
    output += '='.repeat(80) + '\n';
    output += `Time range: last ${params.since} | Max ${params.lines} lines per pod`;
    if (params.severity) {
      output += ` | Severity: >=${params.severity}`;
    }
    output += '\n' + '='.repeat(80) + '\n\n';
    
    if (logsResult.exitCode === 0 && logsResult.stdout.trim()) {
      output += logsResult.stdout;
      
      // Also try to get pod status
      output += '\n\n' + '-'.repeat(80) + '\n';
      output += 'POD STATUS:\n';
      
      // Get pod count using a simpler query
      const podCountCommand = `gcloud logging read "resource.type=\\"k8s_pod\\" AND resource.labels.cluster_name=\\"${params.cluster}\\" AND resource.labels.namespace_name=\\"${params.namespace}\\" AND resource.labels.pod_name:\\"${params.deployment}\\" AND protoPayload.methodName=\\"io.k8s.core.v1.pods\\"" --limit=10 --freshness=1d --format="value(resource.labels.pod_name)" --project=${project} | sort | uniq | wc -l`;
      
      const podCountResult = await executeGCloudCommand(podCountCommand, { timeout: 15000 });
      
      if (podCountResult.exitCode === 0 && podCountResult.stdout.trim()) {
        const podCount = parseInt(podCountResult.stdout.trim()) || 0;
        output += `Found logs from approximately ${podCount} pod(s)\n`;
      }
    } else if (logsResult.exitCode !== 0) {
      output += `Error: ${logsResult.stderr}\n\n`;
      
      // Try alternative filter using pod name pattern
      output += 'Trying alternative query...\n\n';
      
      const altFilter = `resource.type="k8s_container" AND resource.labels.cluster_name="${params.cluster}" AND resource.labels.namespace_name="${params.namespace}" AND resource.labels.pod_name:"${params.deployment}"`;
      const altCommand = `gcloud logging read "${altFilter}" --limit=${params.lines} --freshness=${params.since} --project=${project} --format="table(timestamp.sub('[TZ]',''),resource.labels.pod_name:label=POD,severity,textPayload.sub('\\n',' '))"`;
      
      const altResult = await executeGCloudCommand(altCommand, { timeout: 20000 });
      
      if (altResult.exitCode === 0 && altResult.stdout.trim()) {
        output += altResult.stdout;
      } else {
        output += 'No logs found using alternative query either.\n\n';
        output += 'Troubleshooting:\n';
        output += '1. Verify the deployment name is correct\n';
        output += '2. Check if the deployment has running pods\n';
        output += '3. Try using logs_simple with a specific pod name\n';
      }
    } else {
      output += 'No logs found. Possible reasons:\n';
      output += `1. No deployment named "${params.deployment}" exists\n`;
      output += '2. The deployment has no running pods\n';
      output += '3. No logs generated in the specified time range\n';
      output += '4. The deployment uses different labels\n\n';
      output += 'Tips:\n';
      output += '- Use workloads_list to see available deployments\n';
      output += '- Try increasing the time range (e.g., since: "1h")\n';
      output += '- Try logs_simple with a specific pod name\n';
    }
    
    return {
      content: [{
        type: 'text',
        text: output.trim()
      }]
    };
  }
};

export default gcloudDeploymentLogsTool;