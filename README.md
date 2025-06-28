# Developer MCP Server

A modular Model Context Protocol (MCP) server designed for developers, with organized tools for Git, Docker, and various development utilities.

## Project Structure

```
developer-mcp/
├── src/
│   ├── core/
│   │   └── ToolRegistry.ts      # Dynamic tool loading and registration
│   ├── tools/
│   │   ├── examples/
│   │   │   └── test/
│   │   │       └── hello_world.ts
│   │   ├── git/                 # Git-related tools
│   │   │   ├── repository/      # Repository management
│   │   │   ├── commits/         # Commit operations
│   │   │   └── branches/        # Branch management
│   │   ├── docker/              # Docker tools
│   │   │   ├── containers/      # Container operations
│   │   │   ├── images/          # Image management
│   │   │   └── compose/         # Docker Compose operations
│   │   └── utilities/           # General utilities
│   │       ├── file/            # File operations
│   │       └── system/          # System utilities
│   ├── types/
│   │   ├── index.ts
│   │   └── tool.ts             # TypeScript interfaces
│   ├── utils/                   # Utility functions
│   └── index.ts                 # Main server entry point
├── scripts/                     # Build and utility scripts
├── docs/                        # Documentation
├── tests/                       # Test files
├── package.json
├── tsconfig.json
└── README.md
```

## Architecture

### Modular Tool System

The server uses a modular architecture where tools are:
- Organized by category and subcategory
- Dynamically loaded at runtime
- Self-contained with their own schemas and handlers
- Easily extensible without modifying core code

### Tool Categories

1. **Examples** - Demonstration tools
   - `test/` - Test examples like hello_world

2. **Git** - Version control tools (planned)
   - `repository/` - Repository management
   - `commits/` - Commit operations
   - `branches/` - Branch management

3. **Docker** - Container management (planned)
   - `containers/` - Container operations
   - `images/` - Image management
   - `compose/` - Docker Compose operations

4. **Utilities** - General tools (planned)
   - `file/` - File operations
   - `system/` - System utilities

## Creating New Tools

To add a new tool:

1. Create a TypeScript file in the appropriate category/subcategory folder
2. Implement the `ToolDefinition` interface:

```typescript
import { z } from 'zod';
import { ToolDefinition } from '../../../types/index.js';

const inputSchema = z.object({
  // Define your input schema
});

const myTool: ToolDefinition = {
  name: 'my_tool',
  description: 'What this tool does',
  category: 'category_name',
  subcategory: 'subcategory_name',  // optional
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    // Tool implementation
    return {
      content: [{
        type: 'text',
        text: 'Result'
      }]
    };
  }
};

export default myTool;
```

3. The tool will be automatically loaded when the server starts

## Development

### Setup

```bash
npm install
```

### Build

```bash
npm run build
```

### Development Mode

```bash
npm run dev  # Watches for changes
```

### Running the Server

```bash
npm start
# or
node build/index.js
```

## Tool Naming Convention

Tools are automatically assigned IDs based on their location:
- `category_toolname` for root-level tools
- `category_subcategory_toolname` for subcategory tools

Example: The hello_world tool in `examples/test/` becomes `examples_test_hello_world`

## Example Usage

The included `hello_world` tool demonstrates:
- Input validation with Zod schemas
- Optional parameters with defaults
- Multiple response types
- Proper tool structure

```typescript
// Input
{
  "name": "Developer",
  "language": "es"
}

// Output
{
  "content": [
    {
      "type": "text",
      "text": "¡Hola, Developer!"
    },
    {
      "type": "text", 
      "text": "\nThis is an example tool from the examples/test category."
    }
  ]
}
```

## Future Development

This structure is designed to easily accommodate:
- Git integration tools
- Docker management tools
- File system utilities
- Database tools
- API testing tools
- And much more!

Each category can have its own shared utilities and subcategories for better organization.