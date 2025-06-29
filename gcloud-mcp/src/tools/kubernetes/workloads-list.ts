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

const gcloudWorkloadsListTool: ToolDefinition = {
  name: 'workloads_list',
  description: 'List workloads (deployments, pods, services) in a GKE cluster',
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
    
    // Get cluster credentials
    const credsResult = await executeGCloudCommand(getCredsCommand);
    
    if (credsResult.exitCode !== 0 && !credsResult.stderr.includes('kubeconfig entry generated')) {
      return {
        content: [{
          type: 'text',
          text: `Error getting cluster credentials: ${credsResult.stderr}`
        }],
        isError: true
      };
    }
    
    // Check if gke-gcloud-auth-plugin is installed
    const authPluginCheck = await executeGCloudCommand('which gke-gcloud-auth-plugin');
    const useGcloud = authPluginCheck.exitCode !== 0;
    
    // Build namespace flag
    const namespaceFlag = params.namespace ? `-n ${params.namespace}` : '--all-namespaces';
    const showingAllNamespaces = !params.namespace;
    
    let output = `Workloads in cluster '${params.cluster}'`;
    if (params.namespace) {
      output += ` (namespace: ${params.namespace})`;
    } else {
      output += ` (all namespaces)`;
    }
    output += ':\n' + '='.repeat(60) + '\n\n';
    
    // Get namespaces using gcloud or kubectl
    if (!params.namespace && !useGcloud) {
      const namespacesCommand = 'timeout 10 kubectl get namespaces -o json';
      const namespacesResult = await executeGCloudCommand(namespacesCommand);
      
      if (namespacesResult.exitCode === 0) {
        try {
          const namespaces = JSON.parse(namespacesResult.stdout);
          if (namespaces?.items) {
            const nsNames = namespaces.items.map((ns: any) => ns.metadata.name);
            output += `Available namespaces: ${nsNames.join(', ')}\n\n`;
          }
        } catch (e) {
          // Ignore JSON parse errors
        }
      }
    }
    
    // Get deployments
    if (params.type === 'deployments' || params.type === 'all') {
      let deploymentsCommand: string;
      
      if (useGcloud) {
        // Use gcloud command for deployments
        deploymentsCommand = `gcloud container fleet memberships list --project=${params.project || '$(gcloud config get-value project)'} --format=json`;
        output += `Note: Using gcloud fleet memberships as kubectl is not available\n\n`;
      } else {
        deploymentsCommand = `timeout 20 kubectl get deployments ${namespaceFlag} -o json`;
      }
      
      const deploymentsResult = await executeGCloudCommand(deploymentsCommand);
      
      if (deploymentsResult.exitCode === 0) {
        try {
          const deployments = JSON.parse(deploymentsResult.stdout);
          if (deployments?.items && deployments.items.length > 0) {
            output += `DEPLOYMENTS (${deployments.items.length} found):\n`;
            
            // Group by namespace if showing all
            const depsByNamespace: Record<string, any[]> = {};
            deployments.items.forEach((dep: any) => {
              const ns = dep.metadata.namespace || 'default';
              if (!depsByNamespace[ns]) {
                depsByNamespace[ns] = [];
              }
              depsByNamespace[ns].push(dep);
            });
          
          Object.entries(depsByNamespace).forEach(([ns, deps]) => {
            if (showingAllNamespaces) {
              output += `\n  Namespace: ${ns}\n`;
            }
            deps.forEach((dep: any) => {
              const ready = dep.status.readyReplicas || 0;
              const desired = dep.spec.replicas || 0;
              output += `    ${dep.metadata.name}\n`;
              output += `      Ready: ${ready}/${desired}`;
              if (ready < desired) {
                output += ' ⚠️';
              }
              output += '\n';
              output += `      Image: ${dep.spec.template.spec.containers[0]?.image || 'N/A'}\n`;
              output += `      Created: ${new Date(dep.metadata.creationTimestamp).toLocaleString()}\n`;
              
              // Check for recent updates
              if (dep.status.conditions) {
                const progressing = dep.status.conditions.find((c: any) => c.type === 'Progressing');
                if (progressing && progressing.lastUpdateTime) {
                  const updateTime = new Date(progressing.lastUpdateTime);
                  const hoursSinceUpdate = (Date.now() - updateTime.getTime()) / (1000 * 60 * 60);
                  if (hoursSinceUpdate < 24) {
                    output += `      Last Updated: ${updateTime.toLocaleString()} (${hoursSinceUpdate.toFixed(1)}h ago)\n`;
                  }
                }
              }
              output += '\n';
            });
          });
          } else {
            output += 'DEPLOYMENTS: None found\n';
            if (useGcloud) {
              output += '  (Note: kubectl is required for detailed workload information)\n\n';
            } else {
              output += '  (This could mean no deployments exist or you lack permissions)\n\n';
            }
          }
        } catch (e) {
          output += `DEPLOYMENTS: Error parsing response\n\n`;
        }
      } else {
        if (deploymentsResult.exitCode === 124) {
          output += `DEPLOYMENTS: Command timed out after 20 seconds\n\n`;
        } else if (deploymentsResult.stderr.includes('gke-gcloud-auth-plugin')) {
          output += `DEPLOYMENTS: Authentication error - gke-gcloud-auth-plugin is required\n\n`;
        } else {
          output += `DEPLOYMENTS: Error getting deployments - ${deploymentsResult.stderr}\n\n`;
        }
      }
    }
    
    // Get pods
    if (params.type === 'pods' || params.type === 'all') {
      if (!useGcloud) {
        const podsCommand = `timeout 20 kubectl get pods ${namespaceFlag} -o json`;
        const podsResult = await executeGCloudCommand(podsCommand);
        
        if (podsResult.exitCode === 0) {
          try {
            const pods = JSON.parse(podsResult.stdout);
            if (pods?.items && pods.items.length > 0) {
              output += `PODS (${pods.items.length} found):\n`;
              
              // Group by namespace
              const podsByNamespace: Record<string, any[]> = {};
              pods.items.forEach((pod: any) => {
                const ns = pod.metadata.namespace;
                if (!podsByNamespace[ns]) {
                  podsByNamespace[ns] = [];
                }
                podsByNamespace[ns].push(pod);
              });
          
          Object.entries(podsByNamespace).forEach(([ns, nsPods]) => {
            if (showingAllNamespaces) {
              output += `\n  Namespace: ${ns}\n`;
            }
            
            // Show summary by status
            const statusCounts: Record<string, number> = {};
            nsPods.forEach((pod: any) => {
              const status = pod.status.phase;
              statusCounts[status] = (statusCounts[status] || 0) + 1;
            });
            
            output += `    Summary: ${Object.entries(statusCounts).map(([s, c]) => `${s}: ${c}`).join(', ')}\n`;
            
            // Show individual pods only if not too many
            if (nsPods.length <= 20) {
              nsPods.forEach((pod: any) => {
                const ready = pod.status.containerStatuses?.every((c: any) => c.ready) ? '✓' : '✗';
                const restarts = pod.status.containerStatuses?.reduce((sum: number, c: any) => sum + c.restartCount, 0) || 0;
                output += `    ${pod.metadata.name} [${pod.status.phase}] ${ready}`;
                if (restarts > 0) {
                  output += ` (${restarts} restarts)`;
                }
                output += '\n';
              });
            } else {
              output += `    (Showing summary only - ${nsPods.length} pods)\n`;
            }
          });
          output += '\n';
            } else {
              output += 'PODS: None found\n\n';
            }
          } catch (e) {
            output += `PODS: Error parsing response\n\n`;
          }
        } else {
          if (podsResult.exitCode === 124) {
            output += `PODS: Command timed out after 20 seconds\n\n`;
          } else if (podsResult.stderr.includes('gke-gcloud-auth-plugin')) {
            output += `PODS: Authentication error - gke-gcloud-auth-plugin is required\n\n`;
          } else {
            output += `PODS: Error getting pods - ${podsResult.stderr}\n\n`;
          }
        }
      } else {
        output += 'PODS: Skipped (kubectl required)\n\n';
      }
    }
    
    // Get services
    if (params.type === 'services' || params.type === 'all') {
      if (!useGcloud) {
        const servicesCommand = `timeout 20 kubectl get services ${namespaceFlag} -o json`;
        const servicesResult = await executeGCloudCommand(servicesCommand);
        
        if (servicesResult.exitCode === 0) {
          try {
            const services = JSON.parse(servicesResult.stdout);
            if (services?.items && services.items.length > 0) {
              output += `SERVICES (${services.items.length} found):\n`;
              
              // Group by namespace
              const svcsByNamespace: Record<string, any[]> = {};
              services.items.forEach((svc: any) => {
                const ns = svc.metadata.namespace;
                if (!svcsByNamespace[ns]) {
                  svcsByNamespace[ns] = [];
                }
                svcsByNamespace[ns].push(svc);
              });
          
          Object.entries(svcsByNamespace).forEach(([ns, svcs]) => {
            if (showingAllNamespaces) {
              output += `\n  Namespace: ${ns}\n`;
            }
            svcs.forEach((svc: any) => {
              output += `    ${svc.metadata.name} (${svc.spec.type})`;
              
              if (svc.spec.type === 'LoadBalancer' && svc.status.loadBalancer?.ingress) {
                const ip = svc.status.loadBalancer.ingress[0]?.ip;
                if (ip) {
                  output += ` - External IP: ${ip}`;
                }
              }
              
              if (svc.spec.ports && svc.spec.ports.length > 0) {
                const ports = svc.spec.ports.map((p: any) => `${p.port}`).join(',');
                output += ` - Ports: ${ports}`;
              }
              output += '\n';
            });
          });
            } else {
              output += 'SERVICES: None found\n';
            }
          } catch (e) {
            output += `SERVICES: Error parsing response\n`;
          }
        } else {
          if (servicesResult.exitCode === 124) {
            output += `SERVICES: Command timed out after 20 seconds\n`;
          } else if (servicesResult.stderr.includes('gke-gcloud-auth-plugin')) {
            output += `SERVICES: Authentication error - gke-gcloud-auth-plugin is required\n`;
          } else {
            output += `SERVICES: Error getting services - ${servicesResult.stderr}\n`;
          }
        }
      } else {
        output += 'SERVICES: Skipped (kubectl required)\n';
      }
    }
    
    // Add helpful context at the end
    if (useGcloud) {
      output += '\n\nNote: kubectl is not available. To get detailed workload information:\n';
      output += '1. Install gke-gcloud-auth-plugin: gcloud components install gke-gcloud-auth-plugin\n';
      output += '2. Or for apt-based systems: sudo apt-get install google-cloud-cli-gke-gcloud-auth-plugin\n';
    } else if (!params.namespace) {
      output += '\n\nTip: To see workloads in a specific namespace, add namespace: "namespace-name" to the parameters.';
    }
    
    return {
      content: [{
        type: 'text',
        text: output.trim()
      }]
    };
  }
};

export default gcloudWorkloadsListTool;