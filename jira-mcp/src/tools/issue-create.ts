import { z } from 'zod';
import { ToolDefinition } from '../types.js';
import { getJiraClient, formatJiraError, validateJiraSetup } from '../utils/jira.js';

const inputSchema = z.object({
  projectKey: z.string().describe('Project key (e.g., PROJ)'),
  summary: z.string().describe('Issue summary/title'),
  description: z.string().optional().describe('Issue description'),
  issueType: z.string().describe('Issue type (e.g., Bug, Task, Story)'),
  priority: z.string().optional().describe('Priority (e.g., High, Medium, Low)'),
  labels: z.array(z.string()).optional().describe('Labels to add to the issue'),
  components: z.array(z.string()).optional().describe('Component names'),
  assignee: z.string().optional().describe('Assignee account ID or email'),
  reporter: z.string().optional().describe('Reporter account ID or email'),
  fixVersions: z.array(z.string()).optional().describe('Fix version names'),
  customFields: z.record(z.any()).optional().describe('Custom field values (field ID as key)')
});

const jiraIssueCreateTool: ToolDefinition = {
  name: 'jira_issue_create',
  description: 'Create a new Jira issue',
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
      
      // Build the issue fields
      const fields: any = {
        project: { key: params.projectKey },
        summary: params.summary,
        issuetype: { name: params.issueType }
      };
      
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
      
      if (params.labels) {
        fields.labels = params.labels;
      }
      
      if (params.components) {
        fields.components = params.components.map(name => ({ name }));
      }
      
      if (params.assignee) {
        // Try to find user by email or use as account ID
        if (params.assignee.includes('@')) {
          const userResponse = await client.get(`/rest/api/3/user/search?query=${params.assignee}`);
          if (userResponse.data && userResponse.data.length > 0) {
            fields.assignee = { accountId: userResponse.data[0].accountId };
          }
        } else {
          fields.assignee = { accountId: params.assignee };
        }
      }
      
      if (params.reporter) {
        // Try to find user by email or use as account ID
        if (params.reporter.includes('@')) {
          const userResponse = await client.get(`/rest/api/3/user/search?query=${params.reporter}`);
          if (userResponse.data && userResponse.data.length > 0) {
            fields.reporter = { accountId: userResponse.data[0].accountId };
          }
        } else {
          fields.reporter = { accountId: params.reporter };
        }
      }
      
      if (params.fixVersions) {
        fields.fixVersions = params.fixVersions.map(name => ({ name }));
      }
      
      // Add custom fields
      if (params.customFields) {
        Object.assign(fields, params.customFields);
      }
      
      const response = await client.post('/rest/api/3/issue', { fields });
      const createdIssue = response.data;
      
      return {
        content: [{
          type: 'text',
          text: `Successfully created issue: ${createdIssue.key}\n` +
                `URL: ${client.defaults.baseURL}/browse/${createdIssue.key}`
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

export default jiraIssueCreateTool;