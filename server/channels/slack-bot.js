import { BaseChannel, chunkText } from './base-channel.js';

const SLACK_MAX_LENGTH = 4000;

export class SlackBot extends BaseChannel {
  constructor() {
    super('slack');
    this.app = null;
    this.botUserId = null;
  }

  async start(config) {
    if (!config.token) throw new Error('Slack bot token (xoxb-...) is required');
    if (!config.appToken) throw new Error('Slack app token (xapp-...) is required for Socket Mode');

    const { App } = await import('@slack/bolt');

    this.app = new App({
      token: config.token,
      appToken: config.appToken,
      socketMode: true
    });

    this.app.message(async ({ message, say }) => {
      if (message.subtype || message.bot_id) return;

      const userId = message.user;
      const text = message.text || '';

      if (!text.trim()) return;

      try {
        const response = await this.handleIncomingMessage(userId, text);
        const chunks = chunkText(response, SLACK_MAX_LENGTH);

        for (const chunk of chunks) {
          await say(chunk);
        }
      } catch (error) {
        console.error('[Slack] Error:', error);
        await say('Sorry, an error occurred while processing your message.');
      }
    });

    this.app.event('app_mention', async ({ event, say }) => {
      const userId = event.user;
      const text = (event.text || '').replace(/<@[^>]+>/g, '').trim();

      if (!text) return;

      try {
        const response = await this.handleIncomingMessage(userId, text);
        const chunks = chunkText(response, SLACK_MAX_LENGTH);

        for (const chunk of chunks) {
          await say({ text: chunk, thread_ts: event.ts });
        }
      } catch (error) {
        console.error('[Slack] Error:', error);
        await say({ text: 'Sorry, an error occurred while processing your message.', thread_ts: event.ts });
      }
    });

    await this.app.start();

    const authResult = await this.app.client.auth.test({ token: config.token });
    this.botUserId = authResult.user_id;

    this.active = true;
    console.log(`[Slack] Bot started as ${authResult.user}`);
  }

  async stop() {
    if (this.app) {
      await this.app.stop();
      this.app = null;
    }
    this.active = false;
    this.botUserId = null;
    console.log('[Slack] Bot stopped');
  }

  getStatus() {
    return {
      active: this.active,
      platform: this.platform,
      botUserId: this.botUserId
    };
  }
}
