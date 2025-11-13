#!/usr/bin/env node
import 'dotenv/config';
import { JiraApiClient } from './dist/jiraApiClient.js';

async function addResolution() {
  try {
    const apiClient = new JiraApiClient();
    
    // Проверяем текущий статус
    const issue = await apiClient.getIssue('RIVER-3870', {
      fields: ['status', 'resolution']
    });
    
    console.log('Текущий статус:', issue.fields.status.name);
    console.log('Резолюция:', issue.fields.resolution ? issue.fields.resolution.name : 'не установлена');
    
    // Если резолюция не установлена, нужно перейти обратно и установить её
    if (!issue.fields.resolution || issue.fields.resolution.name !== 'Готово') {
      console.log('\nРезолюция не установлена или неправильная. Перевожу задачу обратно...\n');
      
      // Переводим обратно в "Закрыт"
      const transitions = await apiClient.getIssueTransitions('RIVER-3870', true);
      const backTransition = transitions.transitions.find(t => t.to.name === 'Закрыт');
      
      if (backTransition) {
        let resolution = null;
        if (backTransition.fields?.resolution?.allowedValues && backTransition.fields.resolution.allowedValues.length > 0) {
          resolution = { name: backTransition.fields.resolution.allowedValues[0].name };
        }
        await apiClient.transitionIssue('RIVER-3870', backTransition.id, 'Возвращаю для установки правильной резолюции', resolution);
        console.log('✅ Задача переведена обратно в "Закрыт"\n');
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Теперь переводим в "Готово" с правильной резолюцией
      const transitions2 = await apiClient.getIssueTransitions('RIVER-3870', true);
      const readyTransition = transitions2.transitions.find(t => t.to.name === 'Готово');
      
      if (readyTransition) {
        console.log('Переход найден:', readyTransition.name);
        console.log('Доступные резолюции:', readyTransition.fields?.resolution?.allowedValues?.map(r => r.name).join(', ') || 'нет');
        
        // Ищем резолюцию "Готово"
        let resolution = null;
        if (readyTransition.fields?.resolution?.allowedValues && readyTransition.fields.resolution.allowedValues.length > 0) {
          const readyResolution = readyTransition.fields.resolution.allowedValues.find((r) => r.name === 'Готово');
          resolution = { name: readyResolution ? readyResolution.name : readyTransition.fields.resolution.allowedValues[0].name };
        }
        
        console.log(`\nПеревожу в "Готово" с резолюцией "${resolution?.name}"...\n`);
        
        await apiClient.transitionIssue('RIVER-3870', readyTransition.id, 'Задача выполнена: Реструктуризация проектов в gitlab и создание readme для разработчиков и ИИ', resolution);
        
        console.log('✅ Задача переведена в "Готово" с резолюцией!');
      }
    } else {
      console.log('\n✅ Резолюция уже установлена правильно!');
    }
    
  } catch (error) {
    console.error('Ошибка:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

addResolution();

