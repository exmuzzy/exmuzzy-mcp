#!/bin/bash

# Скрипт для настройки нового репозитория на GitHub
# Использование: ./setup_new_repo.sh YOUR_GITHUB_USERNAME

set -e

GITHUB_USERNAME=${1:-exmuzzy}
REPO_NAME="exmuzzy-mcp"

echo "🚀 Настройка нового репозитория для $REPO_NAME"
echo ""

# Проверяем, что мы в правильной директории
if [ ! -f "package.json" ]; then
    echo "❌ Ошибка: package.json не найден. Запустите скрипт из корня проекта."
    exit 1
fi

# Удаляем старый remote если существует
if git remote get-url origin > /dev/null 2>&1; then
    echo "📦 Удаление старого remote..."
    git remote remove origin
fi

# Добавляем новый remote
echo "🔗 Добавление нового remote..."
git remote add origin "https://github.com/${GITHUB_USERNAME}/${REPO_NAME}.git"

echo ""
echo "✅ Remote настроен!"
echo ""
echo "📝 Следующие шаги:"
echo ""
echo "1. Создайте репозиторий на GitHub:"
echo "   https://github.com/new"
echo "   Имя: $REPO_NAME"
echo "   Описание: Jira MCP Server - Fork with custom modifications"
echo "   НЕ добавляйте README, .gitignore или лицензию"
echo ""
echo "2. После создания репозитория выполните:"
echo "   git add ."
echo "   git commit -m 'feat: fork from original jira-mcp-server'"
echo "   git push -u origin $(git branch --show-current)"
echo ""
echo "Или выполните автоматически:"
echo "   ./setup_new_repo.sh $GITHUB_USERNAME && git add . && git commit -m 'feat: fork from original jira-mcp-server' && git push -u origin \$(git branch --show-current)"

