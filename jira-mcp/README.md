# Jira MCP Server

A Model Context Protocol (MCP) server that provides tools to interact with Jira issues, projects, and users.

## Installation

### Option A: Global Installation
```bash
npm install -g @edjl/jira-mcp
```

### Option B: Use with npx (no installation required)
```bash
npx -y @edjl/jira-mcp
```

## Configuration

Set the following environment variables:

- `JIRA_BASE_URL`: Your Jira instance URL (e.g., `https://your-domain.atlassian.net`)
- `JIRA_EMAIL`: Your Jira account email
- `JIRA_API_TOKEN`: Your Jira API token (create at https://id.atlassian.com/manage-profile/security/api-tokens)

## Available Tools

### Issue Management

- `jira_issue_get` - Get details of a specific Jira issue
- `jira_issue_search` - Search for Jira issues using JQL
- `jira_issue_create` - Create a new Jira issue
- `jira_issue_update` - Update an existing Jira issue
- `jira_issue_delete` - Delete a Jira issue (requires appropriate permissions)
- `jira_issue_transition` - Transition a Jira issue to a different status
- `jira_issue_watchers` - Manage watchers on a Jira issue
- `jira_issue_link` - Create a link between two Jira issues

### Comments

- `jira_comment_add` - Add a comment to a Jira issue
- `jira_comment_list` - List comments on a Jira issue

### Projects and Users

- `jira_project_list` - List all accessible Jira projects
- `jira_user_search` - Search for Jira users

## Usage with Cursor

Add to your Cursor settings:

**For global installation:**
```json
{
  "jira": {
    "command": "jira-mcp",
    "args": [],
    "env": {
      "JIRA_BASE_URL": "https://your-domain.atlassian.net",
      "JIRA_EMAIL": "your-email@example.com",
      "JIRA_API_TOKEN": "your-api-token"
    }
  }
}
```

**For npx usage:**
```json
{
  "jira": {
    "command": "npx",
    "args": ["-y", "@edjl/jira-mcp"],
    "env": {
      "JIRA_BASE_URL": "https://your-domain.atlassian.net",
      "JIRA_EMAIL": "your-email@example.com",
      "JIRA_API_TOKEN": "your-api-token"
    }
  }
}
```

## Examples

### Search for issues
```
Use jira_issue_search with JQL: "project = PROJ AND status = 'In Progress'"
```

### Create an issue
```
Use jira_issue_create with:
- projectKey: "PROJ"
- summary: "Fix login bug"
- description: "Users cannot login with special characters"
- issueType: "Bug"
- priority: "High"
```

### Add a comment
```
Use jira_comment_add with:
- issueKey: "PROJ-123"
- comment: "I've started working on this issue"
```

## License

MIT