import { z } from 'zod';
import { ToolDefinition } from '../types.js';
import { executeGitHubCommand } from '../utils/github.js';

const inputSchema = z.object({
  owner: z.string().optional().describe('Repository owner (user or organization). If not specified, lists all your accessible repositories'),
  visibility: z.enum(['public', 'private', 'all']).optional().default('all').describe('Filter by repository visibility'),
  type: z.enum(['all', 'owner', 'member']).optional().default('all').describe('Filter by repository type'),
  sort: z.enum(['created', 'updated', 'pushed', 'name', 'stargazers']).optional().default('updated').describe('Sort repositories by'),
  limit: z.number().optional().default(100).describe('Maximum number of repositories to return per organization'),
  archived: z.boolean().optional().describe('Include archived repositories'),
  topic: z.string().optional().describe('Filter by topic')
});

const githubReposListTool: ToolDefinition = {
  name: 'repos_list',
  description: 'List GitHub repositories for a user or organization',
  inputSchema,
  
  handler: async (input) => {
    const params = inputSchema.parse(input);
    
    let allRepos: any[] = [];
    
    if (params.owner) {
      // List repos for specific owner
      let command = `gh repo list ${params.owner}`;
      
      // Add flags
      command += ` --limit ${params.limit}`;
      
      if (params.visibility !== 'all') {
        command += ` --${params.visibility}`;
      }
      
      if (params.archived !== undefined) {
        command += params.archived ? ' --archived' : ' --no-archived';
      }
      
      if (params.topic) {
        command += ` --topic ${params.topic}`;
      }
      
      // Add JSON output
      command += ' --json name,description,url,isPrivate,isArchived,pushedAt,stargazerCount,primaryLanguage,repositoryTopics,owner';
      
      const result = await executeGitHubCommand(command);
      
      if (result.exitCode !== 0) {
        return {
          content: [{
            type: 'text',
            text: `Error listing repositories: ${result.stderr}`
          }],
          isError: true
        };
      }
      
      try {
        allRepos = JSON.parse(result.stdout);
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Error parsing repository data: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    } else {
      // List all accessible repos (user + all orgs)
      
      // First, get the authenticated user
      const userResult = await executeGitHubCommand('gh api user --jq .login');
      if (userResult.exitCode !== 0) {
        return {
          content: [{
            type: 'text',
            text: `Error getting user info: ${userResult.stderr}`
          }],
          isError: true
        };
      }
      
      const username = userResult.stdout.trim();
      
      // Get user's repos
      let userCommand = `gh repo list ${username} --limit ${params.limit}`;
      
      if (params.visibility !== 'all') {
        userCommand += ` --${params.visibility}`;
      }
      
      if (params.archived !== undefined) {
        userCommand += params.archived ? ' --archived' : ' --no-archived';
      }
      
      if (params.topic) {
        userCommand += ` --topic ${params.topic}`;
      }
      
      userCommand += ' --json name,description,url,isPrivate,isArchived,pushedAt,stargazerCount,primaryLanguage,repositoryTopics,owner';
      
      const userReposResult = await executeGitHubCommand(userCommand);
      
      if (userReposResult.exitCode === 0) {
        try {
          const userRepos = JSON.parse(userReposResult.stdout);
          allRepos = allRepos.concat(userRepos);
        } catch (e) {
          // Ignore parse errors
        }
      }
      
      // Get all organizations the user is a member of
      const orgsResult = await executeGitHubCommand('gh api user/orgs --jq .[].login');
      
      if (orgsResult.exitCode === 0 && orgsResult.stdout.trim()) {
        const orgs = orgsResult.stdout.trim().split('\n');
        
        // Get repos from each org
        for (const org of orgs) {
          let orgCommand = `gh repo list ${org} --limit ${params.limit}`;
          
          if (params.visibility !== 'all') {
            orgCommand += ` --${params.visibility}`;
          }
          
          if (params.archived !== undefined) {
            orgCommand += params.archived ? ' --archived' : ' --no-archived';
          }
          
          if (params.topic) {
            orgCommand += ` --topic ${params.topic}`;
          }
          
          orgCommand += ' --json name,description,url,isPrivate,isArchived,pushedAt,stargazerCount,primaryLanguage,repositoryTopics,owner';
          
          const orgReposResult = await executeGitHubCommand(orgCommand);
          
          if (orgReposResult.exitCode === 0) {
            try {
              const orgRepos = JSON.parse(orgReposResult.stdout);
              allRepos = allRepos.concat(orgRepos);
            } catch (e) {
              // Ignore parse errors for individual orgs
            }
          }
        }
      }
    }
    
    // Sort repositories based on params.sort
    if (params.sort && allRepos.length > 0) {
      allRepos.sort((a: any, b: any) => {
        switch (params.sort) {
          case 'name':
            return a.name.localeCompare(b.name);
          case 'created':
            return new Date(b.createdAt || b.pushedAt).getTime() - new Date(a.createdAt || a.pushedAt).getTime();
          case 'updated':
            return new Date(b.updatedAt || b.pushedAt).getTime() - new Date(a.updatedAt || a.pushedAt).getTime();
          case 'pushed':
            return new Date(b.pushedAt).getTime() - new Date(a.pushedAt).getTime();
          case 'stargazers':
            return (b.stargazerCount || 0) - (a.stargazerCount || 0);
          default:
            return 0;
        }
      });
    }
    
    // Format output
    let output = '';
    
    if (!params.owner) {
      // Group by owner when showing all repos
      const reposByOwner: Record<string, any[]> = {};
      
      allRepos.forEach(repo => {
        const ownerName = repo.owner?.login || 'unknown';
        if (!reposByOwner[ownerName]) {
          reposByOwner[ownerName] = [];
        }
        reposByOwner[ownerName].push(repo);
      });
      
      output += `Found ${allRepos.length} total repositories across ${Object.keys(reposByOwner).length} accounts:\n\n`;
      
      // Show repos grouped by owner
      Object.entries(reposByOwner).forEach(([owner, repos]) => {
        output += `### ${owner} (${repos.length} repos)\n`;
        output += '='.repeat(40) + '\n\n';
        
        repos.forEach((repo: any) => {
          output += formatRepo(repo);
        });
      });
    } else {
      output += `Found ${allRepos.length} repositor${allRepos.length === 1 ? 'y' : 'ies'} for ${params.owner}:\n\n`;
      
      allRepos.forEach((repo: any) => {
        output += formatRepo(repo);
      });
    }
    
    return {
      content: [{
        type: 'text',
        text: output.trim()
      }]
    };
  }
};

function formatRepo(repo: any): string {
  let output = `📦 ${repo.name}`;
  if (repo.isPrivate) output += ' 🔒';
  if (repo.isArchived) output += ' 📁';
  output += '\n';
  
  if (repo.description) {
    output += `   ${repo.description}\n`;
  }
  
  output += `   URL: ${repo.url}\n`;
  
  if (repo.primaryLanguage?.name) {
    output += `   Language: ${repo.primaryLanguage.name}\n`;
  }
  
  if (repo.stargazerCount > 0) {
    output += `   Stars: ⭐ ${repo.stargazerCount}\n`;
  }
  
  if (repo.repositoryTopics && repo.repositoryTopics.length > 0) {
    const topics = repo.repositoryTopics.map((t: any) => {
      if (typeof t === 'object' && t.topic?.name) {
        return t.topic.name;
      } else if (typeof t === 'object' && t.name) {
        return t.name;
      }
      return t;
    }).filter(Boolean);
    
    if (topics.length > 0) {
      output += `   Topics: ${topics.join(', ')}\n`;
    }
  }
  
  if (repo.pushedAt) {
    const pushedDate = new Date(repo.pushedAt);
    const daysAgo = Math.floor((Date.now() - pushedDate.getTime()) / (1000 * 60 * 60 * 24));
    output += `   Last push: ${daysAgo} days ago\n`;
  }
  
  output += '\n';
  return output;
}

export default githubReposListTool;