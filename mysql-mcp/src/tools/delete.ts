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
  where: z.string().describe('WHERE clause (without WHERE keyword) - REQUIRED for safety'),
  limit: z.number().optional().describe('Maximum rows to delete'),
  dryRun: z.boolean().optional().default(false).describe('Preview affected rows without deleting')
});

const mysqlDeleteTool: ToolDefinition = {
  name: 'delete',
  description: 'Delete rows from a MySQL table with safety checks',
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
              text: 'Error: WHERE clause is required for DELETE operations to prevent accidental deletion of all rows'
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
      
      if (params.dryRun) {
        // First, count how many rows would be affected
        let countQuery = `SELECT COUNT(*) as count FROM ${params.table} WHERE ${params.where}`;
        if (params.limit) {
          countQuery = `SELECT COUNT(*) as count FROM (SELECT 1 FROM ${params.table} WHERE ${params.where} LIMIT ${params.limit}) as limited`;
        }
        
        const [countResult] = await connection.execute(countQuery);
        const count = (countResult as any[])[0].count;
        
        // Show a preview of rows that would be deleted
        let previewQuery = `SELECT * FROM ${params.table} WHERE ${params.where}`;
        if (params.limit) {
          previewQuery += ` LIMIT ${Math.min(params.limit, 10)}`; // Show max 10 rows in preview
        } else {
          previewQuery += ' LIMIT 10'; // Show max 10 rows in preview
        }
        
        const [previewRows] = await connection.execute(previewQuery);
        const rows = previewRows as any[];
        
        let output = `DRY RUN - Would delete ${count} row${count !== 1 ? 's' : ''}\n\n`;
        
        if (rows.length > 0) {
          output += `Preview of rows to be deleted (showing up to 10):\n\n`;
          
          // Format the preview rows
          const keys = Object.keys(rows[0]);
          const maxLengths: Record<string, number> = {};
          
          keys.forEach(key => {
            maxLengths[key] = Math.max(
              key.length,
              ...rows.map(row => String(row[key] ?? 'NULL').length)
            );
          });
          
          // Header
          output += keys.map(key => key.padEnd(maxLengths[key])).join(' | ') + '\n';
          output += keys.map(key => '-'.repeat(maxLengths[key])).join('-|-') + '\n';
          
          // Rows
          rows.forEach(row => {
            output += keys.map(key => {
              const value = row[key];
              const strValue = value === null ? 'NULL' : String(value);
              return strValue.padEnd(maxLengths[key]);
            }).join(' | ') + '\n';
          });
          
          if (count > 10) {
            output += `\n... and ${count - 10} more row${count - 10 !== 1 ? 's' : ''}`;
          }
        }
        
        output += '\n\nNo changes were made.';
        
        return {
          content: [
            {
              type: 'text',
              text: output
            }
          ]
        };
      }
      
      // Build and execute the DELETE query
      let query = `DELETE FROM ${params.table} WHERE ${params.where}`;
      
      if (params.limit) {
        query += ` LIMIT ${params.limit}`;
      }
      
      const [result] = await connection.execute(query);
      const deleteResult = result as any;
      
      let output = `DELETE completed successfully\n\n`;
      output += `Rows deleted: ${deleteResult.affectedRows}\n`;
      
      if (deleteResult.warningCount > 0) {
        output += `Warnings: ${deleteResult.warningCount}\n`;
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
            text: `Error executing delete: ${error instanceof Error ? error.message : String(error)}`
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

export default mysqlDeleteTool;