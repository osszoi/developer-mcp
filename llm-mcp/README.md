# LLM MCP Server

A Model Context Protocol (MCP) server that provides tools to query Large Language Models (LLMs) using the llm-querier library. Currently supports OpenAI and Google Gemini.

## Installation

### Option A: Global Installation
```bash
npm install -g @edjl/llm-mcp
```

### Option B: Use with npx (no installation required)
```bash
npx -y @edjl/llm-mcp
```

## Configuration

Set the following environment variables:

### OpenAI Configuration
- `OPENAI_API_KEY`: Your OpenAI API key (required for OpenAI tool)
- `OPENAI_MODEL`: OpenAI model to use (default: `o3`)

### Google Gemini Configuration
- `GEMINI_API_KEY`: Your Google Gemini API key (required for Gemini tool)
- `GEMINI_MODEL`: Gemini model to use (default: `gemini-2.5-pro`)

Note: You can configure just one provider or both. The server will only enable tools for configured providers.

## Available Tools

### `llm_ask_openai`
Ask a single query prompt to OpenAI. Provide as much context as possible. This is a single call - no conversation state is maintained.

Parameters:
- `prompt` (required): The query prompt to send to OpenAI
- `context` (optional): Array of additional context strings to enhance the prompt
- `examples` (optional): Array of examples to guide the response
- `images` (optional): Array of image URLs or base64 encoded images
- `scrapeUrls` (optional): Array of URLs to scrape and include as context
- `fileUrls` (optional): Array of file URLs to download and include as context

### `llm_ask_gemini`
Ask a single query prompt to Google Gemini. Provide as much context as possible. This is a single call - no conversation state is maintained.

Parameters:
- `prompt` (required): The query prompt to send to Google Gemini
- `context` (optional): Array of additional context strings to enhance the prompt
- `examples` (optional): Array of examples to guide the response
- `images` (optional): Array of image URLs or base64 encoded images
- `videos` (optional): Array of video URLs (Google AI supports video input)
- `scrapeUrls` (optional): Array of URLs to scrape and include as context
- `fileUrls` (optional): Array of file URLs to download and include as context

## Usage with Cursor

Add to your Cursor settings:

### Option A: Global Installation
```json
{
  "mcpServers": {
    "llm-mcp": {
      "command": "llm-mcp",
      "env": {
        "OPENAI_API_KEY": "your-openai-api-key",
        "OPENAI_MODEL": "o3",
        "GEMINI_API_KEY": "your-gemini-api-key",
        "GEMINI_MODEL": "gemini-2.5-pro"
      }
    }
  }
}
```

### Option B: Using npx
```json
{
  "mcpServers": {
    "llm-mcp": {
      "command": "npx",
      "args": ["-y", "@edjl/llm-mcp"],
      "env": {
        "OPENAI_API_KEY": "your-openai-api-key",
        "OPENAI_MODEL": "o3",
        "GEMINI_API_KEY": "your-gemini-api-key",
        "GEMINI_MODEL": "gemini-2.5-pro"
      }
    }
  }
}
```

## Examples

### Basic Query to OpenAI
```javascript
const result = await use_mcp_tool({
  server_name: "llm-mcp",
  tool_name: "llm_ask_openai",
  arguments: {
    prompt: "Explain the concept of quantum computing in simple terms"
  }
});
```

### Query with Context and Examples
```javascript
const result = await use_mcp_tool({
  server_name: "llm-mcp",
  tool_name: "llm_ask_gemini",
  arguments: {
    prompt: "Write a haiku about programming",
    context: ["Focus on the debugging process", "Make it humorous"],
    examples: ["Bugs hide in the code / Like ninjas in the shadows / Coffee is my sword"]
  }
});
```

### Query with Web Scraping
```javascript
const result = await use_mcp_tool({
  server_name: "llm-mcp",
  tool_name: "llm_ask_openai",
  arguments: {
    prompt: "Summarize the main points from this article",
    scrapeUrls: ["https://example.com/article"]
  }
});
```

### Query with Images (Vision Models)
```javascript
const result = await use_mcp_tool({
  server_name: "llm-mcp",
  tool_name: "llm_ask_gemini",
  arguments: {
    prompt: "What's in this image?",
    images: ["https://example.com/image.jpg"]
  }
});
```

## Notes

- This MCP server uses the `llm-querier` library under the hood
- Each query is independent - no conversation history is maintained
- The server only loads tools for providers that have API keys configured
- For more advanced usage, refer to the llm-querier documentation

## License

MIT