#!/usr/bin/env node

/**
 * Тестовый скрипт для проверки работы Jira Structure REST API
 */

import dotenv from 'dotenv';
import { JiraApiClient } from './dist/jiraApiClient.js';
import { Logger } from './dist/utils/logger.js';

// Загружаем переменные окружения из .env файла
dotenv.config();

const logger = new Logger('StructureAPITest');

async function testStructureAPI() {
  try {
    logger.info('=== Тестирование Jira Structure REST API ===\n');

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

    // Тест получения списка структур
    logger.info('2. Получение списка структур...');
    try {
      const structures = await apiClient.getStructures();
      logger.info(`✅ Получено структур: ${structures.length}`);
      
      if (structures.length > 0) {
        logger.info('\nНайденные структуры:');
        structures.forEach((structure, index) => {
          logger.info(`  ${index + 1}. ID: ${structure.id}, Name: ${structure.name || 'Unnamed'}, Project: ${structure.projectKey || 'N/A'}`);
        });
        
        // Тест получения деталей первой структуры
        const firstStructure = structures[0];
        const structureId = firstStructure.id?.toString() || firstStructure.id;
        
        logger.info(`\n3. Получение деталей структуры ${structureId}...`);
        try {
          const structureDetails = await apiClient.getStructure(structureId);
          logger.info(`✅ Детали структуры получены:`);
          logger.info(`   - ID: ${structureDetails.id}`);
          logger.info(`   - Name: ${structureDetails.name || 'Unnamed'}`);
          logger.info(`   - Project: ${structureDetails.projectKey || 'N/A'}`);
          logger.info(`   - Elements: ${structureDetails.elementCount || 0}`);

          // Тест получения элементов структуры
          logger.info(`\n4. Получение элементов структуры ${structureId}...`);
          try {
            const elements = await apiClient.getStructureElements(structureId, { maxResults: 10 });
            const elementsArray = Array.isArray(elements) ? elements : (elements.elements || []);
            logger.info(`✅ Получено элементов: ${elementsArray.length}`);
            
            if (elementsArray.length > 0) {
              logger.info('\nПервые элементы:');
              elementsArray.slice(0, 5).forEach((element, index) => {
                const isFolder = !element.issueKey && (element.type === 'folder' || element.folder === true);
                if (isFolder) {
                  logger.info(`  ${index + 1}. 📁 Folder: ${element.name || element.summary || 'Unnamed'}`);
                } else {
                  logger.info(`  ${index + 1}. 📋 Issue: ${element.issueKey || 'N/A'} - ${(element.summary || element.name || 'No summary').substring(0, 50)}`);
                }
              });
            }
          } catch (error) {
            logger.error(`❌ Ошибка получения элементов:`, error);
            if (error.statusCode === 404 || error.message?.includes('404')) {
              logger.info('   ℹ️  Это может быть нормально, если структура пустая или endpoint отличается');
            }
          }

          // Тест получения иерархии структуры
          logger.info(`\n5. Получение иерархии структуры ${structureId}...`);
          try {
            const hierarchy = await apiClient.getStructureHierarchy(structureId, { maxResults: 10 });
            const elements = hierarchy.elements || [];
            logger.info(`✅ Получено элементов в иерархии: ${elements.length}`);
            
            if (elements.length > 0) {
              logger.info('\nПервые элементы иерархии:');
              elements.slice(0, 5).forEach((element, index) => {
                const isFolder = !element.issueKey && (element.type === 'folder' || element.folder === true);
                if (isFolder) {
                  logger.info(`  ${index + 1}. 📁 Folder: ${element.name || element.summary || 'Unnamed'}`);
                } else {
                  logger.info(`  ${index + 1}. 📋 Issue: ${element.issueKey || 'N/A'} - ${(element.summary || element.name || 'No summary').substring(0, 50)}`);
                }
              });
            }
          } catch (error) {
            logger.error(`❌ Ошибка получения иерархии:`, error);
            if (error.statusCode === 404 || error.message?.includes('404')) {
              logger.info('   ℹ️  Это может быть нормально, если структура пустая или endpoint отличается');
            }
          }
        } catch (error) {
          logger.error(`❌ Ошибка получения деталей структуры:`, error);
        }
      } else {
        logger.info('ℹ️  Структуры не найдены. Это может означать:');
        logger.info('   - Плагин Jira Structure не установлен');
        logger.info('   - API endpoint недоступен');
        logger.info('   - Нет прав доступа к структурам');
        logger.info('   - Структуры не созданы');
      }
    } catch (error) {
      logger.error('❌ Ошибка получения списка структур:', error);
      
      if (error.statusCode === 404 || error.message?.includes('404')) {
        logger.error('\n🔍 Диагностика ошибки 404:');
        logger.error('   - Проверьте, установлен ли плагин Jira Structure');
        logger.error('   - Проверьте доступность API endpoint: /rest/structure/latest/structure');
        logger.error('   - Проверьте права доступа к структурам');
        logger.error('   - Возможно, используется другой путь API (например, /rest/structure/1.0/structure)');
      } else if (error.statusCode === 403 || error.message?.includes('403')) {
        logger.error('\n🔍 Диагностика ошибки 403:');
        logger.error('   - Недостаточно прав доступа к Structure API');
        logger.error('   - Проверьте права пользователя в Jira');
      } else {
        logger.error('\n🔍 Детали ошибки:');
        logger.error(`   - Status: ${error.statusCode || 'N/A'}`);
        logger.error(`   - Message: ${error.message || 'Unknown error'}`);
      }
    }

    logger.info('\n=== Тестирование завершено ===');
  } catch (error) {
    logger.error('Критическая ошибка:', error);
    process.exit(1);
  }
}

// Запуск теста
testStructureAPI().catch(error => {
  logger.error('Необработанная ошибка:', error);
  process.exit(1);
});

