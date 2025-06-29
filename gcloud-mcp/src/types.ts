import { z } from 'zod';

export interface ToolDefinition {
  name: string;
  description: string;
  category: string;
  subcategory?: string;
  version: string;
  inputSchema: z.ZodTypeAny;
  handler: (input: any) => Promise<ToolResponse>;
}

export interface ToolResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
  isError?: boolean;
}

export interface GCloudCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface GCloudConfig {
  project?: string;
  zone?: string;
  region?: string;
}