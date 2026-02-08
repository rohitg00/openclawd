import { TelegramBot } from './telegram-bot.js';
import { DiscordBot } from './discord-bot.js';
import { WhatsAppBot } from './whatsapp-bot.js';
import { SlackBot } from './slack-bot.js';
import { listSessions } from './session-manager.js';

const channels = {
  telegram: new TelegramBot(),
  discord: new DiscordBot(),
  whatsapp: new WhatsAppBot(),
  slack: new SlackBot()
};

export function getChannel(id) {
  return channels[id] || null;
}

export async function startChannel(channelId, config, mcpServers = {}) {
  const channel = channels[channelId];
  if (!channel) throw new Error(`Unknown channel: ${channelId}`);

  if (channel.active) {
    await channel.stop();
  }

  channel.setMcpServers(mcpServers);
  await channel.start(config);
  return channel.getStatus();
}

export async function stopChannel(channelId) {
  const channel = channels[channelId];
  if (!channel) throw new Error(`Unknown channel: ${channelId}`);

  await channel.stop();
  return channel.getStatus();
}

export function getChannelStatus() {
  const status = {};
  for (const [id, channel] of Object.entries(channels)) {
    status[id] = channel.getStatus();
  }
  return status;
}

export function getAllSessions() {
  return listSessions();
}

export async function autoStartChannels(mcpServers = {}) {
  const autoConfigs = [];

  if (process.env.TELEGRAM_BOT_TOKEN) {
    autoConfigs.push({
      id: 'telegram',
      config: { token: process.env.TELEGRAM_BOT_TOKEN }
    });
  }

  if (process.env.DISCORD_BOT_TOKEN) {
    autoConfigs.push({
      id: 'discord',
      config: { token: process.env.DISCORD_BOT_TOKEN }
    });
  }

  if (process.env.SLACK_BOT_TOKEN && process.env.SLACK_APP_TOKEN) {
    autoConfigs.push({
      id: 'slack',
      config: { token: process.env.SLACK_BOT_TOKEN, appToken: process.env.SLACK_APP_TOKEN }
    });
  }

  for (const { id, config } of autoConfigs) {
    try {
      await startChannel(id, config, mcpServers);
      console.log(`[Channels] Auto-started ${id}`);
    } catch (error) {
      console.error(`[Channels] Failed to auto-start ${id}:`, error.message);
    }
  }
}

export function getWhatsAppQR() {
  const wa = channels.whatsapp;
  return wa?.qrCode || null;
}
