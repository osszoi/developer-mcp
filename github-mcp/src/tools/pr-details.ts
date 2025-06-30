import { z } from 'zod';
import { ToolDefinition } from '../types.js';
import { executeGitHubCommand, parseRepository } from '../utils/github.js';

const inputSchema = z.object({
  repository: z.string().describe('Repository in owner/repo format'),
  pr_number: z.number().describe('Pull request number'),
  show_checks: z.boolean().optional().default(true).describe('Show status checks'),
  show_reviews: z.boolean().optional().default(true).describe('Show review status')
});

const githubPRDetailsTool: ToolDefinition = {
  name: 'pr_details',
  description: 'Get detailed information about a pull request',
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
    
    // Get PR details
    const command = `gh pr view ${params.pr_number} --repo ${params.repository} --json number,title,body,author,state,isDraft,createdAt,updatedAt,closedAt,mergedAt,url,headRefName,baseRefName,labels,assignees,reviewRequests,reviews,statusCheckRollup,mergeable,milestone,comments,additions,deletions,changedFiles`;
    
    const result = await executeGitHubCommand(command);
    
    if (result.exitCode !== 0) {
      return {
        content: [{
          type: 'text',
          text: `Error getting PR details: ${result.stderr}`
        }],
        isError: true
      };
    }
    
    try {
      const pr = JSON.parse(result.stdout);
      
      let output = `# PR #${pr.number}: ${pr.title}\n`;
      output += '='.repeat(70) + '\n\n';
      
      // Basic info
      const stateEmoji = pr.isDraft ? '📝' : pr.state === 'OPEN' ? '🟢' : pr.state === 'MERGED' ? '🟣' : '🔴';
      output += `**State:** ${stateEmoji} ${pr.state}${pr.isDraft ? ' (Draft)' : ''}\n`;
      output += `**Author:** @${pr.author.login}\n`;
      output += `**Branch:** ${pr.headRefName} → ${pr.baseRefName}\n`;
      
      // Timestamps
      const created = new Date(pr.createdAt);
      const updated = new Date(pr.updatedAt);
      const daysOld = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));
      
      output += `**Created:** ${created.toLocaleDateString()} (${daysOld} days ago)\n`;
      output += `**Updated:** ${updated.toLocaleDateString()}\n`;
      
      if (pr.mergedAt) {
        output += `**Merged:** ${new Date(pr.mergedAt).toLocaleDateString()}\n`;
      } else if (pr.closedAt) {
        output += `**Closed:** ${new Date(pr.closedAt).toLocaleDateString()}\n`;
      }
      
      // Changes summary
      output += `\n**Changes:** +${pr.additions} -${pr.deletions} in ${pr.changedFiles} file(s)\n`;
      
      // Labels
      if (pr.labels && pr.labels.length > 0) {
        const labelNames = pr.labels.map((l: any) => l.name).join(', ');
        output += `**Labels:** ${labelNames}\n`;
      }
      
      // Assignees
      if (pr.assignees && pr.assignees.length > 0) {
        const assigneeNames = pr.assignees.map((a: any) => `@${a.login}`).join(', ');
        output += `**Assignees:** ${assigneeNames}\n`;
      }
      
      // Milestone
      if (pr.milestone) {
        output += `**Milestone:** ${pr.milestone.title}\n`;
      }
      
      // Review requests
      if (pr.reviewRequests && pr.reviewRequests.length > 0) {
        const reviewers = pr.reviewRequests.map((r: any) => `@${r.login}`).join(', ');
        output += `**Review requested from:** ${reviewers}\n`;
      }
      
      // Reviews
      if (params.show_reviews && pr.reviews && pr.reviews.length > 0) {
        output += '\n## Reviews\n';
        output += '-'.repeat(40) + '\n';
        
        const reviewsByAuthor: Record<string, any> = {};
        pr.reviews.forEach((review: any) => {
          // Keep only the latest review from each author
          if (!reviewsByAuthor[review.author.login] || 
              new Date(review.submittedAt) > new Date(reviewsByAuthor[review.author.login].submittedAt)) {
            reviewsByAuthor[review.author.login] = review;
          }
        });
        
        Object.values(reviewsByAuthor).forEach((review: any) => {
          const reviewEmoji = review.state === 'APPROVED' ? '✅' : 
                            review.state === 'CHANGES_REQUESTED' ? '❌' : 
                            review.state === 'COMMENTED' ? '💬' : '👀';
          output += `${reviewEmoji} @${review.author.login}: ${review.state}\n`;
        });
      }
      
      // Status checks
      if (params.show_checks && pr.statusCheckRollup) {
        output += '\n## Status Checks\n';
        output += '-'.repeat(40) + '\n';
        
        const rollup = pr.statusCheckRollup;
        const statusEmoji = rollup.state === 'SUCCESS' ? '✅' : 
                          rollup.state === 'FAILURE' ? '❌' : 
                          rollup.state === 'PENDING' ? '⏳' : '⚠️';
        
        output += `Overall: ${statusEmoji} ${rollup.state}\n`;
        
        if (rollup.contexts && rollup.contexts.length > 0) {
          output += '\nChecks:\n';
          rollup.contexts.forEach((check: any) => {
            const checkEmoji = check.state === 'SUCCESS' ? '✅' : 
                             check.state === 'FAILURE' ? '❌' : 
                             check.state === 'PENDING' ? '⏳' : '⚠️';
            output += `  ${checkEmoji} ${check.context || check.name || 'Unknown check'}\n`;
          });
        }
      }
      
      // Mergeable status
      if (pr.mergeable) {
        output += `\n**Mergeable:** ${pr.mergeable === 'MERGEABLE' ? '✅ Yes' : '❌ No (' + pr.mergeable + ')'}\n`;
      }
      
      // Description
      if (pr.body) {
        output += '\n## Description\n';
        output += '-'.repeat(40) + '\n';
        output += pr.body + '\n';
      }
      
      // Comments count
      if (pr.comments && pr.comments > 0) {
        output += `\n💬 ${pr.comments} comment(s)\n`;
      }
      
      output += `\n**URL:** ${pr.url}`;
      
      return {
        content: [{
          type: 'text',
          text: output
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error parsing PR data: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
};

export default githubPRDetailsTool;