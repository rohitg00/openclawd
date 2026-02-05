import config from './config.js'
import WhatsAppAdapter from './adapters/whatsapp.js'
import iMessageAdapter from './adapters/imessage.js'
import TelegramAdapter from './adapters/telegram.js'
import SignalAdapter from './adapters/signal.js'
import SessionManager from './sessions/manager.js'
import AgentRunner from './agent/runner.js'
import CommandHandler from './commands/handler.js'
import { loadMcpServers } from './mcp-loader.js'
import { getAvailableProviders, discoverOllamaModels } from './providers/provider-registry.js'
import { BrowserServer, createBrowserMcpServer } from './browser/index.js'

class Gateway {
  constructor() {
    this.sessionManager = new SessionManager()
    this.agentRunner = new AgentRunner(this.sessionManager, {
      allowedTools: config.agent?.allowedTools || ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
      maxTurns: config.agent?.maxTurns || 50
    })
    this.commandHandler = new CommandHandler(this)
    this.adapters = new Map()
    this.browserServer = null
    this.mcpServers = {}
    this.setupQueueMonitoring()
    this.setupAgentMonitoring()
    this.setupCronExecution()
  }

  async initMcpServers() {
    console.log('[MCP] Loading configuration...')
    const configuredServers = loadMcpServers()
    Object.assign(this.mcpServers, configuredServers)
    console.log(`[MCP] ${Object.keys(configuredServers).length} server(s) loaded`)

    const providers = await getAvailableProviders()
    console.log(`[LLM] ${providers.length} provider(s) available: ${providers.map(p => p.name).join(', ')}`)

    const ollamaModels = await discoverOllamaModels()
    if (ollamaModels.length > 0) {
      console.log(`[LLM] Discovered ${ollamaModels.length} Ollama model(s)`)
    }

    if (config.browser?.enabled) {
      console.log('[Browser] Mode:', config.browser.mode || 'managed')

      try {
        this.browserServer = new BrowserServer(config.browser)
        this.mcpServers.browser = createBrowserMcpServer(this.browserServer)
        console.log('[Browser] Ready')
      } catch (err) {
        console.error('[Browser] Failed to initialize:', err.message)
        if (config.browser.mode === 'chrome') {
          console.error('[Browser] Make sure Chrome is running with --remote-debugging-port=' + (config.browser.chrome?.cdpPort || 9222))
        }
      }
    }
  }

  setupQueueMonitoring() {
    this.agentRunner.on('queued', ({ runId, sessionKey, position, queueLength }) => {
      if (position > 0) {
        console.log(`[Queue] Queued: position ${position + 1}, ${queueLength} pending`)
      }
    })

    this.agentRunner.on('processing', ({ runId, waitTimeMs, remainingInQueue }) => {
      if (waitTimeMs > 100) {
        console.log(`[Queue] Processing (waited ${Math.round(waitTimeMs)}ms, ${remainingInQueue} remaining)`)
      }
    })

    this.agentRunner.on('completed', ({ runId, processingTimeMs }) => {
      console.log(`[Queue] Completed in ${Math.round(processingTimeMs)}ms`)
    })

    this.agentRunner.on('failed', ({ runId, error }) => {
      console.log(`[Queue] Failed: ${error}`)
    })
  }

  setupAgentMonitoring() {
    this.agentRunner.on('agent:tool', ({ sessionKey, name }) => {
      console.log(`[Agent] Using tool: ${name}`)
    })
  }

  setupCronExecution() {
    this.agentRunner.agent.cronScheduler.on('execute', async ({ jobId, platform, chatId, sessionKey, message, invokeAgent }) => {
      console.log(`[Cron] Executing job ${jobId}${invokeAgent ? ' (invoking agent)' : ''}`)

      const adapter = this.adapters.get(platform)
      if (!adapter) {
        console.error(`[Cron] No adapter for platform: ${platform}`)
        return
      }

      try {
        if (invokeAgent) {
          console.log(`[Cron] Invoking agent with: ${message}`)
          const response = await this.agentRunner.agent.runAndCollect({
            message,
            sessionKey: sessionKey || `cron:${jobId}`,
            platform,
            chatId,
            mcpServers: this.mcpServers
          })

          if (response) {
            await adapter.sendMessage(chatId, response)
            console.log(`[Cron] Agent response sent for job ${jobId}`)
          }
        } else {
          await adapter.sendMessage(chatId, message)
          console.log(`[Cron] Message sent for job ${jobId}`)
        }
      } catch (err) {
        console.error(`[Cron] Failed to execute job:`, err.message)
      }
    })
  }

  async start() {
    console.log('='.repeat(50))
    console.log('OpenClawd Gateway Starting')
    console.log('='.repeat(50))
    console.log(`Agent ID: ${config.agentId}`)
    console.log(`Workspace: ~/openclawd/`)
    console.log('')

    await this.initMcpServers()
    this.agentRunner.setMcpServers(this.mcpServers)

    this.agentRunner.agent.gateway = this

    if (config.whatsapp.enabled) {
      console.log('[Gateway] Initializing WhatsApp adapter...')
      const whatsapp = new WhatsAppAdapter(config.whatsapp)
      this.setupAdapter(whatsapp, 'whatsapp', config.whatsapp)
      this.adapters.set('whatsapp', whatsapp)

      try {
        await whatsapp.start()
      } catch (err) {
        console.error('[Gateway] WhatsApp adapter failed to start:', err.message)
      }
    }

    if (config.imessage.enabled) {
      console.log('[Gateway] Initializing iMessage adapter...')
      const imessage = new iMessageAdapter(config.imessage)
      this.setupAdapter(imessage, 'imessage', config.imessage)
      this.adapters.set('imessage', imessage)

      try {
        await imessage.start()
      } catch (err) {
        console.error('[Gateway] iMessage adapter failed to start:', err.message)
      }
    }


    if (config.telegram?.enabled) {
      console.log('[Gateway] Initializing Telegram adapter...')
      const telegram = new TelegramAdapter(config.telegram)
      this.setupAdapter(telegram, 'telegram', config.telegram)
      this.adapters.set('telegram', telegram)

      try {
        await telegram.start()
      } catch (err) {
        console.error('[Gateway] Telegram adapter failed to start:', err.message)
      }
    }

    if (config.signal?.enabled) {
      console.log('[Gateway] Initializing Signal adapter...')
      const signal = new SignalAdapter(config.signal)
      this.setupAdapter(signal, 'signal', config.signal)
      this.adapters.set('signal', signal)

      try {
        await signal.start()
      } catch (err) {
        console.error('[Gateway] Signal adapter failed to start:', err.message)
      }
    }

    process.on('SIGINT', () => this.stop())
    process.on('SIGTERM', () => this.stop())

    console.log('')
    console.log('[Gateway] Ready and listening for messages')
    console.log('[Gateway] Using memory + cron + MCP + multi-provider LLM')
    console.log('[Gateway] Commands: /help, /new, /status, /memory, /stop')
  }

  setupAdapter(adapter, platform, platformConfig) {
    adapter.onMessage(async (message) => {
      const sessionKey = adapter.generateSessionKey(config.agentId, platform, message)

      console.log('')
      console.log(`[${platform.toUpperCase()}] Incoming message:`)
      console.log(`  Session: ${sessionKey}`)
      console.log(`  From: ${message.sender}`)
      console.log(`  Group: ${message.isGroup}`)
      console.log(`  Text: ${message.text.substring(0, 100)}${message.text.length > 100 ? '...' : ''}`)
      if (message.image) {
        console.log(`  Image: ${Math.round(message.image.data.length / 1024)}KB`)
      }

      try {
        const commandResult = await this.commandHandler.execute(
          message.text,
          sessionKey,
          adapter,
          message.chatId
        )

        if (commandResult.handled) {
          console.log(`[${platform.toUpperCase()}] Command handled: ${message.text.split(' ')[0]}`)
          await adapter.sendMessage(message.chatId, commandResult.response)
          return
        }

        const queueStatus = this.agentRunner.getQueueStatus(sessionKey)

        if (adapter.sendTyping) {
          await adapter.sendTyping(message.chatId)
        }

        if (queueStatus.pending > 0 && adapter.react && message.raw?.key?.id) {
          await adapter.react(message.chatId, message.raw.key.id, '⏳')
        }

        console.log(`[${platform.toUpperCase()}] Processing...`)
        const response = await this.agentRunner.enqueueRun(
          sessionKey,
          message.text,
          adapter,
          message.chatId,
          message.image
        )

        if (adapter.stopTyping) {
          await adapter.stopTyping(message.chatId)
        }

        console.log(`[${platform.toUpperCase()}] Done`)
      } catch (error) {
        console.error(`[${platform.toUpperCase()}] Error:`, error.message)

        if (adapter.stopTyping) {
          await adapter.stopTyping(message.chatId)
        }

        try {
          await adapter.sendMessage(
            message.chatId,
            "Sorry, I encountered an error. Please try again."
          )
        } catch (sendErr) {
          console.error(`[${platform.toUpperCase()}] Failed to send error message:`, sendErr.message)
        }
      }
    })
  }

  async stop() {
    console.log('\n[Gateway] Shutting down...')

    this.agentRunner.agent.stopCron()

    if (this.browserServer) {
      try {
        await this.browserServer.stop()
        console.log('[Gateway] Browser server stopped')
      } catch (err) {
        console.error('[Gateway] Error stopping browser:', err.message)
      }
    }

    for (const adapter of this.adapters.values()) {
      try {
        await adapter.stop()
      } catch (err) {
        console.error('[Gateway] Error stopping adapter:', err.message)
      }
    }

    console.log('[Gateway] Goodbye!')
    process.exit(0)
  }
}

const gateway = new Gateway()
gateway.start().catch((err) => {
  console.error('[Gateway] Fatal error:', err)
  process.exit(1)
})
