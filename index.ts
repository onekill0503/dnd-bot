import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { botConfig } from './src/config/config';
import { logger } from './src/utils/logger';
import { data as dmData, execute as dmExecute } from './src/commands/dm';
import * as readyEvent from './src/events/ready';
import * as interactionCreateEvent from './src/events/interactionCreate';
import * as buttonInteractionEvent from './src/events/buttonInteraction';
import * as modalSubmitEvent from './src/events/modalSubmit';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

// Register commands
(client as any).commands = new Collection();
(client as any).commands.set(dmData.name, { data: dmData, execute: dmExecute });

// Register events
client.once(readyEvent.name, () => readyEvent.execute(client));
client.on(interactionCreateEvent.name, interactionCreateEvent.execute);
client.on(buttonInteractionEvent.name, buttonInteractionEvent.execute);
client.on(modalSubmitEvent.name, modalSubmitEvent.execute);

client.on('error', (error) => {
  logger.error('Client error:', error);
});

client.login(botConfig.token).catch((error) => {
  logger.error('Failed to start bot:', error);
});