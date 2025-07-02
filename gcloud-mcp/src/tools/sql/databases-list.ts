import { z } from 'zod';
import { ToolDefinition } from '../../types.js';
import { executeGCloudCommand } from '../../utils/gcloud.js';

const inputSchema = z.object({
  instance: z.string().describe('Cloud SQL instance name'),
  project: z.string().optional().describe('Project ID (uses current project if not specified)'),
});

const gcloudSqlDatabasesListTool: ToolDefinition = {
  name: 'sql_databases_list',
  description: 'List databases in a Cloud SQL instance',
  category: 'sql',
  subcategory: 'databases',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    let command = `gcloud sql databases list --instance="${params.instance}"`;
    
    if (params.project) {
      command += ` --project="${params.project}"`;
    }
    
    command += ' --format=json';
    
    const result = await executeGCloudCommand(command);
    
    if (result.exitCode !== 0) {
      return {
        content: [{
          type: 'text',
          text: `Error listing databases: ${result.stderr}`
        }],
        isError: true
      };
    }
    
    try {
      const databases = JSON.parse(result.stdout);
      
      if (!Array.isArray(databases) || databases.length === 0) {
        return {
          content: [{
            type: 'text',
            text: `No databases found in instance: ${params.instance}`
          }]
        };
      }
      
      let output = `Databases in ${params.instance} (${databases.length} found):\n\n`;
      
      databases.forEach((db: any) => {
        output += `Database: ${db.name}\n`;
        
        if (db.charset) {
          output += `  Charset: ${db.charset}\n`;
        }
        
        if (db.collation) {
          output += `  Collation: ${db.collation}\n`;
        }
        
        if (db.etag) {
          output += `  ETag: ${db.etag}\n`;
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
          text: `Error parsing databases data: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
};

export default gcloudSqlDatabasesListTool;
