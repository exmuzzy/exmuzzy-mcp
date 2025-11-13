#!/usr/bin/env node

/**
 * Скрипт для проверки версии Jira
 */

import dotenv from 'dotenv';
import { JiraApiClient } from './dist/jiraApiClient.js';
import { Logger } from './dist/utils/logger.js';

// Загружаем переменные окружения из .env файла
dotenv.config();

const logger = new Logger('JiraVersionCheck');

async function checkJiraVersion() {
  try {
    logger.info('=== Проверка версии Jira ===\n');

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

    // Получение информации о сервере
    logger.info('2. Получение информации о сервере Jira...');
    try {
      const serverInfo = await apiClient.getServerInfo();
      
      logger.info('✅ Информация о сервере получена:\n');
      logger.info('📋 Детали сервера:');
      logger.info(`   - Версия Jira: ${serverInfo.version || 'N/A'}`);
      logger.info(`   - Версия базы данных: ${serverInfo.deploymentType || 'N/A'}`);
      logger.info(`   - Тип развертывания: ${serverInfo.deploymentType || 'N/A'}`);
      logger.info(`   - Build номер: ${serverInfo.buildNumber || 'N/A'}`);
      logger.info(`   - Build дата: ${serverInfo.buildDate || 'N/A'}`);
      logger.info(`   - Server Title: ${serverInfo.serverTitle || 'N/A'}`);
      
      if (serverInfo.version) {
        const versionParts = serverInfo.version.split('.');
        const majorVersion = parseInt(versionParts[0]);
        const minorVersion = parseInt(versionParts[1]) || 0;
        
        logger.info('\n📊 Анализ версии:');
        logger.info(`   - Major версия: ${majorVersion}`);
        logger.info(`   - Minor версия: ${minorVersion}`);
        
        if (majorVersion >= 9) {
          logger.info('   - ✅ Используется современная версия Jira (9.x+)');
        } else if (majorVersion >= 8) {
          logger.info('   - ✅ Используется версия Jira 8.x');
        } else if (majorVersion >= 7) {
          logger.info('   - ⚠️  Используется версия Jira 7.x (устаревшая)');
        } else {
          logger.info('   - ⚠️  Используется очень старая версия Jira');
        }
      }
      
      // Полная информация в JSON формате
      logger.info('\n📄 Полная информация о сервере (JSON):');
      console.log(JSON.stringify(serverInfo, null, 2));
      
    } catch (error) {
      logger.error('❌ Ошибка получения информации о сервере:', error);
      
      if (error.statusCode === 404 || error.message?.includes('404')) {
        logger.error('\n🔍 Диагностика:');
        logger.error('   - Endpoint /rest/api/2/serverInfo недоступен');
        logger.error('   - Возможно, используется другая версия API');
        logger.error('   - Попробуйте проверить через /rest/api/3/serverInfo');
      }
      
      process.exit(1);
    }

    logger.info('\n=== Проверка завершена ===');
  } catch (error) {
    logger.error('Критическая ошибка:', error);
    process.exit(1);
  }
}

// Запуск проверки
checkJiraVersion().catch(error => {
  logger.error('Необработанная ошибка:', error);
  process.exit(1);
});







