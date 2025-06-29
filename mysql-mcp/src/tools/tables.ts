import { z } from 'zod';
import { ToolDefinition } from '../types.js';
import { createConnection } from '../database/connection.js';

const inputSchema = z.object({
  host: z.string().optional().describe('MySQL host (default: localhost)'),
  port: z.number().optional().describe('MySQL port (default: 3306)'),
  user: z.string().optional().describe('MySQL user (default: root)'),
  password: z.string().optional().describe('MySQL password'),
  database: z.string().describe('Database name'),
  showViews: z.boolean().optional().default(true).describe('Include views in the list')
});

const mysqlTablesTool: ToolDefinition = {
  name: 'tables',
  description: 'List all tables in a MySQL database',
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
      
      const query = params.showViews 
        ? 'SHOW FULL TABLES'
        : "SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'";
        
      const [rows] = await connection.execute(query);
      
      const tables = rows as any[];
      const tableList: string[] = [];
      let tableCount = 0;
      let viewCount = 0;
      
      tables.forEach(row => {
        const tableName = row[Object.keys(row)[0]];
        const tableType = row[Object.keys(row)[1]];
        
        if (tableType === 'VIEW') {
          tableList.push(`${tableName} (VIEW)`);
          viewCount++;
        } else {
          tableList.push(tableName);
          tableCount++;
        }
      });
      
      let summary = `Database: ${params.database}\n`;
      summary += `Found ${tableCount} table${tableCount !== 1 ? 's' : ''}`;
      if (params.showViews && viewCount > 0) {
        summary += ` and ${viewCount} view${viewCount !== 1 ? 's' : ''}`;
      }
      
      return {
        content: [
          {
            type: 'text',
            text: `${summary}:\n\n${tableList.join('\n')}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error listing tables: ${error instanceof Error ? error.message : String(error)}`
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

export default mysqlTablesTool;