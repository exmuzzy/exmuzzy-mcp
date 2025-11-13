#!/bin/bash

# Скрипт для создания репозитория на GitHub и отправки кода
# Использование: ./create_repo.sh

set -e

echo "🚀 Создание репозитория на GitHub..."
echo ""

# Проверяем авторизацию
if ! gh auth status &>/dev/null; then
    echo "❌ Требуется авторизация в GitHub CLI"
    echo ""
    echo "Выполните авторизацию:"
    echo "  gh auth login"
    echo ""
    echo "Выберите:"
    echo "  - GitHub.com"
    echo "  - HTTPS"
    echo "  - Login with a web browser"
    echo ""
    exit 1
fi

echo "✅ Авторизация проверена"
echo ""

# Создаем репозиторий и отправляем код
echo "📦 Создание репозитория exmuzzy-mcp..."
gh repo create exmuzzy-mcp \
    --public \
    --description "Jira MCP Server - Fork with custom modifications" \
    --source=. \
    --remote=origin \
    --push

echo ""
echo "✅ Репозиторий создан и код отправлен!"
echo ""
echo "🔗 Откройте: https://github.com/$(gh api user --jq .login)/exmuzzy-mcp"

