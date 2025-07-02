import { z } from 'zod';
import { ToolDefinition } from '../types.js';
import { getJiraClient, formatJiraError, validateJiraSetup } from '../utils/jira.js';

const inputSchema = z.object({
  issueKey: z.string().describe('Issue key to add comment to (e.g., PROJ-123)'),
  comment: z.string().describe('Comment text to add'),
  visibility: z.object({
    type: z.enum(['group', 'role']).optional(),
    value: z.string().optional()
  }).optional().describe('Restrict comment visibility to a group or role')
});

const jiraCommentAddTool: ToolDefinition = {
  name: 'jira_comment_add',
  description: 'Add a comment to a Jira issue',
  category: 'comments',
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
      
      const commentBody: any = {
        body: {
          type: 'doc',
          version: 1,
          content: [{
            type: 'paragraph',
            content: [{
              type: 'text',
              text: params.comment
            }]
          }]
        }
      };
      
      // Add visibility restrictions if specified
      if (params.visibility && params.visibility.type && params.visibility.value) {
        commentBody.visibility = {
          type: params.visibility.type,
          value: params.visibility.value
        };
      }
      
      const response = await client.post(`/rest/api/3/issue/${params.issueKey}/comment`, commentBody);
      const createdComment = response.data;
      
      return {
        content: [{
          type: 'text',
          text: `Successfully added comment to ${params.issueKey}\n` +
                `Comment ID: ${createdComment.id}\n` +
                `Author: ${createdComment.author.displayName}\n` +
                `Created: ${new Date(createdComment.created).toLocaleString()}`
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

export default jiraCommentAddTool;