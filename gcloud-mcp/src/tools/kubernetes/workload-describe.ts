import { z } from 'zod';
import { ToolDefinition } from '../../types.js';
import { executeGCloudCommand, parseGCloudJson } from '../../utils/gcloud.js';

const inputSchema = z.object({
  cluster: z.string().describe('Name of the GKE cluster'),
  zone: z.string().optional().describe('Zone where the cluster is located (for zonal clusters)'),
  region: z.string().optional().describe('Region where the cluster is located (for regional clusters)'),
  workload: z.string().describe('Name of the workload (deployment/pod/service)'),
  type: z.enum(['deployment', 'pod', 'service']).describe('Type of the workload'),
  namespace: z.string().optional().default('default').describe('Kubernetes namespace'),
  project: z.string().optional().describe('GCP project ID (uses current project if not specified)')
});

const gcloudWorkloadDescribeTool: ToolDefinition = {
  name: 'workload_describe',
  description: 'Get detailed information about a specific workload (deployment, pod, or service)',
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
    
    // Get workload details
    const resourceType = params.type === 'deployment' ? 'deployment' : 
                        params.type === 'pod' ? 'pod' : 'service';
    const describeCommand = `kubectl describe ${resourceType} ${params.workload} -n ${params.namespace}`;
    const describeResult = await executeGCloudCommand(describeCommand);
    
    if (describeResult.exitCode !== 0) {
      return {
        content: [{
          type: 'text',
          text: `Error describing ${params.type}: ${describeResult.stderr}`
        }],
        isError: true
      };
    }
    
    let output = `${params.type.toUpperCase()} Details: ${params.workload}\n`;
    output += '='.repeat(60) + '\n\n';
    output += describeResult.stdout + '\n\n';
    
    // Get additional JSON details for more structured information
    const jsonCommand = `kubectl get ${resourceType} ${params.workload} -n ${params.namespace} -o json`;
    const jsonResult = await executeGCloudCommand(jsonCommand);
    
    if (jsonResult.exitCode === 0) {
      const resource = parseGCloudJson<any>(jsonResult.stdout);
      
      if (resource && params.type === 'deployment') {
        output += '\nDeployment History:\n';
        output += '-'.repeat(30) + '\n';
        
        // Get rollout history
        const historyCommand = `kubectl rollout history deployment/${params.workload} -n ${params.namespace}`;
        const historyResult = await executeGCloudCommand(historyCommand);
        
        if (historyResult.exitCode === 0) {
          output += historyResult.stdout + '\n';
        }
        
        // Get recent events
        output += '\nRecent Events:\n';
        output += '-'.repeat(30) + '\n';
        const eventsCommand = `kubectl get events -n ${params.namespace} --field-selector involvedObject.name=${params.workload} --sort-by='.lastTimestamp' | tail -10`;
        const eventsResult = await executeGCloudCommand(eventsCommand);
        
        if (eventsResult.exitCode === 0 && eventsResult.stdout) {
          output += eventsResult.stdout;
        } else {
          output += 'No recent events found\n';
        }
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

export default gcloudWorkloadDescribeTool;