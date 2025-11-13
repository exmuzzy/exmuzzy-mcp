#!/usr/bin/env node
import 'dotenv/config';
import { JiraApiClient } from '../dist/jiraApiClient.js';
import { IssueService } from '../dist/services/issueService.js';

async function testGroupedOutput() {
  try {
    console.log('Testing get_my_issues_grouped output...\n');
    
    const apiClient = new JiraApiClient();
    const issueService = new IssueService(apiClient);
    
    const result = await issueService.getMyIssuesGroupedByStatus({
      maxResults: 500
    });
    
    console.log('=== RAW OUTPUT START ===');
    console.log(result.content[0].text);
    console.log('=== RAW OUTPUT END ===');
    
    console.log('\n=== OUTPUT LENGTH ===');
    console.log(`Total characters: ${result.content[0].text.length}`);
    console.log(`Lines: ${result.content[0].text.split('\n').length}`);
    
    // Check if issue lists are present
    const hasIssueLists = result.content[0].text.includes('- **[RIVER-');
    console.log(`\nContains issue lists: ${hasIssueLists}`);
    
    if (!hasIssueLists) {
      console.log('\n⚠️  WARNING: No issue lists found in output!');
    }
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testGroupedOutput();

