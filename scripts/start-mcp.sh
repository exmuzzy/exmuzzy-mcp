#!/bin/bash
# Startup script for @exmuzzy/jira-mcp via npx

NPX_DIR="$HOME/.npm/_npx"

# Устанавливаем пакет через npx (тихо)
npx -y @exmuzzy/jira-mcp >/dev/null 2>&1

# Находим установленный bin файл
PACKAGE_PATH=$(find "$NPX_DIR" -path "*/@exmuzzy/jira-mcp/bin/jira-mcp.js" 2>/dev/null | head -1)

# Запускаем если найден
if [ -n "$PACKAGE_PATH" ] && [ -f "$PACKAGE_PATH" ]; then
  exec node "$PACKAGE_PATH"
else
  # Fallback: пытаемся запустить через npx напрямую
  exec npx -y @exmuzzy/jira-mcp
fi























