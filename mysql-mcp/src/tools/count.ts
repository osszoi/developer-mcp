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
  where: z.string().optional().describe('WHERE clause (without WHERE keyword)'),
  groupBy: z.string().optional().describe('GROUP BY column(s)')
});

const mysqlCountTool: ToolDefinition = {
  name: 'count',
  description: 'Count rows in a MySQL table with optional conditions',
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
      
      // Build the count query
      let query = `SELECT COUNT(*) as count`;
      
      // Add GROUP BY column to select if specified
      if (params.groupBy) {
        query = `SELECT ${params.groupBy}, COUNT(*) as count`;
      }
      
      query += ` FROM ${params.table}`;
      
      // Add WHERE clause if specified
      if (params.where) {
        // Basic validation to prevent injection
        const whereClause = params.where.trim();
        const dangerousKeywords = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'CREATE', 'ALTER', 'TRUNCATE'];
        
        for (const keyword of dangerousKeywords) {
          if (whereClause.toUpperCase().includes(keyword)) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Error: WHERE clause contains forbidden keyword: ${keyword}`
                }
              ]
            };
          }
        }
        
        query += ` WHERE ${whereClause}`;
      }
      
      // Add GROUP BY if specified
      if (params.groupBy) {
        query += ` GROUP BY ${params.groupBy}`;
        query += ` ORDER BY count DESC`;
      }
      
      const [rows] = await connection.execute(query);
      const results = rows as any[];
      
      let output = `Table: ${params.database}.${params.table}\n`;
      
      if (params.where) {
        output += `Condition: WHERE ${params.where}\n`;
      }
      
      output += '\n';
      
      if (params.groupBy) {
        // Grouped results
        output += `Count by ${params.groupBy}:\n\n`;
        
        if (results.length === 0) {
          output += 'No rows found';
        } else {
          const groupByKey = params.groupBy;
          const maxGroupLength = Math.max(...results.map(r => String(r[groupByKey]).length));
          const maxCountLength = Math.max(...results.map(r => String(r.count).length));
          
          results.forEach(row => {
            const group = String(row[groupByKey]).padEnd(maxGroupLength);
            const count = String(row.count).padStart(maxCountLength);
            output += `${group} : ${count}\n`;
          });
          
          const total = results.reduce((sum, row) => sum + parseInt(row.count), 0);
          output += `\nTotal: ${total} rows`;
        }
      } else {
        // Simple count
        const count = results[0]?.count || 0;
        output += `Total rows: ${count}`;
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
            text: `Error counting rows: ${error instanceof Error ? error.message : String(error)}`
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

export default mysqlCountTool;