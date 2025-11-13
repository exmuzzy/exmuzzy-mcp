#!/usr/bin/env node
import 'dotenv/config';
import { JiraApiClient } from '../dist/jiraApiClient.js';

async function checkPriorities() {
  try {
    console.log('Fetching Jira priorities...\n');
    
    const apiClient = new JiraApiClient();
    
    // Get priorities from Jira
    const priorities = await apiClient.makeRequest('/priority', { useV3Api: false });
    
    console.log('Available priorities:');
    console.log(JSON.stringify(priorities, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkPriorities();

