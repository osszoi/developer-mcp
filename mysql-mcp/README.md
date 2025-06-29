# MySQL MCP

A Model Context Protocol (MCP) server that provides tools for interacting with MySQL databases.

## Features

This MCP server provides the following tools:

### Read Operations
- `mysql_databases` - List all databases
- `mysql_tables` - List all tables in a database
- `mysql_columns` - List columns of a table
- `mysql_describe` - Show detailed table structure
- `mysql_query` - Execute SELECT queries (read-only)
- `mysql_count` - Count rows with optional filtering

### Write Operations
- `mysql_update` - Update rows with safety checks
- `mysql_delete` - Delete rows with safety checks

## Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the project:
   ```bash
   npm run build
   ```

## Configuration

### Option 1: Environment Variables in mcp.json (Recommended)

Add the server to your `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "mysql-mcp": {
      "command": "node",
      "args": [
        "/path/to/mysql-mcp/build/index.js"
      ],
      "env": {
        "MYSQL_HOST": "localhost",
        "MYSQL_PORT": "3306",
        "MYSQL_USER": "your_username",
        "MYSQL_PASSWORD": "your_password",
        "MYSQL_DATABASE": "default_database"
      }
    }
  }
}
```

### Option 2: Per-Tool Configuration

Each tool accepts connection parameters that override the environment variables:

```typescript
{
  host: "localhost",      // Optional, defaults to MYSQL_HOST or 'localhost'
  port: 3306,            // Optional, defaults to MYSQL_PORT or 3306
  user: "root",          // Optional, defaults to MYSQL_USER or 'root'
  password: "password",  // Optional, defaults to MYSQL_PASSWORD
  database: "mydb"       // Required for most tools
}
```

### Option 3: System Environment Variables

You can also set system environment variables:

```bash
export MYSQL_HOST=localhost
export MYSQL_PORT=3306
export MYSQL_USER=root
export MYSQL_PASSWORD=your_password
export MYSQL_DATABASE=default_db
```

## Usage Examples

### List all databases
```
mysql_databases
```

### List tables in a database
```
mysql_tables database: "myapp"
```

### Query data
```
mysql_query database: "myapp", query: "SELECT * FROM users WHERE active = 1", limit: 10
```

### Update with dry run
```
mysql_update database: "myapp", table: "users", set: {status: "inactive"}, where: "last_login < '2023-01-01'", dryRun: true
```

### Delete with safety
```
mysql_delete database: "myapp", table: "logs", where: "created_at < '2023-01-01'", limit: 1000, dryRun: true
```

## Safety Features

1. **Required WHERE clause**: Both UPDATE and DELETE operations require a WHERE clause to prevent accidental operations on all rows
2. **Dry run mode**: Preview changes before executing with `dryRun: true`
3. **Limit support**: Restrict the number of affected rows
4. **Query validation**: The query tool validates and prevents non-SELECT operations
5. **Connection timeout**: 10-second timeout on database connections

## Development

### Project Structure
```
mysql-mcp/
├── src/
│   ├── index.ts           # Main server file
│   ├── types.ts           # TypeScript types
│   ├── database/
│   │   └── connection.ts  # Database connection handling
│   └── tools/            # Individual tool implementations
│       ├── databases.ts
│       ├── tables.ts
│       ├── columns.ts
│       ├── describe.ts
│       ├── query.ts
│       ├── count.ts
│       ├── update.ts
│       └── delete.ts
├── package.json
├── tsconfig.json
└── README.md
```

### Adding New Tools

1. Create a new file in `src/tools/`
2. Implement the `ToolDefinition` interface
3. Export as default
4. The tool will be automatically loaded with the `mysql_` prefix

## License

MIT