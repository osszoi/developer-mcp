import { z } from 'zod';
import { ToolDefinition } from '../../types.js';
import { executeGCloudCommand } from '../../utils/gcloud.js';

const inputSchema = z.object({
  instance: z.string().describe('Cloud SQL instance name'),
  project: z.string().optional().describe('Project ID (uses current project if not specified)'),
});

const gcloudSqlInstanceDescribeTool: ToolDefinition = {
  name: 'sql_instance_describe',
  description: 'Get detailed information about a Cloud SQL instance',
  category: 'sql',
  subcategory: 'instances',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    let command = `gcloud sql instances describe "${params.instance}"`;
    
    if (params.project) {
      command += ` --project="${params.project}"`;
    }
    
    command += ' --format=json';
    
    const result = await executeGCloudCommand(command);
    
    if (result.exitCode !== 0) {
      return {
        content: [{
          type: 'text',
          text: `Error describing Cloud SQL instance: ${result.stderr}`
        }],
        isError: true
      };
    }
    
    try {
      const instance = JSON.parse(result.stdout);
      
      let output = `Cloud SQL Instance: ${instance.name}\n\n`;
      
      // Basic Information
      output += `Basic Information:\n`;
      output += `  Database Version: ${instance.databaseVersion || 'N/A'}\n`;
      output += `  State: ${instance.state || 'N/A'}\n`;
      output += `  Region: ${instance.region || 'N/A'}\n`;
      output += `  Zone: ${instance.gceZone || 'N/A'}\n`;
      output += `  Project: ${instance.project || 'N/A'}\n`;
      output += `  Self Link: ${instance.selfLink || 'N/A'}\n`;
      output += '\n';
      
      // Instance Configuration
      output += `Configuration:\n`;
      output += `  Tier: ${instance.settings?.tier || 'N/A'}\n`;
      output += `  Pricing Plan: ${instance.settings?.pricingPlan || 'N/A'}\n`;
      output += `  Activation Policy: ${instance.settings?.activationPolicy || 'N/A'}\n`;
      
      if (instance.settings?.dataDiskSizeGb) {
        output += `  Disk Size: ${instance.settings.dataDiskSizeGb} GB\n`;
        output += `  Disk Type: ${instance.settings.dataDiskType || 'N/A'}\n`;
      }
      
      if (instance.currentDiskSize) {
        output += `  Current Disk Usage: ${instance.currentDiskSize} bytes\n`;
      }
      
      output += '\n';
      
      // Network Configuration
      if (instance.ipAddresses && instance.ipAddresses.length > 0) {
        output += `Network Configuration:\n`;
        instance.ipAddresses.forEach((ip: any) => {
          output += `  - IP: ${ip.ipAddress} (${ip.type})\n`;
        });
        output += '\n';
      }
      
      // Backup Configuration
      if (instance.settings?.backupConfiguration) {
        const backup = instance.settings.backupConfiguration;
        output += `Backup Configuration:\n`;
        output += `  Enabled: ${backup.enabled || false}\n`;
        if (backup.enabled) {
          output += `  Start Time: ${backup.startTime || 'N/A'}\n`;
          output += `  Point-in-time Recovery: ${backup.pointInTimeRecoveryEnabled || false}\n`;
          output += `  Transaction Log Retention Days: ${backup.transactionLogRetentionDays || 'N/A'}\n`;
          if (backup.backupRetentionSettings) {
            output += `  Retention: ${backup.backupRetentionSettings.retainedBackups || 'N/A'} backups\n`;
          }
        }
        output += '\n';
      }
      
      // Maintenance Window
      if (instance.settings?.maintenanceWindow) {
        const maint = instance.settings.maintenanceWindow;
        output += `Maintenance Window:\n`;
        output += `  Day: ${maint.day || 'N/A'}\n`;
        output += `  Hour: ${maint.hour || 'N/A'}\n`;
        output += `  Update Track: ${maint.updateTrack || 'N/A'}\n`;
        output += '\n';
      }
      
      // Replication Information
      if (instance.replicaNames && instance.replicaNames.length > 0) {
        output += `Replicas:\n`;
        instance.replicaNames.forEach((replica: string) => {
          output += `  - ${replica}\n`;
        });
        output += '\n';
      }
      
      if (instance.masterInstanceName) {
        output += `Master Instance: ${instance.masterInstanceName}\n\n`;
      }
      
      // Connection Information
      output += `Connection:\n`;
      output += `  Connection Name: ${instance.connectionName || 'N/A'}\n`;
      if (instance.serverCaCert) {
        output += `  SSL Certificate: Available\n`;
      }
      
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
          text: `Error parsing Cloud SQL instance data: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
};

export default gcloudSqlInstanceDescribeTool;
