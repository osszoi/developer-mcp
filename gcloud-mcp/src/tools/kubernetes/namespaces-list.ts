import { z } from 'zod';
import { ToolDefinition } from '../../types.js';
import { executeGCloudCommand, parseGCloudJson } from '../../utils/gcloud.js';

const inputSchema = z.object({
  cluster: z.string().describe('Name of the GKE cluster'),
  zone: z.string().optional().describe('Zone where the cluster is located (for zonal clusters)'),
  region: z.string().optional().describe('Region where the cluster is located (for regional clusters)'),
  project: z.string().optional().describe('GCP project ID (uses current project if not specified)')
});

const gcloudNamespacesListTool: ToolDefinition = {
  name: 'namespaces_list',
  description: 'List all namespaces in a GKE cluster',
  category: 'kubernetes',
  subcategory: 'namespaces',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    if (!params.zone && !params.region) {
      // Try to get cluster location from gcloud
      let clusterInfoCommand = `gcloud container clusters list --filter="name:${params.cluster}" --format="value(location)"`;
      if (params.project) {
        clusterInfoCommand += ` --project=${params.project}`;
      }
      
      const clusterInfoResult = await executeGCloudCommand(clusterInfoCommand);
      
      if (clusterInfoResult.exitCode === 0 && clusterInfoResult.stdout.trim()) {
        const location = clusterInfoResult.stdout.trim();
        // Check if it's a zone (contains two dashes) or region (contains one dash)
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
    
    // Get namespaces
    const namespacesCommand = 'kubectl get namespaces -o json';
    const namespacesResult = await executeGCloudCommand(namespacesCommand);
    
    if (namespacesResult.exitCode !== 0) {
      return {
        content: [{
          type: 'text',
          text: `Error getting namespaces: ${namespacesResult.stderr}`
        }],
        isError: true
      };
    }
    
    const namespaces = parseGCloudJson<any>(namespacesResult.stdout);
    
    if (!namespaces?.items || namespaces.items.length === 0) {
      return {
        content: [{
          type: 'text',
          text: 'No namespaces found in the cluster'
        }]
      };
    }
    
    let output = `Namespaces in cluster '${params.cluster}':\n`;
    output += '='.repeat(60) + '\n\n';
    output += `Total namespaces: ${namespaces.items.length}\n\n`;
    
    // Categorize namespaces
    const systemNamespaces: any[] = [];
    const userNamespaces: any[] = [];
    
    namespaces.items.forEach((ns: any) => {
      if (ns.metadata.name.startsWith('kube-') || 
          ns.metadata.name === 'default' || 
          ns.metadata.name === 'gke-system' ||
          ns.metadata.name === 'gmp-system' ||
          ns.metadata.name === 'gmp-public') {
        systemNamespaces.push(ns);
      } else {
        userNamespaces.push(ns);
      }
    });
    
    // Show user namespaces first
    if (userNamespaces.length > 0) {
      output += 'APPLICATION NAMESPACES:\n';
      userNamespaces.forEach((ns: any) => {
        output += `  ${ns.metadata.name}`;
        if (ns.status.phase !== 'Active') {
          output += ` (${ns.status.phase})`;
        }
        if (ns.metadata.creationTimestamp) {
          const age = Date.now() - new Date(ns.metadata.creationTimestamp).getTime();
          const days = Math.floor(age / (1000 * 60 * 60 * 24));
          output += ` - ${days} days old`;
        }
        output += '\n';
        
        // Show labels if any
        if (ns.metadata.labels && Object.keys(ns.metadata.labels).length > 0) {
          const importantLabels = Object.entries(ns.metadata.labels)
            .filter(([k]) => !k.startsWith('kubernetes.io/'))
            .map(([k, v]) => `${k}=${v}`)
            .join(', ');
          if (importantLabels) {
            output += `    Labels: ${importantLabels}\n`;
          }
        }
      });
      output += '\n';
    }
    
    // Show system namespaces
    output += 'SYSTEM NAMESPACES:\n';
    systemNamespaces.forEach((ns: any) => {
      output += `  ${ns.metadata.name}`;
      if (ns.status.phase !== 'Active') {
        output += ` (${ns.status.phase})`;
      }
      output += '\n';
    });
    
    output += '\n';
    output += 'Note: The "default" namespace is commonly used for development workloads.\n';
    output += 'Production workloads typically use dedicated namespaces.\n';
    
    return {
      content: [{
        type: 'text',
        text: output.trim()
      }]
    };
  }
};

export default gcloudNamespacesListTool;