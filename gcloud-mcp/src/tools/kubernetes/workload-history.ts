import { z } from 'zod';
import { ToolDefinition } from '../../types.js';
import { executeGCloudCommand, parseGCloudJson, formatTimestamp } from '../../utils/gcloud.js';

const inputSchema = z.object({
  cluster: z.string().describe('Name of the GKE cluster'),
  zone: z.string().optional().describe('Zone where the cluster is located (for zonal clusters)'),
  region: z.string().optional().describe('Region where the cluster is located (for regional clusters)'),
  deployment: z.string().describe('Name of the deployment'),
  namespace: z.string().optional().default('default').describe('Kubernetes namespace'),
  limit: z.number().optional().default(10).describe('Number of revisions to show'),
  project: z.string().optional().describe('GCP project ID (uses current project if not specified)')
});

const gcloudWorkloadHistoryTool: ToolDefinition = {
  name: 'workload_history',
  description: 'Get deployment history and rollout status for a Kubernetes deployment',
  category: 'kubernetes',
  subcategory: 'workloads',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    if (!params.zone && !params.region) {
      return {
        content: [{
          type: 'text',
          text: 'Error: Either zone or region must be specified for the cluster location'
        }],
        isError: true
      };
    }
    
    // First, get cluster credentials
    let getCredsCommand = `gcloud container clusters get-credentials ${params.cluster}`;
    
    if (params.zone) {
      getCredsCommand += ` --zone=${params.zone}`;
    } else if (params.region) {
      getCredsCommand += ` --region=${params.region}`;
    }
    
    if (params.project) {
      getCredsCommand += ` --project=${params.project}`;
    }
    
    const credsResult = await executeGCloudCommand(getCredsCommand);
    
    if (credsResult.exitCode !== 0) {
      return {
        content: [{
          type: 'text',
          text: `Error getting cluster credentials: ${credsResult.stderr}`
        }],
        isError: true
      };
    }
    
    let output = `Deployment History: ${params.deployment}\n`;
    output += '='.repeat(60) + '\n\n';
    
    // Get current deployment status
    const statusCommand = `kubectl rollout status deployment/${params.deployment} -n ${params.namespace}`;
    const statusResult = await executeGCloudCommand(statusCommand);
    
    if (statusResult.exitCode === 0) {
      output += 'Current Status:\n';
      output += statusResult.stdout + '\n\n';
    }
    
    // Get rollout history
    const historyCommand = `kubectl rollout history deployment/${params.deployment} -n ${params.namespace}`;
    const historyResult = await executeGCloudCommand(historyCommand);
    
    if (historyResult.exitCode !== 0) {
      return {
        content: [{
          type: 'text',
          text: `Error getting deployment history: ${historyResult.stderr}`
        }],
        isError: true
      };
    }
    
    output += 'Revision History:\n';
    output += historyResult.stdout + '\n\n';
    
    // Get replica sets to find deployment times
    const replicaSetsCommand = `kubectl get replicasets -n ${params.namespace} -l app=${params.deployment} -o json`;
    const replicaSetsResult = await executeGCloudCommand(replicaSetsCommand);
    
    if (replicaSetsResult.exitCode === 0) {
      const replicaSets = parseGCloudJson<any>(replicaSetsResult.stdout);
      
      if (replicaSets?.items && replicaSets.items.length > 0) {
        output += 'Deployment Timeline:\n';
        output += '-'.repeat(30) + '\n';
        
        // Sort by creation timestamp
        const sortedRS = replicaSets.items.sort((a: any, b: any) => 
          new Date(b.metadata.creationTimestamp).getTime() - new Date(a.metadata.creationTimestamp).getTime()
        );
        
        // Show recent deployments
        const recentRS = sortedRS.slice(0, params.limit);
        
        recentRS.forEach((rs: any) => {
          const revision = rs.metadata.annotations?.['deployment.kubernetes.io/revision'] || 'N/A';
          const desiredReplicas = rs.spec.replicas || 0;
          const readyReplicas = rs.status.readyReplicas || 0;
          
          output += `\nRevision #${revision}:\n`;
          output += `  Created: ${formatTimestamp(rs.metadata.creationTimestamp)}\n`;
          output += `  ReplicaSet: ${rs.metadata.name}\n`;
          output += `  Replicas: ${readyReplicas}/${desiredReplicas}\n`;
          
          // Get image information
          if (rs.spec.template?.spec?.containers) {
            const images = rs.spec.template.spec.containers.map((c: any) => c.image);
            output += `  Images: ${images.join(', ')}\n`;
          }
          
          // Check if this is the current revision
          if (readyReplicas > 0) {
            output += `  Status: ACTIVE\n`;
          }
        });
        
        // Get the most recent deployment time
        if (sortedRS.length > 0) {
          const latestRS = sortedRS.find((rs: any) => (rs.status.readyReplicas || 0) > 0);
          if (latestRS) {
            output += `\n\nLast Successful Deployment: ${formatTimestamp(latestRS.metadata.creationTimestamp)}\n`;
          }
        }
      }
    }
    
    // Get recent events for this deployment
    output += '\n\nRecent Deployment Events:\n';
    output += '-'.repeat(30) + '\n';
    const eventsCommand = `kubectl get events -n ${params.namespace} --field-selector involvedObject.name=${params.deployment} --sort-by='.lastTimestamp' | grep -E '(Scaled|Started|Pulled|Created)' | tail -10`;
    const eventsResult = await executeGCloudCommand(eventsCommand);
    
    if (eventsResult.exitCode === 0 && eventsResult.stdout) {
      output += eventsResult.stdout;
    } else {
      output += 'No recent deployment events found\n';
    }
    
    return {
      content: [{
        type: 'text',
        text: output.trim()
      }]
    };
  }
};

export default gcloudWorkloadHistoryTool;