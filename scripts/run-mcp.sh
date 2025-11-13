#!/bin/bash
# Wrapper script to run @exmuzzy/jira-mcp via npx

# Get the directory where npx installs packages
NPX_CACHE=$(npm config get cache)/_npx 2>/dev/null || echo "$HOME/.npm/_npx"

# Try to find the installed package
PACKAGE_PATH=$(find "$NPX_CACHE" -path "*/@exmuzzy/jira-mcp/dist/index.js" 2>/dev/null | head -1)

if [ -n "$PACKAGE_PATH" ] && [ -f "$PACKAGE_PATH" ]; then
    # Use the found package
    exec node "$PACKAGE_PATH"
else
    # Install and run via npx
    exec npx -y @exmuzzy/jira-mcp
fi

