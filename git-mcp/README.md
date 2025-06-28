# Git MCP

A Model Context Protocol (MCP) server providing Git version control tools for AI assistants.

## Features

19 Git tools with the `git_` prefix:

### Repository Operations
- `git_status` - Show working tree status
- `git_diff` - Show unstaged changes (ignores lock files by default)
- `git_diff_staged` - Show staged changes (ignores lock files by default)
- `git_add` - Stage files for commit
- `git_reset` - Reset HEAD to specified state
- `git_stash` - Stash/retrieve changes
- `git_clone` - Clone repositories
- `git_pull` - Pull changes from remote
- `git_push` - Push changes to remote
- `git_fetch` - Fetch changes without merging
- `git_remote` - Manage remote repositories
- `git_tag` - Create and manage tags

### Commit Operations
- `git_log` - List commits with hashes and filtering options
- `git_show` - Show commit changes and details
- `git_commit` - Create commits

### Branch Operations
- `git_branch` - List, create, delete branches
- `git_checkout` - Switch branches or restore files
- `git_merge` - Merge branches
- `git_rebase` - Rebase branches

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
    "git-mcp": {
      "command": "node",
      "args": [
        "/path/to/git-mcp/build/index.js"
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
# List commits
git_log(count: 10, oneline: true)

# Show commit changes
git_show(commit: "abc123")

# Check status
git_status(short: true)

# Stage files
git_add(paths: ["src/", "README.md"])

# Commit changes
git_commit(message: "Add new feature")

# Push to remote
git_push(remote: "origin", branch: "main")
```

## Special Features

### Lock File Filtering
The `git_diff` and `git_diff_staged` tools automatically ignore common lock files by default:
- package-lock.json
- yarn.lock
- pnpm-lock.yaml
- composer.lock
- Gemfile.lock
- And many more...

This can be disabled by setting `ignoreLockFiles: false`.