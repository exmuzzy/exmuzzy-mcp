#!/usr/bin/env node
import 'dotenv/config';
import { JiraApiClient } from './dist/jiraApiClient.js';

async function checkStatus() {
  try {
    const apiClient = new JiraApiClient();
    
    const issue = await apiClient.getIssue('RIVER-3870', {
      fields: ['status', 'summary']
    });
    
    console.log('Текущий статус:', issue.fields.status.name);
    console.log('Категория статуса:', issue.fields.status.statusCategory.name);
    
    const transitions = await apiClient.getIssueTransitions('RIVER-3870', true);
    
    console.log('\nДоступные переходы:');
    transitions.transitions.forEach(t => {
      console.log(`  ${t.name} → ${t.to.name} (${t.to.statusCategory.name})`);
      if (t.fields?.resolution?.allowedValues) {
        console.log(`    Резолюции: ${t.fields.resolution.allowedValues.map(r => r.name).join(', ')}`);
      }
    });
    
  } catch (error) {
    console.error('Ошибка:', error.message);
    process.exit(1);
  }
}

checkStatus();

