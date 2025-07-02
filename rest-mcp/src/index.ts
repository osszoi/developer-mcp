#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { getTool } from './tools/get.js';
import { postTool } from './tools/post.js';
import { putTool } from './tools/put.js';
import { patchTool } from './tools/patch.js';
import { deleteTool } from './tools/delete.js';

class RestMcpServer {
  private server: McpServer;
  private authToken?: string;

  constructor() {
    this.server = new McpServer({
      name: 'rest-mcp',
      description: 'MCP server for making REST API requests',
      version: '1.0.0'
    });

    // Get auth token from environment variable
    this.authToken = process.env.REST_API_AUTH_TOKEN;

    this.setupTools();
    this.setupErrorHandling();
  }

  private setupTools(): void {
    const tools = [getTool, postTool, putTool, patchTool, deleteTool];

    tools.forEach(tool => {
      // Extract the shape from the Zod schema
      let shape: any = {};
      if ('shape' in tool.inputSchema && typeof tool.inputSchema.shape === 'object' && tool.inputSchema.shape !== null) {
        shape = tool.inputSchema.shape;
      } else if (tool.inputSchema._def && 'shape' in tool.inputSchema._def) {
        shape = (tool.inputSchema._def as any).shape();
      }
      
      this.server.tool(tool.name, tool.description, shape, async (args: any) => {
        try {
          const validatedInput = tool.inputSchema.parse(args);
          const result = await tool.handler(validatedInput, this.authToken);
          // Only log first 200 chars for debugging
          const resultStr = JSON.stringify(result);
          if (resultStr.length > 200) {
            console.error(`[${tool.name}] Response: ${resultStr.substring(0, 200)}...`);
          } else {
            console.error(`[${tool.name}] Response: ${resultStr}`);
          }
          return result;
        } catch (error: any) {
          console.error(`[${tool.name}] Error:`, error.message);
          throw error;
        }
      });
    });
  }

  private setupErrorHandling(): void {
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Rest MCP server running on stdio');
  }
}

const server = new RestMcpServer();
server.run().catch(console.error);