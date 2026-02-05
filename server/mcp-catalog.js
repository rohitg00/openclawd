/**
 * MCP Server Catalog - Curated list of popular MCP servers
 * Source: https://github.com/modelcontextprotocol/servers
 */

export const MCP_CATALOG = {
  // Official Reference Servers
  'filesystem': {
    name: 'Filesystem',
    description: 'Secure file operations with configurable access controls',
    package: '@modelcontextprotocol/server-filesystem',
    category: 'core',
    requiresAuth: false,
    config: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '${HOME}']
    }
  },
  'memory': {
    name: 'Memory',
    description: 'Knowledge graph-based persistent memory system',
    package: '@modelcontextprotocol/server-memory',
    category: 'core',
    requiresAuth: false,
    config: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-memory']
    }
  },
  'fetch': {
    name: 'Fetch',
    description: 'Web content fetching and conversion for efficient LLM usage',
    package: '@modelcontextprotocol/server-fetch',
    category: 'core',
    requiresAuth: false,
    config: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-fetch']
    }
  },
  'git': {
    name: 'Git',
    description: 'Tools to read, search, and manipulate Git repositories',
    package: '@modelcontextprotocol/server-git',
    category: 'core',
    requiresAuth: false,
    config: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-git']
    }
  },
  'time': {
    name: 'Time',
    description: 'Time and timezone conversion capabilities',
    package: '@modelcontextprotocol/server-time',
    category: 'core',
    requiresAuth: false,
    config: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-time']
    }
  },
  'sequential-thinking': {
    name: 'Sequential Thinking',
    description: 'Dynamic and reflective problem-solving through thought sequences',
    package: '@modelcontextprotocol/server-sequential-thinking',
    category: 'core',
    requiresAuth: false,
    config: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-sequential-thinking']
    }
  },

  // Developer Tools
  'github': {
    name: 'GitHub',
    description: 'GitHub API integration for repos, issues, PRs, and more',
    package: '@modelcontextprotocol/server-github',
    category: 'developer',
    requiresAuth: true,
    envVars: ['GITHUB_TOKEN'],
    config: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      env: { GITHUB_PERSONAL_ACCESS_TOKEN: '${GITHUB_TOKEN}' }
    }
  },
  'gitlab': {
    name: 'GitLab',
    description: 'GitLab API integration for projects, issues, and merge requests',
    package: '@modelcontextprotocol/server-gitlab',
    category: 'developer',
    requiresAuth: true,
    envVars: ['GITLAB_TOKEN'],
    config: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-gitlab'],
      env: { GITLAB_PERSONAL_ACCESS_TOKEN: '${GITLAB_TOKEN}' }
    }
  },
  'linear': {
    name: 'Linear',
    description: 'Linear issue tracking integration',
    package: '@modelcontextprotocol/server-linear',
    category: 'developer',
    requiresAuth: true,
    envVars: ['LINEAR_API_KEY'],
    config: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-linear'],
      env: { LINEAR_API_KEY: '${LINEAR_API_KEY}' }
    }
  },

  // Communication
  'slack': {
    name: 'Slack',
    description: 'Slack workspace integration for messaging and channels',
    package: '@modelcontextprotocol/server-slack',
    category: 'communication',
    requiresAuth: true,
    envVars: ['SLACK_BOT_TOKEN'],
    config: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-slack'],
      env: { SLACK_BOT_TOKEN: '${SLACK_BOT_TOKEN}' }
    }
  },
  'discord': {
    name: 'Discord',
    description: 'Discord bot integration for servers and channels',
    package: '@modelcontextprotocol/server-discord',
    category: 'communication',
    requiresAuth: true,
    envVars: ['DISCORD_BOT_TOKEN'],
    config: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-discord'],
      env: { DISCORD_BOT_TOKEN: '${DISCORD_BOT_TOKEN}' }
    }
  },

  // Productivity
  'google-drive': {
    name: 'Google Drive',
    description: 'Google Drive file access and management',
    package: '@modelcontextprotocol/server-gdrive',
    category: 'productivity',
    requiresAuth: true,
    envVars: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    config: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-gdrive']
    }
  },
  'notion': {
    name: 'Notion',
    description: 'Notion workspace integration for pages and databases',
    package: '@modelcontextprotocol/server-notion',
    category: 'productivity',
    requiresAuth: true,
    envVars: ['NOTION_API_KEY'],
    config: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-notion'],
      env: { NOTION_API_KEY: '${NOTION_API_KEY}' }
    }
  },

  // Search
  'brave-search': {
    name: 'Brave Search',
    description: 'Web search using Brave Search API',
    package: '@modelcontextprotocol/server-brave-search',
    category: 'search',
    requiresAuth: true,
    envVars: ['BRAVE_API_KEY'],
    config: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-brave-search'],
      env: { BRAVE_API_KEY: '${BRAVE_API_KEY}' }
    }
  },
  'exa': {
    name: 'Exa',
    description: 'AI-powered web search with Exa',
    package: '@modelcontextprotocol/server-exa',
    category: 'search',
    requiresAuth: true,
    envVars: ['EXA_API_KEY'],
    config: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-exa'],
      env: { EXA_API_KEY: '${EXA_API_KEY}' }
    }
  },

  // Database
  'postgres': {
    name: 'PostgreSQL',
    description: 'PostgreSQL database query and management',
    package: '@modelcontextprotocol/server-postgres',
    category: 'database',
    requiresAuth: true,
    envVars: ['POSTGRES_URL'],
    config: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-postgres'],
      env: { POSTGRES_URL: '${POSTGRES_URL}' }
    }
  },
  'sqlite': {
    name: 'SQLite',
    description: 'SQLite database query and management',
    package: '@modelcontextprotocol/server-sqlite',
    category: 'database',
    requiresAuth: false,
    config: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-sqlite', '${DB_PATH}']
    }
  },

  // Cloud
  'aws': {
    name: 'AWS',
    description: 'AWS service integration (S3, Lambda, etc.)',
    package: '@modelcontextprotocol/server-aws',
    category: 'cloud',
    requiresAuth: true,
    envVars: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'],
    config: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-aws']
    }
  },

  // Browser
  'puppeteer': {
    name: 'Puppeteer',
    description: 'Browser automation with Puppeteer',
    package: '@modelcontextprotocol/server-puppeteer',
    category: 'browser',
    requiresAuth: false,
    config: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-puppeteer']
    }
  },
  'playwright': {
    name: 'Playwright',
    description: 'Browser automation with Playwright',
    package: '@anthropic-ai/mcp-server-playwright',
    category: 'browser',
    requiresAuth: false,
    config: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@anthropic-ai/mcp-server-playwright']
    }
  }
};

// Categories for grouping
export const MCP_CATEGORIES = {
  core: { name: 'Core', description: 'Essential reference servers' },
  developer: { name: 'Developer Tools', description: 'Code and project management' },
  communication: { name: 'Communication', description: 'Messaging and collaboration' },
  productivity: { name: 'Productivity', description: 'Documents and workflows' },
  search: { name: 'Search', description: 'Web and data search' },
  database: { name: 'Database', description: 'Database access and queries' },
  cloud: { name: 'Cloud', description: 'Cloud service integrations' },
  browser: { name: 'Browser', description: 'Web automation' }
};

function catalogEntries() {
  return Object.entries(MCP_CATALOG).map(([id, server]) => ({ id, ...server }));
}

export function getRecommendedServers() {
  return catalogEntries().filter(s => !s.requiresAuth);
}

export function getServersByCategory(category) {
  return catalogEntries().filter(s => s.category === category);
}

export function getAllServers() {
  return catalogEntries();
}

export function getAvailableServers() {
  return catalogEntries().filter(s => {
    if (!s.requiresAuth || !s.envVars) return true;
    return s.envVars.every(v => process.env[v]);
  });
}

// Generate config for a server
export function generateServerConfig(serverId) {
  const server = MCP_CATALOG[serverId];
  if (!server) return null;
  return {
    ...server.config,
    enabled: true,
    _package: server.package,
    _description: server.description
  };
}
