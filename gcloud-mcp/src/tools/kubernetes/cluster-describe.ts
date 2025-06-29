import { z } from 'zod';
import { ToolDefinition } from '../../types.js';
import { executeGCloudCommand, parseGCloudJson, formatTimestamp } from '../../utils/gcloud.js';

const inputSchema = z.object({
  cluster: z.string().describe('Name of the GKE cluster'),
  zone: z.string().optional().describe('Zone where the cluster is located (required for zonal clusters)'),
  region: z.string().optional().describe('Region where the cluster is located (required for regional clusters)'),
  project: z.string().optional().describe('GCP project ID (uses current project if not specified)')
});

const gcloudClusterDescribeTool: ToolDefinition = {
  name: 'cluster_describe',
  description: 'Get detailed information about a specific GKE cluster',
  category: 'kubernetes',
  subcategory: 'clusters',
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
    
    let command = `gcloud container clusters describe ${params.cluster} --format=json`;
    
    if (params.zone) {
      command += ` --zone=${params.zone}`;
    } else if (params.region) {
      command += ` --region=${params.region}`;
    }
    
    if (params.project) {
      command += ` --project=${params.project}`;
    }
    
    const result = await executeGCloudCommand(command);
    
    if (result.exitCode !== 0) {
      return {
        content: [{
          type: 'text',
          text: `Error describing cluster: ${result.stderr}`
        }],
        isError: true
      };
    }
    
    const cluster = parseGCloudJson<any>(result.stdout);
    
    if (!cluster) {
      return {
        content: [{
          type: 'text',
          text: 'Failed to parse cluster information'
        }],
        isError: true
      };
    }
    
    let output = `Cluster Details: ${cluster.name}\n`;
    output += '='.repeat(50) + '\n\n';
    
    // Basic Information
    output += 'Basic Information:\n';
    output += `  Name: ${cluster.name}\n`;
    output += `  Location: ${cluster.location}\n`;
    output += `  Status: ${cluster.status}\n`;
    output += `  Created: ${formatTimestamp(cluster.createTime)}\n`;
    output += `  Endpoint: ${cluster.endpoint || 'N/A'}\n\n`;
    
    // Version Information
    output += 'Version Information:\n';
    output += `  Master Version: ${cluster.currentMasterVersion}\n`;
    output += `  Node Version: ${cluster.currentNodeVersion}\n\n`;
    
    // Node Configuration
    if (cluster.nodeConfig) {
      output += 'Node Configuration:\n';
      output += `  Machine Type: ${cluster.nodeConfig.machineType}\n`;
      output += `  Disk Type: ${cluster.nodeConfig.diskType || 'pd-standard'}\n`;
      output += `  Disk Size: ${cluster.nodeConfig.diskSizeGb} GB\n`;
      output += `  Image Type: ${cluster.nodeConfig.imageType || 'COS'}\n`;
      if (cluster.nodeConfig.oauthScopes) {
        output += `  OAuth Scopes: ${cluster.nodeConfig.oauthScopes.length} configured\n`;
      }
      output += '\n';
    }
    
    // Node Pools
    if (cluster.nodePools && cluster.nodePools.length > 0) {
      output += 'Node Pools:\n';
      cluster.nodePools.forEach((pool: any) => {
        output += `  ${pool.name}:\n`;
        output += `    Status: ${pool.status}\n`;
        output += `    Node Count: ${pool.initialNodeCount}\n`;
        if (pool.autoscaling) {
          output += `    Autoscaling: ${pool.autoscaling.enabled ? 'Enabled' : 'Disabled'}\n`;
          if (pool.autoscaling.enabled) {
            output += `      Min Nodes: ${pool.autoscaling.minNodeCount}\n`;
            output += `      Max Nodes: ${pool.autoscaling.maxNodeCount}\n`;
          }
        }
      });
      output += '\n';
    }
    
    // Network Configuration
    if (cluster.network || cluster.subnetwork) {
      output += 'Network Configuration:\n';
      output += `  Network: ${cluster.network || 'default'}\n`;
      output += `  Subnetwork: ${cluster.subnetwork || 'default'}\n`;
      output += `  Cluster IPv4 CIDR: ${cluster.clusterIpv4Cidr || 'N/A'}\n`;
      output += '\n';
    }
    
    // Add-ons
    if (cluster.addonsConfig) {
      output += 'Add-ons:\n';
      const addons = cluster.addonsConfig;
      output += `  HTTP Load Balancing: ${addons.httpLoadBalancing?.disabled ? 'Disabled' : 'Enabled'}\n`;
      output += `  Horizontal Pod Autoscaling: ${addons.horizontalPodAutoscaling?.disabled ? 'Disabled' : 'Enabled'}\n`;
      output += `  Network Policy: ${addons.networkPolicyConfig?.disabled ? 'Disabled' : 'Enabled'}\n`;
      output += `  Cloud DNS: ${addons.dnsCacheConfig?.enabled ? 'Enabled' : 'Disabled'}\n`;
    }
    
    return {
      content: [{
        type: 'text',
        text: output.trim()
      }]
    };
  }
};

export default gcloudClusterDescribeTool;