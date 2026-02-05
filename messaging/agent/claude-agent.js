import { query } from '@anthropic-ai/claude-agent-sdk'
import { EventEmitter } from 'events'
import MemoryManager from '../memory/manager.js'
import { createCronMcpServer, setContext as setCronContext, getScheduler } from '../tools/cron.js'
import { createGatewayMcpServer, setGatewayContext } from '../tools/gateway.js'

function buildSystemPrompt(memoryContext, sessionInfo, cronInfo) {
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
  const timeStr = now.toLocaleTimeString('en-US', { hour12: true })

  return `You are OpenClawd, a personal AI assistant communicating via messaging platforms (WhatsApp, iMessage, Telegram, Signal).

## Current Context
- Date: ${dateStr}
- Time: ${timeStr}
- Session: ${sessionInfo.sessionKey}
- Platform: ${sessionInfo.platform}

## Memory System

You have access to a persistent memory system. Use it to remember important information across conversations.

### Memory Structure
- **MEMORY.md**: Curated long-term memory for important facts, preferences, and decisions
- **memory/YYYY-MM-DD.md**: Daily notes (append-only log for each day)

### When to Write Memory
- **Immediately write** when the user says "remember this" or similar
- **Write to MEMORY.md** for: preferences, important decisions, recurring information, relationships, key facts
- **Write to daily log** for: tasks completed, temporary notes, conversation context, things that happened today

### Memory Tools
- Use \`Read\` tool to read memory files from ~/openclawd/
- Use \`Write\` or \`Edit\` tools to update memory files
- Workspace path: ~/openclawd/

### Memory Writing Guidelines
1. Be concise but include enough context to be useful later
2. Use markdown headers to organize information
3. Include dates when relevant
4. For MEMORY.md, organize by topic/category
5. For daily logs, use timestamps

## Current Memory Context
${memoryContext || 'No memory files found yet. Start building your memory!'}

## Scheduling / Reminders

You have cron tools to schedule messages:
- \`mcp__cron__schedule_delayed\`: One-time reminder after delay (seconds)
- \`mcp__cron__schedule_recurring\`: Repeat at interval (seconds)
- \`mcp__cron__schedule_cron\`: Cron expression (minute hour day month weekday)
- \`mcp__cron__list_scheduled\`: List all scheduled jobs
- \`mcp__cron__cancel_scheduled\`: Cancel a job by ID

When user says "remind me in X minutes/hours", use schedule_delayed.
When user says "every day at 9am", use schedule_cron with "0 9 * * *".

### Current Scheduled Jobs
${cronInfo || 'No jobs scheduled'}

## Image Handling

When the user sends an image, you will receive it in your context. You can:
- Describe what you see in the image
- Answer questions about the image
- Extract text from images (OCR)
- Analyze charts, diagrams, screenshots

## Communication Style
- Be helpful and conversational
- Keep responses concise for messaging (avoid walls of text)
- DO NOT use markdown formatting (no **, \`, #, -, etc.) - messaging platforms don't render it
- Use plain text only - write naturally without formatting syntax
- Use emoji sparingly and appropriately
- Remember context from the conversation
- Proactively use tools when needed
- DO NOT mention details about connected accounts (emails, usernames, account IDs) unless explicitly asked - just perform the action silently

## Available Tools
Built-in: Read, Write, Edit, Bash, Glob, Grep, TodoWrite, Skill
Scheduling: mcp__cron__* tools
Gateway: mcp__gateway__* tools
MCP Tools: External integrations via configured MCP servers (GitHub, Slack, etc.)
Browser: mcp__browser__* tools (when enabled)

## LLM Provider Support
This agent supports 20+ LLM providers including Anthropic, OpenAI, Google, Venice, Ollama, OpenRouter, Groq, and more.
The default model is Claude, but the server can be configured to use different providers and models.

## Gateway Tools
- \`mcp__gateway__send_message\`: Send a message to any chat on any platform
- \`mcp__gateway__list_platforms\`: List connected platforms
- \`mcp__gateway__get_queue_status\`: Check message queue status
- \`mcp__gateway__get_current_context\`: Get current platform/chat/session info
- \`mcp__gateway__list_sessions\`: List all active sessions
- \`mcp__gateway__broadcast_message\`: Send to multiple chats (use carefully)

## Tool Selection - IMPORTANT

**Default: Use MCP tools for app integrations when available.**
If MCP servers are configured (GitHub, Slack, Gmail, etc.), use the appropriate mcp__* tools.
These are faster, more reliable, and work via API.

**Browser tools are ONLY for when the user explicitly mentions:**
- "browser", "browse", "open website", "go to site", "navigate to"
- "web page", "webpage", "website"
- Specific URLs they want to visit
- Tasks that require visual interaction with a website that MCP tools cannot handle

Examples:
- "Check my GitHub notifications" → Use MCP GitHub tools (if configured)
- "Open google.com in the browser" → Use Browser tools
- "Browse to twitter.com and take a screenshot" → Use Browser tools
- "Search for files in my project" → Use Glob/Grep tools

## Browser Tools (only when explicitly requested)
  - browser_status: Get browser status (running, mode, current URL, tab count)
  - browser_navigate: Navigate to a URL
  - browser_snapshot: Get accessibility tree snapshot (returns elements with [ref=eN] identifiers for targeting)
  - browser_screenshot: Take a screenshot of the current page
  - browser_click: Click element by ref (e.g., "e5") or text description (e.g., "Submit button")
  - browser_type: Type text into input fields (use ref or field name/placeholder)
  - browser_press: Press keyboard keys (e.g., "Enter", "Tab", "Escape")
  - browser_select: Select dropdown options
  - browser_wait: Wait for element or text to appear
  - browser_tabs: List all open tabs
  - browser_switch_tab: Switch to a tab by index
  - browser_new_tab: Open a new tab
  - browser_close_tab: Close current tab
  - browser_back: Go back in history
  - browser_forward: Go forward in history
  - browser_reload: Reload the page

### Browser Workflow (when needed)
1. Use browser_navigate to go to a URL
2. Use browser_snapshot to see the page structure and get element refs
3. Use browser_click/browser_type with refs (e.g., "e5") or descriptions to interact
4. Take browser_screenshot to verify visual state if needed

## Important
- The workspace at ~/openclawd/ is your home - use it to store files and memory
- Always check memory before asking the user for information they may have already told you
- Update memory when you learn new persistent information about the user
- When user asks to be reminded, use the cron scheduling tools

## Platform Switching / Starting Gateway
When the user says things like "can I text you on WhatsApp?" or "I'm going outside, let me message you on WhatsApp":
- This means they want to continue the conversation on WhatsApp
- You need to START the OpenClawd gateway so you can receive WhatsApp messages
- Run this command to start the gateway in the background:
  \`cd ~/openclawd/messaging && npm start > /tmp/openclawd.log 2>&1 &\`
- After starting, confirm: "Gateway started! You can message me on WhatsApp now."
- The gateway will show a QR code in the logs if WhatsApp needs to be connected - tell the user to check /tmp/openclawd.log if needed
`
}

export default class ClaudeAgent extends EventEmitter {
  constructor(config = {}) {
    super()
    this.memoryManager = new MemoryManager()
    this.cronMcpServer = createCronMcpServer()
    this.cronScheduler = getScheduler()
    this.gatewayMcpServer = createGatewayMcpServer()
    this.gateway = null
    this.sessions = new Map()
    this.abortControllers = new Map()

    this.allowedTools = config.allowedTools || [
      'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep',
      'TodoWrite', 'Skill'
    ]

    this.cronTools = [
      'mcp__cron__schedule_delayed',
      'mcp__cron__schedule_recurring',
      'mcp__cron__schedule_cron',
      'mcp__cron__list_scheduled',
      'mcp__cron__cancel_scheduled'
    ]

    this.gatewayTools = [
      'mcp__gateway__send_message',
      'mcp__gateway__list_platforms',
      'mcp__gateway__get_queue_status',
      'mcp__gateway__get_current_context',
      'mcp__gateway__list_sessions',
      'mcp__gateway__broadcast_message'
    ]

    this.maxTurns = config.maxTurns || 50
    this.permissionMode = config.permissionMode || 'bypassPermissions'

    this.cronScheduler.on('execute', (data) => this.emit('cron:execute', data))
  }

  getSession(sessionKey) {
    if (!this.sessions.has(sessionKey)) {
      this.sessions.set(sessionKey, {
        sdkSessionId: null,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        messageCount: 0
      })
    }
    return this.sessions.get(sessionKey)
  }

  abort(sessionKey) {
    const controller = this.abortControllers.get(sessionKey)
    if (controller) {
      console.log('[ClaudeAgent] Aborting query for:', sessionKey)
      controller.abort()
      this.abortControllers.delete(sessionKey)
      return true
    }
    return false
  }

  getCronSummary() {
    const jobs = this.cronScheduler.list()
    if (jobs.length === 0) return null
    return jobs.map(j => `- ${j.id}: ${j.description} (${j.type})`).join('\n')
  }

  buildPrompt(message, image) {
    if (!image) return message

    return [
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: image.mediaType,
          data: image.data
        }
      },
      {
        type: 'text',
        text: message
      }
    ]
  }

  async *generateMessages(message, image) {
    yield {
      type: 'user',
      message: {
        role: 'user',
        content: this.buildPrompt(message, image)
      }
    }
  }

  async *run(params) {
    const {
      message,
      sessionKey,
      platform = 'unknown',
      chatId = null,
      image = null,
      mcpServers = {}
    } = params

    const session = this.getSession(sessionKey)
    session.lastActivity = Date.now()
    session.messageCount++

    setCronContext({ platform, chatId, sessionKey })

    setGatewayContext({
      gateway: this.gateway,
      currentPlatform: platform,
      currentChatId: chatId,
      currentSessionKey: sessionKey
    })

    const memoryContext = this.memoryManager.getMemoryContext()
    const cronInfo = this.getCronSummary()
    const systemPrompt = buildSystemPrompt(memoryContext, { sessionKey, platform }, cronInfo)

    const allAllowedTools = [...this.allowedTools, ...this.cronTools, ...this.gatewayTools]

    const queryOptions = {
      allowedTools: allAllowedTools,
      maxTurns: this.maxTurns,
      permissionMode: this.permissionMode,
      systemPrompt,
      includePartialMessages: true,
      mcpServers: {
        cron: this.cronMcpServer,
        gateway: this.gatewayMcpServer,
        ...mcpServers
      }
    }

    if (session.sdkSessionId) {
      queryOptions.resume = session.sdkSessionId
    }

    const abortController = new AbortController()
    this.abortControllers.set(sessionKey, abortController)

    if (image) console.log('[ClaudeAgent] With image attachment')

    this.emit('run:start', { sessionKey, message, hasImage: !!image })

    try {
      let fullText = ''
      let hasStreamedContent = false

      for await (const chunk of query({
        prompt: this.generateMessages(message, image),
        options: queryOptions,
        abortSignal: abortController.signal
      })) {
        if (chunk.type === 'system' && chunk.subtype === 'init') {
          const newSessionId = chunk.session_id || chunk.data?.session_id
          if (newSessionId && !session.sdkSessionId) {
            session.sdkSessionId = newSessionId
          } else if (newSessionId) {
            session.sdkSessionId = newSessionId
          }
          continue
        }

        if (chunk.type === 'stream_event' && chunk.event) {
          const event = chunk.event
          hasStreamedContent = true

          if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
            const text = event.delta.text
            if (text) {
              fullText += text
              yield { type: 'text', content: text }
              this.emit('run:text', { sessionKey, content: text })
            }
          }
          else if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
            yield {
              type: 'tool_use',
              name: event.content_block.name,
              input: {},
              id: event.content_block.id
            }
            this.emit('run:tool', { sessionKey, name: event.content_block.name })
          }
          continue
        }

        if (chunk.type === 'assistant' && chunk.message?.content) {
          for (const block of chunk.message.content) {
            if (block.type === 'text' && block.text && !hasStreamedContent) {
              fullText += block.text
              yield { type: 'text', content: block.text }
              this.emit('run:text', { sessionKey, content: block.text })
            } else if (block.type === 'tool_use') {
              if (!hasStreamedContent) {
                yield { type: 'tool_use', name: block.name, input: block.input, id: block.id }
                this.emit('run:tool', { sessionKey, name: block.name })
              }
            }
          }
          continue
        }

        if (chunk.type === 'tool_result' || chunk.type === 'result') {
          yield { type: 'tool_result', result: chunk.result || chunk.content }
          continue
        }

        if (chunk.type !== 'system') {
          yield chunk
        }
      }

      yield { type: 'done', fullText }
      this.emit('run:complete', { sessionKey, response: fullText })

    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('[ClaudeAgent] Aborted:', sessionKey)
        yield { type: 'aborted' }
        this.emit('run:aborted', { sessionKey })
      } else {
        console.error('[ClaudeAgent] Error:', error)
        yield { type: 'error', error: error.message }
        this.emit('run:error', { sessionKey, error })
        throw error
      }
    } finally {
      this.abortControllers.delete(sessionKey)
    }
  }

  async runAndCollect(params) {
    let fullText = ''
    for await (const chunk of this.run(params)) {
      if (chunk.type === 'text') {
        fullText += chunk.content
      }
      if (chunk.type === 'done') {
        return chunk.fullText || fullText
      }
      if (chunk.type === 'error') {
        throw new Error(chunk.error)
      }
    }
    return fullText
  }

  stopCron() {
    this.cronScheduler.stop()
  }
}
