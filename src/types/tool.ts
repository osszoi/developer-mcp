import { z } from 'zod';

export interface ToolMetadata {
  name: string;
  description: string;
  category: string;
  subcategory?: string;
  version: string;
}

export interface ToolDefinition extends ToolMetadata {
  inputSchema: z.ZodSchema<any>;
  handler: (input: any) => Promise<ToolResponse>;
}

export interface ToolResponse {
  [key: string]: any;
  content: Array<{
    type: 'text';
    text: string;
  }>;
}

export interface ToolCategory {
  name: string;
  description: string;
  subcategories?: ToolCategory[];
}