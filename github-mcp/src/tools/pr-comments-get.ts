import { z } from 'zod';
import { ToolDefinition } from '../types.js';
import { executeGitHubCommand, parseRepository } from '../utils/github.js';

const inputSchema = z.object({
  repository: z.string().describe('Repository in owner/repo format'),
  pr_number: z.number().describe('Pull request number'),
  type: z.enum(['all', 'review', 'issue']).optional().default('all').describe('Type of comments to retrieve')
});

const githubPRCommentsGetTool: ToolDefinition = {
  name: 'pr_comments_get',
  description: 'Get comments from a pull request, including inline code comments',
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
    
    let allComments: any[] = [];
    
    // Get issue comments (general PR comments)
    if (params.type === 'all' || params.type === 'issue') {
      const issueCommentsCommand = `gh api repos/${params.repository}/issues/${params.pr_number}/comments`;
      const issueResult = await executeGitHubCommand(issueCommentsCommand);
      
      if (issueResult.exitCode === 0) {
        try {
          const issueComments = JSON.parse(issueResult.stdout);
          allComments = allComments.concat(issueComments.map((c: any) => ({ ...c, type: 'issue' })));
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
    
    // Get review comments (inline code comments)
    if (params.type === 'all' || params.type === 'review') {
      const reviewCommentsCommand = `gh api repos/${params.repository}/pulls/${params.pr_number}/comments`;
      const reviewResult = await executeGitHubCommand(reviewCommentsCommand);
      
      if (reviewResult.exitCode === 0) {
        try {
          const reviewComments = JSON.parse(reviewResult.stdout);
          allComments = allComments.concat(reviewComments.map((c: any) => ({ ...c, type: 'review' })));
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
    
    // Get review threads (for better context)
    const reviewsCommand = `gh api repos/${params.repository}/pulls/${params.pr_number}/reviews`;
    const reviewsResult = await executeGitHubCommand(reviewsCommand);
    
    let reviews: any[] = [];
    if (reviewsResult.exitCode === 0) {
      try {
        reviews = JSON.parse(reviewsResult.stdout);
      } catch (e) {
        // Ignore parse errors
      }
    }
    
    if (allComments.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `No comments found on PR #${params.pr_number}`
        }]
      };
    }
    
    // Sort comments by creation date
    allComments.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    
    // Format output
    let output = `PR #${params.pr_number} Comments (${allComments.length} total)\n`;
    output += '='.repeat(80) + '\n\n';
    
    // Group review comments by file
    const commentsByFile: Record<string, any[]> = {};
    const generalComments: any[] = [];
    
    allComments.forEach(comment => {
      if (comment.type === 'review' && comment.path) {
        if (!commentsByFile[comment.path]) {
          commentsByFile[comment.path] = [];
        }
        commentsByFile[comment.path].push(comment);
      } else {
        generalComments.push(comment);
      }
    });
    
    // Show general comments first
    if (generalComments.length > 0) {
      output += '## General Comments\n\n';
      generalComments.forEach(comment => {
        output += `👤 ${comment.user.login} - ${new Date(comment.created_at).toLocaleString()}\n`;
        output += comment.body + '\n';
        output += '-'.repeat(60) + '\n\n';
      });
    }
    
    // Show inline code comments grouped by file
    if (Object.keys(commentsByFile).length > 0) {
      output += '## Inline Code Comments\n\n';
      
      for (const [filePath, comments] of Object.entries(commentsByFile)) {
        output += `📄 ${filePath}\n`;
        output += '='.repeat(filePath.length + 2) + '\n\n';
        
        // Sort by line number
        comments.sort((a, b) => (a.line || a.original_line || 0) - (b.line || b.original_line || 0));
        
        for (const comment of comments) {
          const line = comment.line || comment.original_line;
          output += `Line ${line}`;
          if (comment.start_line && comment.start_line !== line) {
            output += `-${comment.line}`;
          }
          output += `: ${comment.user.login}\n`;
          
          // Get code context if available
          if (comment.diff_hunk) {
            output += '\nCode context:\n```\n';
            const hunkLines = comment.diff_hunk.split('\n');
            // Show last 5 lines of context
            const contextLines = hunkLines.slice(-6, -1);
            contextLines.forEach((line: string) => {
              output += line + '\n';
            });
            output += '```\n';
          }
          
          output += '\nComment:\n';
          output += comment.body + '\n';
          
          // Check if this comment is part of a review
          const review = reviews.find(r => r.id === comment.pull_request_review_id);
          if (review && review.state !== 'COMMENTED') {
            output += `\n(Part of ${review.state} review)\n`;
          }
          
          output += '-'.repeat(40) + '\n\n';
        }
      }
    }
    
    return {
      content: [{
        type: 'text',
        text: output.trim()
      }]
    };
  }
};

export default githubPRCommentsGetTool;