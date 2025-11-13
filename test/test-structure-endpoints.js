#!/usr/bin/env node

/**
 * Детальный тест для проверки различных вариантов Structure API endpoints
 * Этот скрипт проверяет код и показывает, какие endpoints будут использоваться
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('=== Анализ Jira Structure REST API конфигурации ===\n');

// Читаем исходный код для анализа
const apiClientPath = join(__dirname, 'src', 'jiraApiClient.ts');
const structureServicePath = join(__dirname, 'src', 'services', 'structureService.ts');

try {
  const apiClientCode = readFileSync(apiClientPath, 'utf-8');
  const structureServiceCode = readFileSync(structureServicePath, 'utf-8');

  console.log('1. Анализ базового пути API:');
  const apiPathMatch = apiClientCode.match(/useStructureApi\s*\?\s*['"]([^'"]+)['"]/);
  if (apiPathMatch) {
    console.log(`   ✅ Базовый путь: ${apiPathMatch[1]}`);
  } else {
    console.log('   ❌ Не найден базовый путь');
  }

  console.log('\n2. Анализ endpoints для получения структур:');
  const getStructuresMatch = apiClientCode.match(/async getStructures[^}]+endpoint[^;]+;/s);
  if (getStructuresMatch) {
    const endpointLine = getStructuresMatch[0].match(/endpoint\s*=\s*[`'"]([^`'"]+)[`'"]/);
    if (endpointLine) {
      console.log(`   ✅ Endpoint: ${endpointLine[1]}`);
      console.log(`   📍 Полный URL будет: {BASE_URL}/rest/structure/latest${endpointLine[1]}`);
    }
  }

  console.log('\n3. Анализ endpoints для получения деталей структуры:');
  const getStructureMatch = apiClientCode.match(/async getStructure[^}]+}/s);
  if (getStructureMatch) {
    const endpointLine = getStructureMatch[0].match(/makeRequest\([`'"]([^`'"]+)[`'"]/);
    if (endpointLine) {
      console.log(`   ✅ Endpoint: ${endpointLine[1]}`);
      console.log(`   📍 Полный URL будет: {BASE_URL}/rest/structure/latest${endpointLine[1]}`);
    }
  }

  console.log('\n4. Анализ endpoints для получения элементов структуры:');
  const getElementsMatch = apiClientCode.match(/async getStructureElements[^}]+endpoint[^;]+;/s);
  if (getElementsMatch) {
    const endpointLine = getElementsMatch[0].match(/endpoint\s*=\s*[`'"]([^`'"]+)[`'"]/);
    if (endpointLine) {
      console.log(`   ✅ Endpoint: ${endpointLine[1]}`);
      console.log(`   📍 Полный URL будет: {BASE_URL}/rest/structure/latest${endpointLine[1]}`);
    }
  }

  console.log('\n5. Анализ endpoints для получения иерархии структуры:');
  const hierarchyMatch = apiClientCode.match(/async getStructureHierarchy[^}]+const endpoints[^;]+;/s);
  if (hierarchyMatch) {
    const endpointsMatch = apiClientCode.match(/const endpoints\s*=\s*\[([^\]]+)\]/s);
    if (endpointsMatch) {
      console.log('   ✅ Найдены следующие варианты endpoints:');
      const endpoints = endpointsMatch[1].match(/[`'"]([^`'"]+)[`'"]/g);
      if (endpoints) {
        endpoints.forEach((ep, index) => {
          const cleanEp = ep.replace(/[`'"]/g, '');
          console.log(`      ${index + 1}. ${cleanEp}`);
          console.log(`         📍 Полный URL: {BASE_URL}/rest/structure/latest${cleanEp}`);
        });
      }
    }
  }

  console.log('\n6. Проверка обработки ошибок:');
  const errorHandlingMatch = structureServiceCode.match(/404[^}]+}/s);
  if (errorHandlingMatch) {
    console.log('   ✅ Обработка ошибок 404 найдена');
    console.log('   ℹ️  При ошибке 404 будет показано сообщение о возможных причинах');
  }

  console.log('\n7. Возможные проблемы и решения:');
  console.log('   ⚠️  Если API не работает, проверьте:');
  console.log('      1. Установлен ли плагин Jira Structure');
  console.log('      2. Доступен ли endpoint /rest/structure/latest/structure');
  console.log('      3. Альтернативные пути:');
  console.log('         - /rest/structure/1.0/structure');
  console.log('         - /rest/structure/2.0/structure');
  console.log('      4. Права доступа пользователя к Structure API');
  console.log('      5. Версию плагина Structure (может требовать другой путь)');

  console.log('\n=== Рекомендации ===');
  console.log('Для проверки работы API:');
  console.log('1. Установите переменные окружения:');
  console.log('   export JIRA_BASE_URL="https://your-jira-instance.com"');
  console.log('   export JIRA_BEARER_TOKEN="your-token"');
  console.log('   # или');
  console.log('   export JIRA_EMAIL="your-email"');
  console.log('   export JIRA_API_TOKEN="your-api-token"');
  console.log('');
  console.log('2. Запустите тест:');
  console.log('   node test-structure-api.js');
  console.log('');
  console.log('3. Или используйте curl для прямой проверки:');
  console.log('   curl -H "Authorization: Bearer YOUR_TOKEN" \\');
  console.log('        https://your-jira-instance.com/rest/structure/latest/structure');

} catch (error) {
  console.error('Ошибка при анализе кода:', error.message);
  process.exit(1);
}







