import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { botConfig } from './src/config/config';
import { logger } from './src/utils/logger';
import { data as dmData, execute as dmExecute } from './src/commands/dm';
import * as readyEvent from './src/events/ready';
import * as interactionCreateEvent from './src/events/interactionCreate';
import * as buttonInteractionEvent from './src/events/buttonInteraction';
import { SessionManager } from './src/services/sessionManager';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

// Initialize session manager
const sessionManager = new SessionManager();

// Register commands
(client as any).commands = new Collection();
(client as any).commands.set(dmData.name, { data: dmData, execute: dmExecute });

// Make session manager available globally
(client as any).sessionManager = sessionManager;

// Register events
client.once(readyEvent.name, () => readyEvent.execute(client));
client.on(interactionCreateEvent.name, interactionCreateEvent.execute);
client.on(buttonInteractionEvent.name, buttonInteractionEvent.execute);

client.on('error', (error) => {
  logger.error('Client error:', error);
});

// Initialize session manager before starting the bot
async function startBot() {
  try {
    await sessionManager.initialize();
    await client.login(botConfig.token);
    logger.info('Bot started successfully with Redis session management');
  } catch (error) {
    logger.error('Failed to start bot:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down bot...');
  await sessionManager.shutdown();
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down bot...');
  await sessionManager.shutdown();
  client.destroy();
  process.exit(0);
});

startBot();