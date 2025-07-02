import { z } from 'zod';
import { ToolDefinition } from '../../types.js';
import { executeGCloudCommand } from '../../utils/gcloud.js';

const inputSchema = z.object({
  project: z.string().optional().describe('Project ID (uses current project if not specified)'),
  filter: z.string().optional().describe('Filter expression for instances'),
  limit: z.number().optional().default(100).describe('Maximum number of instances to return'),
});

const gcloudSqlInstancesListTool: ToolDefinition = {
  name: 'sql_instances_list',
  description: 'List Cloud SQL instances',
  category: 'sql',
  subcategory: 'instances',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    let command = 'gcloud sql instances list';
    
    if (params.project) {
      command += ` --project="${params.project}"`;
    }
    
    if (params.filter) {
      command += ` --filter="${params.filter}"`;
    }
    
    command += ` --limit=${params.limit}`;
    command += ' --format=json';
    
    const result = await executeGCloudCommand(command);
    
    if (result.exitCode !== 0) {
      return {
        content: [{
          type: 'text',
          text: `Error listing Cloud SQL instances: ${result.stderr}`
        }],
        isError: true
      };
    }
    
    try {
      const instances = JSON.parse(result.stdout);
      
      if (!Array.isArray(instances) || instances.length === 0) {
        return {
          content: [{
            type: 'text',
            text: 'No Cloud SQL instances found'
          }]
        };
      }
      
      let output = `Cloud SQL Instances (${instances.length} found):\n\n`;
      
      instances.forEach((instance: any) => {
        output += `Instance: ${instance.name}\n`;
        output += `  Database Version: ${instance.databaseVersion || 'N/A'}\n`;
        output += `  Tier: ${instance.settings?.tier || 'N/A'}\n`;
        output += `  Region: ${instance.region || 'N/A'}\n`;
        output += `  State: ${instance.state || 'N/A'}\n`;
        
        if (instance.ipAddresses && instance.ipAddresses.length > 0) {
          output += `  IP Addresses:\n`;
          instance.ipAddresses.forEach((ip: any) => {
            output += `    - ${ip.ipAddress} (${ip.type})\n`;
          });
        }
        
        if (instance.settings?.dataDiskSizeGb) {
          output += `  Disk Size: ${instance.settings.dataDiskSizeGb} GB\n`;
        }
        
        if (instance.settings?.backupConfiguration?.enabled) {
          output += `  Backups: Enabled\n`;
          if (instance.settings.backupConfiguration.startTime) {
            output += `    Start Time: ${instance.settings.backupConfiguration.startTime}\n`;
          }
        }
        
        if (instance.replicaNames && instance.replicaNames.length > 0) {
          output += `  Replicas: ${instance.replicaNames.join(', ')}\n`;
        }
        
        if (instance.masterInstanceName) {
          output += `  Master Instance: ${instance.masterInstanceName}\n`;
        }
        
        output += '\n';
      });
      
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
          text: `Error parsing Cloud SQL instances data: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
};

export default gcloudSqlInstancesListTool;
