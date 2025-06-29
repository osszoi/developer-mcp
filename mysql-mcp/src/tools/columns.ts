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
  showDetails: z.boolean().optional().default(true).describe('Show column details (type, null, key, etc.)')
});

const mysqlColumnsTool: ToolDefinition = {
  name: 'columns',
  description: 'List all columns of a MySQL table',
  category: 'mysql',
  version: '1.0.0',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    let connection;
    
    try {
      connection = await createConnection({
        host: params.host,
        port: params.port,
        user: params.user,
        password: params.password,
        database: params.database
      });
      
      // Use INFORMATION_SCHEMA for detailed column information
      const query = `
        SELECT 
          COLUMN_NAME,
          COLUMN_TYPE,
          IS_NULLABLE,
          COLUMN_KEY,
          COLUMN_DEFAULT,
          EXTRA,
          COLUMN_COMMENT
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION
      `;
      
      const [rows] = await connection.execute(query, [params.database, params.table]);
      const columns = rows as any[];
      
      if (columns.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No columns found for table '${params.table}' in database '${params.database}'`
            }
          ]
        };
      }
      
      let result = `Table: ${params.database}.${params.table}\n`;
      result += `Columns: ${columns.length}\n\n`;
      
      if (params.showDetails) {
        // Detailed view
        columns.forEach((col, index) => {
          result += `${index + 1}. ${col.COLUMN_NAME}\n`;
          result += `   Type: ${col.COLUMN_TYPE}\n`;
          result += `   Nullable: ${col.IS_NULLABLE}\n`;
          if (col.COLUMN_KEY) result += `   Key: ${col.COLUMN_KEY}\n`;
          if (col.COLUMN_DEFAULT !== null) result += `   Default: ${col.COLUMN_DEFAULT}\n`;
          if (col.EXTRA) result += `   Extra: ${col.EXTRA}\n`;
          if (col.COLUMN_COMMENT) result += `   Comment: ${col.COLUMN_COMMENT}\n`;
          result += '\n';
        });
      } else {
        // Simple list
        result += columns.map(col => col.COLUMN_NAME).join('\n');
      }
      
      return {
        content: [
          {
            type: 'text',
            text: result.trim()
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error listing columns: ${error instanceof Error ? error.message : String(error)}`
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

export default mysqlColumnsTool;