import { z } from 'zod';
import { ToolDefinition, JiraIssue } from '../types.js';
import { getJiraClient, formatJiraError, validateJiraSetup } from '../utils/jira.js';

const inputSchema = z.object({
  jql: z.string().describe('JQL (Jira Query Language) query'),
  startAt: z.number().optional().default(0).describe('Starting index for results'),
  maxResults: z.number().optional().default(50).describe('Maximum number of results (max: 100)'),
  fields: z.array(z.string()).optional().describe('Specific fields to return'),
  expand: z.array(z.string()).optional().describe('Fields to expand')
});

const jiraIssueSearchTool: ToolDefinition = {
  name: 'jira_issue_search',
  description: 'Search for Jira issues using JQL',
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
    
    try {
      const client = getJiraClient();
      const requestBody: any = {
        jql: params.jql,
        startAt: params.startAt,
        maxResults: Math.min(params.maxResults, 100)
      };
      
      if (params.fields) {
        requestBody.fields = params.fields;
      }
      
      if (params.expand) {
        requestBody.expand = params.expand;
      }
      
      const response = await client.post('/rest/api/3/search', requestBody);
      const { issues, total, startAt, maxResults } = response.data;
      
      if (!issues || issues.length === 0) {
        return {
          content: [{
            type: 'text',
            text: 'No issues found matching the search criteria'
          }]
        };
      }
      
      let output = `Found ${total} issues (showing ${startAt + 1}-${Math.min(startAt + maxResults, total)} of ${total}):\n\n`;
      
      for (const issue of issues) {
        output += `${issue.key} - ${issue.fields.summary}\n`;
        output += `  Type: ${issue.fields.issuetype.name} | Status: ${issue.fields.status.name}`;
        if (issue.fields.priority) {
          output += ` | Priority: ${issue.fields.priority.name}`;
        }
        if (issue.fields.assignee) {
          output += ` | Assignee: ${issue.fields.assignee.displayName}`;
        }
        output += '\n';
        output += `  Created: ${new Date(issue.fields.created).toLocaleDateString()}`;
        output += ` | Updated: ${new Date(issue.fields.updated).toLocaleDateString()}\n`;
        if (issue.fields.labels && issue.fields.labels.length > 0) {
          output += `  Labels: ${issue.fields.labels.join(', ')}\n`;
        }
        output += '\n';
      }
      
      if (total > startAt + maxResults) {
        output += `\nTo see more results, increase startAt to ${startAt + maxResults}`;
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

export default jiraIssueSearchTool;