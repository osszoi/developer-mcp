import mysql from 'mysql2/promise';
import { ConnectionConfig } from '../types.js';

export async function createConnection(config: ConnectionConfig): Promise<mysql.Connection> {
  const connectionConfig = {
    host: config.host || process.env.MYSQL_HOST || 'localhost',
    port: config.port || parseInt(process.env.MYSQL_PORT || '3306'),
    user: config.user || process.env.MYSQL_USER || 'root',
    password: config.password || process.env.MYSQL_PASSWORD || '',
    database: config.database || process.env.MYSQL_DATABASE,
    connectTimeout: 10000,
    // Ensure read-only by setting appropriate flags
    flags: ['-MULTI_STATEMENTS']
  };

  try {
    const connection = await mysql.createConnection(connectionConfig);
    return connection;
  } catch (error) {
    throw new Error(`Failed to connect to MySQL: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function formatResults(rows: any[]): string {
  if (!rows || rows.length === 0) {
    return 'No results found';
  }

  // For single column results, just list values
  const keys = Object.keys(rows[0]);
  if (keys.length === 1) {
    return rows.map(row => row[keys[0]]).join('\n');
  }

  // For multi-column results, create a table
  const maxLengths: Record<string, number> = {};
  
  // Calculate max lengths
  keys.forEach(key => {
    maxLengths[key] = Math.max(
      key.length,
      ...rows.map(row => String(row[key] || '').length)
    );
  });

  // Create header
  let result = keys.map(key => key.padEnd(maxLengths[key])).join(' | ') + '\n';
  result += keys.map(key => '-'.repeat(maxLengths[key])).join('-|-') + '\n';

  // Add rows
  rows.forEach(row => {
    result += keys.map(key => String(row[key] || 'NULL').padEnd(maxLengths[key])).join(' | ') + '\n';
  });

  return result;
}

export function sanitizeIdentifier(identifier: string): string {
  // Basic sanitization for table/column names to prevent SQL injection
  return identifier.replace(/[^a-zA-Z0-9_]/g, '');
}