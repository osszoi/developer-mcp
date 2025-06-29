import { z } from 'zod';
import { ToolDefinition } from '../../types.js';
import { executeGCloudCommand } from '../../utils/gcloud.js';

const inputSchema = z.object({
  workload: z.string().describe('Name of the workload (deployment, pod, or service name)'),
  cluster: z.string().describe('Name of the GKE cluster'),
  namespace: z.string().optional().default('default').describe('Kubernetes namespace'),
  container: z.string().optional().describe('Container name (for multi-container pods)'),
  type: z.enum(['deployment', 'pod', 'auto']).optional().default('auto').describe('Type of workload (auto-detect by default)'),
  lines: z.number().optional().default(100).describe('Number of log lines to retrieve'),
  since: z.string().optional().default('1h').describe('Time range (e.g., 5m, 1h, 2d)'),
  follow: z.boolean().optional().default(false).describe('Follow log stream (tail -f behavior)'),
  previous: z.boolean().optional().default(false).describe('Show logs from previous container instance'),
  zone: z.string().optional().describe('Zone where the cluster is located'),
  region: z.string().optional().describe('Region where the cluster is located'),
  project: z.string().optional().describe('GCP project ID')
});

const gcloudWorkloadLogsTool: ToolDefinition = {
  name: 'workload_logs',
  description: 'Get logs from a Kubernetes workload (deployment or pod) in a simple way',
  category: 'kubernetes',
  subcategory: 'logs',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    // First, try to get cluster location if not provided
    if (!params.zone && !params.region) {
      let clusterInfoCommand = `gcloud container clusters list --filter="name:${params.cluster}" --format="value(location)"`;
      if (params.project) {
        clusterInfoCommand += ` --project=${params.project}`;
      }
      
      const clusterInfoResult = await executeGCloudCommand(clusterInfoCommand, { timeout: 10000 });
      
      if (clusterInfoResult.exitCode === 0 && clusterInfoResult.stdout.trim()) {
        const location = clusterInfoResult.stdout.trim();
        const dashCount = (location.match(/-/g) || []).length;
        if (dashCount === 2) {
          params.zone = location;
        } else {
          params.region = location;
        }
      }
    }
    
    // Get cluster credentials
    let getCredsCommand = `gcloud container clusters get-credentials ${params.cluster}`;
    
    if (params.zone) {
      getCredsCommand += ` --zone=${params.zone}`;
    } else if (params.region) {
      getCredsCommand += ` --region=${params.region}`;
    }
    
    if (params.project) {
      getCredsCommand += ` --project=${params.project}`;
    }
    
    const credsResult = await executeGCloudCommand(getCredsCommand, { timeout: 15000 });
    
    if (credsResult.exitCode !== 0 && !credsResult.stderr.includes('kubeconfig entry generated')) {
      return {
        content: [{
          type: 'text',
          text: `Error getting cluster credentials: ${credsResult.stderr}`
        }],
        isError: true
      };
    }
    
    // Check if kubectl is available
    const kubectlCheck = await executeGCloudCommand('which kubectl', { timeout: 5000, skipValidation: true });
    let useKubectl = kubectlCheck.exitCode === 0;
    
    let output = '';
    
    if (useKubectl) {
      // Use kubectl for better performance
      let podName = params.workload;
      
      // If type is auto or deployment, try to get pod name from deployment
      if (params.type === 'auto' || params.type === 'deployment') {
        const getPodCommand = `timeout 10 kubectl get pods -n ${params.namespace} -l app=${params.workload} -o jsonpath='{.items[0].metadata.name}' 2>/dev/null`;
        const getPodResult = await executeGCloudCommand(getPodCommand, { timeout: 11000, skipValidation: true });
        
        if (getPodResult.exitCode === 0 && getPodResult.stdout.trim()) {
          podName = getPodResult.stdout.trim();
        } else {
          // Try another common label
          const getPodCommand2 = `timeout 10 kubectl get pods -n ${params.namespace} -l app.kubernetes.io/name=${params.workload} -o jsonpath='{.items[0].metadata.name}' 2>/dev/null`;
          const getPodResult2 = await executeGCloudCommand(getPodCommand2, { timeout: 11000, skipValidation: true });
          
          if (getPodResult2.exitCode === 0 && getPodResult2.stdout.trim()) {
            podName = getPodResult2.stdout.trim();
          }
        }
      }
      
      // Build kubectl logs command
      let logsCommand = `timeout 30 kubectl logs -n ${params.namespace}`;
      
      if (params.type === 'deployment') {
        logsCommand += ` deployment/${params.workload}`;
      } else {
        logsCommand += ` ${podName}`;
      }
      
      if (params.container) {
        logsCommand += ` -c ${params.container}`;
      }
      
      logsCommand += ` --tail=${params.lines}`;
      logsCommand += ` --since=${params.since}`;
      
      if (params.previous) {
        logsCommand += ` --previous`;
      }
      
      if (params.follow) {
        logsCommand += ` -f`;
        // Increase timeout for follow mode
        logsCommand = logsCommand.replace('timeout 30', 'timeout 60');
      }
      
      const logsResult = await executeGCloudCommand(logsCommand, { timeout: params.follow ? 62000 : 32000, skipValidation: true });
      
      if (logsResult.exitCode === 0) {
        output = `Logs for ${params.workload} in ${params.namespace} namespace:\n`;
        output += '='.repeat(60) + '\n\n';
        output += logsResult.stdout || '(No logs found in the specified time range)';
      } else if (logsResult.exitCode === 124) {
        output = 'Command timed out. Try reducing the time range or number of lines.';
      } else if (logsResult.stderr.includes('gke-gcloud-auth-plugin')) {
        output = 'kubectl requires gke-gcloud-auth-plugin. Falling back to Cloud Logging...\n\n';
        useKubectl = false;
      } else {
        output = `Error getting logs: ${logsResult.stderr}\n`;
        output += '\nFalling back to Cloud Logging...\n\n';
        useKubectl = false;
      }
    }
    
    // Fallback to Cloud Logging if kubectl failed or is not available
    if (!useKubectl) {
      // Build Cloud Logging filter
      let filter = `resource.type="k8s_container" AND resource.labels.cluster_name="${params.cluster}"`;
      filter += ` AND resource.labels.namespace_name="${params.namespace}"`;
      
      // Add workload filter - try both pod and container name
      filter += ` AND (resource.labels.pod_name:"${params.workload}" OR resource.labels.container_name:"${params.workload}")`;
      
      if (params.container) {
        filter += ` AND resource.labels.container_name="${params.container}"`;
      }
      
      let logsCommand = `gcloud logging read "${filter}" --limit=${params.lines} --format="value(timestamp,severity,textPayload,jsonPayload)" --freshness=${params.since}`;
      
      if (params.project) {
        logsCommand += ` --project=${params.project}`;
      }
      
      const logsResult = await executeGCloudCommand(logsCommand, { timeout: 30000 });
      
      if (logsResult.exitCode === 0) {
        if (logsResult.stdout.trim()) {
          output += `Logs for ${params.workload} in ${params.namespace} namespace (via Cloud Logging):\n`;
          output += '='.repeat(60) + '\n\n';
          
          // Parse and format the logs
          const lines = logsResult.stdout.split('\n').filter(line => line.trim());
          for (const line of lines) {
            // Cloud Logging returns newest first, so reverse for chronological order
            output = line + '\n' + output;
          }
        } else {
          output += 'No logs found. This could mean:\n';
          output += '1. The workload name is incorrect\n';
          output += '2. No logs were generated in the specified time range\n';
          output += '3. The workload is not running\n\n';
          output += 'Try listing workloads first to verify the name.';
        }
      } else {
        output += `Error reading logs from Cloud Logging: ${logsResult.stderr}`;
      }
    }
    
    // Add helpful tips
    if (!output.includes('Error') && !output.includes('No logs found')) {
      output += '\n\n' + '-'.repeat(60) + '\n';
      output += 'Tips:\n';
      output += `- To see more lines: add "lines: 200"\n`;
      output += `- To see older logs: add "since: 6h" or "since: 1d"\n`;
      output += `- To follow logs: add "follow: true"\n`;
      if (!params.container) {
        output += `- If the pod has multiple containers, specify one with "container: <name>"\n`;
      }
    }
    
    return {
      content: [{
        type: 'text',
        text: output.trim()
      }]
    };
  }
};

export default gcloudWorkloadLogsTool;