#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { ToolRegistry } from './core/ToolRegistry.js';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DeveloperMcpServer {
  private server: McpServer;
  private toolRegistry: ToolRegistry;

  constructor() {
    this.server = new McpServer({
      name: 'developer-mcp',
      version: '1.0.0'
    });

    this.toolRegistry = new ToolRegistry();
  }

  private async setupTools() {
    // Register each tool with the MCP server
    for (const [toolId, tool] of this.toolRegistry.getAllTools()) {
      this.server.tool(
        toolId,
        tool.description,
        {}, // Empty schema object, validation will be done inside handler
        async (args) => {
          try {
            // Validate input
            const validatedInput = tool.inputSchema.parse(args);
            
            // Execute tool
            const result = await tool.handler(validatedInput);
            
            return result;
          } catch (error) {
            if (error instanceof z.ZodError) {
              throw new Error(`Invalid input: ${error.message}`);
            }
            throw error;
          }
        }
      );
    }
  }

  async initialize() {
    // Load tools from the tools directory
    await this.toolRegistry.loadToolsFromDirectory(__dirname);
    
    // Setup tools with MCP server
    await this.setupTools();
    
    console.log('Developer MCP Server initialized');
    console.log(`Loaded ${this.toolRegistry.getAllTools().size} tools`);
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log('Server started on stdio transport');
  }
}

async function main() {
  try {
    const server = new DeveloperMcpServer();
    await server.initialize();
    await server.start();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main().catch(console.error);