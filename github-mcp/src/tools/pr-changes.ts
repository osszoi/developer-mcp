import { z } from 'zod';
import { ToolDefinition } from '../types.js';
import { executeGitHubCommand, parseRepository } from '../utils/github.js';

const inputSchema = z.object({
  repository: z.string().describe('Repository in owner/repo format'),
  pr_number: z.number().describe('Pull request number'),
  format: z.enum(['patch', 'files', 'stats']).optional().default('files').describe('Output format: patch (diff), files (list of changed files), or stats (summary)')
});

const githubPRChangesTool: ToolDefinition = {
  name: 'pr_changes',
  description: 'Get the changes (diff) from a pull request',
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
    
    if (params.format === 'patch') {
      // Get the raw diff
      const command = `gh pr diff ${params.pr_number} --repo ${params.repository}`;
      const result = await executeGitHubCommand(command);
      
      if (result.exitCode !== 0) {
        return {
          content: [{
            type: 'text',
            text: `Error getting PR diff: ${result.stderr}`
          }],
          isError: true
        };
      }
      
      return {
        content: [{
          type: 'text',
          text: result.stdout || 'No changes found'
        }]
      };
    }
    
    // Get PR info and files
    const prCommand = `gh pr view ${params.pr_number} --repo ${params.repository} --json title,state,author,files,additions,deletions,changedFiles`;
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
      
      let output = `PR #${params.pr_number}: ${prData.title}\n`;
      output += `Author: ${prData.author.login}\n`;
      output += `State: ${prData.state}\n`;
      output += `Changes: +${prData.additions} -${prData.deletions} in ${prData.changedFiles} file(s)\n`;
      output += '\n' + '='.repeat(80) + '\n\n';
      
      if (params.format === 'stats') {
        // Group files by type of change
        const added: any[] = [];
        const modified: any[] = [];
        const deleted: any[] = [];
        
        prData.files.forEach((file: any) => {
          if (file.additions > 0 && file.deletions === 0) {
            added.push(file);
          } else if (file.deletions > 0 && file.additions === 0) {
            deleted.push(file);
          } else {
            modified.push(file);
          }
        });
        
        if (added.length > 0) {
          output += `Added (${added.length} files):\n`;
          added.forEach(file => {
            output += `  + ${file.path} (+${file.additions})\n`;
          });
          output += '\n';
        }
        
        if (modified.length > 0) {
          output += `Modified (${modified.length} files):\n`;
          modified.forEach(file => {
            output += `  ~ ${file.path} (+${file.additions} -${file.deletions})\n`;
          });
          output += '\n';
        }
        
        if (deleted.length > 0) {
          output += `Deleted (${deleted.length} files):\n`;
          deleted.forEach(file => {
            output += `  - ${file.path} (-${file.deletions})\n`;
          });
        }
      } else {
        // Default: list all files with changes
        output += 'Changed files:\n\n';
        for (const file of prData.files) {
          const changeIndicator = file.additions > 0 && file.deletions === 0 ? '+' :
                                file.deletions > 0 && file.additions === 0 ? '-' : '~';
          output += `${changeIndicator} ${file.path}\n`;
          output += `  Changes: +${file.additions} -${file.deletions}\n`;
          
          // Get a preview of the changes for this file
          const diffCommand = `gh pr diff ${params.pr_number} --repo ${params.repository} -- "${file.path}" | head -20`;
          const diffResult = await executeGitHubCommand(diffCommand, { timeout: 10000 });
          
          if (diffResult.exitCode === 0 && diffResult.stdout) {
            const lines = diffResult.stdout.split('\n').slice(0, 10);
            if (lines.length > 0) {
              output += '  Preview:\n';
              lines.forEach(line => {
                if (line.startsWith('+') && !line.startsWith('+++')) {
                  output += `    ${line}\n`;
                } else if (line.startsWith('-') && !line.startsWith('---')) {
                  output += `    ${line}\n`;
                }
              });
              output += '\n';
            }
          }
        }
      }
      
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
          text: `Error processing PR data: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
};

export default githubPRChangesTool;