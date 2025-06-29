import { z } from 'zod';
import { ToolDefinition } from '../../types.js';
import { executeGCloudCommand } from '../../utils/gcloud.js';

const inputSchema = z.object({
  project: z.string().optional().describe('GCP project ID (uses current project if not specified)'),
  limit: z.number().optional().default(50).describe('Maximum number of buckets to return')
});


const gcloudBucketsListTool: ToolDefinition = {
  name: 'buckets_list',
  description: 'List all Cloud Storage buckets in the project',
  category: 'storage',
  subcategory: 'buckets',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    let command = 'gsutil ls -L -b';
    
    if (params.project) {
      command = `gsutil -o "GSUtil:default_project_id=${params.project}" ls -L -b`;
    }
    
    // First get bucket list
    const listResult = await executeGCloudCommand(command);
    
    if (listResult.exitCode !== 0) {
      return {
        content: [{
          type: 'text',
          text: `Error listing buckets: ${listResult.stderr}`
        }],
        isError: true
      };
    }
    
    // Parse bucket information from gsutil output
    const buckets: any[] = [];
    const bucketBlocks = listResult.stdout.split(/\n(?=gs:\/\/)/);
    
    for (const block of bucketBlocks) {
      if (!block.trim() || !block.startsWith('gs://')) continue;
      
      const lines = block.split('\n');
      const bucketUrl = lines[0].trim().replace(':', '');
      const bucketName = bucketUrl.replace('gs://', '');
      
      const bucket: any = { name: bucketName };
      
      // Parse bucket details
      lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('Location type:')) {
          bucket.locationType = trimmed.replace('Location type:', '').trim();
        } else if (trimmed.startsWith('Location constraint:')) {
          bucket.location = trimmed.replace('Location constraint:', '').trim();
        } else if (trimmed.startsWith('Storage class:')) {
          bucket.storageClass = trimmed.replace('Storage class:', '').trim();
        } else if (trimmed.startsWith('Time created:')) {
          bucket.timeCreated = trimmed.replace('Time created:', '').trim();
        } else if (trimmed.startsWith('Time updated:')) {
          bucket.updated = trimmed.replace('Time updated:', '').trim();
        } else if (trimmed.startsWith('Metageneration:')) {
          bucket.metageneration = trimmed.replace('Metageneration:', '').trim();
        }
      });
      
      if (bucket.name) {
        buckets.push(bucket);
      }
      
      if (buckets.length >= params.limit) {
        break;
      }
    }
    
    if (buckets.length === 0) {
      return {
        content: [{
          type: 'text',
          text: 'No storage buckets found in the project'
        }]
      };
    }
    
    let output = `Found ${buckets.length} storage bucket${buckets.length !== 1 ? 's' : ''}:\n\n`;
    
    buckets.forEach(bucket => {
      output += `Bucket: ${bucket.name}\n`;
      output += `  Location: ${bucket.location || 'N/A'}\n`;
      output += `  Storage Class: ${bucket.storageClass || 'STANDARD'}\n`;
      if (bucket.timeCreated) {
        output += `  Created: ${bucket.timeCreated}\n`;
      }
      if (bucket.updated) {
        output += `  Updated: ${bucket.updated}\n`;
      }
      output += `  URL: gs://${bucket.name}/\n`;
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

export default gcloudBucketsListTool;