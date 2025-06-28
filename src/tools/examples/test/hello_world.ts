import { z } from 'zod';
import { ToolDefinition } from '../../../types/index.js';

const inputSchema = z.object({
  name: z.string().optional().describe('Name to greet (optional)'),
  language: z.enum(['en', 'es', 'fr', 'de', 'pt']).optional().default('en').describe('Language for greeting')
});

const greetings: Record<string, (name?: string) => string> = {
  en: (name) => name ? `Hello, ${name}!` : 'Hello, World!',
  es: (name) => name ? `¡Hola, ${name}!` : '¡Hola, Mundo!',
  fr: (name) => name ? `Bonjour, ${name}!` : 'Bonjour, le Monde!',
  de: (name) => name ? `Hallo, ${name}!` : 'Hallo, Welt!',
  pt: (name) => name ? `Olá, ${name}!` : 'Olá, Mundo!'
};

const helloWorldTool: ToolDefinition = {
  name: 'hello_world',
  description: 'A simple hello world example tool that greets in multiple languages',
  category: 'examples',
  subcategory: 'test',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const { name, language } = inputSchema.parse(input);
    
    const greetingFunc = greetings[language] || greetings.en;
    const greeting = greetingFunc(name);
    
    return {
      content: [
        {
          type: 'text',
          text: greeting
        },
        {
          type: 'text',
          text: `\nThis is an example tool from the ${helloWorldTool.category}/${helloWorldTool.subcategory} category.`
        }
      ]
    };
  }
};

export default helloWorldTool;