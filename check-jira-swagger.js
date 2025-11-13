#!/usr/bin/env node

/**
 * Скрипт для проверки наличия Swagger/OpenAPI документации в Jira
 */

import dotenv from 'dotenv';
import { JiraApiClient } from './dist/jiraApiClient.js';
import { Logger } from './dist/utils/logger.js';

// Загружаем переменные окружения из .env файла
dotenv.config();

const logger = new Logger('SwaggerCheck');

async function checkSwagger() {
  try {
    logger.info('=== Проверка наличия Swagger/OpenAPI документации в Jira ===\n');

    const apiClient = new JiraApiClient();
    const baseUrl = process.env.JIRA_BASE_URL || 'https://job.sbertroika.ru';
    
    // Список возможных endpoints для Swagger/OpenAPI
    const swaggerEndpoints = [
      // Стандартные пути для Swagger
      '/rest/api/2/swagger.json',
      '/rest/api/3/swagger.json',
      '/rest/api/2/swagger.yaml',
      '/rest/api/3/swagger.yaml',
      
      // Стандартные пути для OpenAPI
      '/rest/api/2/openapi.json',
      '/rest/api/3/openapi.json',
      '/rest/api/2/openapi.yaml',
      '/rest/api/3/openapi.yaml',
      
      // Альтернативные пути
      '/rest/swagger.json',
      '/rest/openapi.json',
      '/api/swagger.json',
      '/api/openapi.json',
      
      // Structure API
      '/rest/structure/latest/swagger.json',
      '/rest/structure/latest/openapi.json',
      '/rest/structure/1.0/swagger.json',
      '/rest/structure/1.0/openapi.json',
      
      // REST API Browser (HTML интерфейс)
      '/plugins/servlet/restbrowser',
      '/rest/api/2/restbrowser',
    ];

    logger.info('Проверка стандартных endpoints для документации API...\n');

    let foundEndpoints = [];

    for (const endpoint of swaggerEndpoints) {
      try {
        const url = `${baseUrl}${endpoint}`;
        logger.debug(`Проверка: ${endpoint}`);
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json, application/yaml, text/html, */*',
          },
        });

        if (response.ok) {
          const contentType = response.headers.get('content-type') || '';
          
          if (contentType.includes('application/json') || 
              contentType.includes('application/yaml') ||
              contentType.includes('text/html')) {
            foundEndpoints.push({
              endpoint,
              url,
              status: response.status,
              contentType,
              type: endpoint.includes('swagger') ? 'Swagger' : 
                    endpoint.includes('openapi') ? 'OpenAPI' :
                    endpoint.includes('restbrowser') ? 'REST Browser' : 'Unknown'
            });
            logger.info(`✅ Найден: ${endpoint} (${response.status}) - ${contentType}`);
          }
        } else if (response.status === 401 || response.status === 403) {
          logger.debug(`   ⚠️  Требуется аутентификация: ${endpoint}`);
        } else {
          logger.debug(`   ❌ Не найден: ${endpoint} (${response.status})`);
        }
      } catch (error) {
        // Игнорируем ошибки сети для несуществующих endpoints
        logger.debug(`   ❌ Ошибка при проверке ${endpoint}: ${error.message}`);
      }
    }

    logger.info('\n=== Результаты проверки ===\n');

    if (foundEndpoints.length > 0) {
      logger.info(`✅ Найдено ${foundEndpoints.length} endpoint(s) с документацией:\n`);
      
      foundEndpoints.forEach((ep, index) => {
        logger.info(`${index + 1}. ${ep.type}: ${ep.endpoint}`);
        logger.info(`   URL: ${ep.url}`);
        logger.info(`   Content-Type: ${ep.contentType}`);
        logger.info('');
      });

      // Попробуем получить содержимое первого найденного JSON endpoint
      const jsonEndpoint = foundEndpoints.find(ep => 
        ep.contentType.includes('application/json') && 
        !ep.endpoint.includes('restbrowser')
      );

      if (jsonEndpoint) {
        logger.info(`\n📄 Попытка получить содержимое: ${jsonEndpoint.endpoint}`);
        try {
          // Используем apiClient для правильной аутентификации
          const response = await apiClient.makeRequest(
            jsonEndpoint.endpoint.replace('/rest/api/2', '').replace('/rest/api/3', ''),
            { useV3Api: jsonEndpoint.endpoint.includes('/api/3') }
          );
          
          logger.info('✅ Содержимое получено успешно');
          logger.info(`   Тип: ${response.swagger ? 'Swagger' : response.openapi ? 'OpenAPI' : 'Unknown'}`);
          if (response.swagger) {
            logger.info(`   Swagger версия: ${response.swagger}`);
            logger.info(`   Info: ${response.info?.title || 'N/A'}`);
            logger.info(`   Paths: ${Object.keys(response.paths || {}).length} endpoints`);
          }
          if (response.openapi) {
            logger.info(`   OpenAPI версия: ${response.openapi}`);
            logger.info(`   Info: ${response.info?.title || 'N/A'}`);
            logger.info(`   Paths: ${Object.keys(response.paths || {}).length} endpoints`);
          }
        } catch (error) {
          logger.warn(`   ⚠️  Не удалось получить содержимое: ${error.message}`);
        }
      }
    } else {
      logger.info('❌ Swagger/OpenAPI документация не найдена\n');
      logger.info('💡 Альтернативные способы получения документации:');
      logger.info('   1. REST API Browser: https://job.sbertroika.ru/plugins/servlet/restbrowser');
      logger.info('   2. Официальная документация: https://developer.atlassian.com/cloud/jira/platform/rest/v3/');
      logger.info('   3. Проверить в админ-панели Jira наличие плагинов для документации API');
    }

    // Проверка REST API Browser
    logger.info('\n=== Проверка REST API Browser ===\n');
    try {
      const browserUrl = `${baseUrl}/plugins/servlet/restbrowser`;
      const response = await fetch(browserUrl, {
        method: 'GET',
        headers: {
          'Accept': 'text/html',
        },
      });

      if (response.ok && response.headers.get('content-type')?.includes('text/html')) {
        logger.info(`✅ REST API Browser доступен: ${browserUrl}`);
        logger.info('   Это HTML интерфейс для просмотра и тестирования API endpoints');
      } else {
        logger.info(`❌ REST API Browser недоступен: ${browserUrl}`);
      }
    } catch (error) {
      logger.info(`❌ REST API Browser недоступен: ${error.message}`);
    }

    logger.info('\n=== Проверка завершена ===');
  } catch (error) {
    logger.error('Критическая ошибка:', error);
    process.exit(1);
  }
}

// Запуск проверки
checkSwagger().catch(error => {
  logger.error('Необработанная ошибка:', error);
  process.exit(1);
});







