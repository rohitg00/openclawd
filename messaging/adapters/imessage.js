import { spawn, execFile } from 'child_process'
import path from 'path'
import os from 'os'
import BaseAdapter from './base.js'

// Path to imsg binary
const IMSG_PATH = process.env.IMSG_PATH || path.join(os.homedir(), 'bin', 'imsg')

/**
 * iMessage adapter using imsg CLI
 * - Uses `imsg watch --json` for receiving messages
 * - Uses `imsg send` for sending messages
 */
export default class iMessageAdapter extends BaseAdapter {
  constructor(config) {
    super(config)
    this.watchProcess = null
    this.buffer = ''
  }

  async start() {
    return new Promise((resolve, reject) => {
      // Spawn imsg watch with JSON output
      this.watchProcess = spawn(IMSG_PATH, ['watch', '--json'], {
        stdio: ['ignore', 'pipe', 'pipe']
      })

      this.watchProcess.on('error', (err) => {
        console.error('[iMessage] Failed to start imsg watch:', err.message)
        console.log('[iMessage] Make sure imsg is installed at:', IMSG_PATH)
        console.log('[iMessage] Grant Full Disk Access to your terminal in System Settings > Privacy & Security')
        reject(err)
      })

      this.watchProcess.on('close', (code) => {
        console.log(`[iMessage] Watch process exited with code ${code}`)
        this.watchProcess = null
      })

      // Handle stdout (JSON messages)
      this.watchProcess.stdout.on('data', (data) => {
        this.handleData(data.toString())
      })

      // Handle stderr
      this.watchProcess.stderr.on('data', (data) => {
        const msg = data.toString().trim()
        if (msg) {
          console.error('[iMessage] stderr:', msg)
        }
      })

      // Give it a moment to start watching
      setTimeout(() => {
        if (this.watchProcess && !this.watchProcess.killed) {
          console.log('[iMessage] Adapter started, watching for messages...')
          resolve()
        }
      }, 1000)
    })
  }

  async stop() {
    if (this.watchProcess) {
      this.watchProcess.kill()
      this.watchProcess = null
    }
    console.log('[iMessage] Adapter stopped')
  }

  /**
   * Handle incoming data from imsg watch
   */
  handleData(data) {
    this.buffer += data
    const lines = this.buffer.split('\n')
    this.buffer = lines.pop() // Keep incomplete line

    for (const line of lines) {
      if (!line.trim()) continue

      try {
        const json = JSON.parse(line)
        this.handleMessage(json)
      } catch (err) {
        // Might be a log line, not JSON
        if (!line.startsWith('[') && !line.includes('watching')) {
          console.log('[iMessage] Non-JSON output:', line)
        }
      }
    }
  }

  /**
   * Handle a parsed message from imsg watch
   */
  handleMessage(msg) {
    // imsg watch outputs messages with these fields:
    // rowid, guid, chat_id, chat_identifier, handle_id, sender, text, date, is_from_me, attachments, etc.

    // Ignore messages from self
    if (msg.is_from_me) return

    // Extract message details
    const chatId = msg.chat_id?.toString() || msg.chat_identifier
    const text = msg.text
    const sender = msg.sender || msg.handle_id

    if (!chatId || !text) return

    // Determine if group chat (chat_identifier usually contains multiple participants for groups)
    const isGroup = msg.chat_identifier?.includes(',') || msg.participants?.length > 2

    // Check for mentions (simplified - look for @ patterns)
    const mentions = []
    if (text.includes('@')) {
      mentions.push('potential')
    }

    const message = {
      chatId,
      text,
      isGroup: Boolean(isGroup),
      sender,
      mentions,
      raw: msg
    }

    console.log(`[iMessage] Received: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}" from ${sender}`)

    // Check if we should respond
    if (!this.shouldRespond(message, this.config)) {
      console.log('[iMessage] Skipping - not in allowlist or mention required')
      return
    }

    // Emit message to handler
    this.emitMessage(message)
  }

  async sendMessage(chatId, text) {
    return new Promise((resolve, reject) => {
      // Use imsg send command
      const args = ['send', '--chat-id', chatId.toString(), '--text', text]

      execFile(IMSG_PATH, args, (error, stdout, stderr) => {
        if (error) {
          console.error('[iMessage] Failed to send message:', error.message)
          if (stderr) console.error('[iMessage] stderr:', stderr)
          reject(error)
          return
        }

        console.log('[iMessage] Message sent successfully')
        resolve()
      })
    })
  }
}
