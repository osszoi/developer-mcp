# Docker MCP

A Model Context Protocol (MCP) server providing Docker tools for AI assistants.

## Features

10 Docker tools with the `docker_` prefix:

### Container Operations
- `docker_ps` - List containers with filtering and formatting options
- `docker_run` - Run containers with full configuration options
- `docker_stop` - Stop running containers
- `docker_remove` - Remove containers
- `docker_logs` - View container logs
- `docker_exec` - Execute commands in running containers

### Image Operations
- `docker_images` - List Docker images
- `docker_pull` - Pull images from registry
- `docker_build` - Build images from Dockerfile

### Compose Operations
- `docker_compose_up` - Start Docker Compose services

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the project:
   ```bash
   npm run build
   ```

## Usage with Cursor

Add to your `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "docker-mcp": {
      "command": "node",
      "args": [
        "/path/to/docker-mcp/build/index.js"
      ]
    }
  }
}
```

## Development

- `npm run dev` - Watch mode for development
- `npm run build` - Build the project
- `npm start` - Run the server

## Tool Usage Examples

```
# List all containers
docker_ps(all: true)

# Run a container
docker_run(image: "nginx", name: "web", ports: ["8080:80"])

# View logs
docker_logs(container: "web", tail: 50)

# Execute command
docker_exec(container: "web", command: "ls -la")
```