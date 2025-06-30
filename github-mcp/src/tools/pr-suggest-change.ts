import { z } from 'zod';
import { ToolDefinition } from '../types.js';
import { executeGitHubCommand, parseRepository } from '../utils/github.js';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const inputSchema = z.object({
  repository: z.string().describe('Repository in owner/repo format'),
  pr_number: z.number().describe('Pull request number'),
  path: z.string().describe('File path where the change should be made'),
  line: z.number().describe('Line number where the suggestion starts'),
  end_line: z.number().optional().describe('End line for multi-line suggestions (defaults to line)'),
  original_code: z.string().describe('The original code that should be replaced'),
  suggested_code: z.string().describe('The suggested replacement code'),
  comment: z.string().optional().describe('Explanation for the suggested change'),
  commit_id: z.string().optional().describe('Specific commit SHA (defaults to latest in PR)')
});

const githubPRSuggestChangeTool: ToolDefinition = {
  name: 'pr_suggest_change',
  description: 'Suggest a code change on a specific line or range in a pull request',
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
    
    // Get the latest commit SHA if not provided
    let commitSha = params.commit_id;
    if (!commitSha) {
      // First get the PR info with commits to get the latest commit SHA
      const prCommand = `gh pr view ${params.pr_number} --repo ${params.repository} --json commits`;
      const prResult = await executeGitHubCommand(prCommand);
      
      if (prResult.exitCode !== 0) {
        return {
          content: [{
            type: 'text',
            text: `Error getting PR information: ${prResult.stderr}`
          }],
          isError: true
        };
      }
      
      try {
        const prData = JSON.parse(prResult.stdout);
        // Get the latest commit SHA from the commits array
        if (prData.commits && prData.commits.length > 0) {
          commitSha = prData.commits[prData.commits.length - 1].oid;
        } else {
          return {
            content: [{
              type: 'text',
              text: 'Error: Could not find any commits in the PR'
            }],
            isError: true
          };
        }
      } catch (e) {
        return {
          content: [{
            type: 'text',
            text: 'Error parsing PR data'
          }],
          isError: true
        };
      }
    }
    
    // Build the review comment body with suggestion
    let commentBody = '';
    
    // Add explanation if provided
    if (params.comment) {
      commentBody += params.comment + '\n\n';
    }
    
    // Add the suggestion block
    commentBody += '```suggestion\n';
    commentBody += params.suggested_code;
    // Ensure the suggestion ends with a newline if it doesn't have one
    if (!params.suggested_code.endsWith('\n')) {
      commentBody += '\n';
    }
    commentBody += '```';
    
    // Create a temporary file for the JSON payload
    const tmpFile = join(tmpdir(), `gh-suggestion-${Date.now()}.json`);
    
    try {
      // Build the API payload
      const payload: any = {
        body: commentBody,
        path: params.path,
        commit_id: commitSha,
        side: 'RIGHT' // Suggestions are always on the RIGHT side (new code)
      };
      
      // Handle single line vs multi-line suggestions
      if (params.end_line && params.end_line > params.line) {
        // Multi-line suggestion
        payload.start_line = params.line;
        payload.start_side = 'RIGHT';
        payload.line = params.end_line;
      } else {
        // Single line suggestion
        payload.line = params.line;
      }
      
      writeFileSync(tmpFile, JSON.stringify(payload), 'utf8');
      
      // Post the suggestion using GitHub API
      const apiCommand = `gh api repos/${params.repository}/pulls/${params.pr_number}/comments --method POST --input "${tmpFile}"`;
      const result = await executeGitHubCommand(apiCommand);
      
      // Clean up temp file
      try {
        unlinkSync(tmpFile);
      } catch (e) {
        // Ignore cleanup errors
      }
      
      if (result.exitCode !== 0) {
        // Check if it's a validation error
        if (result.stderr.includes('pull_request_review_thread.line')) {
          return {
            content: [{
              type: 'text',
              text: `Error: The specified line ${params.line} may not be part of the diff. Make sure the line number corresponds to a changed line in the PR.`
            }],
            isError: true
          };
        }
        
        return {
          content: [{
            type: 'text',
            text: `Error posting suggestion: ${result.stderr}`
          }],
          isError: true
        };
      }
      
      // Parse the response to get the comment URL
      let commentUrl = '';
      try {
        const response = JSON.parse(result.stdout);
        commentUrl = response.html_url || '';
      } catch (e) {
        // Ignore parse errors
      }
      
      let successMessage = `✅ Successfully posted code suggestion on ${params.path}`;
      if (params.end_line && params.end_line > params.line) {
        successMessage += ` (lines ${params.line}-${params.end_line})`;
      } else {
        successMessage += ` (line ${params.line})`;
      }
      successMessage += ` in PR #${params.pr_number}`;
      
      if (commentUrl) {
        successMessage += `\n\nView suggestion: ${commentUrl}`;
      }
      
      successMessage += '\n\nSuggested change:\n';
      successMessage += '```\n';
      successMessage += params.original_code;
      successMessage += '\n→\n';
      successMessage += params.suggested_code;
      successMessage += '\n```';
      
      return {
        content: [{
          type: 'text',
          text: successMessage
        }]
      };
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
          text: `Error posting suggestion: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
};

export default githubPRSuggestChangeTool;