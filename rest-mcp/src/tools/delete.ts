import { z } from 'zod';
import { makeRequest } from '../utils/request.js';

interface Tool {
  name: string;
  description: string;
  inputSchema: z.ZodSchema<any>;
  handler: (params: any, authToken?: string) => Promise<any>;
}

export const deleteTool: Tool = {
  name: 'rest_delete',
  description: 'Make a DELETE request to an API endpoint',
  inputSchema: z.object({
    url: z.string().describe('The URL to send the DELETE request to'),
    headers: z.record(z.string()).optional().describe('Additional headers to include'),
    withoutAuthorization: z.boolean().optional().describe('Skip authorization header'),
    queryParams: z.record(z.any()).optional().describe('Query parameters to append to URL'),
  }),
  handler: async (params: z.infer<typeof deleteTool.inputSchema>, authToken?: string) => {
    try {
      const result = await makeRequest({
        url: params.url,
        method: 'DELETE',
        headers: params.headers,
        withoutAuthorization: params.withoutAuthorization,
        queryParams: params.queryParams,
      }, authToken);

      // Return in MCP format
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              response: result.data,
              status: result.status,
              statusText: result.statusText,
              headers: result.headers,
            }, null, 2)
          }
        ]
      };
    } catch (error: any) {
      console.error(`[DELETE Tool Error]`, error);
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error.message}`
          }
        ],
        isError: true
      };
    }
  },
};