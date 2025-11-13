#!/usr/bin/env node

/**
 * Простой тест для проверки /tree endpoint с cookie-based аутентификацией
 */

import dotenv from 'dotenv';
import { JiraApiClient } from './dist/jiraApiClient.js';
import { Logger } from './dist/utils/logger.js';

dotenv.config();

const logger = new Logger('TreeEndpointTest');

async function testTreeEndpoint() {
  try {
    logger.info('=== Тестирование /tree endpoint для Structure API ===\n');

    const apiClient = new JiraApiClient();
    
    // Тест подключения
    logger.info('1. Проверка подключения...');
    await apiClient.testConnection();
    logger.info('✅ Подключение успешно\n');

    // Получаем список структур
    logger.info('2. Получение списка структур...');
    const structures = await apiClient.getStructures();
    logger.info(`✅ Найдено структур: ${structures.length}\n`);

    if (structures.length === 0) {
      logger.error('❌ Структуры не найдены');
      return;
    }

    // Пробуем получить дерево для структуры 138 (известная структура)
    const testStructureId = '138';
    logger.info(`3. Получение дерева структуры ${testStructureId} через /tree endpoint...`);
    
    try {
      const hierarchy = await apiClient.getStructureHierarchy(testStructureId, {
        maxResults: 50,
      });
      
      logger.info(`\n📊 Результат:`);
      logger.info(`   - Тип ответа: ${Array.isArray(hierarchy) ? 'Array' : typeof hierarchy}`);
      logger.info(`   - Ключи объекта: ${hierarchy ? Object.keys(hierarchy).join(', ') : 'null'}`);
      
      if (hierarchy && hierarchy.elements) {
        logger.info(`   ✅ Получено элементов: ${hierarchy.elements.length}`);
        
        if (hierarchy.elements.length > 0) {
          logger.info(`\n   Первые 5 элементов:`);
          hierarchy.elements.slice(0, 5).forEach((element, index) => {
            const type = element.issueKey ? 'Issue' : (element.folder ? 'Folder' : 'Unknown');
            const name = element.issueKey || element.name || element.summary || 'Unnamed';
            logger.info(`     ${index + 1}. [${type}] ${name}`);
          });
        } else {
          logger.info(`   ℹ️  Структура пустая`);
        }
      } else if (Array.isArray(hierarchy)) {
        logger.info(`   ✅ Получено элементов: ${hierarchy.length}`);
        if (hierarchy.length > 0) {
          logger.info(`\n   Первые 5 элементов:`);
          hierarchy.slice(0, 5).forEach((element, index) => {
            const type = element.issueKey ? 'Issue' : (element.folder ? 'Folder' : 'Unknown');
            const name = element.issueKey || element.name || element.summary || 'Unnamed';
            logger.info(`     ${index + 1}. [${type}] ${name}`);
          });
        }
      } else {
        logger.info(`   📄 Полный ответ:`);
        console.log(JSON.stringify(hierarchy, null, 2));
      }
      
    } catch (error) {
      logger.error(`❌ Ошибка: ${error.message}`);
      if (error.stack) {
        logger.error(`\nStack trace:\n${error.stack}`);
      }
    }

    logger.info('\n=== Тестирование завершено ===');
  } catch (error) {
    logger.error('Критическая ошибка:', error);
    process.exit(1);
  }
}

testTreeEndpoint().catch(error => {
  logger.error('Необработанная ошибка:', error);
  process.exit(1);
});





