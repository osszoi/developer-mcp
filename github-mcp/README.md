# GitHub MCP Server

MCP server for GitHub operations using the GitHub CLI (`gh`).

## Prerequisites

- GitHub CLI (`gh`) installed and authenticated
- Node.js 18+

### Installing GitHub CLI

```bash
# macOS
brew install gh

# Ubuntu/Debian
sudo apt install gh

# Or download from https://cli.github.com/
```

### Authenticating

```bash
gh auth login
```

## Installation

```bash
npm install
npm run build
```

## Configuration

Add to your MCP client configuration:

```json
{
  "github-mcp": {
    "command": "node",
    "args": ["/path/to/github-mcp/build/index.js"]
  }
}
```

## Available Tools

### Repository Management

#### 1. `github_repos_list`
List GitHub repositories. When no owner specified, lists ALL your accessible repos including organizations.

**Parameters:**
- `owner` (optional): Repository owner (defaults to all accessible repos)
- `visibility`: "public", "private", or "all"
- `type`: "all", "owner", or "member"
- `sort`: "created", "updated", "pushed", "name", or "stargazers"
- `limit`: Maximum number of repositories per organization
- `archived`: Include archived repositories
- `topic`: Filter by topic

**Example:**
```json
{
  "owner": "facebook",
  "visibility": "public",
  "sort": "stargazers",
  "limit": 10
}
```

#### 2. `github_file_get`
Get the content of a file from a GitHub repository.

**Parameters:**
- `repository`: Repository in owner/repo format
- `path`: Path to the file
- `ref` (optional): Branch, tag, or commit SHA
- `raw`: Return raw content without metadata

**Example:**
```json
{
  "repository": "facebook/react",
  "path": "README.md",
  "ref": "main"
}
```

#### 3. `github_branch_list`
List branches in a repository.

**Parameters:**
- `repository`: Repository in owner/repo format
- `protected` (optional): Show only protected branches
- `sort`: "name" or "updated"
- `limit`: Maximum number of branches

**Example:**
```json
{
  "repository": "nodejs/node",
  "sort": "updated",
  "limit": 20
}
```

### Pull Requests

#### 4. `github_pr_list`
List pull requests from a repository or all your repositories.

**Parameters:**
- `repository` (optional): Repository in owner/repo format
- `state`: "open", "closed", "merged", or "all"
- `author` (optional): Filter by author
- `assignee` (optional): Filter by assignee
- `label` (optional): Filter by label
- `base` (optional): Filter by base branch
- `sort`: "created", "updated", or "comments"
- `limit`: Maximum number of PRs

**Example:**
```json
{
  "repository": "kubernetes/kubernetes",
  "state": "open",
  "limit": 20
}
```

#### 5. `github_pr_details`
Get detailed information about a specific pull request.

**Parameters:**
- `repository`: Repository in owner/repo format
- `pr_number`: Pull request number
- `show_checks`: Show status checks (default: true)
- `show_reviews`: Show review status (default: true)

**Example:**
```json
{
  "repository": "rust-lang/rust",
  "pr_number": 12345
}
```

#### 6. `github_pr_create`
Create a new pull request.

**Parameters:**
- `repository`: Repository in owner/repo format
- `title`: PR title
- `body` (optional): PR description
- `base`: Base branch (default: "main")
- `head`: Head branch (your feature branch)
- `draft`: Create as draft (default: false)
- `assignees` (optional): Array of usernames
- `labels` (optional): Array of labels
- `reviewers` (optional): Array of reviewers

**Example:**
```json
{
  "repository": "owner/repo",
  "title": "Add new feature",
  "body": "This PR adds...",
  "base": "main",
  "head": "feature-branch",
  "draft": false,
  "reviewers": ["user1", "user2"]
}
```

#### 7. `github_pr_changes`
Get the changes (diff) from a pull request.

**Parameters:**
- `repository`: Repository in owner/repo format
- `pr_number`: Pull request number
- `format`: "patch" (raw diff), "files" (list), or "stats" (summary)

**Example:**
```json
{
  "repository": "nodejs/node",
  "pr_number": 12345,
  "format": "files"
}
```

#### 8. `github_pr_comments_get`
Get comments from a pull request, including inline code comments.

**Parameters:**
- `repository`: Repository in owner/repo format
- `pr_number`: Pull request number
- `type`: "all", "review" (inline), or "issue" (general)

**Example:**
```json
{
  "repository": "microsoft/vscode",
  "pr_number": 98765,
  "type": "all"
}
```

#### 9. `github_pr_suggest_change`
Suggest a specific code change on a pull request.

**Parameters:**
- `repository`: Repository in owner/repo format
- `pr_number`: Pull request number
- `path`: File path where the change should be made
- `line`: Starting line number
- `end_line` (optional): End line for multi-line suggestions
- `original_code`: The original code to be replaced
- `suggested_code`: The suggested replacement
- `comment` (optional): Explanation for the change

**Example:**
```json
{
  "repository": "owner/repo",
  "pr_number": 123,
  "path": "src/index.js",
  "line": 42,
  "original_code": "let value = 42;",
  "suggested_code": "const value = 42;",
  "comment": "Use const for values that won't be reassigned"
}
```

#### 10. `github_pr_approve`
Approve, request changes, or comment on a pull request.

**Parameters:**
- `repository`: Repository in owner/repo format
- `pr_number`: Pull request number
- `body` (optional): Review comment
- `event`: "APPROVE", "REQUEST_CHANGES", or "COMMENT" (default: "APPROVE")

**Example:**
```json
{
  "repository": "owner/repo",
  "pr_number": 123,
  "body": "Looks good to me! Great work on the implementation.",
  "event": "APPROVE"
}
```

### Issues

#### 11. `github_issues_list`
List issues from a repository or all your repositories.

**Parameters:**
- `repository` (optional): Repository in owner/repo format
- `state`: "open", "closed", or "all"
- `author` (optional): Filter by author
- `assignee` (optional): Filter by assignee
- `label` (optional): Filter by label
- `milestone` (optional): Filter by milestone
- `sort`: "created", "updated", or "comments"
- `limit`: Maximum number of issues

**Example:**
```json
{
  "state": "open",
  "assignee": "@me",
  "sort": "updated",
  "limit": 30
}
```

## Usage Examples

### List all your repositories (including organizations)
```
Use github_repos_list without any parameters to see ALL repositories you have access to
```

### Find and review open PRs
1. List open PRs: `github_pr_list` with state: "open"
2. Get PR details: `github_pr_details` 
3. View changes: `github_pr_changes`
4. Read comments: `github_pr_comments_get`
5. Suggest changes: `github_pr_suggest_change` with specific code improvements
6. Approve PR: `github_pr_approve` with event: "APPROVE"

### Create a new PR
```
Use github_pr_create with repository, title, head branch, and base branch
```

### Track issues assigned to you
```
Use github_issues_list with assignee: "@me" and state: "open"
```

### Explore a repository
1. List branches: `github_branch_list`
2. Get README: `github_file_get` with path: "README.md"
3. View open PRs: `github_pr_list`
4. Check issues: `github_issues_list`

## Troubleshooting

### Authentication Issues
If you see authentication errors:
```bash
gh auth status  # Check status
gh auth login   # Re-authenticate
```

### Rate Limiting
GitHub API has rate limits. Authenticated requests have higher limits.

### Permissions
Ensure your GitHub token has appropriate permissions for the operations you want to perform.