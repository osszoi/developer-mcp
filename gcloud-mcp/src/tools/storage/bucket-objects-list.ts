import { z } from 'zod';
import { ToolDefinition } from '../../types.js';
import { executeGCloudCommand } from '../../utils/gcloud.js';

const inputSchema = z.object({
  bucket: z.string().describe('Name of the storage bucket (without gs:// prefix)'),
  prefix: z.string().optional().describe('Filter objects by prefix/folder'),
  recursive: z.boolean().optional().default(false).describe('List objects recursively'),
  limit: z.number().optional().default(100).describe('Maximum number of objects to return'),
  includeVersions: z.boolean().optional().default(false).describe('Include object versions'),
  project: z.string().optional().describe('GCP project ID (uses current project if not specified)')
});

const gcloudBucketObjectsListTool: ToolDefinition = {
  name: 'bucket_objects_list',
  description: 'List objects in a Cloud Storage bucket',
  category: 'storage',
  subcategory: 'objects',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    // Remove gs:// prefix if provided
    const bucketName = params.bucket.replace('gs://', '');
    let path = `gs://${bucketName}/`;
    
    if (params.prefix) {
      path += params.prefix;
      if (!params.prefix.endsWith('/')) {
        path += '/';
      }
    }
    
    let command = 'gsutil ls';
    
    if (!params.recursive) {
      command += ' -d'; // Directory/folder listing only
    }
    
    if (params.includeVersions) {
      command += ' -a'; // All versions
    }
    
    command += ` -l ${path}`; // Long listing format
    
    if (params.project) {
      command = `gsutil -o "GSUtil:default_project_id=${params.project}" ${command.replace('gsutil ', '')}`;
    }
    
    const result = await executeGCloudCommand(command);
    
    if (result.exitCode !== 0) {
      return {
        content: [{
          type: 'text',
          text: `Error listing bucket objects: ${result.stderr}`
        }],
        isError: true
      };
    }
    
    const lines = result.stdout.split('\n').filter(line => line.trim());
    
    // Remove header and total line
    const objectLines = lines.filter(line => 
      !line.startsWith('TOTAL:') && 
      line.includes('gs://')
    );
    
    if (objectLines.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `No objects found in bucket '${bucketName}'${params.prefix ? ` with prefix '${params.prefix}'` : ''}`
        }]
      };
    }
    
    let output = `Objects in '${bucketName}'${params.prefix ? ` (prefix: ${params.prefix})` : ''}:\n`;
    output += '='.repeat(60) + '\n\n';
    
    let objectCount = 0;
    let totalSize = 0;
    const folders = new Set<string>();
    const files: any[] = [];
    
    for (const line of objectLines) {
      if (objectCount >= params.limit) break;
      
      // Parse gsutil ls -l output
      // Format: size date time url
      const parts = line.trim().split(/\s+/);
      
      if (parts.length >= 4) {
        const size = parts[0];
        const date = parts[1];
        const time = parts[2];
        const url = parts.slice(3).join(' ');
        
        if (url.endsWith('/:')) {
          // It's a folder
          const folderName = url.replace(`gs://${bucketName}/`, '').replace('/:', '');
          folders.add(folderName);
        } else {
          // It's a file
          const objectName = url.replace(`gs://${bucketName}/`, '');
          files.push({
            name: objectName,
            size: size === '<DIR>' ? 0 : parseInt(size),
            date: `${date} ${time}`,
            url: url
          });
          
          if (size !== '<DIR>') {
            totalSize += parseInt(size);
          }
        }
        
        objectCount++;
      }
    }
    
    // Display folders first
    if (folders.size > 0) {
      output += 'Folders:\n';
      Array.from(folders).sort().forEach(folder => {
        output += `  📁 ${folder}/\n`;
      });
      output += '\n';
    }
    
    // Display files
    if (files.length > 0) {
      output += 'Files:\n';
      files.sort((a, b) => a.name.localeCompare(b.name)).forEach(file => {
        const sizeMB = (file.size / 1024 / 1024).toFixed(2);
        const sizeStr = file.size < 1024 ? `${file.size} B` :
                       file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(2)} KB` :
                       `${sizeMB} MB`;
        
        output += `  📄 ${file.name}\n`;
        output += `      Size: ${sizeStr}\n`;
        output += `      Modified: ${file.date}\n`;
        
        // Add generation/version info if available
        if (params.includeVersions && file.url.includes('#')) {
          const generation = file.url.split('#')[1];
          output += `      Generation: ${generation}\n`;
        }
        
        output += '\n';
      });
    }
    
    // Summary
    output += '\nSummary:\n';
    output += '-'.repeat(30) + '\n';
    output += `Total Objects: ${objectCount}\n`;
    if (files.length > 0) {
      const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);
      output += `Total Size: ${totalSizeMB} MB\n`;
    }
    if (folders.size > 0) {
      output += `Folders: ${folders.size}\n`;
    }
    if (files.length > 0) {
      output += `Files: ${files.length}\n`;
    }
    
    if (objectCount >= params.limit) {
      output += `\nNote: Results limited to ${params.limit} objects. Use a higher limit or more specific prefix to see more.`;
    }
    
    return {
      content: [{
        type: 'text',
        text: output.trim()
      }]
    };
  }
};

export default gcloudBucketObjectsListTool;