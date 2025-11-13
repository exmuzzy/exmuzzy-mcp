# Инструкция по созданию репозитория на GitHub

## Шаг 1: Создайте репозиторий на GitHub

### Вариант 1: Через веб-интерфейс (рекомендуется)

1. Откройте https://github.com/new
2. Заполните форму:
   - **Repository name**: `exmuzzy-mcp`
   - **Description**: `Jira MCP Server - Fork with custom modifications`
   - **Visibility**: Public (или Private, если хотите)
   - **НЕ** добавляйте README, .gitignore или лицензию (они уже есть)
3. Нажмите "Create repository"

### Вариант 2: Через GitHub CLI (если установлен)

```bash
gh repo create exmuzzy-mcp --public --description "Jira MCP Server - Fork with custom modifications"
```

## Шаг 2: Обновите remote в локальном репозитории

После создания репозитория выполните:

```bash
cd /Users/exmuzzy2/jira-mcp-server

# Удалите старый remote
git remote remove origin

# Добавьте новый remote (замените YOUR_USERNAME на ваш GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/exmuzzy-mcp.git

# Или если используете SSH:
# git remote add origin git@github.com:YOUR_USERNAME/exmuzzy-mcp.git
```

## Шаг 3: Подготовьте изменения к коммиту

```bash
# Добавьте все изменения
git add .

# Создайте коммит
git commit -m "feat: fork from original jira-mcp-server with custom modifications

- Renamed package to @exmuzzy/jira-mcp
- Updated author and contributors
- Added proper LICENSE with copyright
- Fixed API v2 compatibility issue
- Updated configuration for Cursor MCP"
```

## Шаг 4: Отправьте код в GitHub

```bash
# Отправьте код в новый репозиторий
git push -u origin main

# Если ваша ветка называется master:
# git push -u origin master
```

## Шаг 5: Проверьте результат

Откройте в браузере: `https://github.com/YOUR_USERNAME/exmuzzy-mcp`

## Дополнительно: Настройте GitHub Actions (опционально)

Если хотите автоматическую публикацию в npm при создании тега:

1. Создайте файл `.github/workflows/publish.yml`:

```yaml
name: Publish to npm

on:
  release:
    types: [created]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{secrets.NPM_TOKEN}}
```

2. Добавьте NPM_TOKEN в Secrets репозитория (Settings → Secrets → Actions)

## Важно

- Убедитесь, что файл `.env` добавлен в `.gitignore` (он уже там)
- Не коммитьте токены и секреты
- Проверьте, что LICENSE файл содержит правильный копирайт

