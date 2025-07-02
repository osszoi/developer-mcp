import { z } from 'zod';
import { ToolDefinition, JiraTransition } from '../types.js';
import { getJiraClient, formatJiraError, validateJiraSetup } from '../utils/jira.js';

const inputSchema = z.object({
  issueKey: z.string().describe('Issue key to transition (e.g., PROJ-123)'),
  transitionName: z.string().optional().describe('Name of the transition (e.g., "Done", "In Progress")'),
  transitionId: z.string().optional().describe('ID of the transition (use if name is ambiguous)'),
  comment: z.string().optional().describe('Comment to add with the transition'),
  fields: z.record(z.any()).optional().describe('Fields to update during transition')
});

const jiraIssueTransitionTool: ToolDefinition = {
  name: 'jira_issue_transition',
  description: 'Transition a Jira issue to a different status',
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
    
    if (!params.transitionName && !params.transitionId) {
      return {
        content: [{
          type: 'text',
          text: 'Either transitionName or transitionId must be provided'
        }],
        isError: true
      };
    }
    
    try {
      const client = getJiraClient();
      
      // First, get available transitions for the issue
      const transitionsResponse = await client.get(`/rest/api/3/issue/${params.issueKey}/transitions`);
      const transitions: JiraTransition[] = transitionsResponse.data.transitions;
      
      if (!transitions || transitions.length === 0) {
        return {
          content: [{
            type: 'text',
            text: `No transitions available for issue ${params.issueKey}`
          }],
          isError: true
        };
      }
      
      // Find the requested transition
      let targetTransition: JiraTransition | undefined;
      
      if (params.transitionId) {
        targetTransition = transitions.find(t => t.id === params.transitionId);
      } else if (params.transitionName) {
        targetTransition = transitions.find(t => 
          t.name.toLowerCase() === params.transitionName!.toLowerCase()
        );
      }
      
      if (!targetTransition) {
        let output = `Transition not found. Available transitions for ${params.issueKey}:\n\n`;
        for (const transition of transitions) {
          output += `- ${transition.name} (ID: ${transition.id}) → ${transition.to.name}\n`;
        }
        return {
          content: [{
            type: 'text',
            text: output
          }],
          isError: true
        };
      }
      
      // Build transition request
      const transitionRequest: any = {
        transition: { id: targetTransition.id }
      };
      
      if (params.fields) {
        transitionRequest.fields = params.fields;
      }
      
      if (params.comment) {
        transitionRequest.update = {
          comment: [{
            add: {
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
            }
          }]
        };
      }
      
      // Execute the transition
      await client.post(`/rest/api/3/issue/${params.issueKey}/transitions`, transitionRequest);
      
      return {
        content: [{
          type: 'text',
          text: `Successfully transitioned ${params.issueKey} to "${targetTransition.to.name}"`
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

export default jiraIssueTransitionTool;