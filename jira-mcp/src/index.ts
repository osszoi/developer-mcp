#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readdir } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';
import { validateJiraSetup } from './utils/jira.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ToolModule {
  default: {
    name: string;
    description: string;
    inputSchema: any;
    handler: (input: any) => Promise<any>;
  };
}

class JiraMcpServer {
  private server: McpServer;
  private toolCount = 0;

  constructor() {
    this.server = new McpServer(
      {
        name: 'jira-mcp',
        version: '1.0.0',
        description: 'Jira integration for Model Context Protocol'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );
  }

  async validateSetup() {
    console.log('Jira MCP Server\n');
    const validation = validateJiraSetup();
    
    if (validation.valid) {
      console.log('✓ Jira configuration found');
    } else {
      console.log('⚠ Warning: ' + validation.error);
    }
  }

  async loadTools() {
    const toolsDir = path.join(__dirname, 'tools');
    await this.loadToolsFromDirectory(toolsDir);
  }

  private async loadToolsFromDirectory(dir: string): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // Recursively load tools from subdirectories
          await this.loadToolsFromDirectory(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
          try {
            const module = await import(fullPath) as ToolModule;
            
            if (module.default && this.isValidTool(module.default)) {
              const tool = module.default;
              
              // Get the shape from the Zod schema for MCP
              const shape = tool.inputSchema._def.shape ? tool.inputSchema._def.shape() : {};
              
              this.server.tool(
                tool.name,
                tool.description,
                shape,
                async (args: any) => {
                  try {
                    const validatedInput = tool.inputSchema.parse(args);
                    return await tool.handler(validatedInput);
                  } catch (error) {
                    throw new Error(`Validation error: ${error instanceof Error ? error.message : String(error)}`);
                  }
                }
              );
              
              this.toolCount++;
              console.log(`Registered tool: ${tool.name}`);
            }
          } catch (error) {
            console.error(`Failed to load tool from ${fullPath}:`, error);
          }
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${dir}:`, error);
    }
  }

  private isValidTool(obj: any): boolean {
    return (
      obj &&
      typeof obj === 'object' &&
      typeof obj.name === 'string' &&
      typeof obj.description === 'string' &&
      typeof obj.handler === 'function' &&
      obj.inputSchema
    );
  }

  async start() {
    await this.validateSetup();
    await this.loadTools();
    console.log(`\nJira MCP Server loaded ${this.toolCount} tools`);
    
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log('Server started on stdio transport');
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Jira MCP Server

This MCP server provides tools to interact with Jira issues, projects, and users.

Required environment variables:
  JIRA_BASE_URL    Your Jira instance URL (e.g., https://your-domain.atlassian.net)
  JIRA_EMAIL       Your Jira account email
  JIRA_API_TOKEN   Your Jira API token (create at https://id.atlassian.com/manage-profile/security/api-tokens)

Usage:
  jira-mcp              Start the MCP server
  jira-mcp --help       Show this help message
`);
    process.exit(0);
  }

  try {
    const server = new JiraMcpServer();
    await server.start();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main().catch(console.error);