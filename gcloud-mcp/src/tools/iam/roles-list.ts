import { z } from 'zod';
import { ToolDefinition } from '../../types.js';
import { executeGCloudCommand } from '../../utils/gcloud.js';

const inputSchema = z.object({
  project: z.string().optional().describe('Project ID (uses current project if not specified)'),
  showDeleted: z.boolean().optional().default(false).describe('Include deleted roles'),
  filter: z.string().optional().describe('Filter expression for roles'),
  limit: z.number().optional().default(100).describe('Maximum number of roles to return'),
});

const gcloudIamRolesListTool: ToolDefinition = {
  name: 'iam_roles_list',
  description: 'List IAM roles in the project',
  category: 'iam',
  subcategory: 'roles',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    let command = 'gcloud iam roles list';
    
    if (params.project) {
      command += ` --project="${params.project}"`;
    }
    
    if (params.showDeleted) {
      command += ' --show-deleted';
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
          text: `Error listing IAM roles: ${result.stderr}`
        }],
        isError: true
      };
    }
    
    try {
      const roles = JSON.parse(result.stdout);
      
      if (!Array.isArray(roles) || roles.length === 0) {
        return {
          content: [{
            type: 'text',
            text: 'No IAM roles found'
          }]
        };
      }
      
      const formattedRoles = roles.map(role => ({
        name: role.name,
        title: role.title,
        description: role.description,
        stage: role.stage,
        deleted: role.deleted || false,
        includedPermissions: role.includedPermissions ? role.includedPermissions.length : 0
      }));
      
      let output = `IAM Roles (${formattedRoles.length} found):\n\n`;
      
      formattedRoles.forEach(role => {
        output += `Role: ${role.name}\n`;
        output += `  Title: ${role.title || 'N/A'}\n`;
        output += `  Description: ${role.description || 'N/A'}\n`;
        output += `  Stage: ${role.stage || 'N/A'}\n`;
        output += `  Permissions: ${role.includedPermissions} permissions\n`;
        if (role.deleted) {
          output += `  Status: DELETED\n`;
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
          text: `Error parsing IAM roles data: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
};

export default gcloudIamRolesListTool;
