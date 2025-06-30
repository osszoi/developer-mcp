import { z } from 'zod';
import { ToolDefinition } from '../types.js';
import { executeGitHubCommand, parseRepository } from '../utils/github.js';

const inputSchema = z.object({
  repository: z.string().optional().describe('Repository in owner/repo format. If not specified, lists PRs from all repos'),
  state: z.enum(['open', 'closed', 'merged', 'all']).optional().default('open').describe('Filter by PR state'),
  author: z.string().optional().describe('Filter by PR author username'),
  assignee: z.string().optional().describe('Filter by assignee'),
  label: z.string().optional().describe('Filter by label'),
  base: z.string().optional().describe('Filter by base branch'),
  head: z.string().optional().describe('Filter by head branch'),
  sort: z.enum(['created', 'updated', 'comments']).optional().default('updated').describe('Sort PRs by'),
  limit: z.number().optional().default(30).describe('Maximum number of PRs to return')
});

const githubPRListTool: ToolDefinition = {
  name: 'pr_list',
  description: 'List pull requests from a repository or all your repositories',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    let allPRs: any[] = [];
    
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
      let command = `gh pr list --repo ${params.repository}`;
      
      // Add state filter
      if (params.state === 'all') {
        command += ' --state all';
      } else if (params.state === 'merged') {
        command += ' --state closed --search "is:merged"';
      } else {
        command += ` --state ${params.state}`;
      }
      
      // Add other filters
      if (params.author) command += ` --author ${params.author}`;
      if (params.assignee) command += ` --assignee ${params.assignee}`;
      if (params.label) command += ` --label "${params.label}"`;
      if (params.base) command += ` --base ${params.base}`;
      if (params.head) command += ` --head ${params.head}`;
      
      command += ` --limit ${params.limit}`;
      command += ' --json number,title,author,state,isDraft,createdAt,updatedAt,url,headRefName,baseRefName,labels,assignees,reviewDecision,statusCheckRollup';
      
      const result = await executeGitHubCommand(command);
      
      if (result.exitCode !== 0) {
        return {
          content: [{
            type: 'text',
            text: `Error listing PRs: ${result.stderr}`
          }],
          isError: true
        };
      }
      
      try {
        const prs = JSON.parse(result.stdout);
        allPRs = prs.map((pr: any) => ({ ...pr, repository: params.repository }));
      } catch (e) {
        return {
          content: [{
            type: 'text',
            text: 'Error parsing PR data'
          }],
          isError: true
        };
      }
    } else {
      // List PRs from all repos
      const searchQuery = [`is:pr`];
      
      if (params.state === 'open') {
        searchQuery.push('is:open');
      } else if (params.state === 'closed') {
        searchQuery.push('is:closed');
      } else if (params.state === 'merged') {
        searchQuery.push('is:merged');
      }
      
      if (params.author) searchQuery.push(`author:${params.author}`);
      else searchQuery.push('involves:@me'); // Default to PRs involving the user
      
      const sortMap: Record<string, string> = {
        'created': 'created-desc',
        'updated': 'updated-desc',
        'comments': 'comments-desc'
      };
      
      let command = `gh search prs "${searchQuery.join(' ')}" --limit ${params.limit} --sort ${sortMap[params.sort || 'updated']}`;
      command += ' --json repository,number,title,author,state,isDraft,createdAt,updatedAt,url,labels';
      
      const result = await executeGitHubCommand(command);
      
      if (result.exitCode !== 0) {
        return {
          content: [{
            type: 'text',
            text: `Error searching PRs: ${result.stderr}`
          }],
          isError: true
        };
      }
      
      try {
        allPRs = JSON.parse(result.stdout);
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
    
    if (allPRs.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `No ${params.state} pull requests found${params.repository ? ` in ${params.repository}` : ''}`
        }]
      };
    }
    
    // Format output
    let output = '';
    
    if (params.repository) {
      output += `Pull Requests in ${params.repository} (${params.state}):\n`;
      output += '='.repeat(60) + '\n\n';
    } else {
      // Group by repository
      const prsByRepo: Record<string, any[]> = {};
      
      allPRs.forEach(pr => {
        const repo = pr.repository?.nameWithOwner || pr.repository || 'unknown';
        if (!prsByRepo[repo]) {
          prsByRepo[repo] = [];
        }
        prsByRepo[repo].push(pr);
      });
      
      output += `Found ${allPRs.length} ${params.state} pull requests across ${Object.keys(prsByRepo).length} repositories:\n\n`;
      
      Object.entries(prsByRepo).forEach(([repo, prs]) => {
        output += `### ${repo}\n`;
        output += '-'.repeat(40) + '\n';
        prs.forEach(pr => {
          output += formatPR(pr, false);
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
    allPRs.forEach(pr => {
      output += formatPR(pr, true);
    });
    
    return {
      content: [{
        type: 'text',
        text: output.trim()
      }]
    };
  }
};

function formatPR(pr: any, detailed: boolean): string {
  let output = '';
  
  const stateEmoji = pr.isDraft ? '📝' : pr.state === 'OPEN' ? '🟢' : pr.state === 'MERGED' ? '🟣' : '🔴';
  output += `${stateEmoji} #${pr.number}: ${pr.title}\n`;
  
  if (detailed) {
    output += `   Author: @${pr.author.login}\n`;
    output += `   Branch: ${pr.headRefName || 'N/A'} → ${pr.baseRefName || 'main'}\n`;
    
    if (pr.labels && pr.labels.length > 0) {
      const labelNames = pr.labels.map((l: any) => l.name).join(', ');
      output += `   Labels: ${labelNames}\n`;
    }
    
    if (pr.assignees && pr.assignees.length > 0) {
      const assigneeNames = pr.assignees.map((a: any) => `@${a.login}`).join(', ');
      output += `   Assignees: ${assigneeNames}\n`;
    }
    
    if (pr.reviewDecision) {
      output += `   Review: ${pr.reviewDecision}\n`;
    }
    
    if (pr.statusCheckRollup) {
      const status = pr.statusCheckRollup.state || pr.statusCheckRollup;
      output += `   Checks: ${status}\n`;
    }
    
    const created = new Date(pr.createdAt);
    const updated = new Date(pr.updatedAt);
    const daysOld = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));
    const daysUpdated = Math.floor((Date.now() - updated.getTime()) / (1000 * 60 * 60 * 24));
    
    output += `   Created: ${daysOld} days ago`;
    if (daysUpdated < daysOld) {
      output += ` | Updated: ${daysUpdated} days ago`;
    }
    output += '\n';
  } else {
    output += `   By @${pr.author.login} • ${pr.state.toLowerCase()}`;
    const daysOld = Math.floor((Date.now() - new Date(pr.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
    output += ` • ${daysOld}d ago\n`;
  }
  
  output += `   ${pr.url}\n\n`;
  
  return output;
}

export default githubPRListTool;