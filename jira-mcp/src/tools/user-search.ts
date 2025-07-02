import { z } from 'zod';
import { ToolDefinition, JiraUser } from '../types.js';
import { getJiraClient, formatJiraError, validateJiraSetup } from '../utils/jira.js';

const inputSchema = z.object({
  query: z.string().describe('Search query (name, email, or partial match)'),
  startAt: z.number().optional().default(0).describe('Starting index for results'),
  maxResults: z.number().optional().default(50).describe('Maximum number of results'),
  includeInactive: z.boolean().optional().default(false).describe('Include inactive users')
});

const jiraUserSearchTool: ToolDefinition = {
  name: 'jira_user_search',
  description: 'Search for Jira users',
  category: 'users',
  subcategory: 'read',
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
      const queryParams = new URLSearchParams({
        query: params.query,
        startAt: params.startAt.toString(),
        maxResults: params.maxResults.toString(),
        includeInactive: params.includeInactive.toString()
      });
      
      const response = await client.get(`/rest/api/3/user/search?${queryParams.toString()}`);
      const users: JiraUser[] = response.data;
      
      if (!users || users.length === 0) {
        return {
          content: [{
            type: 'text',
            text: `No users found matching "${params.query}"`
          }]
        };
      }
      
      let output = `Found ${users.length} users:\n\n`;
      
      for (const user of users) {
        output += `${user.displayName}\n`;
        output += `  Account ID: ${user.accountId}\n`;
        if (user.emailAddress) {
          output += `  Email: ${user.emailAddress}\n`;
        }
        output += `  Status: ${user.active ? 'Active' : 'Inactive'}\n`;
        output += '\n';
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
          text: formatJiraError(error)
        }],
        isError: true
      };
    }
  }
};

export default jiraUserSearchTool;