import { z } from 'zod';
import { ToolDefinition } from '../../types.js';
import { executeGCloudCommand } from '../../utils/gcloud.js';

const inputSchema = z.object({
  cluster: z.string().describe('Name of the GKE cluster'),
  zone: z.string().optional().describe('Zone where the cluster is located (for zonal clusters)'),
  region: z.string().optional().describe('Region where the cluster is located (for regional clusters)'),
  namespace: z.string().optional().describe('Kubernetes namespace (leave empty to list from all namespaces)'),
  type: z.enum(['deployments', 'pods', 'services', 'all']).optional().default('all').describe('Type of workloads to list'),
  project: z.string().optional().describe('GCP project ID (uses current project if not specified)')
});

const gcloudWorkloadsListApiTool: ToolDefinition = {
  name: 'workloads_list_api',
  description: 'List workloads using direct API calls (alternative method)',
  category: 'kubernetes',
  subcategory: 'workloads',
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
        const dashCount = (location.match(/-/g) || []).length;
        if (dashCount === 2) {
          params.zone = location;
        } else {
          params.region = location;
        }
      }
    }
    
    // Get cluster endpoint
    let getEndpointCommand = `gcloud container clusters describe ${params.cluster} --format="value(endpoint)"`;
    
    if (params.zone) {
      getEndpointCommand += ` --zone=${params.zone}`;
    } else if (params.region) {
      getEndpointCommand += ` --region=${params.region}`;
    }
    
    if (params.project) {
      getEndpointCommand += ` --project=${params.project}`;
    }
    
    const endpointResult = await executeGCloudCommand(getEndpointCommand);
    
    if (endpointResult.exitCode !== 0) {
      return {
        content: [{
          type: 'text',
          text: `Error getting cluster endpoint: ${endpointResult.stderr}`
        }],
        isError: true
      };
    }
    
    const endpoint = endpointResult.stdout.trim();
    
    // Get access token
    const tokenResult = await executeGCloudCommand('gcloud auth application-default print-access-token');
    
    if (tokenResult.exitCode !== 0) {
      return {
        content: [{
          type: 'text',
          text: `Error getting access token: ${tokenResult.stderr}`
        }],
        isError: true
      };
    }
    
    const token = tokenResult.stdout.trim();
    
    let output = `Workloads in cluster '${params.cluster}'`;
    if (params.namespace) {
      output += ` (namespace: ${params.namespace})`;
    } else {
      output += ` (all namespaces)`;
    }
    output += ':\n' + '='.repeat(60) + '\n\n';
    
    // Function to make API calls
    const makeApiCall = async (path: string) => {
      const curlCommand = `curl -s -k -H "Authorization: Bearer ${token}" -H "Accept: application/json" "https://${endpoint}${path}"`;
      const result = await executeGCloudCommand(curlCommand);
      
      if (result.exitCode === 0) {
        try {
          return JSON.parse(result.stdout);
        } catch {
          return null;
        }
      }
      return null;
    };
    
    // Get namespaces first if not specified
    let namespaces = [params.namespace || 'default'];
    if (!params.namespace) {
      const nsData = await makeApiCall('/api/v1/namespaces');
      if (nsData?.items) {
        namespaces = nsData.items.map((ns: any) => ns.metadata.name);
        output += `Found namespaces: ${namespaces.join(', ')}\n\n`;
      }
    }
    
    // Get deployments
    if (params.type === 'deployments' || params.type === 'all') {
      output += 'DEPLOYMENTS:\n';
      let totalDeployments = 0;
      
      for (const ns of namespaces) {
        const deployData = await makeApiCall(`/apis/apps/v1/namespaces/${ns}/deployments`);
        
        if (deployData?.items && deployData.items.length > 0) {
          totalDeployments += deployData.items.length;
          if (!params.namespace) {
            output += `\n  Namespace: ${ns}\n`;
          }
          
          deployData.items.forEach((dep: any) => {
            const ready = dep.status.readyReplicas || 0;
            const desired = dep.spec.replicas || 0;
            output += `    ${dep.metadata.name}\n`;
            output += `      Ready: ${ready}/${desired}`;
            if (ready < desired) {
              output += ' ⚠️';
            }
            output += '\n';
            
            if (dep.spec.template?.spec?.containers?.[0]) {
              output += `      Image: ${dep.spec.template.spec.containers[0].image}\n`;
            }
            
            if (dep.metadata.creationTimestamp) {
              output += `      Created: ${new Date(dep.metadata.creationTimestamp).toLocaleString()}\n`;
            }
            output += '\n';
          });
        }
      }
      
      if (totalDeployments === 0) {
        output += '  None found\n';
      }
      output += '\n';
    }
    
    // Get pods (simplified for API version)
    if (params.type === 'pods' || params.type === 'all') {
      output += 'PODS:\n';
      let totalPods = 0;
      
      for (const ns of namespaces) {
        const podData = await makeApiCall(`/api/v1/namespaces/${ns}/pods`);
        
        if (podData?.items && podData.items.length > 0) {
          totalPods += podData.items.length;
          if (!params.namespace) {
            output += `\n  Namespace: ${ns} (${podData.items.length} pods)\n`;
          }
          
          // Group by status
          const statusCounts: Record<string, number> = {};
          podData.items.forEach((pod: any) => {
            const status = pod.status.phase || 'Unknown';
            statusCounts[status] = (statusCounts[status] || 0) + 1;
          });
          
          output += `    Status: ${Object.entries(statusCounts).map(([s, c]) => `${s}: ${c}`).join(', ')}\n`;
        }
      }
      
      if (totalPods === 0) {
        output += '  None found\n';
      }
      output += '\n';
    }
    
    // Get services
    if (params.type === 'services' || params.type === 'all') {
      output += 'SERVICES:\n';
      let totalServices = 0;
      
      for (const ns of namespaces) {
        const svcData = await makeApiCall(`/api/v1/namespaces/${ns}/services`);
        
        if (svcData?.items && svcData.items.length > 0) {
          totalServices += svcData.items.length;
          if (!params.namespace) {
            output += `\n  Namespace: ${ns}\n`;
          }
          
          svcData.items.forEach((svc: any) => {
            output += `    ${svc.metadata.name} (${svc.spec.type})`;
            
            if (svc.spec.type === 'LoadBalancer' && svc.status?.loadBalancer?.ingress?.[0]) {
              const ip = svc.status.loadBalancer.ingress[0].ip;
              if (ip) {
                output += ` - External IP: ${ip}`;
              }
            }
            
            if (svc.spec.ports && svc.spec.ports.length > 0) {
              const ports = svc.spec.ports.map((p: any) => p.port).join(',');
              output += ` - Ports: ${ports}`;
            }
            output += '\n';
          });
        }
      }
      
      if (totalServices === 0) {
        output += '  None found\n';
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

export default gcloudWorkloadsListApiTool;