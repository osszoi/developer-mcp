import { z } from 'zod';
import { ToolDefinition, JiraIssue } from '../types.js';
import { getJiraClient, formatJiraError, validateJiraSetup } from '../utils/jira.js';

const inputSchema = z.object({
  issueKey: z.string().describe('The issue key (e.g., PROJ-123)'),
  expand: z.array(z.string()).optional().describe('Fields to expand (e.g., changelog, renderedFields)'),
  fields: z.array(z.string()).optional().describe('Specific fields to return (default: all fields)')
});

const jiraIssueGetTool: ToolDefinition = {
  name: 'jira_issue_get',
  description: 'Get details of a specific Jira issue',
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
      const queryParams = new URLSearchParams();
      
      if (params.expand) {
        queryParams.append('expand', params.expand.join(','));
      }
      
      if (params.fields) {
        queryParams.append('fields', params.fields.join(','));
      }
      
      const response = await client.get<JiraIssue>(`/rest/api/3/issue/${params.issueKey}?${queryParams.toString()}`);
      const issue = response.data;
      
      let output = `Issue: ${issue.key}\n`;
      output += `Summary: ${issue.fields.summary}\n`;
      output += `Type: ${issue.fields.issuetype.name}\n`;
      output += `Status: ${issue.fields.status.name}\n`;
      output += `Priority: ${issue.fields.priority?.name || 'None'}\n`;
      output += `Project: ${issue.fields.project.name} (${issue.fields.project.key})\n`;
      
      if (issue.fields.assignee) {
        output += `Assignee: ${issue.fields.assignee.displayName}\n`;
      } else {
        output += `Assignee: Unassigned\n`;
      }
      
      output += `Reporter: ${issue.fields.reporter.displayName}\n`;
      output += `Created: ${new Date(issue.fields.created).toLocaleString()}\n`;
      output += `Updated: ${new Date(issue.fields.updated).toLocaleString()}\n`;
      
      if (issue.fields.labels && issue.fields.labels.length > 0) {
        output += `Labels: ${issue.fields.labels.join(', ')}\n`;
      }
      
      if (issue.fields.components && issue.fields.components.length > 0) {
        output += `Components: ${issue.fields.components.map(c => c.name).join(', ')}\n`;
      }
      
      if (issue.fields.fixVersions && issue.fields.fixVersions.length > 0) {
        output += `Fix Versions: ${issue.fields.fixVersions.map(v => v.name).join(', ')}\n`;
      }
      
      if (issue.fields.description) {
        output += `\nDescription:\n${issue.fields.description}\n`;
      }
      
      return {
        content: [{
          type: 'text',
          text: output
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

export default jiraIssueGetTool;