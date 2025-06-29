import { z } from 'zod';
import { ToolDefinition } from '../../types.js';
import { executeGCloudCommand } from '../../utils/gcloud.js';

const inputSchema = z.object({
  cluster: z.string().describe('Name of the GKE cluster'),
  zone: z.string().optional().describe('Zone where the cluster is located (for zonal clusters)'),
  region: z.string().optional().describe('Region where the cluster is located (for regional clusters)'),
  namespace: z.string().optional().describe('Kubernetes namespace (defaults to "default")'),
  type: z.enum(['deployments', 'pods', 'services', 'all']).optional().default('all').describe('Type of workloads to list'),
  project: z.string().optional().describe('GCP project ID (uses current project if not specified)')
});

const gcloudWorkloadsListSimpleTool: ToolDefinition = {
  name: 'workloads_list_simple',
  description: 'List workloads in a GKE cluster (simplified version using gcloud)',
  category: 'kubernetes',
  subcategory: 'workloads',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    // Default to 'default' namespace if not specified
    const namespace = params.namespace || 'default';
    
    if (!params.zone && !params.region) {
      // Try to get cluster location from gcloud
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
      } else {
        return {
          content: [{
            type: 'text',
            text: 'Error: Could not determine cluster location. Please specify either zone or region.'
          }],
          isError: true
        };
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
    
    let output = `Workloads in cluster '${params.cluster}' (namespace: ${namespace}):\n`;
    output += '='.repeat(60) + '\n\n';
    
    // Try to use gcloud commands that don't require kubectl
    if (params.type === 'deployments' || params.type === 'all') {
      // Try using gcloud to get workload information
      let workloadsCommand = `gcloud container clusters describe ${params.cluster} --format=json`;
      
      if (params.zone) {
        workloadsCommand += ` --zone=${params.zone}`;
      } else if (params.region) {
        workloadsCommand += ` --region=${params.region}`;
      }
      
      if (params.project) {
        workloadsCommand += ` --project=${params.project}`;
      }
      
      const workloadsResult = await executeGCloudCommand(workloadsCommand, { timeout: 15000 });
      
      if (workloadsResult.exitCode === 0) {
        try {
          const clusterInfo = JSON.parse(workloadsResult.stdout);
          output += 'CLUSTER INFO:\n';
          output += `  Name: ${clusterInfo.name}\n`;
          output += `  Location: ${clusterInfo.location || clusterInfo.zone}\n`;
          output += `  Status: ${clusterInfo.status}\n`;
          output += `  Version: ${clusterInfo.currentMasterVersion}\n`;
          output += `  Nodes: ${clusterInfo.currentNodeCount || 0}\n`;
          output += `  Endpoint: ${clusterInfo.endpoint}\n\n`;
          
          if (clusterInfo.nodePools) {
            output += 'NODE POOLS:\n';
            clusterInfo.nodePools.forEach((pool: any) => {
              output += `  ${pool.name}:\n`;
              output += `    Machine type: ${pool.config?.machineType || 'N/A'}\n`;
              output += `    Node count: ${pool.initialNodeCount || 0}\n`;
              output += `    Status: ${pool.status}\n`;
            });
            output += '\n';
          }
        } catch (e) {
          output += 'Error parsing cluster information\n\n';
        }
      }
    }
    
    // For actual workload listing, we need to try kubectl with proper error handling
    const kubectlAvailable = await executeGCloudCommand('which kubectl', { timeout: 5000, skipValidation: true });
    
    if (kubectlAvailable.exitCode === 0) {
      // Try a simple kubectl command with timeout
      const testCommand = `timeout 5 kubectl get deployments -n ${namespace} --no-headers 2>&1`;
      const testResult = await executeGCloudCommand(testCommand, { timeout: 6000, skipValidation: true });
      
      if (testResult.exitCode === 0) {
        // kubectl is working, get detailed info
        if (params.type === 'deployments' || params.type === 'all') {
          const deploymentsCommand = `kubectl get deployments -n ${namespace} -o wide`;
          const deploymentsResult = await executeGCloudCommand(deploymentsCommand, { timeout: 10000, skipValidation: true });
          
          if (deploymentsResult.exitCode === 0 && deploymentsResult.stdout) {
            output += 'DEPLOYMENTS:\n';
            output += deploymentsResult.stdout + '\n\n';
          }
        }
        
        if (params.type === 'pods' || params.type === 'all') {
          const podsCommand = `kubectl get pods -n ${namespace} -o wide`;
          const podsResult = await executeGCloudCommand(podsCommand, { timeout: 10000, skipValidation: true });
          
          if (podsResult.exitCode === 0 && podsResult.stdout) {
            output += 'PODS:\n';
            output += podsResult.stdout + '\n\n';
          }
        }
        
        if (params.type === 'services' || params.type === 'all') {
          const servicesCommand = `kubectl get services -n ${namespace} -o wide`;
          const servicesResult = await executeGCloudCommand(servicesCommand, { timeout: 10000, skipValidation: true });
          
          if (servicesResult.exitCode === 0 && servicesResult.stdout) {
            output += 'SERVICES:\n';
            output += servicesResult.stdout + '\n\n';
          }
        }
      } else if (testResult.stderr && testResult.stderr.includes('gke-gcloud-auth-plugin')) {
        output += '\nNote: kubectl requires gke-gcloud-auth-plugin to be installed.\n';
        output += 'To install it:\n';
        output += '1. For gcloud SDK: gcloud components install gke-gcloud-auth-plugin\n';
        output += '2. For apt-based systems: sudo apt-get install google-cloud-cli-gke-gcloud-auth-plugin\n';
        output += '3. Then set: export USE_GKE_GCLOUD_AUTH_PLUGIN=True\n';
      } else {
        output += '\nNote: Unable to retrieve detailed workload information.\n';
        output += 'Error: ' + (testResult.stderr || 'Unknown error') + '\n';
      }
    } else {
      output += '\nNote: kubectl is not installed. Install kubectl to see detailed workload information.\n';
    }
    
    return {
      content: [{
        type: 'text',
        text: output.trim()
      }]
    };
  }
};

export default gcloudWorkloadsListSimpleTool;