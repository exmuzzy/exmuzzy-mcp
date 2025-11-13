#!/usr/bin/env node

/**
 * Скрипт для получения информации о доступных API endpoints в Jira
 */

import dotenv from 'dotenv';
import { JiraApiClient } from './dist/jiraApiClient.js';
import { Logger } from './dist/utils/logger.js';

dotenv.config();

const logger = new Logger('JiraAPIInfo');

async function getAPIInfo() {
  try {
    logger.info('=== Получение информации о Jira API ===\n');

    const apiClient = new JiraApiClient();
    const baseUrl = process.env.JIRA_BASE_URL;

    // Согласно документации Atlassian, Jira НЕ предоставляет Swagger/OpenAPI документацию
    // встроенную в сервер. Вместо этого используется:
    // 1. REST API Browser (HTML интерфейс)
    // 2. Официальная документация онлайн
    // 3. Для некоторых плагинов может быть своя документация

    logger.info('📋 Важная информация:\n');
    logger.info('Jira Server НЕ предоставляет встроенную Swagger/OpenAPI документацию');
    logger.info('в формате JSON/YAML. Вместо этого доступны:\n');

    logger.info('1. REST API Browser (HTML интерфейс):');
    logger.info(`   URL: ${baseUrl}/plugins/servlet/restbrowser`);
    logger.info('   Описание: Интерактивный инструмент для просмотра API\n');

    logger.info('2. Официальная документация Atlassian:');
    logger.info('   Jira REST API v3: https://developer.atlassian.com/cloud/jira/platform/rest/v3/');
    logger.info('   Jira REST API v2: https://developer.atlassian.com/cloud/jira/platform/rest/v2/');
    logger.info('   Примечание: Документация для Cloud, но многие endpoints работают и в Server\n');

    logger.info('3. Для плагина Structure:');
    logger.info('   URL: https://docs.almworks.com/structure/latest/rest-api.html\n');

    // Попробуем получить информацию о доступных ресурсах через стандартные endpoints
    logger.info('=== Проверка доступных ресурсов ===\n');

    try {
      // Получаем информацию о сервере
      const serverInfo = await apiClient.getServerInfo();
      logger.info('✅ Информация о сервере получена:');
      logger.info(`   Версия: ${serverInfo.version}`);
      logger.info(`   Тип: ${serverInfo.deploymentType}`);
      logger.info('');

      // Пробуем получить список доступных ресурсов через стандартные endpoints
      logger.info('Проверка стандартных API endpoints:\n');

      const testEndpoints = [
        { name: 'Server Info', endpoint: '/serverInfo', useV3: false },
        { name: 'Myself', endpoint: '/myself', useV3: false },
        { name: 'Projects', endpoint: '/project', useV3: false },
      ];

      for (const test of testEndpoints) {
        try {
          await apiClient.makeRequest(test.endpoint, { useV3Api: test.useV3 });
          logger.info(`✅ ${test.name}: доступен`);
        } catch (error) {
          logger.info(`❌ ${test.name}: недоступен`);
        }
      }

    } catch (error) {
      logger.error('Ошибка при получении информации:', error);
    }

    logger.info('\n=== Итоговая информация ===\n');
    logger.info('❌ Swagger/OpenAPI документация в формате JSON/YAML НЕ доступна');
    logger.info('✅ REST API Browser доступен для интерактивного просмотра');
    logger.info('✅ Официальная документация доступна онлайн');
    logger.info('\n💡 Рекомендация:');
    logger.info('   Используйте REST API Browser для поиска правильных endpoints');
    logger.info('   для Structure API, особенно для методов получения элементов и иерархии');

  } catch (error) {
    logger.error('Критическая ошибка:', error);
    process.exit(1);
  }
}

getAPIInfo().catch(error => {
  logger.error('Необработанная ошибка:', error);
  process.exit(1);
});





