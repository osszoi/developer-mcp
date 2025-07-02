import { z } from 'zod';
import { ToolDefinition } from '../types.js';
import { getJiraClient, formatJiraError, validateJiraSetup } from '../utils/jira.js';

const inputSchema = z.object({
  inwardIssue: z.string().describe('Inward issue key (e.g., PROJ-123)'),
  outwardIssue: z.string().describe('Outward issue key (e.g., PROJ-456)'),
  linkType: z.string().describe('Link type (e.g., "blocks", "relates to", "duplicates")'),
  comment: z.string().optional().describe('Optional comment to add with the link')
});

const jiraIssueLinkTool: ToolDefinition = {
  name: 'jira_issue_link',
  description: 'Create a link between two Jira issues',
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
      
      // First, get available issue link types
      const linkTypesResponse = await client.get('/rest/api/3/issueLinkType');
      const linkTypes = linkTypesResponse.data.issueLinkTypes;
      
      // Find the matching link type
      const linkType = linkTypes.find((lt: any) => 
        lt.name.toLowerCase() === params.linkType.toLowerCase() ||
        lt.inward.toLowerCase() === params.linkType.toLowerCase() ||
        lt.outward.toLowerCase() === params.linkType.toLowerCase()
      );
      
      if (!linkType) {
        let output = 'Link type not found. Available link types:\n\n';
        for (const lt of linkTypes) {
          output += `- ${lt.name}: "${lt.inward}" / "${lt.outward}"\n`;
        }
        return {
          content: [{
            type: 'text',
            text: output
          }],
          isError: true
        };
      }
      
      // Create the link
      const linkRequest: any = {
        type: { id: linkType.id },
        inwardIssue: { key: params.inwardIssue },
        outwardIssue: { key: params.outwardIssue }
      };
      
      if (params.comment) {
        linkRequest.comment = {
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
      }
      
      await client.post('/rest/api/3/issueLink', linkRequest);
      
      return {
        content: [{
          type: 'text',
          text: `Successfully linked issues:\n` +
                `${params.inwardIssue} ${linkType.inward} ${params.outwardIssue}`
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

export default jiraIssueLinkTool;