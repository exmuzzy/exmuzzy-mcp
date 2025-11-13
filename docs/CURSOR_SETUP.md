# Настройка Jira MCP Server в Cursor

## Шаг 1: Найдите файл конфигурации MCP в Cursor

Конфигурация MCP в Cursor обычно находится в одном из следующих мест:

### Вариант 1: Cursor Settings (рекомендуется)
1. Откройте Cursor
2. Нажмите `Cmd + Shift + P` (или `Ctrl + Shift + P` на Windows/Linux)
3. Введите "Preferences: Open User Settings (JSON)"
4. Найдите или создайте секцию `mcpServers`

### Вариант 2: Прямой путь к файлу настроек
На macOS:
```
~/Library/Application Support/Cursor/User/settings.json
```

На Windows:
```
%APPDATA%\Cursor\User\settings.json
```

На Linux:
```
~/.config/Cursor/User/settings.json
```

## Шаг 2: Добавьте конфигурацию MCP сервера

Добавьте следующую конфигурацию в ваш файл настроек Cursor:

### Использование локального сервера (рекомендуется для разработки):

```json
{
  "mcpServers": {
    "jira": {
      "command": "node",
      "args": ["/Users/exmuzzy2/jira-mcp-server/dist/index.js"],
      "env": {
        "JIRA_BASE_URL": "https://job.sbertroika.ru",
        "JIRA_BEARER_TOKEN": "your-bearer-token-here",
        "LOG_LEVEL": "INFO"
      }
    }
  }
}
```

### Использование через npx (если пакет опубликован):

```json
{
  "mcpServers": {
    "jira": {
      "command": "npx",
      "args": ["-y", "@exmuzzy/jira-mcp"],
      "env": {
        "JIRA_BASE_URL": "https://job.sbertroika.ru",
        "JIRA_BEARER_TOKEN": "your-bearer-token-here",
        "LOG_LEVEL": "INFO"
      }
    }
  }
}
```

### Использование Basic Auth (если Bearer токен не используется):

```json
{
  "mcpServers": {
    "jira": {
      "command": "node",
      "args": ["/Users/exmuzzy2/jira-mcp-server/dist/index.js"],
      "env": {
        "JIRA_BASE_URL": "https://job.sbertroika.ru",
        "JIRA_EMAIL": "your-email@example.com",
        "JIRA_API_TOKEN": "your-api-token",
        "LOG_LEVEL": "INFO"
      }
    }
  }
}
```

## Шаг 3: Перезапустите Cursor

После добавления конфигурации:
1. Сохраните файл настроек
2. Полностью закройте и перезапустите Cursor
3. MCP сервер должен автоматически подключиться при запуске

## Шаг 4: Проверка работы

После перезапуска Cursor вы сможете использовать инструменты Jira через AI ассистента:

- "Покажи мне все мои открытые задачи в Jira"
- "Найди задачу RIVER-2147"
- "Создай новую задачу в проекте RIVER"
- "Покажи все доски в Jira"

## Доступные инструменты

После настройки будут доступны следующие инструменты:

### Управление задачами (Issues)
- `search_issues` - Поиск задач по JQL
- `get_issue_details` - Получить детали задачи
- `create_issue` - Создать новую задачу
- `update_issue` - Обновить задачу
- `transition_issue` - Изменить статус задачи
- `add_comment` - Добавить комментарий

### Управление досками (Boards)
- `get_boards` - Список всех досок
- `get_board_details` - Детали доски
- `get_board_issues` - Задачи на доске

### Пользователи
- `get_current_user` - Текущий пользователь
- `search_users` - Поиск пользователей
- `get_user_details` - Детали пользователя

### Проекты
- `get_projects` - Список проектов
- `get_project_details` - Детали проекта

### Учет времени
- `add_worklog` - Добавить запись времени
- `get_worklogs` - Получить записи времени

### Система
- `get_server_info` - Информация о сервере

## Устранение неполадок

### Сервер не запускается
1. Убедитесь, что путь к `dist/index.js` правильный
2. Проверьте, что проект собран: `npm run build`
3. Проверьте права на выполнение: `chmod +x dist/index.js`

### Ошибки аутентификации
1. Проверьте правильность `JIRA_BASE_URL`
2. Убедитесь, что Bearer токен или API токен действительны
3. Проверьте логи в Cursor (View → Output → MCP)

### Инструменты не отображаются
1. Перезапустите Cursor полностью
2. Проверьте конфигурацию JSON на синтаксические ошибки
3. Убедитесь, что MCP сервер запущен (проверьте логи)

## Примеры использования

После настройки вы можете использовать естественный язык:

```
"Покажи все мои открытые задачи"
"Найди задачу RIVER-2147 и покажи её детали"
"Создай новую задачу типа Bug в проекте RIVER с названием 'Ошибка входа'"
"Переведи задачу RIVER-2147 в статус 'In Progress'"
"Добавь комментарий к задаче RIVER-2147: 'Исправлено'"
"Покажи все доски Scrum"
"Запиши 2 часа работы на задачу RIVER-2147"
```



