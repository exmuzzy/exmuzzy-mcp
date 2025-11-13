/**
 * Application configuration management
 */

import { LOGGING, TIMEOUTS, RETRY, CACHE, VALIDATION } from './constants.js';

export interface JiraConfig {
  baseUrl: string;
  email: string | undefined;
  apiToken: string | undefined;
  bearerToken: string | undefined;
  sessionCookies: string | undefined;
}

export interface AppConfig {
  jira: JiraConfig;
  logging: {
    level: string;
  };
  timeouts: typeof TIMEOUTS;
  retry: typeof RETRY;
  cache: typeof CACHE;
  validation: typeof VALIDATION;
}

/**
 * Load configuration from environment variables
 */
export function loadConfig(): AppConfig {
  const jiraConfig: JiraConfig = {
    baseUrl: process.env.JIRA_BASE_URL || '',
    email: process.env.JIRA_EMAIL,
    apiToken: process.env.JIRA_API_TOKEN,
    bearerToken: process.env.JIRA_BEARER_TOKEN,
    sessionCookies: process.env.JIRA_SESSION_COOKIES
  };

  return {
    jira: jiraConfig,
    logging: {
      level: process.env.LOG_LEVEL || LOGGING.DEFAULT_LEVEL
    },
    timeouts: TIMEOUTS,
    retry: RETRY,
    cache: CACHE,
    validation: VALIDATION
  };
}

/**
 * Validate required configuration
 */
export function validateConfig(config: AppConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.jira.baseUrl) {
    errors.push('JIRA_BASE_URL is required');
  }

  if (!config.jira.email) {
    errors.push('JIRA_EMAIL is required');
  }

  // Check authentication methods
  const hasApiToken = !!config.jira.apiToken;
  const hasBearerToken = !!config.jira.bearerToken;
  const hasSessionCookies = !!config.jira.sessionCookies;

  if (!hasApiToken && !hasBearerToken && !hasSessionCookies) {
    errors.push('At least one authentication method is required: JIRA_API_TOKEN, JIRA_BEARER_TOKEN, or JIRA_SESSION_COOKIES');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get configuration singleton
 */
let configInstance: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (!configInstance) {
    configInstance = loadConfig();
    const validation = validateConfig(configInstance);
    if (!validation.valid) {
      throw new Error(`Configuration validation failed:\n${validation.errors.join('\n')}`);
    }
  }
  return configInstance;
}
