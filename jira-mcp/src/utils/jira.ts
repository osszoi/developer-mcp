import axios, { AxiosInstance, AxiosError } from 'axios';
import { JiraConfig } from '../types.js';

let jiraClient: AxiosInstance | null = null;

export function getJiraConfig(): JiraConfig | null {
  const baseUrl = process.env.JIRA_BASE_URL;
  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;

  if (!baseUrl || !email || !apiToken) {
    return null;
  }

  return { baseUrl, email, apiToken };
}

export function getJiraClient(): AxiosInstance {
  if (!jiraClient) {
    const config = getJiraConfig();
    if (!config) {
      throw new Error('Jira configuration not found. Please set JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN environment variables.');
    }

    jiraClient = axios.create({
      baseURL: config.baseUrl,
      auth: {
        username: config.email,
        password: config.apiToken
      },
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
  }

  return jiraClient;
}

export function formatJiraError(error: unknown): string {
  if (error instanceof AxiosError) {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.errorMessages?.join(', ') || 
                      error.response.data?.message || 
                      error.response.statusText;
      
      switch (status) {
        case 401:
          return 'Authentication failed. Please check your JIRA_EMAIL and JIRA_API_TOKEN.';
        case 403:
          return `Permission denied: ${message}`;
        case 404:
          return 'Resource not found. Please check the issue key or project key.';
        case 400:
          return `Bad request: ${message}`;
        default:
          return `Jira API error (${status}): ${message}`;
      }
    } else if (error.request) {
      return 'No response from Jira. Please check your JIRA_BASE_URL and internet connection.';
    }
  }
  
  return `Unexpected error: ${String(error)}`;
}

export function validateJiraSetup(): { valid: boolean; error?: string } {
  const config = getJiraConfig();
  
  if (!config) {
    return {
      valid: false,
      error: 'Jira configuration missing. Please set the following environment variables:\n' +
             '- JIRA_BASE_URL (e.g., https://your-domain.atlassian.net)\n' +
             '- JIRA_EMAIL (your Jira account email)\n' +
             '- JIRA_API_TOKEN (create at https://id.atlassian.com/manage-profile/security/api-tokens)'
    };
  }

  // Validate URL format
  try {
    new URL(config.baseUrl);
  } catch {
    return {
      valid: false,
      error: 'Invalid JIRA_BASE_URL format. It should be a valid URL like https://your-domain.atlassian.net'
    };
  }

  return { valid: true };
}