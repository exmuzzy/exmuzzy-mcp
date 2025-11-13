#!/usr/bin/env node
import 'dotenv/config';
import { JiraApiClient } from './dist/jiraApiClient.js';
import { IssueService } from './dist/services/issueService.js';

async function reopenAndComplete() {
  try {
    const apiClient = new JiraApiClient();
    const issueService = new IssueService(apiClient);
    
    console.log('1. Проверяю текущий статус RIVER-2640...\n');
    
    const issue = await apiClient.getIssue('RIVER-2640', {
      fields: ['status']
    });
    
    console.log('Текущий статус:', issue.fields.status.name);
    
    if (issue.fields.status.name === 'Canceled') {
      console.log('\n2. Задача в статусе Canceled, перевожу в Закрыт...\n');
      
      const transitions1 = await apiClient.getIssueTransitions('RIVER-2640', true);
      const closeTransition = transitions1.transitions.find((t) => t.to.name === 'Закрыт');
      
      if (closeTransition) {
        let resolution = undefined;
        if (closeTransition.fields?.resolution?.allowedValues && closeTransition.fields.resolution.allowedValues.length > 0) {
          resolution = { name: closeTransition.fields.resolution.allowedValues[0].name };
        }
        
        await apiClient.transitionIssue('RIVER-2640', closeTransition.id, 'Перевожу в Закрыт', resolution);
        console.log('✅ Переведено в Закрыт\n');
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log('3. Закрываю задачу через completeIssue...\n');
    
    const result = await issueService.completeIssue({ issueKey: 'RIVER-2640' });
    
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

reopenAndComplete();
