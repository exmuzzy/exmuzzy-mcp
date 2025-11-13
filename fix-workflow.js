#!/usr/bin/env node
import 'dotenv/config';
import { JiraApiClient } from './dist/jiraApiClient.js';
import { ResolutionGenerator } from './dist/utils/resolutionGenerator.js';

async function fixWorkflow() {
  try {
    const apiClient = new JiraApiClient();
    const generator = new ResolutionGenerator();
    
    console.log('Шаг 1: Перевожу задачу в статус "Закрыт"...\n');
    
    // Переводим в "Закрыт" чтобы потом можно было переоткрыть
    const transitions1 = await apiClient.getIssueTransitions('RIVER-3870', true);
    const closeTransition = transitions1.transitions.find(t => t.to.name === 'Закрыт');
    
    if (closeTransition) {
      // Нужна резолюция для закрытия
      let resolution = null;
      if (closeTransition.fields?.resolution?.allowedValues && closeTransition.fields.resolution.allowedValues.length > 0) {
        resolution = { name: closeTransition.fields.resolution.allowedValues[0].name };
      }
      
      await apiClient.transitionIssue('RIVER-3870', closeTransition.id, 'Временно закрываю для правильного workflow', resolution);
      console.log('✅ Задача переведена в статус "Закрыт"\n');
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('Шаг 2: Переоткрываю задачу...\n');
    
    // Теперь должны быть доступны переходы для переоткрытия
    const transitions2 = await apiClient.getIssueTransitions('RIVER-3870', true);
    console.log('Доступные переходы:', transitions2.transitions.map(t => `${t.name} → ${t.to.name}`).join(', '));
    
    // Ищем переход для переоткрытия
    const reopenTransition = transitions2.transitions.find((t) => 
      t.to.name === 'Переоткрыт' || 
      t.to.name === 'Сделать' || 
      t.to.name === 'Backlog' ||
      t.to.statusCategory?.key === 'new' ||
      t.name.toLowerCase().includes('reopen') ||
      t.name.toLowerCase().includes('переоткрыт')
    );
    
    if (reopenTransition) {
      await apiClient.transitionIssue('RIVER-3870', reopenTransition.id);
      console.log(`✅ Задача переоткрыта: ${reopenTransition.name} → ${reopenTransition.to.name}\n`);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    } else {
      console.log('⚠️ Переход для переоткрытия не найден\n');
    }
    
    console.log('Шаг 3: Ищу переход в статус "Готово"...\n');
    
    // Получаем обновленные переходы
    const transitions3 = await apiClient.getIssueTransitions('RIVER-3870', true);
    console.log('Доступные переходы:', transitions3.transitions.map(t => `${t.name} → ${t.to.name}`).join(', '));
    
    // Ищем переход в "Готово"
    const readyTransition = transitions3.transitions.find((t) => 
      t.to.name === 'Готово'
    );
    
    if (readyTransition) {
      console.log(`✅ Найден переход: ${readyTransition.name} → ${readyTransition.to.name}\n`);
      
      // Получаем детали задачи
      const issue = await apiClient.getIssue('RIVER-3870', {
        fields: ['summary', 'description', 'status', 'issuetype', 'assignee', 'components', 'labels']
      });
      
      // Генерируем резолюцию
      const resolutionText = await generator.generateResolution(issue);
      
      // Получаем резолюцию "Готово"
      let resolution = null;
      if (readyTransition.fields?.resolution?.allowedValues && readyTransition.fields.resolution.allowedValues.length > 0) {
        const readyResolution = readyTransition.fields.resolution.allowedValues.find((r) => r.name === 'Готово');
        resolution = { name: readyResolution ? readyResolution.name : readyTransition.fields.resolution.allowedValues[0].name };
      }
      
      console.log('Шаг 4: Перевожу задачу в статус "Готово"...\n');
      
      await apiClient.transitionIssue('RIVER-3870', readyTransition.id, resolutionText, resolution);
      
      console.log('✅ Задача успешно переведена в статус "Готово"!');
      console.log(`Резолюция: ${resolution?.name || 'не указана'}`);
      console.log(`Комментарий: ${resolutionText}`);
    } else {
      console.log('❌ Переход в статус "Готово" не найден');
      console.log('\nДоступные переходы:');
      transitions3.transitions.forEach(t => {
        console.log(`  ${t.name} → ${t.to.name} (${t.to.statusCategory.name})`);
        if (t.fields?.resolution?.allowedValues) {
          console.log(`    Резолюции: ${t.fields.resolution.allowedValues.map(r => r.name).join(', ')}`);
        }
      });
    }
    
  } catch (error) {
    console.error('Ошибка:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

fixWorkflow();

