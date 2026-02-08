import { BaseChannel, chunkText } from './base-channel.js';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';

const WHATSAPP_MAX_LENGTH = 65536;

export class WhatsAppBot extends BaseChannel {
  constructor() {
    super('whatsapp');
    this.sock = null;
    this.qrCode = null;
    this.authDir = null;
  }

  async start(config) {
    if (this.sock) {
      this.sock.end();
      this.sock = null;
    }

    const baileys = await import('@whiskeysockets/baileys');
    const makeWASocket = baileys.default || baileys.makeWASocket;
    const { useMultiFileAuthState, DisconnectReason, jidNormalizedUser } = baileys;

    this.authDir = config.authDir || path.join(process.cwd(), 'whatsapp-auth');
    if (!existsSync(this.authDir)) {
      mkdirSync(this.authDir, { recursive: true });
    }

    const { state: authState, saveCreds } = await useMultiFileAuthState(this.authDir);

    this.sock = makeWASocket({
      auth: authState,
      printQRInTerminal: false
    });

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('connection.update', (update) => {
      const { connection, qr, lastDisconnect } = update;

      if (qr) {
        this.qrCode = qr;
        console.log('[WhatsApp] QR code generated - scan via settings UI');
      }

      if (connection === 'open') {
        this.active = true;
        this.qrCode = null;
        console.log('[WhatsApp] Connected');
      }

      if (connection === 'close') {
        const reason = lastDisconnect?.error?.output?.statusCode;
        if (reason !== DisconnectReason.loggedOut) {
          console.log('[WhatsApp] Reconnecting in 5s...');
          setTimeout(() => this.start(config), 5000);
        } else {
          this.active = false;
          console.log('[WhatsApp] Logged out');
        }
      }
    });

    this.sock.ev.on('messages.upsert', async ({ messages }) => {
      for (const msg of messages) {
        if (!msg.message || msg.key.fromMe) continue;

        const text = msg.message.conversation ||
          msg.message.extendedTextMessage?.text ||
          '';

        if (!text) continue;

        const jid = msg.key.remoteJid;
        const isGroup = jid.endsWith('@g.us');
        const userId = isGroup ? msg.key.participant : jid;

        if (isGroup) {
          const mentionedJids = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
          const botJid = this.sock.user?.id;
          const isMentioned = botJid && mentionedJids.some(jid => {
            try { return jidNormalizedUser(jid) === jidNormalizedUser(botJid); } catch { return false; }
          });
          if (!isMentioned) continue;
        }

        try {
          const response = await this.handleIncomingMessage(userId, text);
          const chunks = chunkText(response, WHATSAPP_MAX_LENGTH);

          for (const chunk of chunks) {
            await this.sock.sendMessage(jid, { text: chunk });
          }
        } catch (error) {
          console.error('[WhatsApp] Error:', error);
          await this.sock.sendMessage(jid, { text: 'Sorry, an error occurred while processing your message.' });
        }
      }
    });
  }

  async stop() {
    if (this.sock) {
      this.sock.end();
      this.sock = null;
    }
    this.active = false;
    this.qrCode = null;
    console.log('[WhatsApp] Bot stopped');
  }

  getStatus() {
    return {
      active: this.active,
      platform: this.platform,
      qrCode: this.qrCode,
      hasQr: !!this.qrCode
    };
  }
}
