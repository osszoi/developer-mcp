import { z } from 'zod';
import { ToolDefinition, JiraComment } from '../types.js';
import { getJiraClient, formatJiraError, validateJiraSetup } from '../utils/jira.js';

const inputSchema = z.object({
  issueKey: z.string().describe('Issue key to get comments from (e.g., PROJ-123)'),
  startAt: z.number().optional().default(0).describe('Starting index for results'),
  maxResults: z.number().optional().default(50).describe('Maximum number of results'),
  orderBy: z.enum(['created', '-created']).optional().default('-created').describe('Order by created date (- for descending)')
});

const jiraCommentListTool: ToolDefinition = {
  name: 'jira_comment_list',
  description: 'List comments on a Jira issue',
  category: 'comments',
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
        startAt: params.startAt.toString(),
        maxResults: params.maxResults.toString(),
        orderBy: params.orderBy
      });
      
      const response = await client.get(`/rest/api/3/issue/${params.issueKey}/comment?${queryParams.toString()}`);
      const { comments, total, startAt, maxResults } = response.data;
      
      if (!comments || comments.length === 0) {
        return {
          content: [{
            type: 'text',
            text: `No comments found on issue ${params.issueKey}`
          }]
        };
      }
      
      let output = `Comments on ${params.issueKey} (${total} total, showing ${startAt + 1}-${Math.min(startAt + maxResults, total)}):\n\n`;
      
      for (const comment of comments) {
        output += `Comment ID: ${comment.id}\n`;
        output += `Author: ${comment.author.displayName}`;
        if (comment.author.emailAddress) {
          output += ` (${comment.author.emailAddress})`;
        }
        output += '\n';
        output += `Created: ${new Date(comment.created).toLocaleString()}\n`;
        if (comment.updated !== comment.created) {
          output += `Updated: ${new Date(comment.updated).toLocaleString()}\n`;
        }
        
        // Extract text from document format
        let commentText = '';
        if (comment.body && comment.body.content) {
          for (const block of comment.body.content) {
            if (block.type === 'paragraph' && block.content) {
              for (const inline of block.content) {
                if (inline.type === 'text') {
                  commentText += inline.text;
                }
              }
              commentText += '\n';
            }
          }
        }
        
        output += `Comment:\n${commentText}\n`;
        
        if (comment.visibility) {
          output += `Visibility: Restricted to ${comment.visibility.type} "${comment.visibility.value}"\n`;
        }
        
        output += '---\n\n';
      }
      
      if (total > startAt + maxResults) {
        output += `To see more comments, increase startAt to ${startAt + maxResults}`;
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

export default jiraCommentListTool;