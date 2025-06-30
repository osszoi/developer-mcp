import { z } from 'zod';
import { ToolDefinition } from '../types.js';
import { executeGitHubCommand, parseRepository } from '../utils/github.js';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const inputSchema = z.object({
  repository: z.string().describe('Repository in owner/repo format'),
  pr_number: z.number().describe('Pull request number'),
  body: z.string().optional().describe('Approval comment (optional)'),
  event: z.enum(['APPROVE', 'REQUEST_CHANGES', 'COMMENT']).optional().default('APPROVE').describe('Review event type')
});

const githubPRApproveTool: ToolDefinition = {
  name: 'pr_approve',
  description: 'Approve, request changes, or comment on a pull request',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    // Validate repository format
    const repoInfo = parseRepository(params.repository);
    if (!repoInfo) {
      return {
        content: [{
          type: 'text',
          text: 'Invalid repository format. Use: owner/repo'
        }],
        isError: true
      };
    }
    
    // Build the review command
    let command = `gh pr review ${params.pr_number} --repo ${params.repository}`;
    
    // Add the event type
    switch (params.event) {
      case 'APPROVE':
        command += ' --approve';
        break;
      case 'REQUEST_CHANGES':
        command += ' --request-changes';
        break;
      case 'COMMENT':
        command += ' --comment';
        break;
    }
    
    // Handle the review body if provided
    if (params.body) {
      // Create a temporary file to hold the review body
      const tmpFile = join(tmpdir(), `gh-review-${Date.now()}.txt`);
      
      try {
        // Write review body to temporary file
        writeFileSync(tmpFile, params.body, 'utf8');
        
        // Add body file to command
        command += ` --body-file "${tmpFile}"`;
        
        // Execute the review command
        const result = await executeGitHubCommand(command);
        
        // Clean up temp file
        try {
          unlinkSync(tmpFile);
        } catch (e) {
          // Ignore cleanup errors
        }
        
        if (result.exitCode !== 0) {
          return {
            content: [{
              type: 'text',
              text: `Error submitting review: ${result.stderr}`
            }],
            isError: true
          };
        }
      } catch (error) {
        // Clean up temp file on error
        try {
          unlinkSync(tmpFile);
        } catch (e) {
          // Ignore cleanup errors
        }
        
        return {
          content: [{
            type: 'text',
            text: `Error writing review: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    } else {
      // No body, just submit the review
      const result = await executeGitHubCommand(command);
      
      if (result.exitCode !== 0) {
        return {
          content: [{
            type: 'text',
            text: `Error submitting review: ${result.stderr}`
          }],
          isError: true
        };
      }
    }
    
    // Success message based on event type
    let successMessage = '';
    switch (params.event) {
      case 'APPROVE':
        successMessage = `✅ Successfully approved PR #${params.pr_number}`;
        break;
      case 'REQUEST_CHANGES':
        successMessage = `❌ Successfully requested changes on PR #${params.pr_number}`;
        break;
      case 'COMMENT':
        successMessage = `💬 Successfully submitted review comment on PR #${params.pr_number}`;
        break;
    }
    
    if (params.body) {
      successMessage += '\n\nReview comment:\n' + params.body;
    }
    
    return {
      content: [{
        type: 'text',
        text: successMessage
      }]
    };
  }
};

export default githubPRApproveTool;