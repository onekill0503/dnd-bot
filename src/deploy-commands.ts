import { REST, Routes } from 'discord.js';
import { botConfig } from './config/config';
import { logger } from './utils/logger';
import { data as dmData } from './commands/dm';

const commands = [dmData.toJSON()];

const rest = new REST().setToken(botConfig.token);

(async () => {
  try {
    logger.info('Started refreshing application (/) commands.');

    if (botConfig.guildId) {
      await rest.put(
        Routes.applicationGuildCommands(botConfig.clientId, botConfig.guildId),
        { body: commands },
      );
      logger.info('Successfully reloaded guild (/) commands.');
    } else {
      await rest.put(
        Routes.applicationCommands(botConfig.clientId),
        { body: commands },
      );
      logger.info('Successfully reloaded application (/) commands.');
    }
  } catch (error) {
    logger.error('Error deploying commands:', error);
  }
})(); 