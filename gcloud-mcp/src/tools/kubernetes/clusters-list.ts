import { z } from 'zod';
import { ToolDefinition } from '../../types.js';
import { executeGCloudCommand, parseGCloudJson } from '../../utils/gcloud.js';

const inputSchema = z.object({
  project: z.string().optional().describe('GCP project ID (uses current project if not specified)'),
  region: z.string().optional().describe('Filter by region'),
  limit: z.number().optional().default(50).describe('Maximum number of clusters to return')
});

interface GKECluster {
  name: string;
  location: string;
  status: string;
  currentMasterVersion: string;
  currentNodeVersion: string;
  nodeConfig?: {
    machineType: string;
  };
  currentNodeCount: number;
  createTime: string;
  endpoint?: string;
}

const gcloudClustersListTool: ToolDefinition = {
  name: 'clusters_list',
  description: 'List all GKE clusters in the project',
  category: 'kubernetes',
  subcategory: 'clusters',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    let command = 'gcloud container clusters list --format=json';
    
    if (params.project) {
      command += ` --project=${params.project}`;
    }
    
    if (params.region) {
      command += ` --region=${params.region}`;
    }
    
    if (params.limit) {
      command += ` --limit=${params.limit}`;
    }
    
    const result = await executeGCloudCommand(command);
    
    if (result.exitCode !== 0) {
      return {
        content: [{
          type: 'text',
          text: `Error listing clusters: ${result.stderr}`
        }],
        isError: true
      };
    }
    
    const clusters = parseGCloudJson<GKECluster[]>(result.stdout);
    
    if (!clusters || clusters.length === 0) {
      return {
        content: [{
          type: 'text',
          text: 'No GKE clusters found in the project'
        }]
      };
    }
    
    let output = `Found ${clusters.length} GKE cluster${clusters.length !== 1 ? 's' : ''}:\n\n`;
    
    clusters.forEach(cluster => {
      output += `Cluster: ${cluster.name}\n`;
      output += `  Location: ${cluster.location}\n`;
      output += `  Status: ${cluster.status}\n`;
      output += `  Master Version: ${cluster.currentMasterVersion}\n`;
      output += `  Node Version: ${cluster.currentNodeVersion}\n`;
      if (cluster.nodeConfig?.machineType) {
        output += `  Machine Type: ${cluster.nodeConfig.machineType}\n`;
      }
      output += `  Node Count: ${cluster.currentNodeCount}\n`;
      output += `  Created: ${new Date(cluster.createTime).toLocaleString()}\n`;
      output += '\n';
    });
    
    return {
      content: [{
        type: 'text',
        text: output.trim()
      }]
    };
  }
};

export default gcloudClustersListTool;