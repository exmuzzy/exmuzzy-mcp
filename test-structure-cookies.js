#!/usr/bin/env node

/**
 * Тестовый скрипт для проверки cookie-based аутентификации для Structure API
 */

import dotenv from 'dotenv';
import { JiraApiClient } from './dist/jiraApiClient.js';
import { Logger } from './dist/utils/logger.js';

// Загружаем переменные окружения из .env файла
dotenv.config();

const logger = new Logger('StructureCookiesTest');

async function testStructureWithCookies() {
  try {
    logger.info('=== Тестирование Structure API с cookie-based аутентификацией ===\n');

    // Инициализация клиента
    const apiClient = new JiraApiClient();
    
    // Тест подключения
    logger.info('1. Проверка подключения к Jira...');
    try {
      await apiClient.testConnection();
      logger.info('✅ Подключение успешно\n');
    } catch (error) {
      logger.error('❌ Ошибка подключения:', error);
      process.exit(1);
    }

    // Тест получения списка структур (должен использовать cookies)
    logger.info('2. Получение списка структур (с cookie-based auth)...');
    try {
      const structures = await apiClient.getStructures();
      logger.info(`✅ Получено структур: ${structures.length}`);
      
      if (structures.length > 0) {
        logger.info('\nПервые 3 структуры:');
        structures.slice(0, 3).forEach((structure, index) => {
          logger.info(`  ${index + 1}. ID: ${structure.id}, Name: ${structure.name || 'Unnamed'}`);
        });
        
        // Тест получения иерархии структуры (должен использовать /tree endpoint с cookies)
        const testStructureId = structures[0].id?.toString() || structures[0].id;
        logger.info(`\n3. Получение иерархии структуры ${testStructureId} (с /tree endpoint)...`);
        try {
          const hierarchy = await apiClient.getStructureHierarchy(testStructureId, {
            maxResults: 10,
          });
          
          if (hierarchy && hierarchy.elements && hierarchy.elements.length > 0) {
            logger.info(`✅ Получено элементов в иерархии: ${hierarchy.elements.length}`);
            logger.info('\nПервые 3 элемента:');
            hierarchy.elements.slice(0, 3).forEach((element, index) => {
              const type = element.issueKey ? 'Issue' : 'Folder';
              const name = element.issueKey || element.name || element.summary || 'Unnamed';
              logger.info(`  ${index + 1}. ${type}: ${name}`);
            });
          } else {
            logger.info('ℹ️  Структура пустая или элементы не найдены');
          }
        } catch (error) {
          logger.error(`❌ Ошибка получения иерархии: ${error.message}`);
          if (error.message.includes('Cannot create session')) {
            logger.error('\n💡 Решение:');
            logger.error('   Убедитесь, что установлены переменные окружения:');
            logger.error('   - JIRA_EMAIL');
            logger.error('   - JIRA_API_TOKEN');
            logger.error('   (даже если используется JIRA_BEARER_TOKEN)');
          }
        }
      }
      
    } catch (error) {
      logger.error('❌ Ошибка получения структур:', error.message);
      if (error.message.includes('Cannot create session')) {
        logger.error('\n💡 Решение:');
        logger.error('   Убедитесь, что установлены переменные окружения:');
        logger.error('   - JIRA_EMAIL');
        logger.error('   - JIRA_API_TOKEN');
        logger.error('   (даже если используется JIRA_BEARER_TOKEN)');
      }
    }

    logger.info('\n=== Тестирование завершено ===');
  } catch (error) {
    logger.error('Критическая ошибка:', error);
    process.exit(1);
  }
}

// Запуск теста
testStructureWithCookies().catch(error => {
  logger.error('Необработанная ошибка:', error);
  process.exit(1);
});

