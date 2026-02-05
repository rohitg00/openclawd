# OpenClawd Messaging

A personal AI assistant that runs on your messaging platforms. Send a message on WhatsApp, Telegram, Signal, or iMessage and get responses from Claude with full tool access, persistent memory, scheduled reminders, browser automation, and integrations with 500+ apps.

## Table of Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Messaging Platforms](#messaging-platforms)
  - [WhatsApp](#whatsapp)
  - [Telegram](#telegram)
  - [Signal](#signal)
  - [iMessage](#imessage)
- [Browser Control](#browser-control)
  - [Managed Mode](#managed-mode-isolated-browser)
  - [Chrome Mode](#chrome-mode-your-existing-browser)
- [Memory System](#memory-system)
- [Scheduling and Reminders](#scheduling-and-reminders)
- [App Integrations](#app-integrations-mcp)
- [Commands](#commands)
  - [CLI Commands](#cli-commands)
  - [Chat Commands](#chat-commands)
- [Troubleshooting](#troubleshooting)

---

## Requirements

- Node.js 18 or higher
- macOS, Linux, or Windows
- At least one LLM provider API key (Anthropic recommended)

For specific adapters:
- WhatsApp: A phone with WhatsApp installed
- Telegram: A bot token from @BotFather
- Signal: signal-cli installed and registered
- iMessage: macOS with Messages.app signed in, plus the `imsg` CLI tool

---

## Installation

```bash
cd messaging
npm install
```

### API Keys

Get your API key from one of the supported providers:

**Anthropic (Recommended):**
```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

**Or use Claude Pro/Max subscription:**
```bash
export CLAUDE_SESSION_KEY=sk-ant-sid01-...
```
Get this from claude.ai > DevTools > Cookies > sessionKey

**Other supported providers:**
- OpenAI: `OPENAI_API_KEY`
- Google: `GEMINI_API_KEY`
- Groq: `GROQ_API_KEY`
- DeepSeek: `DEEPSEEK_API_KEY`
- OpenRouter: `OPENROUTER_API_KEY`
- And 15+ more (see `.env.example`)

**Making Keys Permanent:**

Add exports to your shell profile (`~/.bashrc`, `~/.zshrc`, or `~/.bash_profile`):

```bash
echo 'export ANTHROPIC_API_KEY=sk-ant-...' >> ~/.zshrc
source ~/.zshrc
```

---

## Quick Start

Run the CLI:

```bash
node cli.js
```

You will see a menu:

```
What would you like to do?

  1) Terminal chat
  2) Start gateway
  3) Setup adapters
  4) Configure browser
  5) Show current config
  6) Test connection
  7) Exit
```

**Terminal chat** lets you test the assistant directly in your terminal before connecting any messaging platforms.

**Start gateway** runs the full system, connecting to all enabled messaging platforms and listening for messages.

---

## Configuration

All settings are in `config.js`. You can edit this file directly or use the setup wizard (`node cli.js` then select option 3 for adapters or option 4 for browser).

The configuration includes:

```javascript
{
  agentId: 'openclawd',              // Unique identifier for your assistant

  whatsapp: { enabled: true, ... },
  telegram: { enabled: false, token: '', ... },
  signal: { enabled: false, phoneNumber: '', ... },
  imessage: { enabled: false, ... },

  agent: {
    workspace: '~/openclawd',        // Where memory and files are stored
    maxTurns: 50,                // Max tool calls per message
    allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep']
  },

  browser: {
    enabled: true,
    mode: 'managed',               // 'managed' or 'chrome'
    ...
  }
}
```

---

## Messaging Platforms

### WhatsApp

WhatsApp uses QR code authentication. No additional setup required beyond enabling it in config.

1. Enable WhatsApp in config or run the setup wizard
2. Start the gateway: `node cli.js` then select "Start gateway"
3. A QR code will appear in your terminal
4. Open WhatsApp on your phone, go to Settings > Linked Devices > Link a Device
5. Scan the QR code

Your session is saved in `auth_whatsapp/`. You only need to scan once unless you log out.

**Configuration options:**

```javascript
whatsapp: {
  enabled: true,
  allowedDMs: ['*'],           // '*' allows all direct messages
  allowedGroups: [],           // Add group JIDs to allow specific groups
  respondToMentionsOnly: true  // In groups, only respond when @mentioned
}
```

### Telegram

You need a bot token from Telegram's BotFather.

1. Open Telegram and message @BotFather
2. Send `/newbot` and follow the prompts
3. Copy the bot token (looks like `123456789:ABCdefGHIjklmno...`)
4. Run the setup wizard or add the token to config:

```javascript
telegram: {
  enabled: true,
  token: 'YOUR_BOT_TOKEN',
  allowedDMs: ['*'],
  allowedGroups: [],
  respondToMentionsOnly: true
}
```

Start the gateway and message your bot on Telegram.

### Signal

Signal requires the signal-cli tool to be installed and registered.

1. Install signal-cli: https://github.com/AsamK/signal-cli
2. Register your phone number:
   ```bash
   signal-cli -u +1234567890 register
   signal-cli -u +1234567890 verify CODE
   ```
3. Configure in config.js:

```javascript
signal: {
  enabled: true,
  phoneNumber: '+1234567890',
  signalCliPath: 'signal-cli',  // or full path to the binary
  allowedDMs: ['*'],
  allowedGroups: [],
  respondToMentionsOnly: true
}
```

### iMessage

iMessage only works on macOS and requires the `imsg` CLI tool.

1. Make sure you are signed into Messages.app on your Mac
2. Install imsg:
   ```bash
   brew install steipete/formulae/imsg
   ```
   Or download from: https://github.com/steipete/imsg
3. Enable in config:

```javascript
imessage: {
  enabled: true,
  allowedDMs: ['*'],
  allowedGroups: [],
  respondToMentionsOnly: true
}
```

---

## Browser Control

OpenClawd can control a web browser to navigate pages, click buttons, fill forms, and take screenshots. There are two modes:

### Managed Mode (Isolated Browser)

This launches a dedicated Chromium browser with its own profile. Your browsing data is kept separate from your personal browser.

**Setup:**

1. Run `node cli.js` and select "Configure browser"
2. Select "managed - Managed browser"
3. When prompted, allow it to install Playwright's Chromium browser
4. Choose a profile path or accept the default (`~/.openclawd-browser`)
5. Choose whether to run headless (no visible window)

The browser will launch automatically when you start the gateway or terminal chat.

**When to use this mode:**
- You want a clean, isolated browsing environment
- You do not need existing login sessions
- You want to see exactly what the assistant is doing

### Chrome Mode (Your Existing Browser)

This connects to your existing Chrome browser, giving the assistant access to your logged-in sessions. Useful when you need the assistant to interact with sites where you are already authenticated.

**Setup:**

1. Run `node cli.js` and select "Configure browser"
2. Select "chrome - Control your Chrome"
3. Note the CDP port (default 9222)

**Before starting the gateway**, you must launch Chrome with remote debugging enabled:

macOS:
```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
```

Linux:
```bash
google-chrome --remote-debugging-port=9222
```

Windows:
```bash
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
```

Then start the gateway. The assistant will connect to your running Chrome instance.

**When to use this mode:**
- You need the assistant to use your logged-in sessions (Gmail, GitHub, etc.)
- You want to watch and interact with the same browser the assistant controls

**Security note:** This mode gives the assistant access to all your open tabs and logged-in sessions. Only use with sites you trust the assistant to access.

### Browser Tools Available to the Assistant

Once browser is enabled, the assistant can:

- `browser_navigate` - Go to a URL
- `browser_snapshot` - Get the page structure (accessibility tree)
- `browser_screenshot` - Take a screenshot
- `browser_click` - Click elements
- `browser_type` - Type into input fields
- `browser_press` - Press keyboard keys
- `browser_tabs` - List open tabs
- `browser_switch_tab` - Switch between tabs
- `browser_new_tab` / `browser_close_tab` - Manage tabs
- `browser_back` / `browser_forward` / `browser_reload` - Navigation

---

## Memory System

OpenClawd maintains persistent memory across conversations. All memory is stored in the workspace directory (default: `~/openclawd/`).

### Memory Structure

- **MEMORY.md** - Long-term memory for important facts, preferences, and decisions
- **memory/YYYY-MM-DD.md** - Daily notes, one file per day

### How Memory Works

The assistant automatically loads recent memory at the start of each conversation:
- Long-term memory (MEMORY.md)
- Yesterday's notes
- Today's notes

When you tell the assistant to remember something, it decides whether to:
- Add to MEMORY.md (permanent facts, preferences)
- Add to today's daily log (temporary notes, tasks completed)

### Examples

"Remember that my favorite coffee shop is Blue Bottle on Market Street"
- This goes to MEMORY.md

"Remember that I called the dentist today"
- This goes to today's daily log

### Viewing Memory

Use the `/memory` command in chat to see current memory, or `/memory list` to see all memory files.

---

## Scheduling and Reminders

The assistant can schedule messages to be sent later.

### One-time Reminders

"Remind me in 30 minutes to check the oven"
"Send me a message in 2 hours about the meeting"

### Recurring Messages

"Remind me every day at 9am to take my vitamins"
"Send me a status update every hour"

### Cron Expressions

For advanced scheduling, the assistant can use cron expressions:

- `0 9 * * *` - Every day at 9:00 AM
- `0 9 * * 1-5` - Weekdays at 9:00 AM
- `30 14 * * 1` - Every Monday at 2:30 PM

Scheduled jobs persist across restarts and are stored in `~/.openclawd/cron-jobs.json`.

---

## App Integrations (MCP)

OpenClawd uses the Model Context Protocol (MCP) for integrations. Configure MCP servers in `mcp-servers.json`:

```json
{
  "github": {
    "type": "stdio",
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-github"],
    "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}" },
    "enabled": true
  }
}
```

### Available MCP Servers

- GitHub, GitLab
- Slack, Discord
- Google Drive, Sheets
- Brave Search
- Filesystem access
- And many more at [MCP Server List](https://github.com/modelcontextprotocol/servers)

### Using Integrations

Just ask the assistant to do something:

"Create a GitHub issue for the login bug"
"Search for files matching *.ts"
"Look up information about React hooks"

MCP servers provide the tools automatically when configured.

---

## Commands

### CLI Commands

Run these from your terminal:

```bash
node cli.js              # Interactive menu
node cli.js chat         # Start terminal chat directly
node cli.js start        # Start the gateway directly
node cli.js setup        # Run the setup wizard
node cli.js config       # Show current configuration
node cli.js help         # Show help
```

Or if you link the package globally:

```bash
npm link
oclawd             # Interactive menu
oclawd chat         # Terminal chat
oclawd start        # Start gateway
```

### Chat Commands

Use these commands while chatting with OpenClawd on any platform:

| Command | Description |
|---------|-------------|
| `/new` or `/reset` | Start a fresh conversation, clearing context |
| `/status` | Show session information |
| `/memory` | Show current memory summary |
| `/memory list` | List all memory files |
| `/memory search <query>` | Search through memories |
| `/queue` | Show message queue status |
| `/stop` | Stop the current operation |
| `/help` | Show available commands |

---

## Troubleshooting

### "ANTHROPIC_API_KEY not set"

Set your API key as an environment variable:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

Add this to your shell profile (`.bashrc`, `.zshrc`, etc.) to make it permanent.

### MCP Server Not Loading

Make sure your MCP server is properly configured in `mcp-servers.json`:

```json
{
  "github": {
    "type": "stdio",
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-github"],
    "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}" },
    "enabled": true
  }
}
```

Check that:
1. The server is set to `"enabled": true`
2. Required environment variables are set (e.g., `GITHUB_TOKEN`)
3. The npx command can find the MCP server package

### WhatsApp QR Code Not Appearing

Delete the `auth_whatsapp/` folder and restart the gateway to force a new authentication.

### Browser Not Starting (Managed Mode)

Run the browser setup again and make sure Playwright's Chromium is installed:

```bash
npx playwright install chromium
```

### Browser Not Connecting (Chrome Mode)

Make sure Chrome is running with remote debugging enabled before starting the gateway:

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
```

Check that the port in your config matches the port Chrome is using.

### Telegram Bot Not Responding

- Verify your bot token is correct
- Make sure you have started a conversation with your bot (send `/start`)
- Check that `enabled: true` is set in the telegram config

### Signal Not Working

- Verify signal-cli is installed and in your PATH
- Make sure your phone number is registered and verified
- Check the phone number format includes country code (e.g., `+1234567890`)

### iMessage Not Working

- Only works on macOS
- Make sure Messages.app is open and signed in
- Verify imsg is installed: `which imsg`
- Grant terminal/application accessibility permissions if prompted

### Memory Not Persisting

Check that the workspace directory exists and is writable:

```bash
ls -la ~/openclawd/
```

If it does not exist, it will be created automatically on first use.

### Scheduled Jobs Not Running

- Jobs persist in `~/.openclawd/cron-jobs.json`
- Jobs only execute while the gateway is running
- Use `/memory list` in chat to check scheduled jobs

---

## Directory Structure

```
messaging/
  config.js           # Configuration file
  cli.js              # CLI entry point
  gateway.js          # Main gateway process
  adapters/           # Messaging platform adapters
    whatsapp.js
    telegram.js
    signal.js
    imessage.js
  agent/              # Claude agent implementation
    claude-agent.js
    runner.js
  browser/            # Browser control
    server.js
    mcp.js
  memory/             # Memory management
    manager.js
  tools/              # Built-in tools
    cron.js
  commands/           # Slash command handlers
    handler.js
  sessions/           # Session management
    manager.js
  auth_whatsapp/      # WhatsApp auth (created on first run)

~/openclawd/              # Workspace (created on first run)
  MEMORY.md           # Long-term memory
  memory/             # Daily logs
    2025-01-28.md
    ...
```

---

## License

MIT
