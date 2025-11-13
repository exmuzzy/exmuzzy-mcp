# Examples

This directory contains examples of how to use the Jira MCP Server with different MCP clients.

## Cursor Integration

### Configuration

Add the following to your Cursor MCP configuration:

```json
{
  "mcpServers": {
    "jira": {
      "command": "npx",
      "args": ["@exmuzzy/exmuzzy-mcp"],
      "env": {
        "JIRA_BASE_URL": "https://your-jira-instance.atlassian.net",
        "JIRA_EMAIL": "your-email@company.com",
        "JIRA_API_TOKEN": "your-api-token",
        "JIRA_BEARER_TOKEN": "your-bearer-token"
      }
    }
  }
}
```

### Usage Examples

#### Get Your Issues
```bash
/jira
```

#### Get Specific Issue Details
```bash
/jira RIVER-123
```

#### Complete an Issue
```bash
/jira complete RIVER-123
```

#### Transition Issue Status
```bash
/jira transition RIVER-123 "In Progress"
```

#### Add Comment to Issue
```bash
/jira comment RIVER-123 "This is a comment from MCP"
```

#### Search Issues by Assignee
```bash
/jira john.doe@example.com
```

## Claude Desktop Integration

Add to your Claude Desktop configuration:

**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`
**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "jira": {
      "command": "npx",
      "args": ["@exmuzzy/exmuzzy-mcp"],
      "env": {
        "JIRA_BASE_URL": "https://your-jira-instance.atlassian.net",
        "JIRA_EMAIL": "your-email@company.com",
        "JIRA_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

## Environment Variables

### Required
- `JIRA_BASE_URL`: Your Jira instance URL
- `JIRA_EMAIL`: Your Jira account email

### Authentication (choose one method)

#### Method 1: API Token (recommended)
- `JIRA_API_TOKEN`: Your Jira API token

#### Method 2: Bearer Token
- `JIRA_BEARER_TOKEN`: Bearer token for authentication

#### Method 3: Session Cookies (on-premise only)
- `JIRA_SESSION_COOKIES`: Session cookies string

### Optional
- `LOG_LEVEL`: Logging level (INFO, DEBUG, WARN, ERROR) - default: INFO

## Advanced Configuration

### Custom JQL Queries

You can create custom scripts that use specific JQL queries:

```javascript
// Get high priority issues
const highPriorityIssues = await jira.searchIssues({
  jql: "priority = Highest AND assignee = currentUser()",
  maxResults: 50
});
```

### Project-specific Configuration

```javascript
// Configure for specific project
const projectConfig = {
  baseUrl: "https://company.atlassian.net",
  project: "PROJ",
  defaultAssignee: "john.doe"
};
```

## Troubleshooting

### Common Issues

1. **Authentication Failed**
   - Check your API token is correct
   - Ensure your email matches your Jira account
   - Verify your Jira instance URL

2. **Connection Timeout**
   - Check network connectivity
   - Verify Jira instance is accessible
   - Try different authentication method

3. **Permission Denied**
   - Ensure your account has necessary permissions
   - Check project access rights
   - Verify API token scopes

### Debug Mode

Enable debug logging:

```bash
export LOG_LEVEL=DEBUG
npx @exmuzzy/exmuzzy-mcp
```

## API Reference

See the main documentation in `docs/` folder for complete API reference.
