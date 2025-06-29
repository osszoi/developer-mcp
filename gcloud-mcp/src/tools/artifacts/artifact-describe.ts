import { z } from 'zod';
import { ToolDefinition } from '../../types.js';
import { executeGCloudCommand, parseGCloudJson } from '../../utils/gcloud.js';

const inputSchema = z.object({
  repository: z.string().describe('Name of the artifact repository'),
  location: z.string().describe('Location of the repository (e.g., us-central1)'),
  package: z.string().describe('Package/artifact name'),
  version: z.string().optional().describe('Specific version/tag to describe (defaults to latest)'),
  project: z.string().optional().describe('GCP project ID (uses current project if not specified)')
});

const gcloudArtifactDescribeTool: ToolDefinition = {
  name: 'artifact_describe',
  description: 'Get detailed information about a specific artifact/package version',
  category: 'artifacts',
  subcategory: 'artifacts',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    let output = `Artifact Details: ${params.package}\n`;
    output += '='.repeat(60) + '\n\n';
    
    // Try Docker image describe first
    let imageUri = `${params.location}-docker.pkg.dev/${params.project || '$(gcloud config get-value project)'}/${params.repository}/${params.package}`;
    if (params.version) {
      imageUri += `:${params.version}`;
    }
    
    const dockerCommand = `gcloud artifacts docker images describe ${imageUri} --format=json`;
    const dockerResult = await executeGCloudCommand(dockerCommand);
    
    if (dockerResult.exitCode === 0) {
      const imageInfo = parseGCloudJson<any>(dockerResult.stdout);
      
      if (imageInfo) {
        output += 'Docker Image Information:\n';
        output += '-'.repeat(30) + '\n';
        output += `URI: ${imageInfo.uri}\n`;
        output += `Package: ${imageInfo.package}\n`;
        
        if (imageInfo.tags && imageInfo.tags.length > 0) {
          output += `Tags: ${imageInfo.tags.join(', ')}\n`;
        }
        
        output += `Digest: ${imageInfo.version.split('@')[1]}\n`;
        output += `Created: ${new Date(imageInfo.createTime).toLocaleString()}\n`;
        output += `Updated: ${new Date(imageInfo.updateTime).toLocaleString()}\n`;
        output += `Upload Time: ${new Date(imageInfo.uploadTime).toLocaleString()}\n`;
        
        if (imageInfo.imageSizeBytes) {
          const sizeMB = (parseInt(imageInfo.imageSizeBytes) / 1024 / 1024).toFixed(2);
          output += `Size: ${sizeMB} MB\n`;
        }
        
        if (imageInfo.mediaType) {
          output += `Media Type: ${imageInfo.mediaType}\n`;
        }
        
        output += '\n';
        
        // Get vulnerability scanning results if available
        const scanCommand = `gcloud artifacts docker images scan ${imageUri} --format=json 2>/dev/null`;
        const scanResult = await executeGCloudCommand(scanCommand);
        
        if (scanResult.exitCode === 0) {
          const scanInfo = parseGCloudJson<any>(scanResult.stdout);
          if (scanInfo) {
            output += 'Vulnerability Scan Results:\n';
            output += '-'.repeat(30) + '\n';
            
            if (scanInfo.vulnerabilities) {
              const vulnCounts: Record<string, number> = {};
              scanInfo.vulnerabilities.forEach((vuln: any) => {
                const severity = vuln.severity || 'UNKNOWN';
                vulnCounts[severity] = (vulnCounts[severity] || 0) + 1;
              });
              
              Object.entries(vulnCounts).forEach(([severity, count]) => {
                output += `  ${severity}: ${count}\n`;
              });
            } else {
              output += '  No vulnerabilities found\n';
            }
            output += '\n';
          }
        }
        
        // List recent tags for this image
        const tagsCommand = `gcloud artifacts docker tags list ${params.location}-docker.pkg.dev/${params.project || '$(gcloud config get-value project)'}/${params.repository}/${params.package} --format=json --limit=10`;
        const tagsResult = await executeGCloudCommand(tagsCommand);
        
        if (tagsResult.exitCode === 0) {
          const tags = parseGCloudJson<any[]>(tagsResult.stdout);
          if (tags && tags.length > 0) {
            output += 'Recent Tags:\n';
            output += '-'.repeat(30) + '\n';
            
            tags.forEach(tag => {
              output += `  ${tag.tag}\n`;
              output += `    Created: ${new Date(tag.createTime).toLocaleString()}\n`;
            });
          }
        }
        
        return {
          content: [{
            type: 'text',
            text: output.trim()
          }]
        };
      }
    }
    
    // If not Docker, try generic package describe
    let versionParam = params.version || '';
    if (versionParam) {
      versionParam = `@${versionParam}`;
    }
    
    let packageCommand = `gcloud artifacts packages describe ${params.package}${versionParam} --repository=${params.repository} --location=${params.location} --format=json`;
    
    if (params.project) {
      packageCommand += ` --project=${params.project}`;
    }
    
    const packageResult = await executeGCloudCommand(packageCommand);
    
    if (packageResult.exitCode !== 0) {
      return {
        content: [{
          type: 'text',
          text: `Error describing artifact: ${packageResult.stderr}`
        }],
        isError: true
      };
    }
    
    const packageInfo = parseGCloudJson<any>(packageResult.stdout);
    
    if (!packageInfo) {
      return {
        content: [{
          type: 'text',
          text: 'Failed to parse artifact information'
        }],
        isError: true
      };
    }
    
    output += `Package: ${params.package}\n`;
    output += `Repository: ${params.repository}\n`;
    output += `Location: ${params.location}\n`;
    output += `Created: ${new Date(packageInfo.createTime).toLocaleString()}\n`;
    output += `Updated: ${new Date(packageInfo.updateTime).toLocaleString()}\n`;
    
    return {
      content: [{
        type: 'text',
        text: output.trim()
      }]
    };
  }
};

export default gcloudArtifactDescribeTool;