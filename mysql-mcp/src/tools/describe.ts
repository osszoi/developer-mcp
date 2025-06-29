import { z } from 'zod';
import { ToolDefinition } from '../types.js';
import { createConnection, formatResults } from '../database/connection.js';

const inputSchema = z.object({
  host: z.string().optional().describe('MySQL host (default: localhost)'),
  port: z.number().optional().describe('MySQL port (default: 3306)'),
  user: z.string().optional().describe('MySQL user (default: root)'),
  password: z.string().optional().describe('MySQL password'),
  database: z.string().describe('Database name'),
  table: z.string().describe('Table name'),
  showIndexes: z.boolean().optional().default(true).describe('Show table indexes'),
  showCreateTable: z.boolean().optional().default(false).describe('Show CREATE TABLE statement')
});

const mysqlDescribeTool: ToolDefinition = {
  name: 'describe',
  description: 'Show detailed structure of a MySQL table',
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
      
      let result = `Table: ${params.database}.${params.table}\n\n`;
      
      // Get table structure
      const [columns] = await connection.execute(`DESCRIBE ${params.table}`);
      result += 'STRUCTURE:\n';
      result += formatResults(columns as any[]);
      
      // Get indexes if requested
      if (params.showIndexes) {
        const [indexes] = await connection.execute(`SHOW INDEXES FROM ${params.table}`);
        const indexRows = indexes as any[];
        
        if (indexRows.length > 0) {
          result += '\n\nINDEXES:\n';
          
          // Group indexes by key name
          const groupedIndexes: Record<string, any[]> = {};
          indexRows.forEach(idx => {
            if (!groupedIndexes[idx.Key_name]) {
              groupedIndexes[idx.Key_name] = [];
            }
            groupedIndexes[idx.Key_name].push(idx);
          });
          
          Object.entries(groupedIndexes).forEach(([keyName, indices]) => {
            const first = indices[0];
            const unique = first.Non_unique === 0 ? 'UNIQUE' : 'INDEX';
            const columns = indices
              .sort((a, b) => a.Seq_in_index - b.Seq_in_index)
              .map(idx => idx.Column_name)
              .join(', ');
            
            result += `- ${keyName} (${unique}): ${columns}\n`;
          });
        }
      }
      
      // Get CREATE TABLE statement if requested
      if (params.showCreateTable) {
        const [createResult] = await connection.execute(`SHOW CREATE TABLE ${params.table}`);
        const createRow = (createResult as any[])[0];
        
        if (createRow && createRow['Create Table']) {
          result += '\n\nCREATE TABLE STATEMENT:\n';
          result += createRow['Create Table'];
        }
      }
      
      // Get table status
      const [status] = await connection.execute(
        `SELECT TABLE_ROWS, AVG_ROW_LENGTH, DATA_LENGTH, INDEX_LENGTH, AUTO_INCREMENT
         FROM INFORMATION_SCHEMA.TABLES
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
        [params.database, params.table]
      );
      
      const statusRow = (status as any[])[0];
      if (statusRow) {
        result += '\n\nTABLE STATISTICS:\n';
        result += `- Approximate rows: ${statusRow.TABLE_ROWS || 0}\n`;
        result += `- Avg row length: ${statusRow.AVG_ROW_LENGTH || 0} bytes\n`;
        result += `- Data size: ${Math.round((statusRow.DATA_LENGTH || 0) / 1024 / 1024 * 100) / 100} MB\n`;
        result += `- Index size: ${Math.round((statusRow.INDEX_LENGTH || 0) / 1024 / 1024 * 100) / 100} MB\n`;
        if (statusRow.AUTO_INCREMENT) {
          result += `- Next AUTO_INCREMENT: ${statusRow.AUTO_INCREMENT}\n`;
        }
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
            text: `Error describing table: ${error instanceof Error ? error.message : String(error)}`
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

export default mysqlDescribeTool;