import { z } from 'zod';
import { ToolDefinition } from '../../types.js';
import { executeGCloudCommand, parseGCloudJson } from '../../utils/gcloud.js';

const inputSchema = z.object({
  project: z.string().optional().describe('GCP project ID (uses current project if not specified)'),
  location: z.string().optional().describe('Filter by location (e.g., us-central1, us, europe)'),
  limit: z.number().optional().default(50).describe('Maximum number of repositories to return')
});

interface ArtifactRepository {
  name: string;
  format: string;
  mode: string;
  description?: string;
  createTime: string;
  updateTime: string;
  sizeBytes?: string;
}

const gcloudArtifactsRepositoriesListTool: ToolDefinition = {
  name: 'artifacts_repositories_list',
  description: 'List all Artifact Registry repositories in the project',
  category: 'artifacts',
  subcategory: 'repositories',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    let command = 'gcloud artifacts repositories list --format=json';
    
    if (params.project) {
      command += ` --project=${params.project}`;
    }
    
    if (params.location) {
      command += ` --location=${params.location}`;
    }
    
    if (params.limit) {
      command += ` --limit=${params.limit}`;
    }
    
    const result = await executeGCloudCommand(command);
    
    if (result.exitCode !== 0) {
      return {
        content: [{
          type: 'text',
          text: `Error listing artifact repositories: ${result.stderr}`
        }],
        isError: true
      };
    }
    
    const repositories = parseGCloudJson<ArtifactRepository[]>(result.stdout);
    
    if (!repositories || repositories.length === 0) {
      return {
        content: [{
          type: 'text',
          text: 'No artifact repositories found in the project'
        }]
      };
    }
    
    let output = `Found ${repositories.length} artifact repositor${repositories.length !== 1 ? 'ies' : 'y'}:\n\n`;
    
    repositories.forEach(repo => {
      // Extract repository details from the full name
      const parts = repo.name.split('/');
      const location = parts[3];
      const repoName = parts[5];
      
      output += `Repository: ${repoName}\n`;
      output += `  Location: ${location}\n`;
      output += `  Format: ${repo.format}\n`;
      output += `  Mode: ${repo.mode}\n`;
      if (repo.description) {
        output += `  Description: ${repo.description}\n`;
      }
      if (repo.sizeBytes) {
        const sizeMB = (parseInt(repo.sizeBytes) / 1024 / 1024).toFixed(2);
        output += `  Size: ${sizeMB} MB\n`;
      }
      output += `  Created: ${new Date(repo.createTime).toLocaleString()}\n`;
      output += `  Updated: ${new Date(repo.updateTime).toLocaleString()}\n`;
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

export default gcloudArtifactsRepositoriesListTool;