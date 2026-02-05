/**
 * Base provider interface for AI agent providers.
 * All providers must implement these methods.
 */
export class BaseProvider {
  constructor(config = {}) {
    this.config = config;
    this.sessions = new Map();
  }

  /**
   * Get the provider name
   * @returns {string}
   */
  get name() {
    throw new Error('Provider must implement name getter');
  }

  /**
   * Initialize the provider
   * @returns {Promise<void>}
   */
  async initialize() {
    // Override in subclass if needed
  }

  /**
   * Execute a query/prompt and yield streaming responses
   * @param {Object} params
   * @param {string} params.prompt - The user message
   * @param {string} params.chatId - Chat session identifier
   * @param {string} params.userId - User identifier
   * @param {Object} params.mcpServers - MCP server configurations
   * @param {string[]} params.allowedTools - List of allowed tool names
   * @param {number} params.maxTurns - Maximum conversation turns
   * @yields {Object} Streaming response chunks
   */
  async *query(params) {
    throw new Error('Provider must implement query method');
  }

  /**
   * Get or create a session for a chat
   * @param {string} chatId
   * @returns {string|null} Session ID if exists
   */
  getSession(chatId) {
    return this.sessions.get(chatId) || null;
  }

  /**
   * Store a session ID for a chat
   * @param {string} chatId
   * @param {string} sessionId
   */
  setSession(chatId, sessionId) {
    this.sessions.set(chatId, sessionId);
  }

  /**
   * Abort an active query for a given chatId
   * @param {string} chatId
   * @returns {boolean} True if aborted, false if no active query
   */
  abort(chatId) {
    // Override in subclass to implement abort functionality
    return false;
  }

  /**
   * Cleanup resources
   * @returns {Promise<void>}
   */
  async cleanup() {
    this.sessions.clear();
  }
}
