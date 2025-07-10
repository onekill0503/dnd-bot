import {
  Events,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from 'discord.js';
import type { Interaction } from 'discord.js';
import { logger } from '../utils/logger';

export const name = Events.InteractionCreate;
export const once = false;

export const execute = async (interaction: Interaction) => {
  // Handle chat input commands
  if (interaction.isChatInputCommand()) {
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
    return;
  }

  // Handle button clicks
  if (interaction.isButton()) {
    logger.info(`Button clicked: ${interaction.customId}`);

    try {
      if (interaction.customId === 'player_action') {
        // Create modal for player action
        const modal = new ModalBuilder()
          .setCustomId('player_action_modal')
          .setTitle('🎭 Perform Action');

        const actionInput = new TextInputBuilder()
          .setCustomId('player_action')
          .setLabel('What does your character do?')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder("Describe your character's action in detail...")
          .setRequired(true)
          .setMaxLength(1000);

        const diceInput = new TextInputBuilder()
          .setCustomId('dice_results')
          .setLabel('Dice Results (Optional)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g., "Attack: 15, Damage: 8" or "Stealth: 12"')
          .setRequired(false)
          .setMaxLength(200);

        const firstActionRow =
          new ActionRowBuilder<TextInputBuilder>().addComponents(actionInput);
        const secondActionRow =
          new ActionRowBuilder<TextInputBuilder>().addComponents(diceInput);

        modal.addComponents(firstActionRow, secondActionRow);

        await interaction.showModal(modal);
      }
    } catch (error) {
      logger.error('Error handling button click:', error);

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: 'There was an error processing your button click.',
          flags: 64,
        });
      } else {
        await interaction.reply({
          content: 'There was an error processing your button click.',
          flags: 64,
        });
      }
    }
    return;
  }

  // Handle modal submits
  if (interaction.isModalSubmit()) {
    logger.info(`Modal submit received: ${interaction.customId}`);

    try {
      if (interaction.customId === 'character_creation_modal') {
        // Import and execute the modal submit handler
        const { handleCharacterCreation } = await import('./modalSubmit');
        await handleCharacterCreation(interaction);
      } else if (interaction.customId === 'player_action_modal') {
        // Import and execute the player action modal handler
        const { handlePlayerAction } = await import('./modalSubmit');
        await handlePlayerAction(interaction);
      }
    } catch (error) {
      logger.error('Error handling modal submit:', error);

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: 'There was an error processing your modal submission.',
          flags: 64,
        });
      } else {
        await interaction.reply({
          content: 'There was an error processing your modal submission.',
          flags: 64,
        });
      }
    }
    return;
  }
};
