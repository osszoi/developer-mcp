import { z } from 'zod';
import { ToolDefinition } from '../types.js';
import { executeGitHubCommand, parseRepository } from '../utils/github.js';

const inputSchema = z.object({
  repository: z.string().optional().describe('Repository in owner/repo format. If not specified, lists issues from all repos'),
  state: z.enum(['open', 'closed', 'all']).optional().default('open').describe('Filter by issue state'),
  author: z.string().optional().describe('Filter by issue author username'),
  assignee: z.string().optional().describe('Filter by assignee (use @me for yourself)'),
  label: z.string().optional().describe('Filter by label'),
  milestone: z.string().optional().describe('Filter by milestone'),
  sort: z.enum(['created', 'updated', 'comments']).optional().default('updated').describe('Sort issues by'),
  limit: z.number().optional().default(30).describe('Maximum number of issues to return')
});

const githubIssuesListTool: ToolDefinition = {
  name: 'issues_list',
  description: 'List issues from a repository or all your repositories',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    let allIssues: any[] = [];
    
    if (params.repository) {
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
      
      // Build command for specific repo
      let command = `gh issue list --repo ${params.repository}`;
      
      // Add filters
      command += ` --state ${params.state}`;
      
      if (params.author) command += ` --author ${params.author}`;
      if (params.assignee) command += ` --assignee ${params.assignee}`;
      if (params.label) command += ` --label "${params.label}"`;
      if (params.milestone) command += ` --milestone "${params.milestone}"`;
      
      command += ` --limit ${params.limit}`;
      command += ' --json number,title,author,state,createdAt,updatedAt,url,labels,assignees,milestone,comments';
      
      const result = await executeGitHubCommand(command);
      
      if (result.exitCode !== 0) {
        return {
          content: [{
            type: 'text',
            text: `Error listing issues: ${result.stderr}`
          }],
          isError: true
        };
      }
      
      try {
        const issues = JSON.parse(result.stdout);
        allIssues = issues.map((issue: any) => ({ ...issue, repository: params.repository }));
      } catch (e) {
        return {
          content: [{
            type: 'text',
            text: 'Error parsing issue data'
          }],
          isError: true
        };
      }
    } else {
      // List issues from all repos
      const searchQuery = [`is:issue`];
      
      if (params.state !== 'all') {
        searchQuery.push(`is:${params.state}`);
      }
      
      if (params.author) {
        searchQuery.push(`author:${params.author}`);
      } else if (params.assignee) {
        searchQuery.push(`assignee:${params.assignee}`);
      } else {
        searchQuery.push('involves:@me'); // Default to issues involving the user
      }
      
      if (params.label) searchQuery.push(`label:"${params.label}"`);
      
      const sortMap: Record<string, string> = {
        'created': 'created-desc',
        'updated': 'updated-desc',
        'comments': 'comments-desc'
      };
      
      let command = `gh search issues "${searchQuery.join(' ')}" --limit ${params.limit} --sort ${sortMap[params.sort || 'updated']}`;
      command += ' --json repository,number,title,author,state,createdAt,updatedAt,url,labels';
      
      const result = await executeGitHubCommand(command);
      
      if (result.exitCode !== 0) {
        return {
          content: [{
            type: 'text',
            text: `Error searching issues: ${result.stderr}`
          }],
          isError: true
        };
      }
      
      try {
        allIssues = JSON.parse(result.stdout);
      } catch (e) {
        return {
          content: [{
            type: 'text',
            text: 'Error parsing issue data'
          }],
          isError: true
        };
      }
    }
    
    if (allIssues.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `No ${params.state} issues found${params.repository ? ` in ${params.repository}` : ''}`
        }]
      };
    }
    
    // Format output
    let output = '';
    
    if (params.repository) {
      output += `Issues in ${params.repository} (${params.state}):\n`;
      output += '='.repeat(60) + '\n\n';
    } else {
      // Group by repository
      const issuesByRepo: Record<string, any[]> = {};
      
      allIssues.forEach(issue => {
        const repo = issue.repository?.nameWithOwner || issue.repository || 'unknown';
        if (!issuesByRepo[repo]) {
          issuesByRepo[repo] = [];
        }
        issuesByRepo[repo].push(issue);
      });
      
      output += `Found ${allIssues.length} ${params.state} issues across ${Object.keys(issuesByRepo).length} repositories:\n\n`;
      
      Object.entries(issuesByRepo).forEach(([repo, issues]) => {
        output += `### ${repo}\n`;
        output += '-'.repeat(40) + '\n';
        issues.forEach(issue => {
          output += formatIssue(issue, false);
        });
        output += '\n';
      });
      
      return {
        content: [{
          type: 'text',
          text: output.trim()
        }]
      };
    }
    
    // Single repo formatting
    allIssues.forEach(issue => {
      output += formatIssue(issue, true);
    });
    
    return {
      content: [{
        type: 'text',
        text: output.trim()
      }]
    };
  }
};

function formatIssue(issue: any, detailed: boolean): string {
  let output = '';
  
  const stateEmoji = issue.state === 'OPEN' ? '🟢' : '🔴';
  output += `${stateEmoji} #${issue.number}: ${issue.title}\n`;
  
  if (detailed) {
    output += `   Author: @${issue.author.login}\n`;
    
    if (issue.labels && issue.labels.length > 0) {
      const labelNames = issue.labels.map((l: any) => l.name).join(', ');
      output += `   Labels: ${labelNames}\n`;
    }
    
    if (issue.assignees && issue.assignees.length > 0) {
      const assigneeNames = issue.assignees.map((a: any) => `@${a.login}`).join(', ');
      output += `   Assignees: ${assigneeNames}\n`;
    }
    
    if (issue.milestone) {
      output += `   Milestone: ${issue.milestone.title}\n`;
    }
    
    if (issue.comments && issue.comments > 0) {
      output += `   Comments: ${issue.comments}\n`;
    }
    
    const created = new Date(issue.createdAt);
    const updated = new Date(issue.updatedAt);
    const daysOld = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));
    const daysUpdated = Math.floor((Date.now() - updated.getTime()) / (1000 * 60 * 60 * 24));
    
    output += `   Created: ${daysOld} days ago`;
    if (daysUpdated < daysOld) {
      output += ` | Updated: ${daysUpdated} days ago`;
    }
    output += '\n';
  } else {
    output += `   By @${issue.author.login} • ${issue.state.toLowerCase()}`;
    const daysOld = Math.floor((Date.now() - new Date(issue.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
    output += ` • ${daysOld}d ago\n`;
  }
  
  output += `   ${issue.url}\n\n`;
  
  return output;
}

export default githubIssuesListTool;