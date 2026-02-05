import TelegramBot from 'node-telegram-bot-api'
import BaseAdapter from './base.js'

/**
 * Telegram adapter using node-telegram-bot-api
 * Supports text and image messages
 */
export default class TelegramAdapter extends BaseAdapter {
  constructor(config) {
    super(config)
    this.bot = null
    this.botInfo = null
  }

  async start() {
    if (!this.config.token) {
      throw new Error('Telegram bot token is required. Get one from @BotFather')
    }

    this.bot = new TelegramBot(this.config.token, { polling: true })

    // Get bot info
    this.botInfo = await this.bot.getMe()
    console.log(`[Telegram] Connected as @${this.botInfo.username}`)

    // Handle incoming messages
    this.bot.on('message', async (msg) => {
      await this.handleMessage(msg)
    })

    // Handle errors
    this.bot.on('polling_error', (err) => {
      console.error('[Telegram] Polling error:', err.message)
    })

    console.log('[Telegram] Adapter started')
  }

  async stop() {
    if (this.bot) {
      await this.bot.stopPolling()
      this.bot = null
    }
    console.log('[Telegram] Adapter stopped')
  }

  async sendMessage(chatId, text) {
    if (!this.bot) {
      throw new Error('Telegram not connected')
    }

    // Telegram has a 4096 character limit per message
    if (text.length > 4096) {
      const chunks = this.splitMessage(text, 4096)
      for (const chunk of chunks) {
        await this.bot.sendMessage(chatId, chunk, { parse_mode: 'Markdown' })
      }
    } else {
      await this.bot.sendMessage(chatId, text, { parse_mode: 'Markdown' })
    }
  }

  splitMessage(text, maxLength) {
    const chunks = []
    let remaining = text
    while (remaining.length > 0) {
      if (remaining.length <= maxLength) {
        chunks.push(remaining)
        break
      }
      // Find a good break point
      let breakPoint = remaining.lastIndexOf('\n', maxLength)
      if (breakPoint === -1 || breakPoint < maxLength / 2) {
        breakPoint = remaining.lastIndexOf(' ', maxLength)
      }
      if (breakPoint === -1 || breakPoint < maxLength / 2) {
        breakPoint = maxLength
      }
      chunks.push(remaining.substring(0, breakPoint))
      remaining = remaining.substring(breakPoint).trim()
    }
    return chunks
  }

  async sendTyping(chatId) {
    if (!this.bot) return
    try {
      await this.bot.sendChatAction(chatId, 'typing')
    } catch (err) {
      // Ignore
    }
  }

  async handleMessage(msg) {
    // Skip messages without content
    if (!msg.text && !msg.photo && !msg.caption) return

    const chatId = msg.chat.id.toString()
    const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup'
    const sender = msg.from?.id?.toString() || chatId

    // Extract text
    let text = msg.text || msg.caption || ''

    // Check for image
    let image = null
    if (msg.photo && msg.photo.length > 0) {
      // Get the largest photo
      const photo = msg.photo[msg.photo.length - 1]
      try {
        const fileLink = await this.bot.getFileLink(photo.file_id)
        const response = await fetch(fileLink)
        const buffer = Buffer.from(await response.arrayBuffer())
        image = {
          data: buffer.toString('base64'),
          mediaType: 'image/jpeg'
        }
        console.log('[Telegram] Image downloaded, size:', buffer.length)
        if (!text) {
          text = '[Image]'
        }
      } catch (err) {
        console.error('[Telegram] Failed to download image:', err.message)
      }
    }

    if (!text && !image) return

    // Check for bot mention in groups
    const botMentioned = text.includes(`@${this.botInfo.username}`)

    // Remove bot mention from text
    if (botMentioned) {
      text = text.replace(`@${this.botInfo.username}`, '').trim()
    }

    const message = {
      chatId,
      text,
      isGroup,
      sender,
      mentions: botMentioned ? ['self'] : [],
      image,
      raw: msg
    }

    if (!this.shouldRespond(message, this.config)) {
      return
    }

    this.emitMessage(message)
  }
}
