import { z } from 'zod';
import { ToolDefinition } from '../types.js';
import { getJiraClient, formatJiraError, validateJiraSetup } from '../utils/jira.js';

const inputSchema = z.object({
  issueKey: z.string().describe('Issue key to update (e.g., PROJ-123)'),
  summary: z.string().optional().describe('New summary/title'),
  description: z.string().optional().describe('New description'),
  priority: z.string().optional().describe('New priority (e.g., High, Medium, Low)'),
  labels: z.object({
    add: z.array(z.string()).optional(),
    remove: z.array(z.string()).optional()
  }).optional().describe('Labels to add or remove'),
  components: z.object({
    add: z.array(z.string()).optional(),
    remove: z.array(z.string()).optional()
  }).optional().describe('Components to add or remove'),
  assignee: z.string().optional().describe('New assignee (account ID or email, or "unassigned")'),
  fixVersions: z.object({
    add: z.array(z.string()).optional(),
    remove: z.array(z.string()).optional()
  }).optional().describe('Fix versions to add or remove'),
  customFields: z.record(z.any()).optional().describe('Custom field values to update')
});

const jiraIssueUpdateTool: ToolDefinition = {
  name: 'jira_issue_update',
  description: 'Update an existing Jira issue',
  category: 'issues',
  subcategory: 'write',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const validation = validateJiraSetup();
    if (!validation.valid) {
      return {
        content: [{
          type: 'text',
          text: validation.error!
        }],
        isError: true
      };
    }

    const params = inputSchema.parse(input);
    
    try {
      const client = getJiraClient();
      const update: any = {};
      const fields: any = {};
      
      // Handle simple field updates
      if (params.summary) {
        fields.summary = params.summary;
      }
      
      if (params.description) {
        fields.description = {
          type: 'doc',
          version: 1,
          content: [{
            type: 'paragraph',
            content: [{
              type: 'text',
              text: params.description
            }]
          }]
        };
      }
      
      if (params.priority) {
        fields.priority = { name: params.priority };
      }
      
      // Handle assignee
      if (params.assignee) {
        if (params.assignee === 'unassigned') {
          fields.assignee = null;
        } else if (params.assignee.includes('@')) {
          // Try to find user by email
          const userResponse = await client.get(`/rest/api/3/user/search?query=${params.assignee}`);
          if (userResponse.data && userResponse.data.length > 0) {
            fields.assignee = { accountId: userResponse.data[0].accountId };
          }
        } else {
          fields.assignee = { accountId: params.assignee };
        }
      }
      
      // Handle array field updates (labels, components, fixVersions)
      if (params.labels) {
        update.labels = [];
        if (params.labels.add) {
          update.labels.push(...params.labels.add.map(label => ({ add: label })));
        }
        if (params.labels.remove) {
          update.labels.push(...params.labels.remove.map(label => ({ remove: label })));
        }
      }
      
      if (params.components) {
        update.components = [];
        if (params.components.add) {
          update.components.push(...params.components.add.map(name => ({ add: { name } })));
        }
        if (params.components.remove) {
          update.components.push(...params.components.remove.map(name => ({ remove: { name } })));
        }
      }
      
      if (params.fixVersions) {
        update.fixVersions = [];
        if (params.fixVersions.add) {
          update.fixVersions.push(...params.fixVersions.add.map(name => ({ add: { name } })));
        }
        if (params.fixVersions.remove) {
          update.fixVersions.push(...params.fixVersions.remove.map(name => ({ remove: { name } })));
        }
      }
      
      // Add custom fields
      if (params.customFields) {
        Object.assign(fields, params.customFields);
      }
      
      // Build the request body
      const requestBody: any = {};
      if (Object.keys(fields).length > 0) {
        requestBody.fields = fields;
      }
      if (Object.keys(update).length > 0) {
        requestBody.update = update;
      }
      
      if (Object.keys(requestBody).length === 0) {
        return {
          content: [{
            type: 'text',
            text: 'No fields to update were provided'
          }],
          isError: true
        };
      }
      
      await client.put(`/rest/api/3/issue/${params.issueKey}`, requestBody);
      
      return {
        content: [{
          type: 'text',
          text: `Successfully updated issue: ${params.issueKey}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: formatJiraError(error)
        }],
        isError: true
      };
    }
  }
};

export default jiraIssueUpdateTool;