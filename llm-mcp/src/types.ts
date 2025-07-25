import { z } from 'zod';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodType<any>;
  handler: (input: any) => Promise<{
    content: Array<{
      type: string;
      text?: string;
      data?: any;
    }>;
    isError?: boolean;
  }>;
}

export interface LLMConfig {
  openaiApiKey?: string;
  geminiApiKey?: string;
  openaiModel?: string;
  geminiModel?: string;
}