import { z } from 'zod';
import { ToolDefinition } from '../types.js';
import { createConnection } from '../database/connection.js';

const inputSchema = z.object({
  host: z.string().optional().describe('MySQL host (default: localhost)'),
  port: z.number().optional().describe('MySQL port (default: 3306)'),
  user: z.string().optional().describe('MySQL user (default: root)'),
  password: z.string().optional().describe('MySQL password'),
  database: z.string().describe('Database name'),
  table: z.string().describe('Table name'),
  set: z.record(z.any()).describe('Column-value pairs to update (e.g., {"status": "active", "count": 5})'),
  where: z.string().describe('WHERE clause (without WHERE keyword) - REQUIRED for safety'),
  limit: z.number().optional().describe('Maximum rows to update'),
  dryRun: z.boolean().optional().default(false).describe('Preview the query without executing')
});

const mysqlUpdateTool: ToolDefinition = {
  name: 'update',
  description: 'Update rows in a MySQL table with safety checks',
  category: 'mysql',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    let connection;
    
    try {
      // Safety check: WHERE clause is required
      if (!params.where || params.where.trim() === '') {
        return {
          content: [
            {
              type: 'text',
              text: 'Error: WHERE clause is required for UPDATE operations to prevent accidental updates of all rows'
            }
          ]
        };
      }
      
      connection = await createConnection({
        host: params.host,
        port: params.port,
        user: params.user,
        password: params.password,
        database: params.database
      });
      
      // Build SET clause
      const setEntries = Object.entries(params.set);
      if (setEntries.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'Error: No columns specified to update'
            }
          ]
        };
      }
      
      const setClause = setEntries
        .map(([col, value]) => {
          if (value === null) {
            return `${col} = NULL`;
          }
          return `${col} = ?`;
        })
        .join(', ');
      
      // Build the UPDATE query
      let query = `UPDATE ${params.table} SET ${setClause} WHERE ${params.where}`;
      
      if (params.limit) {
        query += ` LIMIT ${params.limit}`;
      }
      
      // Get values for prepared statement (excluding NULL values)
      const values = setEntries
        .filter(([_, value]) => value !== null)
        .map(([_, value]) => value);
      
      if (params.dryRun) {
        // Show the query that would be executed
        let previewQuery = query;
        values.forEach((value) => {
          previewQuery = previewQuery.replace('?', typeof value === 'string' ? `'${value}'` : String(value));
        });
        
        return {
          content: [
            {
              type: 'text',
              text: `DRY RUN - Query to be executed:\n\n${previewQuery}\n\nNo changes were made.`
            }
          ]
        };
      }
      
      // Execute the UPDATE
      const [result] = await connection.execute(query, values);
      const updateResult = result as any;
      
      let output = `UPDATE completed successfully\n\n`;
      output += `Rows matched: ${updateResult.affectedRows}\n`;
      output += `Rows changed: ${updateResult.changedRows}\n`;
      
      if (updateResult.info) {
        output += `Info: ${updateResult.info}\n`;
      }
      
      if (updateResult.warningCount > 0) {
        output += `Warnings: ${updateResult.warningCount}\n`;
      }
      
      return {
        content: [
          {
            type: 'text',
            text: output
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error executing update: ${error instanceof Error ? error.message : String(error)}`
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

export default mysqlUpdateTool;