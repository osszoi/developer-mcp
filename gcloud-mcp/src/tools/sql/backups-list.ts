import { z } from 'zod';
import { ToolDefinition } from '../../types.js';
import { executeGCloudCommand } from '../../utils/gcloud.js';

const inputSchema = z.object({
  instance: z.string().describe('Cloud SQL instance name'),
  project: z.string().optional().describe('Project ID (uses current project if not specified)'),
  limit: z.number().optional().default(20).describe('Maximum number of backups to return'),
});

const gcloudSqlBackupsListTool: ToolDefinition = {
  name: 'sql_backups_list',
  description: 'List backups for a Cloud SQL instance',
  category: 'sql',
  subcategory: 'backups',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    let command = `gcloud sql backups list --instance="${params.instance}"`;
    
    if (params.project) {
      command += ` --project="${params.project}"`;
    }
    
    command += ` --limit=${params.limit}`;
    command += ' --format=json';
    
    const result = await executeGCloudCommand(command);
    
    if (result.exitCode !== 0) {
      return {
        content: [{
          type: 'text',
          text: `Error listing backups: ${result.stderr}`
        }],
        isError: true
      };
    }
    
    try {
      const backups = JSON.parse(result.stdout);
      
      if (!Array.isArray(backups) || backups.length === 0) {
        return {
          content: [{
            type: 'text',
            text: `No backups found for instance: ${params.instance}`
          }]
        };
      }
      
      let output = `Backups for ${params.instance} (${backups.length} found):\n\n`;
      
      backups.forEach((backup: any) => {
        output += `Backup ID: ${backup.id}\n`;
        output += `  Type: ${backup.type || 'N/A'}\n`;
        output += `  Status: ${backup.status || 'N/A'}\n`;
        
        if (backup.startTime) {
          output += `  Start Time: ${new Date(backup.startTime).toLocaleString()}\n`;
        }
        
        if (backup.endTime) {
          output += `  End Time: ${new Date(backup.endTime).toLocaleString()}\n`;
        }
        
        if (backup.windowStartTime) {
          output += `  Window Start: ${new Date(backup.windowStartTime).toLocaleString()}\n`;
        }
        
        if (backup.location) {
          output += `  Location: ${backup.location}\n`;
        }
        
        if (backup.diskEncryptionStatus) {
          output += `  Encryption: ${backup.diskEncryptionStatus.kmsKeyVersionName ? 'Customer-managed' : 'Google-managed'}\n`;
        }
        
        output += '\n';
      });
      
      output += `Note: Backups are retained based on your backup retention policy.`;
      
      return {
        content: [{
          type: 'text',
          text: output.trim()
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error parsing backups data: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
};

export default gcloudSqlBackupsListTool;
