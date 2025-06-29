#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readdir } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';
import { validateGCloudSetup } from './utils/gcloud.js';

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

class GCloudMcpServer {
  private server: McpServer;
  private toolCount = 0;

  constructor() {
    this.server = new McpServer({
      name: 'gcloud-mcp',
      version: '1.0.0'
    });
  }

  async validateSetup() {
    console.log('Validating gcloud setup...');
    const validation = await validateGCloudSetup();
    
    if (!validation.valid) {
      console.error(`\n❌ GCloud setup validation failed: ${validation.error}\n`);
      console.error('Please ensure:');
      console.error('1. gcloud CLI is installed: https://cloud.google.com/sdk/docs/install');
      console.error('2. You are authenticated: gcloud auth login');
      console.error('3. A project is set: gcloud config set project PROJECT_ID\n');
      process.exit(1);
    }
    
    console.log('✓ GCloud CLI installed');
    console.log('✓ Authenticated');
    console.log(`✓ Project: ${validation.config?.project}`);
    if (validation.config?.zone) {
      console.log(`✓ Default Zone: ${validation.config.zone}`);
    }
    if (validation.config?.region) {
      console.log(`✓ Default Region: ${validation.config.region}`);
    }
    console.log('');
  }

  async loadTools() {
    const toolsDir = path.join(__dirname, 'tools');
    await this.loadToolsFromDirectory(toolsDir);
  }

  private async loadToolsFromDirectory(dir: string, prefix = ''): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // Recursively load tools from subdirectories
          await this.loadToolsFromDirectory(fullPath, prefix);
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
          try {
            const module = await import(fullPath) as ToolModule;
            
            if (module.default && this.isValidTool(module.default)) {
              const tool = module.default;
              const toolName = `gcloud_${tool.name}`;
              
              // Get the shape from the Zod schema for MCP
              const shape = tool.inputSchema._def.shape ? tool.inputSchema._def.shape() : {};
              
              this.server.tool(
                toolName,
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
              console.log(`Registered tool: ${toolName}`);
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
    console.log(`\nGCloud MCP Server loaded ${this.toolCount} tools`);
    
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log('Server started on stdio transport');
  }
}

async function main() {
  try {
    const server = new GCloudMcpServer();
    await server.start();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main().catch(console.error);