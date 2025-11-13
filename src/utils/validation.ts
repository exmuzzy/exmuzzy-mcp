export function validateEnvironment(): void {
  const baseUrl = process.env.JIRA_BASE_URL;
  const bearerToken = process.env.JIRA_BEARER_TOKEN;
  const sessionCookies = process.env.JIRA_SESSION_COOKIES;
  
  // If using session cookies, only baseUrl is required
  if (sessionCookies) {
    if (!baseUrl) {
      throw new Error(
        'Missing required environment variables: JIRA_BASE_URL\n' +
        'When using session cookies authentication, please set:\n' +
        '- JIRA_BASE_URL: Your Jira instance URL (e.g., https://company.atlassian.net)\n' +
        '- JIRA_SESSION_COOKIES: Your session cookies from browser (see README for instructions)'
      );
    }
    return; // Session cookies mode - skip other validations
  }
  
  // If using Bearer token, only baseUrl is required
  if (bearerToken) {
    if (!baseUrl) {
      throw new Error(
        'Missing required environment variables: JIRA_BASE_URL\n' +
        'When using Bearer token authentication, please set:\n' +
        '- JIRA_BASE_URL: Your Jira instance URL (e.g., https://company.atlassian.net)\n' +
        '- JIRA_BEARER_TOKEN: Your Bearer token for authentication'
      );
    }
  } else {
    // Otherwise require email and apiToken for Basic auth
    const required = ['JIRA_BASE_URL', 'JIRA_EMAIL', 'JIRA_API_TOKEN'];
    const missing = required.filter(env => !process.env[env]);
    
    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missing.join(', ')}\n` +
        'Please set the following environment variables:\n' +
        '- JIRA_BASE_URL: Your Jira instance URL (e.g., https://company.atlassian.net)\n' +
        '- JIRA_EMAIL: Your Jira account email\n' +
        '- JIRA_API_TOKEN: Your Jira API token (create at https://id.atlassian.com/manage-profile/security/api-tokens)\n' +
        'Or use Bearer token authentication with:\n' +
        '- JIRA_BASE_URL: Your Jira instance URL\n' +
        '- JIRA_BEARER_TOKEN: Your Bearer token\n' +
        'Or use session cookies from browser:\n' +
        '- JIRA_BASE_URL: Your Jira instance URL\n' +
        '- JIRA_SESSION_COOKIES: Your session cookies (see README for instructions)'
      );
    }
  }

  // Validate URL format
  if (baseUrl) {
    try {
      new URL(baseUrl);
    } catch {
      throw new Error(`Invalid JIRA_BASE_URL format: ${baseUrl}. Please provide a valid URL (e.g., https://company.atlassian.net)`);
    }
  }

  // Validate email format only if not using Bearer token
  if (!bearerToken && process.env.JIRA_EMAIL) {
    const email = process.env.JIRA_EMAIL;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error(`Invalid JIRA_EMAIL format: ${email}. Please provide a valid email address.`);
    }
  }
}