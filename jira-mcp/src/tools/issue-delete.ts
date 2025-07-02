import { z } from 'zod';
import { ToolDefinition } from '../types.js';
import { getJiraClient, formatJiraError, validateJiraSetup } from '../utils/jira.js';

const inputSchema = z.object({
  issueKey: z.string().describe('Issue key to delete (e.g., PROJ-123)'),
  deleteSubtasks: z.boolean().optional().default(true).describe('Whether to delete subtasks')
});

const jiraIssueDeleteTool: ToolDefinition = {
  name: 'jira_issue_delete',
  description: 'Delete a Jira issue (requires appropriate permissions)',
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
      const queryParams = new URLSearchParams({
        deleteSubtasks: params.deleteSubtasks.toString()
      });
      
      await client.delete(`/rest/api/3/issue/${params.issueKey}?${queryParams.toString()}`);
      
      return {
        content: [{
          type: 'text',
          text: `Successfully deleted issue ${params.issueKey}${params.deleteSubtasks ? ' and its subtasks' : ''}`
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

export default jiraIssueDeleteTool;