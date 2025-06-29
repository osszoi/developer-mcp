import { z } from 'zod';
import { ToolDefinition } from '../../types.js';
import { executeGCloudCommand, parseGCloudJson } from '../../utils/gcloud.js';

const inputSchema = z.object({
  repository: z.string().describe('Name of the artifact repository'),
  location: z.string().describe('Location of the repository (e.g., us-central1)'),
  package: z.string().describe('Package/artifact name'),
  project: z.string().optional().describe('GCP project ID (uses current project if not specified)'),
  limit: z.number().optional().default(20).describe('Maximum number of versions to return'),
  includePrerelease: z.boolean().optional().default(true).describe('Include pre-release versions')
});

interface ArtifactVersion {
  name: string;
  createTime: string;
  updateTime: string;
  metadata?: any;
}

const gcloudArtifactVersionsTool: ToolDefinition = {
  name: 'artifact_versions',
  description: 'List all versions of a specific artifact/package',
  category: 'artifacts',
  subcategory: 'versions',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    let output = `Versions of '${params.package}' in '${params.repository}':\n`;
    output += '='.repeat(60) + '\n\n';
    
    // Try Docker tags first (for Docker repositories)
    const dockerCommand = `gcloud artifacts docker tags list ${params.location}-docker.pkg.dev/${params.project || '$(gcloud config get-value project)'}/${params.repository}/${params.package} --format=json --limit=${params.limit}`;
    
    const dockerResult = await executeGCloudCommand(dockerCommand);
    
    if (dockerResult.exitCode === 0) {
      const tags = parseGCloudJson<any[]>(dockerResult.stdout);
      
      if (!tags || tags.length === 0) {
        return {
          content: [{
            type: 'text',
            text: `No tags found for Docker image '${params.package}'`
          }]
        };
      }
      
      output += `Found ${tags.length} tag${tags.length !== 1 ? 's' : ''}:\n\n`;
      
      // Sort by creation time (newest first)
      tags.sort((a, b) => new Date(b.createTime).getTime() - new Date(a.createTime).getTime());
      
      // Find latest stable version
      const latestStable = tags.find(t => t.tag && !t.tag.includes('-') && t.tag !== 'latest');
      const latestTag = tags.find(t => t.tag === 'latest');
      
      if (latestTag) {
        output += 'Latest Tag:\n';
        output += `  latest -> ${latestTag.version.split('@')[1].substring(0, 12)}...\n`;
        output += `  Created: ${new Date(latestTag.createTime).toLocaleString()}\n\n`;
      }
      
      if (latestStable) {
        output += 'Latest Stable Version:\n';
        output += `  ${latestStable.tag}\n`;
        output += `  Created: ${new Date(latestStable.createTime).toLocaleString()}\n\n`;
      }
      
      output += 'All Tags:\n';
      tags.forEach(tag => {
        if (!params.includePrerelease && tag.tag && tag.tag.includes('-') && tag.tag !== 'latest') {
          return; // Skip pre-release versions
        }
        
        output += `  ${tag.tag}\n`;
        output += `    Digest: ${tag.version.split('@')[1].substring(0, 12)}...\n`;
        output += `    Created: ${new Date(tag.createTime).toLocaleString()}\n`;
        output += `    Full URI: ${tag.package}:${tag.tag}\n`;
        output += '\n';
      });
      
      return {
        content: [{
          type: 'text',
          text: output.trim()
        }]
      };
    }
    
    // If not Docker, try generic versions list
    let versionsCommand = `gcloud artifacts versions list --package=${params.package} --repository=${params.repository} --location=${params.location} --format=json --limit=${params.limit}`;
    
    if (params.project) {
      versionsCommand += ` --project=${params.project}`;
    }
    
    const versionsResult = await executeGCloudCommand(versionsCommand);
    
    if (versionsResult.exitCode !== 0) {
      return {
        content: [{
          type: 'text',
          text: `Error listing artifact versions: ${versionsResult.stderr}`
        }],
        isError: true
      };
    }
    
    const versions = parseGCloudJson<ArtifactVersion[]>(versionsResult.stdout);
    
    if (!versions || versions.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `No versions found for package '${params.package}'`
        }]
      };
    }
    
    output += `Found ${versions.length} version${versions.length !== 1 ? 's' : ''}:\n\n`;
    
    versions.forEach(version => {
      const versionName = version.name.split('/').pop() || 'unknown';
      
      output += `Version: ${versionName}\n`;
      output += `  Created: ${new Date(version.createTime).toLocaleString()}\n`;
      output += `  Updated: ${new Date(version.updateTime).toLocaleString()}\n`;
      if (version.metadata) {
        output += `  Metadata: ${JSON.stringify(version.metadata)}\n`;
      }
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

export default gcloudArtifactVersionsTool;