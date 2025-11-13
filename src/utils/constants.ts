/**
 * Application constants and configuration values
 */

export const JIRA = {
  // API versions
  API_VERSION: '2',
  API_VERSION_3: '3',

  // Default limits
  MAX_RESULTS_DEFAULT: 50,
  MAX_RESULTS_MAX: 1000,

  // Status categories
  STATUS_CATEGORIES: {
    NEW: 'new',
    INDETERMINATE: 'indeterminate',
    DONE: 'done'
  },

  // Common issue types
  ISSUE_TYPES: {
    TASK: 'Task',
    BUG: 'Bug',
    STORY: 'Story',
    EPIC: 'Epic'
  }
} as const;

export const LOGGING = {
  LEVELS: {
    ERROR: 'ERROR',
    WARN: 'WARN',
    INFO: 'INFO',
    DEBUG: 'DEBUG'
  },
  DEFAULT_LEVEL: 'INFO'
} as const;

export const VALIDATION = {
  // Environment variable names
  REQUIRED_ENV_VARS: ['JIRA_BASE_URL', 'JIRA_EMAIL', 'JIRA_API_TOKEN'] as const,

  // Email regex pattern
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,

  // Description length limits
  DESCRIPTION_MAX_LENGTH: 100,
  SUMMARY_MAX_LENGTH: 80
} as const;

export const TIMEOUTS = {
  // Request timeouts in milliseconds
  REQUEST_TIMEOUT: 30000,
  CONNECTION_TIMEOUT: 10000
} as const;

export const RETRY = {
  MAX_ATTEMPTS: 3,
  DELAY_MS: 1000,
  BACKOFF_MULTIPLIER: 2
} as const;

export const CACHE = {
  // Cache TTL in milliseconds
  ISSUE_CACHE_TTL: 300000, // 5 minutes
  PROJECT_CACHE_TTL: 600000, // 10 minutes
  USER_CACHE_TTL: 600000 // 10 minutes
} as const;
