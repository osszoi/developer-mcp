import { z } from 'zod';
import { ToolDefinition } from '../types.js';
import { createConnection } from '../database/connection.js';

const inputSchema = z.object({
  host: z.string().optional().describe('MySQL host (default: localhost)'),
  port: z.number().optional().describe('MySQL port (default: 3306)'),
  user: z.string().optional().describe('MySQL user (default: root)'),
  password: z.string().optional().describe('MySQL password'),
  showSystemDatabases: z.boolean().optional().default(false).describe('Include system databases')
});

const mysqlDatabasesTool: ToolDefinition = {
  name: 'databases',
  description: 'List all MySQL databases',
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
        password: params.password
      });
      
      let query = 'SHOW DATABASES';
      const [rows] = await connection.execute(query);
      
      let databases = rows as any[];
      
      // Filter out system databases if requested
      if (!params.showSystemDatabases) {
        const systemDbs = ['information_schema', 'mysql', 'performance_schema', 'sys'];
        databases = databases.filter(db => 
          !systemDbs.includes(db.Database?.toLowerCase())
        );
      }
      
      const dbList = databases.map(db => db.Database).join('\n');
      const count = databases.length;
      
      return {
        content: [
          {
            type: 'text',
            text: `Found ${count} database${count !== 1 ? 's' : ''}:\n\n${dbList}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error listing databases: ${error instanceof Error ? error.message : String(error)}`
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

export default mysqlDatabasesTool;