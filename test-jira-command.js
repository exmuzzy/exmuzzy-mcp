#!/usr/bin/env node

import { JiraApiClient } from './dist/jiraApiClient.js';
import { IssueService } from './dist/services/issueService.js';
import dotenv from 'dotenv';

dotenv.config();

async function testJiraCommand() {
  console.log('⚡️ Тест команды /jira\n');

  const apiClient = new JiraApiClient({
    baseUrl: process.env.JIRA_BASE_URL,
    email: process.env.JIRA_EMAIL || 'test@test.com',
    apiToken: process.env.JIRA_API_TOKEN,
  });

  const issueService = new IssueService(apiClient);

  // Симуляция команды /jira
  console.log('Пользователь: /jira\n');
  console.log('⏱️  Выполняется запрос...\n');
  
  const start = Date.now();
  const result = await issueService.getMyIssuesGroupedByStatus({ maxResults: 100 });
  const duration = Date.now() - start;

  console.log(`✅ Запрос выполнен за ${duration}ms\n`);
  console.log('📊 Результат:\n');
  console.log('─'.repeat(80));
  console.log(result.content[0].text.substring(0, 2000));
  console.log('\n[... остальной вывод ...]');
  console.log('─'.repeat(80));
  console.log(`\n⚡️ Время ответа: ${duration}ms`);
  console.log(`📦 Размер ответа: ${result.content[0].text.length} байт`);
  console.log(`\n✅ Команда /jira работает за ${duration}ms (один запрос)`);
}

testJiraCommand().catch(console.error);

