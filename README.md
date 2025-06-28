# Developer MCP Collection

A collection of Model Context Protocol (MCP) servers for developer tools.

## Available MCP Servers

### 🐳 Docker MCP
Location: `./docker-mcp/`

Provides 10 Docker tools for container and image management:
- Container operations (ps, run, stop, remove, logs, exec)
- Image operations (images, pull, build)
- Docker Compose support

[See Docker MCP README](./docker-mcp/README.md)

### 🔧 Git MCP
Location: `./git-mcp/`

Provides 19 Git tools for version control:
- Repository operations (status, diff, add, clone, pull, push)
- Commit operations (log, show, commit)
- Branch operations (branch, checkout, merge, rebase)

[See Git MCP README](./git-mcp/README.md)

## Installation

Each MCP server is independent. Navigate to the desired server directory and:

```bash
cd docker-mcp  # or git-mcp
npm install
npm run build
```

## Configuration

Add the desired servers to your `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "docker-mcp": {
      "command": "node",
      "args": [
        "/absolute/path/to/docker-mcp/build/index.js"
      ]
    },
    "git-mcp": {
      "command": "node",
      "args": [
        "/absolute/path/to/git-mcp/build/index.js"
      ]
    }
  }
}
```

## Structure

```
developer-mcp/
├── docker-mcp/          # Docker tools MCP server
│   ├── src/
│   ├── build/
│   ├── package.json
│   └── README.md
├── git-mcp/             # Git tools MCP server
│   ├── src/
│   ├── build/
│   ├── package.json
│   └── README.md
└── README.md            # This file
```

## Future MCP Servers

This structure allows easy addition of new domain-specific MCP servers:
- `npm-mcp` - NPM/Node.js package management
- `python-mcp` - Python/pip tools
- `k8s-mcp` - Kubernetes tools
- `aws-mcp` - AWS CLI tools
- etc.

Each server remains independent and can be enabled/disabled as needed in Cursor.