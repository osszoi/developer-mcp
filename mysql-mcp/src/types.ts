export interface ToolDefinition {
  name: string;
  description: string;
  category: string;
  subcategory?: string;
  version: string;
  inputSchema: any;
  handler: (input: any) => Promise<{
    content: Array<{
      type: 'text';
      text: string;
    }>;
    [key: string]: any;
  }>;
}

export interface ConnectionConfig {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
}