import { z } from 'zod';
import { ToolDefinition } from '../types.js';
import { getJiraClient, formatJiraError, validateJiraSetup } from '../utils/jira.js';

const inputSchema = z.object({
  issueKey: z.string().describe('Issue key (e.g., PROJ-123)'),
  action: z.enum(['list', 'add', 'remove']).describe('Action to perform'),
  accountId: z.string().optional().describe('Account ID for add/remove actions')
});

const jiraIssueWatchersTool: ToolDefinition = {
  name: 'jira_issue_watchers',
  description: 'Manage watchers on a Jira issue',
  category: 'issues',
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
    
    if ((params.action === 'add' || params.action === 'remove') && !params.accountId) {
      return {
        content: [{
          type: 'text',
          text: 'Account ID is required for add/remove actions'
        }],
        isError: true
      };
    }
    
    try {
      const client = getJiraClient();
      
      switch (params.action) {
        case 'list': {
          const response = await client.get(`/rest/api/3/issue/${params.issueKey}/watchers`);
          const { watchers, watchCount, isWatching } = response.data;
          
          let output = `Watchers for ${params.issueKey} (${watchCount} total):\n\n`;
          output += `You are ${isWatching ? '' : 'not '}watching this issue\n\n`;
          
          if (watchers && watchers.length > 0) {
            output += 'Watchers:\n';
            for (const watcher of watchers) {
              output += `- ${watcher.displayName}`;
              if (watcher.emailAddress) {
                output += ` (${watcher.emailAddress})`;
              }
              output += '\n';
            }
          } else {
            output += 'No watchers listed (may be restricted)';
          }
          
          return {
            content: [{
              type: 'text',
              text: output
            }]
          };
        }
        
        case 'add': {
          await client.post(`/rest/api/3/issue/${params.issueKey}/watchers`, `"${params.accountId}"`, {
            headers: { 'Content-Type': 'application/json' }
          });
          
          return {
            content: [{
              type: 'text',
              text: `Successfully added watcher to ${params.issueKey}`
            }]
          };
        }
        
        case 'remove': {
          await client.delete(`/rest/api/3/issue/${params.issueKey}/watchers?accountId=${params.accountId}`);
          
          return {
            content: [{
              type: 'text',
              text: `Successfully removed watcher from ${params.issueKey}`
            }]
          };
        }
      }
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

export default jiraIssueWatchersTool;