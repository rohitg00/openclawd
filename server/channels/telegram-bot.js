import { BaseChannel, chunkText } from './base-channel.js';

const TELEGRAM_MAX_LENGTH = 4096;

export class TelegramBot extends BaseChannel {
  constructor() {
    super('telegram');
    this.bot = null;
    this.username = null;
  }

  async start(config) {
    if (!config.token) throw new Error('Telegram bot token is required');

    const TelegramBotApi = (await import('node-telegram-bot-api')).default;
    this.bot = new TelegramBotApi(config.token, { polling: true });

    const me = await this.bot.getMe();
    this.username = me.username;
    console.log(`[Telegram] Bot started as @${this.username}`);

    this.bot.on('message', async (msg) => {
      if (!msg.text) return;

      const chatId = msg.chat.id;
      const userId = msg.from.id.toString();
      const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';

      if (isGroup) {
        const mentioned = msg.text.includes(`@${this.username}`) ||
          (msg.reply_to_message && msg.reply_to_message.from?.id === this.bot.options?.id);
        if (!mentioned) return;
      }

      let text = msg.text.replace(`@${this.username}`, '').trim();

      if (text === '/start') {
        await this.bot.sendMessage(chatId, 'Welcome to OpenClawd! Send me any message and I\'ll respond using AI.\n\nCommands:\n/reset - Clear conversation\n/model <name> - Switch model\n/status - Show current settings');
        return;
      }

      try {
        await this.bot.sendChatAction(chatId, 'typing');
        const response = await this.handleIncomingMessage(userId, text);
        const chunks = chunkText(response, TELEGRAM_MAX_LENGTH);

        for (const chunk of chunks) {
          await this.bot.sendMessage(chatId, chunk, { parse_mode: 'Markdown' }).catch(() => {
            return this.bot.sendMessage(chatId, chunk);
          });
        }
      } catch (error) {
        console.error('[Telegram] Error:', error.message);
        await this.bot.sendMessage(chatId, `Error: ${error.message}`);
      }
    });

    this.active = true;
  }

  async stop() {
    if (this.bot) {
      await this.bot.stopPolling();
      this.bot = null;
    }
    this.active = false;
    this.username = null;
    console.log('[Telegram] Bot stopped');
  }

  getStatus() {
    return {
      active: this.active,
      platform: this.platform,
      username: this.username
    };
  }
}
