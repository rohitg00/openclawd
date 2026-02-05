import { spawn } from 'child_process'
import { createInterface } from 'readline'
import BaseAdapter from './base.js'

/**
 * Signal adapter using signal-cli
 * Requires signal-cli to be installed and configured
 * Install: https://github.com/AsamK/signal-cli
 */
export default class SignalAdapter extends BaseAdapter {
  constructor(config) {
    super(config)
    this.process = null
    this.phoneNumber = config.phoneNumber
    this.signalCliPath = config.signalCliPath || 'signal-cli'
  }

  async start() {
    if (!this.phoneNumber) {
      throw new Error('Signal phone number is required in config')
    }

    console.log('[Signal] Starting signal-cli daemon...')

    // Start signal-cli in JSON-RPC mode
    this.process = spawn(this.signalCliPath, [
      '-u', this.phoneNumber,
      'jsonRpc'
    ], {
      stdio: ['pipe', 'pipe', 'pipe']
    })

    const rl = createInterface({ input: this.process.stdout })

    rl.on('line', async (line) => {
      try {
        const data = JSON.parse(line)
        if (data.method === 'receive') {
          await this.handleMessage(data.params)
        }
      } catch (err) {
        // Not JSON or parse error, ignore
      }
    })

    this.process.stderr.on('data', (data) => {
      const msg = data.toString().trim()
      if (msg && !msg.includes('DEBUG')) {
        console.error('[Signal]', msg)
      }
    })

    this.process.on('error', (err) => {
      console.error('[Signal] Process error:', err.message)
    })

    this.process.on('close', (code) => {
      console.log('[Signal] Process exited with code:', code)
      this.process = null
    })

    console.log(`[Signal] Connected as ${this.phoneNumber}`)
    console.log('[Signal] Adapter started')
  }

  async stop() {
    if (this.process) {
      this.process.kill()
      this.process = null
    }
    console.log('[Signal] Adapter stopped')
  }

  async sendMessage(chatId, text) {
    return new Promise((resolve, reject) => {
      const isGroup = chatId.startsWith('group.')

      const args = [
        '-u', this.phoneNumber,
        'send',
        '-m', text
      ]

      if (isGroup) {
        args.push('-g', chatId.replace('group.', ''))
      } else {
        args.push(chatId)
      }

      const proc = spawn(this.signalCliPath, args)

      proc.on('close', (code) => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`signal-cli exited with code ${code}`))
        }
      })

      proc.on('error', reject)
    })
  }

  async handleMessage(params) {
    const envelope = params?.envelope
    if (!envelope) return

    // Skip our own messages
    if (envelope.source === this.phoneNumber) return

    const dataMessage = envelope.dataMessage
    if (!dataMessage) return

    const text = dataMessage.message || ''
    if (!text) return

    const isGroup = !!dataMessage.groupInfo
    const chatId = isGroup
      ? `group.${dataMessage.groupInfo.groupId}`
      : envelope.source

    const sender = envelope.source

    // Check for mentions
    const mentions = dataMessage.mentions || []
    const isMentioned = mentions.some(m => m.number === this.phoneNumber)

    const message = {
      chatId,
      text,
      isGroup,
      sender,
      mentions: isMentioned ? ['self'] : [],
      image: null, // TODO: Handle attachments
      raw: envelope
    }

    if (!this.shouldRespond(message, this.config)) {
      return
    }

    this.emitMessage(message)
  }
}
