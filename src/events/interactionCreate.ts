import { Events } from 'discord.js';
import type { Interaction } from 'discord.js';
import { logger } from '../utils/logger';

export const name = Events.InteractionCreate;
export const once = false;

export const execute = async (interaction: Interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const client = interaction.client as any;
  const command = client.commands?.get(interaction.commandName);

  if (!command) {
    logger.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    logger.error(`Error executing ${interaction.commandName}:`, error);
    
    const errorMessage = 'There was an error while executing this command!';
    
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errorMessage, flags: 64 });
    } else {
      await interaction.reply({ content: errorMessage, flags: 64 });
    }
  }
}; 