# OpenClawd

Multi-provider AI platform. 20+ LLMs. MCP integrations. Desktop + messaging.

## Architecture

![OpenClawd Architecture](docs/architecture.png)

```bash
npx openclawd-cli
```

## Install

```bash
git clone https://github.com/rohitg00/openclawd
cd openclawd && ./setup.sh
```

Add your API key to `.env`:

```bash
ANTHROPIC_API_KEY=sk-ant-xxx
```

Run:

```bash
cd server && npm start   # Terminal 1
npm start                # Terminal 2
```

## Providers

Works with any provider. Add API keys to `.env`:

```
ANTHROPIC_API_KEY      # Claude (default)
OPENAI_API_KEY         # GPT-4o, o1
GEMINI_API_KEY         # Gemini 2.0
GROQ_API_KEY           # Ultra-fast Llama
OPENROUTER_API_KEY     # 200+ models
VENICE_API_KEY         # Privacy-focused
DEEPSEEK_API_KEY       # DeepSeek R1
XAI_API_KEY            # Grok
MISTRAL_API_KEY        # Mistral/Codestral
```

Ollama models auto-discovered when running locally.

## MCP Servers

20+ servers included. Add via API or config:

```bash
# Add from catalog
curl -X POST localhost:3001/api/mcp/servers/from-catalog/github

# Or edit server/mcp-servers.json
```

Available: filesystem, memory, git, github, slack, postgres, puppeteer, and more.

## API

```bash
# Chat
curl -X POST localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello", "chatId": "test"}'

# Providers
curl localhost:3001/api/llm/providers

# MCP catalog
curl localhost:3001/api/mcp/catalog
```

## Messaging Bot

AI on WhatsApp, Telegram, Signal, iMessage:

```bash
cd messaging && npm install && node cli.js
```

## Detailed Architecture

![OpenClawd Detailed Architecture](docs/architecture-detailed.png)

### User Interfaces
- **Desktop App** — Electron-based native app for macOS, Windows, Linux
- **CLI** — `npx openclawd` for terminal-first workflows
- **Messaging Gateway** — WhatsApp, Telegram, Signal, iMessage bots

### Backend (Server :3001)
- **Chat API** — SSE-streamed responses for real-time conversation
- **Provider Registry** — Unified interface to 20+ LLM providers
- **MCP Manager** — Loader + catalog for 30+ MCP server integrations
- **Auth Profiles & Usage** — API key management and usage tracking
- **Agent Loop & Memory** — Persistent conversation context and agent orchestration

### LLM Providers (20+)
Claude (Agent SDK), OpenCode (Free+Paid), Ollama (Local), OpenAI, Gemini, Groq, DeepSeek, Mistral, xAI, and more.

### MCP Servers (30+ catalog)
Filesystem, Memory, GitHub, Fetch, Brave, Slack, Git, DB, and more. Add from the built-in catalog or configure manually.

### Build & Release (GitHub Actions)
- macOS `.dmg` / `.zip`
- Windows `.exe` (NSIS)
- Linux `.AppImage` / `.deb`
- npm `openclawd-cli`
- GitHub Release (Draft)

## License

MIT
