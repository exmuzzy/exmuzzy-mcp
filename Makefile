.PHONY: help build clean dev start test lint format install check-env

# Default target
.DEFAULT_GOAL := help

# Load environment variables from .env if it exists
ifneq (,$(wildcard ./.env))
    include .env
    export
endif

# Colors for output
RED := \033[0;31m
GREEN := \033[0;32m
YELLOW := \033[1;33m
BLUE := \033[0;34m
NC := \033[0m # No Color

##@ General

help: ## Display this help message
	@echo "$(BLUE)Jira MCP Server - Make Commands$(NC)"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make $(YELLOW)<target>$(NC)\n"} /^[a-zA-Z_0-9-]+:.*?##/ { printf "  $(YELLOW)%-20s$(NC) %s\n", $$1, $$2 } /^##@/ { printf "\n$(BLUE)%s$(NC)\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ Development

install: ## Install dependencies
	@echo "$(GREEN)Installing dependencies...$(NC)"
	npm install

build: ## Build the project
	@echo "$(GREEN)Building project...$(NC)"
	npm run build

clean: ## Clean build artifacts
	@echo "$(YELLOW)Cleaning build artifacts...$(NC)"
	npm run clean

dev: ## Start development server with hot reload
	@echo "$(GREEN)Starting development server...$(NC)"
	npm run dev

start: build ## Build and start production server
	@echo "$(GREEN)Starting production server...$(NC)"
	npm run start

lint: ## Run linter
	@echo "$(GREEN)Running linter...$(NC)"
	npm run lint

lint-fix: ## Fix linting issues
	@echo "$(GREEN)Fixing linting issues...$(NC)"
	npm run lint:fix

format: ## Format code with Prettier
	@echo "$(GREEN)Formatting code...$(NC)"
	npm run format

format-check: ## Check code formatting
	@echo "$(GREEN)Checking code formatting...$(NC)"
	npm run format:check

typecheck: ## Run TypeScript type checking
	@echo "$(GREEN)Running type check...$(NC)"
	npm run typecheck

##@ Testing

check-env: ## Check environment variables
	@echo "$(GREEN)Checking environment variables...$(NC)"
	@if [ -z "$$JIRA_BASE_URL" ]; then echo "$(RED)Error: JIRA_BASE_URL not set$(NC)"; exit 1; fi
	@if [ -z "$$JIRA_BEARER_TOKEN" ] && [ -z "$$JIRA_EMAIL" ]; then echo "$(RED)Error: JIRA_BEARER_TOKEN or JIRA_EMAIL/JIRA_API_TOKEN not set$(NC)"; exit 1; fi
	@echo "$(GREEN)✓ Environment variables are set$(NC)"

test-connection: build check-env ## Test Jira connection
	@echo "$(GREEN)Testing Jira connection...$(NC)"
	@node dist/index.js --test-connection 2>&1 | head -5 || echo "$(YELLOW)Connection test completed$(NC)"

test-grouped: build check-env ## Test get_my_issues_grouped (optimized)
	@echo "$(GREEN)Testing get_my_issues_grouped...$(NC)"
	@node test/test-grouped-output.js 2>/dev/null | head -100

test-grouped-full: build check-env ## Test get_my_issues_grouped (full output)
	@echo "$(GREEN)Testing get_my_issues_grouped (full output)...$(NC)"
	@node test/test-grouped-output.js 2>/dev/null

test-priorities: build check-env ## Check Jira priorities
	@echo "$(GREEN)Checking Jira priorities...$(NC)"
	@node test/check-priorities.js 2>/dev/null

##@ MCP Tools Testing

test-boards: build check-env ## Test get_boards
	@echo "$(GREEN)Testing get_boards...$(NC)"
	@node -e "import('./dist/jiraApiClient.js').then(m => { const client = new m.JiraApiClient(); return client.getBoards(); }).then(r => console.log(JSON.stringify(r, null, 2))).catch(e => console.error(e));"

test-my-issues: build check-env ## Test search_issues (my issues)
	@echo "$(GREEN)Testing search_issues (my open issues)...$(NC)"
	@node -e "import('./dist/jiraApiClient.js').then(m => { const client = new m.JiraApiClient(); return client.searchIssues('assignee = currentUser() AND statusCategory != Done', {maxResults: 10}); }).then(r => { console.log('Total:', r.total); r.issues.slice(0,5).forEach(i => console.log('-', i.key, ':', i.fields.summary.substring(0,60))); }).catch(e => console.error(e));"

test-issue-detail: build check-env ## Test get_issue (requires ISSUE_KEY env var)
	@echo "$(GREEN)Testing get_issue_details for $(ISSUE_KEY)...$(NC)"
	@if [ -z "$(ISSUE_KEY)" ]; then echo "$(RED)Error: ISSUE_KEY not set. Usage: make test-issue-detail ISSUE_KEY=RIVER-123$(NC)"; exit 1; fi
	@node -e "import('./dist/jiraApiClient.js').then(m => { const client = new m.JiraApiClient(); return client.getIssue('$(ISSUE_KEY)'); }).then(i => { console.log('Key:', i.key); console.log('Summary:', i.fields.summary); console.log('Status:', i.fields.status.name); console.log('Priority:', i.fields.priority?.name); console.log('Assignee:', i.fields.assignee?.displayName); }).catch(e => console.error(e));"

test-projects: build check-env ## Test get_projects
	@echo "$(GREEN)Testing get_projects...$(NC)"
	@node -e "import('./dist/jiraApiClient.js').then(m => { const client = new m.JiraApiClient(); return client.makeRequest('/project', {useV3Api: false}); }).then(projects => { console.log('Total projects:', projects.length); projects.slice(0,10).forEach(p => console.log('-', p.key, ':', p.name)); }).catch(e => console.error(e));"

test-current-user: build check-env ## Test get_current_user
	@echo "$(GREEN)Testing get_current_user...$(NC)"
	@node -e "import('./dist/jiraApiClient.js').then(m => { const client = new m.JiraApiClient(); return client.makeRequest('/myself', {useV3Api: false}); }).then(user => { console.log('User:', user.displayName); console.log('Email:', user.emailAddress); console.log('Account ID:', user.accountId); }).catch(e => console.error(e));"

test-search-users: build check-env ## Test search_users (requires QUERY env var)
	@echo "$(GREEN)Testing search_users for '$(QUERY)'...$(NC)"
	@if [ -z "$(QUERY)" ]; then echo "$(RED)Error: QUERY not set. Usage: make test-search-users QUERY=Агафонов$(NC)"; exit 1; fi
	@node -e "import('./dist/jiraApiClient.js').then(m => { const client = new m.JiraApiClient(); return client.makeRequest('/user/search?query=$(QUERY)', {useV3Api: false}); }).then(users => { users.slice(0,5).forEach(u => console.log('-', u.displayName, '(', u.emailAddress, ')')); }).catch(e => console.error(e));"

##@ Logs

logs: ## View MCP logs in real-time (macOS)
	@echo "$(GREEN)Viewing MCP logs...$(NC)"
	@tail -f ~/Library/Application\ Support/Cursor/logs/*/window*/exthost/anysphere.cursor-mcp/MCP\ user-jira.log

logs-list: ## List all log directories
	@echo "$(GREEN)Log directories:$(NC)"
	@ls -lt ~/Library/Application\ Support/Cursor/logs/ | head -10

logs-errors: ## Show only errors from logs
	@echo "$(GREEN)Showing errors from logs...$(NC)"
	@tail -100 ~/Library/Application\ Support/Cursor/logs/*/window*/exthost/anysphere.cursor-mcp/MCP\ user-jira.log | grep -i error

##@ Git

git-status: ## Show git status
	@git status

git-log: ## Show git log
	@git log --oneline -10

git-diff: ## Show git diff
	@git diff

##@ Publish

version-patch: ## Bump patch version (1.0.8 -> 1.0.9)
	@echo "$(GREEN)Bumping patch version...$(NC)"
	@npm version patch

version-minor: ## Bump minor version (1.0.8 -> 1.1.0)
	@echo "$(GREEN)Bumping minor version...$(NC)"
	@npm version minor

version-major: ## Bump major version (1.0.8 -> 2.0.0)
	@echo "$(GREEN)Bumping major version...$(NC)"
	@npm version major

publish: build ## Publish to npm
	@echo "$(GREEN)Publishing to npm...$(NC)"
	@echo "$(YELLOW)Warning: This will publish to npm registry!$(NC)"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		npm publish; \
	else \
		echo "$(RED)Publish cancelled$(NC)"; \
	fi

##@ Docker (if needed)

docker-build: ## Build Docker image
	@echo "$(GREEN)Building Docker image...$(NC)"
	docker build -t jira-mcp-server .

docker-run: ## Run Docker container
	@echo "$(GREEN)Running Docker container...$(NC)"
	docker run -it --rm \
		-e JIRA_BASE_URL="$$JIRA_BASE_URL" \
		-e JIRA_BEARER_TOKEN="$$JIRA_BEARER_TOKEN" \
		jira-mcp-server

##@ All Tests

test-all: build check-env ## Run all tests
	@echo "$(BLUE)Running all tests...$(NC)"
	@echo ""
	@echo "$(YELLOW)1. Testing grouped issues...$(NC)"
	@make test-grouped -s
	@echo ""
	@echo "$(YELLOW)2. Testing priorities...$(NC)"
	@make test-priorities -s
	@echo ""
	@echo "$(YELLOW)3. Testing current user...$(NC)"
	@make test-current-user -s
	@echo ""
	@echo "$(YELLOW)4. Testing my issues...$(NC)"
	@make test-my-issues -s
	@echo ""
	@echo "$(GREEN)All tests completed!$(NC)"

