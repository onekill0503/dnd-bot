import { Events, Client } from 'discord.js';
import { logger } from '../utils/logger';

export const name = Events.ClientReady;
export const once = true;

export const execute = (client: Client) => {
  logger.info(`🚀 Bot is ready! Logged in as ${client.user?.tag}`);

  if (client.user) {
    client.user.setActivity('D&D with friends', { type: 0 }); // Playing
  }
};
