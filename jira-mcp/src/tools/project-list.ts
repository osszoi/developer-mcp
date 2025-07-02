import { z } from 'zod';
import { ToolDefinition, JiraProject } from '../types.js';
import { getJiraClient, formatJiraError, validateJiraSetup } from '../utils/jira.js';

const inputSchema = z.object({
  startAt: z.number().optional().default(0).describe('Starting index for results'),
  maxResults: z.number().optional().default(50).describe('Maximum number of results'),
  orderBy: z.enum(['key', '-key', 'name', '-name']).optional().default('key').describe('Field to order by'),
  typeKey: z.string().optional().describe('Filter by project type (e.g., software, business)'),
  searchQuery: z.string().optional().describe('Search query for project name or key')
});

const jiraProjectListTool: ToolDefinition = {
  name: 'jira_project_list',
  description: 'List all accessible Jira projects',
  category: 'projects',
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
      
      if (params.typeKey) {
        queryParams.append('typeKey', params.typeKey);
      }
      
      if (params.searchQuery) {
        queryParams.append('query', params.searchQuery);
      }
      
      const response = await client.get(`/rest/api/3/project/search?${queryParams.toString()}`);
      const { values: projects, total, startAt, maxResults } = response.data;
      
      if (!projects || projects.length === 0) {
        return {
          content: [{
            type: 'text',
            text: 'No accessible projects found'
          }]
        };
      }
      
      let output = `Projects (${total} total, showing ${startAt + 1}-${Math.min(startAt + maxResults, total)}):\n\n`;
      
      for (const project of projects) {
        output += `${project.key} - ${project.name}\n`;
        output += `  ID: ${project.id}\n`;
        output += `  Type: ${project.projectTypeKey}\n`;
        if (project.lead) {
          output += `  Lead: ${project.lead.displayName}`;
          if (project.lead.emailAddress) {
            output += ` (${project.lead.emailAddress})`;
          }
          output += '\n';
        }
        output += `  URL: ${client.defaults.baseURL}/browse/${project.key}\n`;
        output += '\n';
      }
      
      if (total > startAt + maxResults) {
        output += `To see more projects, increase startAt to ${startAt + maxResults}`;
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

export default jiraProjectListTool;