# Инструкция по публикации пакета в npm

## Шаг 1: Авторизация в npm

Если у вас еще нет аккаунта в npm:
1. Зарегистрируйтесь на https://www.npmjs.com/signup

Затем авторизуйтесь в терминале:

```bash
npm login
```

Введите:
- Username: ваш username на npmjs.com
- Password: ваш пароль
- Email: ваш email (exmuzzy@gmail.com)

## Шаг 2: Проверка авторизации

```bash
npm whoami
```

Должен показать ваш username.

## Шаг 3: Публикация пакета

Для публикации scoped пакета (@exmuzzy/exmuzzy-mcp) нужно использовать флаг `--access public`:

```bash
npm publish --access public
```

Это сделает пакет публично доступным.

## Шаг 4: Проверка публикации

После публикации проверьте, что пакет доступен:

```bash
npm view @exmuzzy/exmuzzy-mcp
```

Или откройте в браузере:
https://www.npmjs.com/package/@exmuzzy/exmuzzy-mcp

## Шаг 5: Обновление конфигурации Cursor

После успешной публикации обновите конфигурацию Cursor:

```json
{
  "mcpServers": {
    "jira": {
      "command": "npx",
      "args": ["-y", "@exmuzzy/exmuzzy-mcp"],
      "env": {
        "JIRA_BASE_URL": "https://job.sbertroika.ru",
        "JIRA_BEARER_TOKEN": "your-bearer-token-here",
        "LOG_LEVEL": "INFO"
      }
    }
  }
}
```

## Обновление версии

Для обновления пакета:

1. Измените версию в `package.json` (например, на `1.0.1`)
2. Соберите проект: `npm run build`
3. Опубликуйте: `npm publish --access public`

Или используйте npm version:

```bash
npm version patch  # для 1.0.0 -> 1.0.1
npm version minor  # для 1.0.0 -> 1.1.0
npm version major  # для 1.0.0 -> 2.0.0
npm publish --access public
```

