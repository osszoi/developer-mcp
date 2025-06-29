import { z } from 'zod';
import { ToolDefinition } from '../types.js';
import { createConnection, formatResults } from '../database/connection.js';

const inputSchema = z.object({
  host: z.string().optional().describe('MySQL host (default: localhost)'),
  port: z.number().optional().describe('MySQL port (default: 3306)'),
  user: z.string().optional().describe('MySQL user (default: root)'),
  password: z.string().optional().describe('MySQL password'),
  database: z.string().describe('Database name'),
  query: z.string().describe('SELECT query to execute (only SELECT queries allowed)'),
  limit: z.number().optional().default(100).describe('Maximum rows to return (default: 100)'),
  format: z.enum(['table', 'json', 'csv']).optional().default('table').describe('Output format')
});

const mysqlQueryTool: ToolDefinition = {
  name: 'query',
  description: 'Execute a SELECT query on MySQL database (read-only)',
  category: 'mysql',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    let connection;
    
    try {
      // Validate that the query is a SELECT statement
      const normalizedQuery = params.query.trim().toUpperCase();
      if (!normalizedQuery.startsWith('SELECT') && 
          !normalizedQuery.startsWith('SHOW') && 
          !normalizedQuery.startsWith('DESCRIBE') &&
          !normalizedQuery.startsWith('EXPLAIN')) {
        return {
          content: [
            {
              type: 'text',
              text: 'Error: Only SELECT, SHOW, DESCRIBE, and EXPLAIN queries are allowed'
            }
          ]
        };
      }
      
      // Check for potentially dangerous keywords
      const dangerousKeywords = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER', 'TRUNCATE', 'GRANT', 'REVOKE'];
      for (const keyword of dangerousKeywords) {
        if (normalizedQuery.includes(keyword)) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: Query contains forbidden keyword: ${keyword}`
              }
            ]
          };
        }
      }
      
      connection = await createConnection({
        host: params.host,
        port: params.port,
        user: params.user,
        password: params.password,
        database: params.database
      });
      
      // Add LIMIT if not present and it's a SELECT query
      let query = params.query.trim();
      if (normalizedQuery.startsWith('SELECT') && 
          !normalizedQuery.includes('LIMIT') && 
          params.limit > 0) {
        query += ` LIMIT ${params.limit}`;
      }
      
      const [rows] = await connection.execute(query);
      const results = rows as any[];
      
      if (!Array.isArray(results)) {
        return {
          content: [
            {
              type: 'text',
              text: 'Query executed successfully'
            }
          ]
        };
      }
      
      if (results.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'Query returned no results'
            }
          ]
        };
      }
      
      let output = '';
      
      switch (params.format) {
        case 'json':
          output = JSON.stringify(results, null, 2);
          break;
          
        case 'csv':
          const keys = Object.keys(results[0]);
          output = keys.join(',') + '\n';
          output += results.map(row => 
            keys.map(key => {
              const value = row[key];
              if (value === null) return 'NULL';
              if (typeof value === 'string' && value.includes(',')) {
                return `"${value.replace(/"/g, '""')}"`;
              }
              return value;
            }).join(',')
          ).join('\n');
          break;
          
        default: // table
          output = formatResults(results);
      }
      
      const rowCount = results.length;
      const limitMessage = rowCount === params.limit ? ` (limited to ${params.limit})` : '';
      
      return {
        content: [
          {
            type: 'text',
            text: `Query returned ${rowCount} row${rowCount !== 1 ? 's' : ''}${limitMessage}:\n\n${output}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error executing query: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    } finally {
      if (connection) {
        await connection.end();
      }
    }
  }
};

export default mysqlQueryTool;