/**
 * Type definitions for multi-provider LLM platform
 */

export const API_TYPES = {
  OPENAI: 'openai-completions',
  ANTHROPIC: 'anthropic-messages',
  GOOGLE: 'google-generative-ai',
  COPILOT: 'github-copilot',
  BEDROCK: 'bedrock-converse-stream'
};

export const AUTH_MODES = {
  API_KEY: 'api-key',
  AWS_SDK: 'aws-sdk',
  OAUTH: 'oauth',
  TOKEN: 'token',
  SESSION: 'session'  // For claude.ai Pro/Max subscriptions
};

export const FAILURE_TYPES = {
  AUTH: 'auth',
  RATE_LIMIT: 'rate_limit',
  BILLING: 'billing',
  TIMEOUT: 'timeout',
  UNKNOWN: 'unknown'
};

export const CREDENTIAL_TYPES = {
  API_KEY: 'api_key',
  TOKEN: 'token',
  OAUTH: 'oauth'
};
