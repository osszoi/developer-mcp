#!/usr/bin/env node

import { spawn } from 'child_process';

const server = spawn('node', ['build/index.js']);

let buffer = '';

server.stdout.on('data', (data) => {
  buffer += data.toString();
  
  // Wait for server to be ready
  if (buffer.includes('Server started')) {
    // Send initialization request
    const initRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'test-client',
          version: '1.0.0'
        }
      }
    };
    
    server.stdin.write(JSON.stringify(initRequest) + '\n');
    
    // After init, send tool list request
    setTimeout(() => {
      const listRequest = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {}
      };
      
      server.stdin.write(JSON.stringify(listRequest) + '\n');
      
      // Call hello_world tool
      setTimeout(() => {
        const callRequest = {
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: {
            name: 'examples_test_hello_world',
            arguments: {
              name: 'Developer',
              language: 'pt'
            }
          }
        };
        
        server.stdin.write(JSON.stringify(callRequest) + '\n');
        
        // Close after a delay
        setTimeout(() => {
          server.kill();
        }, 1000);
      }, 500);
    }, 500);
  }
});

server.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line.trim());
  lines.forEach(line => {
    try {
      const json = JSON.parse(line);
      if (json.id === 3) { // Response to our hello_world call
        console.log('Hello World Response:', JSON.stringify(json, null, 2));
      }
    } catch (e) {
      // Not JSON, probably server logs
    }
  });
});

server.stderr.on('data', (data) => {
  console.error('Server error:', data.toString());
});

server.on('close', (code) => {
  console.log(`Server exited with code ${code}`);
});