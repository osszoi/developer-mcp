#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { ToolDefinition } from './types.js';
import { validateLLMSetup } from './utils/llm.js';

interface ToolModule {
  default: ToolDefinition;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class LLMMCPServer {
  private server: McpServer;
  private toolCount = 0;

  constructor() {
    this.server = new McpServer({
      name: 'llm-mcp',
      version: '1.0.0'
    });

    this.setupErrorHandling();
  }

  private setupErrorHandling() {
    process.on('SIGINT', async () => {
      console.log('\n[LLM MCP] Shutting down...');
      await this.server.close();
      process.exit(0);
    });
  }

  async initialize() {
    // Print startup message
    console.log('LLM MCP Server v1.0.0');
    console.log('=====================');
    
    // Validate LLM setup
    const validation = await validateLLMSetup();
    if (!validation.valid) {
      console.error(`✗ Setup Error: ${validation.error}`);
      console.error('Please fix the issue and restart the server.');
      process.exit(1);
    }
    
    console.log('✓ LLM configuration is valid');
    console.log(`✓ OpenAI Model: ${validation.openaiModel || 'Not configured'}`);
    console.log(`✓ Gemini Model: ${validation.geminiModel || 'Not configured'}`);
    console.log('');
    
    // Load tools
    await this.loadTools();
    
    console.log(`\nTotal tools registered: ${this.toolCount}`);
    console.log('Server ready!\n');
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
          await this.loadToolsFromDirectory(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
          try {
            const module = await import(fullPath) as ToolModule;
            
            if (module.default && this.isValidTool(module.default)) {
              const tool = module.default;
              const toolName = `llm_${tool.name}`;
              
              // Get the shape from the Zod schema for MCP
              const shape = (tool.inputSchema as any)._def.shape ? (tool.inputSchema as any)._def.shape() : {};
              
              this.server.tool(
                toolName,
                tool.description,
                shape,
                async (args: any) => {
                  try {
                    const validatedInput = tool.inputSchema.parse(args);
                    const result = await tool.handler(validatedInput);
                    
                    // Convert our format to MCP format
                    return {
                      content: result.content.map((item: any) => {
                        if (item.type === 'text' && item.text) {
                          return {
                            type: 'text',
                            text: item.text
                          };
                        }
                        return item;
                      })
                    };
                  } catch (error) {
                    throw new Error(`Validation error: ${error instanceof Error ? error.message : String(error)}`);
                  }
                }
              );
              
              this.toolCount++;
              console.log(`Registered tool: ${toolName}`);
            }
          } catch (error) {
            console.error(`Failed to load tool from ${entry.name}:`, error);
          }
        }
      }
    } catch (error) {
      console.error(`Failed to read directory ${dir}:`, error);
    }
  }

  private isValidTool(tool: any): tool is ToolDefinition {
    return (
      typeof tool.name === 'string' &&
      typeof tool.description === 'string' &&
      typeof tool.handler === 'function' &&
      tool.inputSchema?._def
    );
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.initialize();
    await this.server.connect(transport);
    console.log('LLM MCP server running on stdio');
  }
}

// Start the server
const server = new LLMMCPServer();
server.run().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});