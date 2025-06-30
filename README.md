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

### 🗄️ MySQL MCP
Location: `./mysql-mcp/`

Provides 8 MySQL database tools:
- Read operations (databases, tables, columns, describe, query, count)
- Write operations (update, delete) with safety features
- Connection via environment variables in mcp.json

[See MySQL MCP README](./mysql-mcp/README.md)

### ☁️ GCloud MCP
Location: `./gcloud-mcp/`

Provides 20+ Google Cloud Platform tools:
- Kubernetes/GKE operations (clusters, workloads, deployments)
- Artifact Registry management (repositories, images, versions)
- Cloud Storage operations (buckets, objects, metadata)
- Cloud Logging (read, tail, query, sinks)
- Requires gcloud CLI installed and authenticated

[See GCloud MCP README](./gcloud-mcp/README.md)

### 🐙 GitHub MCP
Location: `./github-mcp/`

Provides GitHub operations using GitHub CLI:
- Repository listing and file retrieval
- Pull request viewing (changes, comments)
- Pull request interactions (post comments, code reviews)
- Requires GitHub CLI (gh) installed and authenticated

[See GitHub MCP README](./github-mcp/README.md)

## Installation

Each MCP server is independent. Navigate to the desired server directory and:

```bash
cd docker-mcp  # or git-mcp, mysql-mcp, gcloud-mcp, github-mcp
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
    },
    "mysql-mcp": {
      "command": "node",
      "args": [
        "/absolute/path/to/mysql-mcp/build/index.js"
      ],
      "env": {
        "MYSQL_HOST": "localhost",
        "MYSQL_PORT": "3306",
        "MYSQL_USER": "your_username",
        "MYSQL_PASSWORD": "your_password"
      }
    },
    "gcloud-mcp": {
      "command": "node",
      "args": [
        "/absolute/path/to/gcloud-mcp/build/index.js"
      ]
    },
    "github-mcp": {
      "command": "node",
      "args": [
        "/absolute/path/to/github-mcp/build/index.js"
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
├── mysql-mcp/           # MySQL tools MCP server
│   ├── src/
│   ├── build/
│   ├── package.json
│   └── README.md
├── gcloud-mcp/          # Google Cloud Platform tools MCP server
│   ├── src/
│   ├── build/
│   ├── package.json
│   ├── README.md
│   └── ROADMAP.md
├── github-mcp/          # GitHub CLI tools MCP server
│   ├── src/
│   ├── build/
│   ├── package.json
│   └── README.md
└── README.md            # This file
```

Each server remains independent and can be enabled/disabled as needed in Cursor.