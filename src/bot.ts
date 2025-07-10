import { Client, GatewayIntentBits, Collection } from 'discord.js';
import type { BotClient, Command } from './types';
import { botConfig, validateConfig } from './config/config';
import { events } from './events';
import { commands } from './commands';
import { logger } from './utils/logger';

export class Bot {
  private client: BotClient;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    }) as BotClient;

    this.client.commands = new Collection();
  }

  async initialize(): Promise<void> {
    try {
      // Validate configuration
      validateConfig();

      // Register commands
      this.registerCommands();

      // Register events
      this.registerEvents();

      // Login to Discord
      await this.client.login(botConfig.token);

      logger.info('Bot initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize bot:', error);
      throw error;
    }
  }

  private registerCommands(): void {
    for (const command of commands) {
      this.client.commands.set(command.data.name, command as Command);
      logger.debug(`Registered command: ${command.data.name}`);
    }
    logger.info(`Registered ${commands.length} commands`);
  }

  private registerEvents(): void {
    for (const event of events) {
      if (event.once) {
        this.client.once(event.name as any, (args: any) => event.execute(args));
      } else {
        this.client.on(event.name as any, (args: any) => event.execute(args));
      }
      logger.debug(`Registered event: ${event.name}`);
    }
    logger.info(`Registered ${events.length} events`);
  }

  async destroy(): Promise<void> {
    this.client.destroy();
    logger.info('Bot destroyed');
  }
}
