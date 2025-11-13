#!/usr/bin/env node
import 'dotenv/config';
import { JiraApiClient } from './dist/jiraApiClient.js';

async function checkTransition() {
  try {
    const apiClient = new JiraApiClient();
    
    const transitions = await apiClient.getIssueTransitions('RIVER-2640', true);
    
    const readyTransition = transitions.transitions.find((t) => t.to.name === 'Готово');
    
    if (readyTransition) {
      console.log('Переход:', readyTransition.name);
      console.log('В статус:', readyTransition.to.name);
      console.log('\nПоля перехода:');
      console.log(JSON.stringify(readyTransition.fields, null, 2));
      
      if (readyTransition.fields?.resolution) {
        console.log('\nРезолюция требуется:', readyTransition.fields.resolution.required);
        console.log('Доступные резолюции:', readyTransition.fields.resolution.allowedValues?.map(r => r.name).join(', '));
      } else {
        console.log('\nРезолюция не требуется для этого перехода');
      }
    }
    
  } catch (error) {
    console.error('Ошибка:', error.message);
    process.exit(1);
  }
}

checkTransition();

