# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Building
- **Build all packages**: `npm run build` (from root)
- **Build individual package**: `cd [package-name] && npm run build`
- **Publish all packages**: `npm run publish-all` (requires npm authentication)

### Development
- **Install dependencies**: `npm install` (from root, installs all workspace dependencies)
- **Run MCP server**: `node build/index.js` (from individual package directory after building)

## Architecture

This is a monorepo containing multiple MCP (Model Context Protocol) servers, each published as a separate npm package under the `@edjl/mcp-tools` scope.

### Workspace Structure
Each MCP server follows the same pattern:
- `src/index.ts` - Server entry point that dynamically loads all tools
- `src/tools/[category]/[tool-name].ts` - Individual tool implementations
- Tools are automatically discovered and registered based on file structure

### Tool Implementation Pattern
When creating new tools, follow the naming convention from `.cursor/rules/tools.mdc`:
- Tool names must be prefixed with their category (e.g., `docker_run`, `git_commit`)
- Each tool exports a `ToolDefinition` object with:
  - `name`: Prefixed tool name
  - `description`: Clear description of functionality
  - `inputSchema`: Zod schema for validation
  - `handler`: Async function implementing the tool logic

### Key Dependencies
- **@modelcontextprotocol/sdk**: Core MCP functionality
- **zod**: Input validation schemas
- Most servers execute CLI commands (docker, git, gcloud, gh) rather than using SDKs

### Adding New Tools
1. Create a new file in `src/tools/[category]/[tool-name].ts`
2. Export a `ToolDefinition` following the existing pattern
3. The tool will be automatically loaded by the server
4. Build the package to include the new tool

### Environment Variables
Different servers require specific environment variables:
- **github-mcp**: `GITHUB_TOKEN` or uses gh CLI authentication
- **mysql-mcp**: Database connection parameters
- **gcloud-mcp**: Relies on gcloud CLI authentication
- **jira-mcp**: `JIRA_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`