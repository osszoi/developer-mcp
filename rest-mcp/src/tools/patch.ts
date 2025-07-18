import { z } from 'zod';
import { makeRequest } from '../utils/request.js';

interface Tool {
  name: string;
  description: string;
  inputSchema: z.ZodSchema<any>;
  handler: (params: any, authToken?: string) => Promise<any>;
}

export const patchTool: Tool = {
  name: 'rest_patch',
  description: 'Make a PATCH request to an API endpoint',
  inputSchema: z.object({
    url: z.string().describe('The URL to send the PATCH request to'),
    body: z.any().optional().describe('The request body (will be JSON stringified)'),
    headers: z.record(z.string()).optional().describe('Additional headers to include'),
    withoutAuthorization: z.boolean().optional().describe('Skip authorization header'),
    contentType: z.string().optional().describe('Content-Type header (default: application/json)'),
    queryParams: z.record(z.any()).optional().describe('Query parameters to append to URL'),
  }),
  handler: async (params: z.infer<typeof patchTool.inputSchema>, authToken?: string) => {
    try {
      const result = await makeRequest({
        url: params.url,
        method: 'PATCH',
        body: params.body,
        headers: params.headers,
        withoutAuthorization: params.withoutAuthorization,
        contentType: params.contentType,
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
      console.error(`[PATCH Tool Error]`, error);
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