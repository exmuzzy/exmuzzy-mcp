#!/usr/bin/env node

/**
 * Тест для проверки работы cookies
 */

import dotenv from 'dotenv';
import { JiraApiClient } from './dist/jiraApiClient.js';
import { Logger } from './dist/utils/logger.js';

dotenv.config();

const logger = new Logger('CookiesTest');

async function testCookies() {
  try {
    logger.info('=== Тестирование работы cookies ===\n');

    const apiClient = new JiraApiClient();

    // Тест 1: Проверка подключения
    logger.info('1. Проверка подключения...');
    await apiClient.testConnection();
    logger.info('✅ Подключение успешно\n');

    // Тест 2: Проверка получения текущего пользователя с cookies
    logger.info('2. Получение информации о текущем пользователе...');
    const userInfo = await apiClient.getCurrentUser();
    logger.info(`✅ Текущий пользователь: ${userInfo.displayName} (${userInfo.emailAddress})\n`);

    // Тест 3: Получение списка структур
    logger.info('3. Получение списка структур...');
    const structures = await apiClient.getStructures();
    logger.info(`✅ Найдено структур: ${structures.length}\n`);

    logger.info('=== Тестирование завершено успешно ===');

  } catch (error) {
    logger.error('❌ Ошибка тестирования:', error.message);
    if (error.stack) {
      logger.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

testCookies().catch(error => {
  logger.error('Необработанная ошибка:', error);
  process.exit(1);
});



