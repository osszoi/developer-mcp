import { z } from 'zod';
import { ToolDefinition } from '../types.js';
import { executeGitHubCommand, parseRepository } from '../utils/github.js';

const inputSchema = z.object({
  repository: z.string().describe('Repository in owner/repo format'),
  title: z.string().describe('PR title'),
  body: z.string().optional().describe('PR description/body'),
  base: z.string().optional().default('main').describe('Base branch (target branch)'),
  head: z.string().describe('Head branch (source branch with changes)'),
  draft: z.boolean().optional().default(false).describe('Create as draft PR'),
  assignees: z.array(z.string()).optional().describe('Usernames to assign'),
  labels: z.array(z.string()).optional().describe('Labels to add'),
  milestone: z.string().optional().describe('Milestone to assign'),
  reviewers: z.array(z.string()).optional().describe('Reviewers to request')
});

const githubPRCreateTool: ToolDefinition = {
  name: 'pr_create',
  description: 'Create a new pull request',
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
    
    // Build the command
    let command = `gh pr create --repo ${params.repository}`;
    
    // Add required parameters
    command += ` --title "${params.title.replace(/"/g, '\\"')}"`;
    command += ` --base ${params.base}`;
    command += ` --head ${params.head}`;
    
    // Add body if provided
    if (params.body) {
      // Use echo to handle multi-line body
      command = `echo "${params.body.replace(/"/g, '\\"')}" | ${command} --body-file -`;
    } else {
      command += ' --body ""';
    }
    
    // Add optional flags
    if (params.draft) {
      command += ' --draft';
    }
    
    if (params.assignees && params.assignees.length > 0) {
      command += ` --assignee ${params.assignees.join(',')}`;
    }
    
    if (params.labels && params.labels.length > 0) {
      command += ` --label ${params.labels.join(',')}`;
    }
    
    if (params.milestone) {
      command += ` --milestone "${params.milestone}"`;
    }
    
    if (params.reviewers && params.reviewers.length > 0) {
      command += ` --reviewer ${params.reviewers.join(',')}`;
    }
    
    const result = await executeGitHubCommand(command);
    
    if (result.exitCode !== 0) {
      // Check for common errors
      if (result.stderr.includes('already exists')) {
        return {
          content: [{
            type: 'text',
            text: `Error: A pull request already exists for ${params.head}`
          }],
          isError: true
        };
      }
      
      if (result.stderr.includes('not found')) {
        return {
          content: [{
            type: 'text',
            text: `Error: Branch '${params.head}' not found. Make sure the branch exists and has been pushed.`
          }],
          isError: true
        };
      }
      
      return {
        content: [{
          type: 'text',
          text: `Error creating PR: ${result.stderr}`
        }],
        isError: true
      };
    }
    
    // Extract PR URL from output
    const prUrl = result.stdout.trim();
    
    // Get PR details to show full information
    const prNumber = prUrl.match(/\/pull\/(\d+)$/)?.[1];
    if (prNumber) {
      const detailsCommand = `gh pr view ${prNumber} --repo ${params.repository} --json number,title,state,url,author,createdAt,isDraft`;
      const detailsResult = await executeGitHubCommand(detailsCommand);
      
      if (detailsResult.exitCode === 0) {
        try {
          const pr = JSON.parse(detailsResult.stdout);
          
          let output = `✅ Pull Request created successfully!\n\n`;
          output += `PR #${pr.number}: ${pr.title}\n`;
          output += `State: ${pr.isDraft ? 'Draft' : 'Open'}\n`;
          output += `Author: @${pr.author.login}\n`;
          output += `Branch: ${params.head} → ${params.base}\n`;
          
          if (params.assignees && params.assignees.length > 0) {
            output += `Assignees: ${params.assignees.map(a => `@${a}`).join(', ')}\n`;
          }
          
          if (params.labels && params.labels.length > 0) {
            output += `Labels: ${params.labels.join(', ')}\n`;
          }
          
          if (params.reviewers && params.reviewers.length > 0) {
            output += `Reviewers requested: ${params.reviewers.map(r => `@${r}`).join(', ')}\n`;
          }
          
          output += `\nURL: ${pr.url}`;
          
          return {
            content: [{
              type: 'text',
              text: output
            }]
          };
        } catch (e) {
          // Fall back to simple output
        }
      }
    }
    
    // Simple output if we couldn't get details
    return {
      content: [{
        type: 'text',
        text: `✅ Pull Request created successfully!\n\n${prUrl}`
      }]
    };
  }
};

export default githubPRCreateTool;