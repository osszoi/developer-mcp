# Developer MCP Collection

A collection of Model Context Protocol (MCP) servers for developer tools.

## Quick Start

### 1. Install Tools

#### Option A: Global Installation

```bash
npm install -g @edjl/docker-mcp @edjl/git-mcp @edjl/mysql-mcp @edjl/gcloud-mcp @edjl/github-mcp @edjl/rest-mcp @edjl/jira-mcp @edjl/llm-mcp
```

#### Option B: Use with npx (no installation required)

You can use any of these tools directly with npx:

```bash
npx -y @edjl/docker-mcp
npx -y @edjl/git-mcp
npx -y @edjl/mysql-mcp
npx -y @edjl/gcloud-mcp
npx -y @edjl/github-mcp
npx -y @edjl/rest-mcp
npx -y @edjl/jira-mcp
npx -y @edjl/llm-mcp
```

### 2. Configure Your MCP Client

Add to `~/.cursor/mcp.json` (or your MCP client's config file):

**For npx usage:**

```json
{
	"mcpServers": {
		"docker-mcp": {
			"command": "npx",
			"args": ["-y", "@edjl/docker-mcp"]
		},
		"git-mcp": {
			"command": "npx",
			"args": ["-y", "@edjl/git-mcp"]
		},
		"mysql-mcp": {
			"command": "npx",
			"args": ["-y", "@edjl/mysql-mcp"],
			"env": {
				"MYSQL_HOST": "localhost",
				"MYSQL_PORT": "3306",
				"MYSQL_USER": "your_user",
				"MYSQL_PASSWORD": "your_password"
			}
		},
		"gcloud-mcp": {
			"command": "npx",
			"args": ["-y", "@edjl/gcloud-mcp"]
		},
		"github-mcp": {
			"command": "npx",
			"args": ["-y", "@edjl/github-mcp"]
		},
		"rest-mcp": {
			"command": "npx",
			"args": ["-y", "@edjl/rest-mcp"],
			"env": {
				"REST_API_AUTH_TOKEN": "Bearer your_token_here"
			}
		},
		"jira-mcp": {
			"command": "npx",
			"args": ["-y", "@edjl/jira-mcp"],
			"env": {
				"JIRA_BASE_URL": "https://your-domain.atlassian.net",
				"JIRA_EMAIL": "your-email@example.com",
				"JIRA_API_TOKEN": "your-api-token"
			}
		},
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

### Claude Code Configuration

To add MCPs to Claude Code, use the following commands:

```bash
# Docker MCP
claude mcp add docker-mcp -s user -- npx -y @edjl/docker-mcp

# Git MCP
claude mcp add git-mcp -s user -- npx -y @edjl/git-mcp

# MySQL MCP
claude mcp add mysql-mcp -s user --env MYSQL_HOST=localhost --env MYSQL_PORT=3306 --env MYSQL_USER=your_user --env MYSQL_PASSWORD=your_password -- npx -y @edjl/mysql-mcp

# GCloud MCP
claude mcp add gcloud-mcp -s user -- npx -y @edjl/gcloud-mcp

# GitHub MCP
claude mcp add github-mcp -s user -- npx -y @edjl/github-mcp

# REST MCP
claude mcp add rest-mcp -s user --env REST_API_AUTH_TOKEN="Bearer your_token_here" -- npx -y @edjl/rest-mcp

# Jira MCP
claude mcp add jira-mcp -s user --env JIRA_BASE_URL=https://your-domain.atlassian.net --env JIRA_EMAIL=your-email@example.com --env JIRA_API_TOKEN=your-api-token -- npx -y @edjl/jira-mcp

# LLM MCP
claude mcp add llm-mcp -s user --env OPENAI_API_KEY=your-openai-api-key --env OPENAI_MODEL=o3 --env GEMINI_API_KEY=your-gemini-api-key --env GEMINI_MODEL=gemini-2.5-pro -- npx -y @edjl/llm-mcp
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

Google Cloud Platform tools (32 tools)

- **Kubernetes**: clusters_list, workloads_list, deployment logs, workload logs
- **Storage**: buckets_list, objects_list, object_read, metadata
- **IAM & Security**: roles, policies, service accounts, keys
- **Secrets Manager**: list, versions, get (with warnings)
- **Cloud SQL**: instances, databases, backups
- **Pub/Sub**: topics, subscriptions, describe
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

### 🎫 Jira MCP

Jira issue tracking and project management (12 tools)

- **Issues**: get, search, create, update, delete, transition, watchers, link
- **Comments**: add, list
- **Projects & Users**: project_list, user_search
- **Note**: Requires JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN environment variables

### 🤖 LLM MCP

Query Large Language Models (2 tools)

- **Models**: ask_openai, ask_gemini
- **Features**: Single queries with context, examples, images, video (Gemini), URL scraping, file downloads
- **Note**: Requires API keys and model configuration for each provider

## Environment Variables

Some MCPs require environment variables. Set them in the `env` section of each MCP configuration:

- **MySQL MCP**: `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`
- **REST MCP**: `REST_API_AUTH_TOKEN` (optional)
- **Jira MCP**: `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`
- **LLM MCP**: `OPENAI_API_KEY`, `OPENAI_MODEL`, `GEMINI_API_KEY`, `GEMINI_MODEL`

## Troubleshooting

- **"command not found"**: Make sure you've installed the tools globally with npm
- **"0 tools enabled"**: Check that the tools are properly installed and restart your MCP client
- **Connection errors**: Verify environment variables and external dependencies (MySQL, gcloud, gh)
