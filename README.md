# Developer MCP Collection

A collection of Model Context Protocol (MCP) servers for developer tools.

## Quick Start

### 1. Install Tools
```bash
npm install -g @edjl/docker-mcp @edjl/git-mcp @edjl/mysql-mcp @edjl/gcloud-mcp @edjl/github-mcp @edjl/rest-mcp
```

### 2. Configure Your MCP Client
Add to `~/.cursor/mcp.json` (or your MCP client's config file):

```json
{
  "mcpServers": {
    "docker-mcp": {
      "command": "docker-mcp",
      "args": []
    },
    "git-mcp": {
      "command": "git-mcp",
      "args": []
    },
    "mysql-mcp": {
      "command": "mysql-mcp",
      "args": [],
      "env": {
        "MYSQL_HOST": "localhost",
        "MYSQL_PORT": "3306",
        "MYSQL_USER": "your_user",
        "MYSQL_PASSWORD": "your_password"
      }
    },
    "gcloud-mcp": {
      "command": "gcloud-mcp",
      "args": []
    },
    "github-mcp": {
      "command": "github-mcp",
      "args": []
    },
    "rest-mcp": {
      "command": "rest-mcp",
      "args": [],
      "env": {
        "REST_API_AUTH_TOKEN": "Bearer your_token_here"
      }
    }
  }
}
```

### 3. Restart Your MCP Client
Restart Cursor (or your MCP client) to load the new tools.

## Available Tools

### 🐳 Docker MCP
Container and image management (10 tools)
- **Container**: ps, run, stop, remove, logs, exec
- **Images**: images, pull, build
- **Compose**: compose_up

### 🔧 Git MCP  
Version control operations (17 tools)
- **Repository**: status, diff, add, pull, push
- **Commits**: log, show, commit
- **Branches**: branch, checkout, merge, reset, revert
- **Advanced**: stash, tag, remote, blame

### 🗄️ MySQL MCP
Database operations (6 tools)
- **Read**: query, list_databases, list_tables, describe_table
- **Write**: update, delete
- **Note**: Requires environment variables for connection

### ☁️ GCloud MCP
Google Cloud Platform tools (18 tools)
- **Kubernetes**: clusters_list, workloads_list, deployments_restart, logs
- **Storage**: buckets_list, objects_list, object_read
- **Artifact Registry**: repositories_list, images_list
- **Note**: Requires gcloud CLI installed and authenticated

### 🐙 GitHub MCP
GitHub operations via CLI (9 tools)
- **Repositories**: repos_list, file_get
- **Pull Requests**: pr_list, pr_view, pr_diff, pr_comments_list
- **Reviews**: pr_suggest_change, pr_approve
- **Note**: Requires GitHub CLI (gh) installed and authenticated

### 🌐 REST MCP
HTTP/REST API requests (5 tools)
- **Methods**: rest_get, rest_post, rest_put, rest_patch, rest_delete
- **Features**: Automatic auth headers, custom headers, query params
- **Note**: Optional REST_API_AUTH_TOKEN environment variable

## Environment Variables

Some MCPs require environment variables. Set them in the `env` section of each MCP configuration:

- **MySQL MCP**: `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`
- **REST MCP**: `REST_API_AUTH_TOKEN` (optional)

## Troubleshooting

- **"command not found"**: Make sure you've installed the tools globally with npm
- **"0 tools enabled"**: Check that the tools are properly installed and restart your MCP client
- **Connection errors**: Verify environment variables and external dependencies (MySQL, gcloud, gh)