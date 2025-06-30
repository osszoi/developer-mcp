import { z } from 'zod';
import { ToolDefinition } from '../types.js';
import { executeGitHubCommand, parseRepository } from '../utils/github.js';

const inputSchema = z.object({
  repository: z.string().describe('Repository in owner/repo format'),
  protected: z.boolean().optional().describe('Show only protected branches'),
  sort: z.enum(['name', 'updated']).optional().default('updated').describe('Sort branches by'),
  limit: z.number().optional().default(30).describe('Maximum number of branches to return')
});

const githubBranchListTool: ToolDefinition = {
  name: 'branch_list',
  description: 'List branches in a GitHub repository',
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
    
    // Get branches using gh api
    let endpoint = `repos/${params.repository}/branches?per_page=${params.limit}`;
    
    if (params.protected !== undefined) {
      endpoint += `&protected=${params.protected}`;
    }
    
    const command = `gh api ${endpoint}`;
    const result = await executeGitHubCommand(command);
    
    if (result.exitCode !== 0) {
      return {
        content: [{
          type: 'text',
          text: `Error listing branches: ${result.stderr}`
        }],
        isError: true
      };
    }
    
    try {
      const branches = JSON.parse(result.stdout);
      
      if (!Array.isArray(branches) || branches.length === 0) {
        return {
          content: [{
            type: 'text',
            text: `No branches found in ${params.repository}`
          }]
        };
      }
      
      // Get additional details for each branch (commit info)
      const branchDetails = await Promise.all(
        branches.map(async (branch: any) => {
          const commitCommand = `gh api repos/${params.repository}/commits/${branch.commit.sha}`;
          const commitResult = await executeGitHubCommand(commitCommand);
          
          if (commitResult.exitCode === 0) {
            try {
              const commit = JSON.parse(commitResult.stdout);
              return {
                ...branch,
                lastCommit: {
                  date: commit.commit.author.date,
                  message: commit.commit.message.split('\n')[0], // First line only
                  author: commit.commit.author.name
                }
              };
            } catch (e) {
              return branch;
            }
          }
          return branch;
        })
      );
      
      // Sort branches
      if (params.sort === 'updated' && branchDetails[0].lastCommit) {
        branchDetails.sort((a, b) => {
          const dateA = a.lastCommit?.date ? new Date(a.lastCommit.date).getTime() : 0;
          const dateB = b.lastCommit?.date ? new Date(b.lastCommit.date).getTime() : 0;
          return dateB - dateA;
        });
      } else if (params.sort === 'name') {
        branchDetails.sort((a, b) => a.name.localeCompare(b.name));
      }
      
      // Get default branch
      const repoCommand = `gh api repos/${params.repository} --jq .default_branch`;
      const repoResult = await executeGitHubCommand(repoCommand);
      const defaultBranch = repoResult.exitCode === 0 ? repoResult.stdout.trim() : 'main';
      
      // Format output
      let output = `Branches in ${params.repository}:\n`;
      output += '='.repeat(60) + '\n\n';
      
      branchDetails.forEach((branch: any) => {
        const isDefault = branch.name === defaultBranch;
        const isProtected = branch.protected;
        
        output += `🌿 ${branch.name}`;
        if (isDefault) output += ' (default)';
        if (isProtected) output += ' 🔒';
        output += '\n';
        
        if (branch.lastCommit) {
          const date = new Date(branch.lastCommit.date);
          const daysAgo = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
          
          output += `   Last commit: ${daysAgo} days ago by ${branch.lastCommit.author}\n`;
          output += `   "${branch.lastCommit.message}"\n`;
        }
        
        output += `   SHA: ${branch.commit.sha.substring(0, 7)}\n`;
        output += '\n';
      });
      
      output += `Total: ${branchDetails.length} branch${branchDetails.length !== 1 ? 'es' : ''}`;
      
      return {
        content: [{
          type: 'text',
          text: output.trim()
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error parsing branch data: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
};

export default githubBranchListTool;