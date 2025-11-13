#!/usr/bin/env node

/**
 * Тестовый скрипт для проверки оптимизированной функции get_my_issues_grouped
 * 
 * Использование:
 *   node test-optimized-function.js
 */

import { JiraApiClient } from './dist/jiraApiClient.js';
import { IssueService } from './dist/services/issueService.js';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

async function testOptimizedFunction() {
  console.log('🚀 Тестирование оптимизированной функции get_my_issues_grouped\n');

  // Проверяем переменные окружения
  const requiredEnvVars = ['JIRA_BASE_URL', 'JIRA_EMAIL', 'JIRA_API_TOKEN'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ Ошибка: Отсутствуют обязательные переменные окружения:');
    missingVars.forEach(varName => console.error(`   - ${varName}`));
    console.error('\nСоздайте файл .env или установите переменные окружения.');
    process.exit(1);
  }

  console.log('✅ Переменные окружения загружены');
  console.log(`   JIRA_BASE_URL: ${process.env.JIRA_BASE_URL}`);
  console.log(`   JIRA_EMAIL: ${process.env.JIRA_EMAIL}`);
  console.log(`   JIRA_API_TOKEN: ${'*'.repeat(20)}\n`);

  try {
    // Инициализируем клиент и сервис
    console.log('🔧 Инициализация Jira API клиента...');
    const apiClient = new JiraApiClient({
      baseUrl: process.env.JIRA_BASE_URL,
      email: process.env.JIRA_EMAIL,
      apiToken: process.env.JIRA_API_TOKEN,
    });

    const issueService = new IssueService(apiClient);
    console.log('✅ Клиент инициализирован\n');

    // Тест 1: Традиционный метод (для сравнения)
    console.log('📊 Тест 1: Традиционный метод (search_issues)');
    console.log('   Выполняется запрос...');
    const startTimeOld = Date.now();
    
    const resultOld = await issueService.searchIssues({
      jql: 'assignee = currentUser() AND statusCategory != Done',
      maxResults: 100,
    });
    
    const endTimeOld = Date.now();
    const durationOld = endTimeOld - startTimeOld;
    
    console.log(`   ⏱️  Время выполнения: ${durationOld}ms`);
    console.log(`   📝 Результат получен (${resultOld.content[0].text.length} байт)\n`);

    // Тест 2: Оптимизированный метод
    console.log('⚡️ Тест 2: Оптимизированный метод (get_my_issues_grouped)');
    console.log('   Выполняется запрос...');
    const startTimeNew = Date.now();
    
    const resultNew = await issueService.getMyIssuesGroupedByStatus({
      maxResults: 100,
    });
    
    const endTimeNew = Date.now();
    const durationNew = endTimeNew - startTimeNew;
    
    console.log(`   ⏱️  Время выполнения: ${durationNew}ms`);
    console.log(`   📝 Результат получен (${resultNew.content[0].text.length} байт)\n`);

    // Сравнение результатов
    console.log('📈 Сравнение результатов:');
    console.log('─'.repeat(60));
    console.log(`Метод                      | Время (ms) | Размер (байт)`);
    console.log('─'.repeat(60));
    console.log(`Традиционный (search)      | ${String(durationOld).padEnd(10)} | ${resultOld.content[0].text.length}`);
    console.log(`Оптимизированный (grouped) | ${String(durationNew).padEnd(10)} | ${resultNew.content[0].text.length}`);
    console.log('─'.repeat(60));
    
    const improvement = ((durationOld - durationNew) / durationOld * 100).toFixed(1);
    const speedup = (durationOld / durationNew).toFixed(2);
    
    console.log(`\n🎯 Результаты:`);
    if (durationNew < durationOld) {
      console.log(`   ✅ Оптимизированный метод быстрее на ${improvement}%`);
      console.log(`   ⚡️ Ускорение: ${speedup}x`);
    } else {
      console.log(`   ⚠️  Оптимизированный метод медленнее на ${Math.abs(improvement)}%`);
      console.log(`   (Это нормально для небольших данных или первого запуска)`);
    }

    // Проверка содержимого результата
    console.log(`\n📋 Анализ результата оптимизированного метода:`);
    const text = resultNew.content[0].text;
    
    // Проверяем наличие ключевых элементов
    const checks = [
      { name: 'Заголовок "Мои открытые задачи"', regex: /Мои открытые задачи/ },
      { name: 'Ссылки на задачи', regex: /https:\/\/.*\/browse\// },
      { name: 'Быстрый доступ', regex: /\/jira [A-Z]+-\d+/ },
      { name: 'Группировка по статусам', regex: /###.*\(\d+.*\)/ },
      { name: 'Меню быстрых действий', regex: /Быстрые действия/ },
      { name: 'Подсказки', regex: /Подсказки/ },
    ];

    checks.forEach(check => {
      const found = check.regex.test(text);
      console.log(`   ${found ? '✅' : '❌'} ${check.name}`);
    });

    // Выводим начало результата
    console.log(`\n📄 Начало результата (первые 500 символов):`);
    console.log('─'.repeat(60));
    console.log(text.substring(0, 500) + '...');
    console.log('─'.repeat(60));

    console.log(`\n✅ Тестирование завершено успешно!`);
    console.log(`\n💡 Подсказка: Для просмотра полного результата используйте:`);
    console.log(`   node test-optimized-function.js > result.txt`);

  } catch (error) {
    console.error('\n❌ Ошибка при тестировании:');
    console.error(`   ${error.message}`);
    
    if (error.statusCode) {
      console.error(`   Код ошибки: ${error.statusCode}`);
    }
    
    if (error.stack) {
      console.error(`\n📚 Stack trace:`);
      console.error(error.stack);
    }
    
    process.exit(1);
  }
}

// Запускаем тест
testOptimizedFunction();

