#!/usr/bin/env node
import 'dotenv/config';
import { JiraApiClient } from './dist/jiraApiClient.js';
import { IssueService } from './dist/services/issueService.js';

async function checkIssue() {
  try {
    const apiClient = new JiraApiClient();
    const issueService = new IssueService(apiClient);
    
    const result = await issueService.getIssueDetails({ 
      issueKey: 'RIVER-123',
      includeComments: false,
      includeWorklogs: false
    });
    
    if (result.content && result.content[0] && result.content[0].text) {
      console.log(result.content[0].text);
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error('Ошибка:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

checkIssue();

