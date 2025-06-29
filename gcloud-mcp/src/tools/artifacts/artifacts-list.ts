import { z } from 'zod';
import { ToolDefinition } from '../../types.js';
import { executeGCloudCommand, parseGCloudJson } from '../../utils/gcloud.js';

const inputSchema = z.object({
  repository: z.string().describe('Name of the artifact repository'),
  location: z.string().describe('Location of the repository (e.g., us-central1)'),
  project: z.string().optional().describe('GCP project ID (uses current project if not specified)'),
  package: z.string().optional().describe('Filter by package name'),
  limit: z.number().optional().default(50).describe('Maximum number of artifacts to return')
});

interface Artifact {
  name: string;
  createTime: string;
  updateTime: string;
}

const gcloudArtifactsListTool: ToolDefinition = {
  name: 'artifacts_list',
  description: 'List artifacts/images in an Artifact Registry repository',
  category: 'artifacts',
  subcategory: 'artifacts',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    // First check if it's a Docker repository and list Docker images
    let command = `gcloud artifacts docker images list ${params.location}-docker.pkg.dev/${params.project || '$(gcloud config get-value project)'}/${params.repository} --format=json`;
    
    if (params.limit) {
      command += ` --limit=${params.limit}`;
    }
    
    const dockerResult = await executeGCloudCommand(command);
    
    if (dockerResult.exitCode === 0) {
      // It's a Docker repository
      const images = parseGCloudJson<any[]>(dockerResult.stdout);
      
      if (!images || images.length === 0) {
        return {
          content: [{
            type: 'text',
            text: `No Docker images found in repository '${params.repository}'`
          }]
        };
      }
      
      let output = `Found ${images.length} Docker image${images.length !== 1 ? 's' : ''} in '${params.repository}':\n\n`;
      
      // Group images by package name
      const imagesByPackage: Record<string, any[]> = {};
      images.forEach(img => {
        const parts = img.package.split('/');
        const packageName = parts[parts.length - 1];
        if (!imagesByPackage[packageName]) {
          imagesByPackage[packageName] = [];
        }
        imagesByPackage[packageName].push(img);
      });
      
      Object.entries(imagesByPackage).forEach(([packageName, imgs]) => {
        output += `Package: ${packageName}\n`;
        
        // Sort by creation time (newest first)
        imgs.sort((a, b) => new Date(b.createTime).getTime() - new Date(a.createTime).getTime());
        
        imgs.forEach(img => {
          const tags = img.tags ? img.tags.join(', ') : 'untagged';
          output += `  ${tags}\n`;
          output += `    Digest: ${img.version.split('@')[1].substring(0, 12)}...\n`;
          output += `    Created: ${new Date(img.createTime).toLocaleString()}\n`;
          output += `    URI: ${img.uri}\n`;
          output += '\n';
        });
      });
      
      return {
        content: [{
          type: 'text',
          text: output.trim()
        }]
      };
    }
    
    // If not Docker, try generic packages list
    command = `gcloud artifacts packages list --repository=${params.repository} --location=${params.location} --format=json`;
    
    if (params.project) {
      command += ` --project=${params.project}`;
    }
    
    if (params.limit) {
      command += ` --limit=${params.limit}`;
    }
    
    const packagesResult = await executeGCloudCommand(command);
    
    if (packagesResult.exitCode !== 0) {
      return {
        content: [{
          type: 'text',
          text: `Error listing artifacts: ${packagesResult.stderr}`
        }],
        isError: true
      };
    }
    
    const packages = parseGCloudJson<Artifact[]>(packagesResult.stdout);
    
    if (!packages || packages.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `No packages found in repository '${params.repository}'`
        }]
      };
    }
    
    let output = `Found ${packages.length} package${packages.length !== 1 ? 's' : ''} in '${params.repository}':\n\n`;
    
    packages.forEach(pkg => {
      const parts = pkg.name.split('/');
      const packageName = parts[parts.length - 1];
      
      output += `Package: ${packageName}\n`;
      output += `  Created: ${new Date(pkg.createTime).toLocaleString()}\n`;
      output += `  Updated: ${new Date(pkg.updateTime).toLocaleString()}\n`;
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

export default gcloudArtifactsListTool;