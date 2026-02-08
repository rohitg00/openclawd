import { BaseChannel, chunkText } from './base-channel.js';

const DISCORD_MAX_LENGTH = 2000;

export class DiscordBot extends BaseChannel {
  constructor() {
    super('discord');
    this.client = null;
    this.username = null;
  }

  async start(config) {
    if (!config.token) throw new Error('Discord bot token is required');

    const { Client, GatewayIntentBits, Partials } = await import('discord.js');

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
      ],
      partials: [Partials.Channel, Partials.Message]
    });

    await new Promise((resolve, reject) => {
      this.client.once('ready', () => {
        this.username = this.client.user.username;
        console.log(`[Discord] Bot started as ${this.username}`);
        resolve();
      });

      this.client.once('error', reject);
      this.client.login(config.token).catch(reject);
    });

    this.client.on('messageCreate', async (message) => {
      if (message.author.bot) return;

      const isDM = !message.guild;
      const isMentioned = message.mentions.has(this.client.user);

      if (!isDM && !isMentioned) return;

      let text = message.content
        .replace(new RegExp(`<@!?${this.client.user.id}>`, 'g'), '')
        .trim();

      if (!text) return;

      const userId = message.author.id;

      try {
        await message.channel.sendTyping();
        const response = await this.handleIncomingMessage(userId, text);
        const chunks = chunkText(response, DISCORD_MAX_LENGTH);

        for (const chunk of chunks) {
          await message.reply(chunk);
        }
      } catch (error) {
        console.error('[Discord] Error:', error);
        await message.reply('Sorry, an error occurred while processing your message.');
      }
    });

    this.active = true;
  }

  async stop() {
    if (this.client) {
      this.client.destroy();
      this.client = null;
    }
    this.active = false;
    this.username = null;
    console.log('[Discord] Bot stopped');
  }

  getStatus() {
    return {
      active: this.active,
      platform: this.platform,
      username: this.username,
      guilds: this.client?.guilds?.cache?.size || 0
    };
  }
}
