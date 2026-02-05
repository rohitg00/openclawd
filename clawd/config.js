export default {
  agentId: 'clawd',

  whatsapp: {
    enabled: true,
    allowedDMs: ['*'],  // fromMe check handles filtering
    allowedGroups: [],           // group JIDs like '1234567890-1234567890@g.us'
    respondToMentionsOnly: true  // for groups, only respond when mentioned
  },

  imessage: {
    enabled: false,              // Set to true after signing into Messages.app
    allowedDMs: ['*'],           // '*' allows all, or specific chat IDs
    allowedGroups: [],           // group chat IDs
    respondToMentionsOnly: true  // for groups, only respond when mentioned
  },

  telegram: {
    enabled: false,              // Set to true and add bot token
    token: '',                   // Get from @BotFather on Telegram
    allowedDMs: ['*'],           // '*' allows all, or specific user IDs
    allowedGroups: [],           // group chat IDs
    respondToMentionsOnly: true  // for groups, only respond when @mentioned
  },

  signal: {
    enabled: false,              // Set to true after setting up signal-cli
    phoneNumber: '',             // Your Signal phone number with country code (+1234567890)
    signalCliPath: 'signal-cli', // Path to signal-cli binary
    allowedDMs: ['*'],           // '*' allows all, or specific phone numbers
    allowedGroups: [],           // group IDs
    respondToMentionsOnly: true  // for groups, only respond when mentioned
  },

  // Agent configuration
  agent: {
    workspace: '~/clawd',        // Agent workspace directory
    maxTurns: 50,                // Max tool-use turns per message
    allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep']
  },

  browser: {
    enabled: true,
    mode: 'clawd',
    clawd: {
      userDataDir: '~/.clawd-browser-profile',
      headless: false
    },
    chrome: {
      profilePath: '',
      cdpPort: 9222
    }
  }}
