import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'

/**
 * Gateway context - set by gateway before agent runs
 */
let gatewayContext = {
  gateway: null,
  currentPlatform: null,
  currentChatId: null,
  currentSessionKey: null
}

export function setGatewayContext(ctx) {
  gatewayContext = { ...gatewayContext, ...ctx }
}

export function getGatewayContext() {
  return gatewayContext
}

/**
 * Create Gateway MCP server with tools for interacting with the gateway
 */
export function createGatewayMcpServer() {
  return createSdkMcpServer({
    name: 'gateway',
    version: '1.0.0',
    tools: [
      tool(
        'send_message',
        'Send a message to a specific chat on any connected platform. Use this to proactively message users or send to different chats.',
        {
          platform: z.enum(['whatsapp', 'imessage', 'telegram', 'signal']).describe('The messaging platform'),
          chat_id: z.string().describe('The chat ID to send to (e.g., phone@s.whatsapp.net for WhatsApp)'),
          message: z.string().describe('The message text to send')
        },
        async ({ platform, chat_id, message }) => {
          const { gateway } = gatewayContext
          if (!gateway) {
            return { success: false, error: 'Gateway not available' }
          }

          const adapter = gateway.adapters.get(platform)
          if (!adapter) {
            return { success: false, error: `Platform ${platform} not connected` }
          }

          try {
            await adapter.sendMessage(chat_id, message)
            return { success: true, platform, chat_id, message_length: message.length }
          } catch (err) {
            return { success: false, error: err.message }
          }
        }
      ),

      tool(
        'list_platforms',
        'List all connected messaging platforms and their status',
        {},
        async () => {
          const { gateway } = gatewayContext
          if (!gateway) {
            return { success: false, error: 'Gateway not available' }
          }

          const platforms = []
          for (const [name, adapter] of gateway.adapters) {
            platforms.push({
              name,
              connected: !!adapter.sock || !!adapter.bot || !!adapter.process
            })
          }

          return { success: true, platforms }
        }
      ),

      tool(
        'get_queue_status',
        'Get the current queue status for all sessions or a specific session',
        {
          session_key: z.string().optional().describe('Optional session key to check specific session')
        },
        async ({ session_key }) => {
          const { gateway } = gatewayContext
          if (!gateway) {
            return { success: false, error: 'Gateway not available' }
          }

          if (session_key) {
            const status = gateway.agentRunner.getQueueStatus(session_key)
            return { success: true, session: session_key, ...status }
          }

          const globalStats = gateway.agentRunner.getGlobalStats()
          return { success: true, ...globalStats }
        }
      ),

      tool(
        'get_current_context',
        'Get information about the current conversation context (platform, chat, session)',
        {},
        async () => {
          const { currentPlatform, currentChatId, currentSessionKey } = gatewayContext
          return {
            success: true,
            platform: currentPlatform,
            chat_id: currentChatId,
            session_key: currentSessionKey
          }
        }
      ),

      tool(
        'list_sessions',
        'List all active sessions with their last activity time',
        {},
        async () => {
          const { gateway } = gatewayContext
          if (!gateway) {
            return { success: false, error: 'Gateway not available' }
          }

          const sessions = []
          for (const [key, data] of gateway.agentRunner.agent.sessions) {
            sessions.push({
              key,
              message_count: data.messageCount,
              last_activity: new Date(data.lastActivity).toISOString(),
              created: new Date(data.createdAt).toISOString()
            })
          }

          return { success: true, sessions, count: sessions.length }
        }
      ),

      tool(
        'broadcast_message',
        'Send a message to multiple chats across platforms. Use with caution.',
        {
          targets: z.array(z.object({
            platform: z.enum(['whatsapp', 'imessage', 'telegram', 'signal']),
            chat_id: z.string()
          })).describe('Array of targets to send to'),
          message: z.string().describe('The message to broadcast')
        },
        async ({ targets, message }) => {
          const { gateway } = gatewayContext
          if (!gateway) {
            return { success: false, error: 'Gateway not available' }
          }

          const results = []
          for (const target of targets) {
            const adapter = gateway.adapters.get(target.platform)
            if (!adapter) {
              results.push({ ...target, success: false, error: 'Platform not connected' })
              continue
            }

            try {
              await adapter.sendMessage(target.chat_id, message)
              results.push({ ...target, success: true })
            } catch (err) {
              results.push({ ...target, success: false, error: err.message })
            }
          }

          const successful = results.filter(r => r.success).length
          return { success: true, sent: successful, failed: results.length - successful, results }
        }
      )
    ]
  })
}