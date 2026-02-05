/**
 * Base adapter interface for messaging platforms
 */
export default class BaseAdapter {
  constructor(config) {
    this.config = config
    this.messageCallback = null
  }

  /**
   * Connect and start listening for messages
   */
  async start() {
    throw new Error('start() must be implemented by subclass')
  }

  /**
   * Disconnect and stop listening
   */
  async stop() {
    throw new Error('stop() must be implemented by subclass')
  }

  /**
   * Send a message to a chat
   * @param {string} chatId - The chat identifier
   * @param {string} text - The message text to send
   */
  async sendMessage(chatId, text) {
    throw new Error('sendMessage() must be implemented by subclass')
  }

  /**
   * Register a callback for incoming messages
   * @param {Function} callback - Called with (message) object containing:
   *   - chatId: string
   *   - text: string
   *   - isGroup: boolean
   *   - sender: string
   *   - mentions: string[]
   *   - raw: any (platform-specific data)
   */
  onMessage(callback) {
    this.messageCallback = callback
  }

  /**
   * Emit a message to the registered callback
   */
  emitMessage(message) {
    if (this.messageCallback) {
      this.messageCallback(message)
    }
  }

  /**
   * Check if we should respond to a message based on allowlists and mention gating
   * @param {Object} message - The message object
   * @param {Object} config - Platform-specific config (whatsapp or imessage)
   * @returns {boolean}
   */
  shouldRespond(message, config) {
    const { chatId, isGroup, mentions } = message

    if (isGroup) {
      // Check group allowlist
      if (config.allowedGroups.length === 0) {
        return false
      }
      if (!config.allowedGroups.includes('*') && !config.allowedGroups.includes(chatId)) {
        return false
      }
      // Check mention gating for groups
      if (config.respondToMentionsOnly && mentions && !mentions.includes('self')) {
        return false
      }
    } else {
      // Check DM allowlist
      if (config.allowedDMs.length === 0) {
        return false
      }
      if (!config.allowedDMs.includes('*') && !config.allowedDMs.includes(chatId)) {
        return false
      }
    }

    return true
  }

  /**
   * Generate a session key for this message
   * @param {string} agentId - The agent identifier
   * @param {string} platform - Platform name (whatsapp, imessage)
   * @param {Object} message - The message object
   * @returns {string}
   */
  generateSessionKey(agentId, platform, message) {
    const type = message.isGroup ? 'group' : 'dm'
    return `agent:${agentId}:${platform}:${type}:${message.chatId}`
  }
}
