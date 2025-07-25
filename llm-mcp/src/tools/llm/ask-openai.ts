import { z } from 'zod';
import { query, SupportedProviders } from 'llm-querier';
import { ToolDefinition } from '../../types.js';
import { getLLMConfig } from '../../utils/llm.js';

const inputSchema = z.object({
  prompt: z.string().describe('The query prompt to send to OpenAI'),
  context: z.array(z.string()).optional().describe('Additional context to enhance the prompt'),
  examples: z.array(z.string()).optional().describe('Examples to guide the response'),
  images: z.array(z.string()).optional().describe('Image URLs or base64 encoded images'),
  scrapeUrls: z.array(z.string()).optional().describe('URLs to scrape and include as context'),
  fileUrls: z.array(z.string()).optional().describe('File URLs to download and include as context')
});

const askOpenAITool: ToolDefinition = {
  name: 'ask_openai',
  description: 'Ask a single query prompt to OpenAI. Provide as much context as possible. This is a single call - no conversation state is maintained.',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    const config = getLLMConfig();
    
    // Check if OpenAI is configured
    if (!config.openaiApiKey) {
      return {
        content: [{
          type: 'text',
          text: 'OpenAI is not configured. Please set OPENAI_API_KEY environment variable.'
        }],
        isError: true
      };
    }
    
    try {
      // Use the query function from llm-querier
      const response = await query({
        prompt: params.prompt,
        provider: SupportedProviders.OpenAI,
        model: config.openaiModel,
        apiKey: config.openaiApiKey,
        context: params.context,
        examples: params.examples,
        images: params.images,
        scrapeUrls: params.scrapeUrls,
        fileUrls: params.fileUrls
      });
      
      return {
        content: [{
          type: 'text',
          text: response
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error querying OpenAI: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
};

export default askOpenAITool;