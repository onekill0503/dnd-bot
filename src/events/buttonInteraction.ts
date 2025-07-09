import { Events, ButtonInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } from 'discord.js';
import { logger } from '../utils/logger';
import { OpenAIService } from '../services/openai';

export const name = Events.InteractionCreate;
export const once = false;

export const execute = async (interaction: any) => {
  if (!interaction.isButton()) return;

  try {
    if (interaction.customId === 'join_session') {
      await handleJoinSession(interaction);
    } else if (interaction.customId.startsWith('show_stats_')) {
      await handleShowStats(interaction);
    }
  } catch (error) {
    logger.error('Error handling button interaction:', error);
    await interaction.reply({
      content: 'There was an error processing your request.',
      flags: 64 // Ephemeral flag
    });
  }
};

async function handleJoinSession(interaction: ButtonInteraction) {
  try {
    // Create modal for character creation
    const modal = new ModalBuilder()
      .setCustomId('character_creation_modal')
      .setTitle('Create Your D&D Character');

    const nameInput = new TextInputBuilder()
      .setCustomId('character_name')
      .setLabel('Character Name')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Enter your character\'s name')
      .setRequired(true)
      .setMaxLength(50);

    const classInput = new TextInputBuilder()
      .setCustomId('character_class')
      .setLabel('Class')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Barbarian, Bard, Cleric, Druid, Fighter, Monk, Paladin, Ranger, Rogue, Sorcerer, Warlock, Wizard')
      .setRequired(true)
      .setMaxLength(20);

    const raceInput = new TextInputBuilder()
      .setCustomId('character_race')
      .setLabel('Race')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Dragonborn, Dwarf, Elf, Gnome, Half-Elf, Half-Orc, Halfling, Human, Tiefling')
      .setRequired(true)
      .setMaxLength(20);

    const backgroundInput = new TextInputBuilder()
      .setCustomId('character_background')
      .setLabel('Background')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Acolyte, Criminal, Folk Hero, Noble, Sage, Soldier')
      .setRequired(true)
      .setMaxLength(20);

    const descriptionInput = new TextInputBuilder()
      .setCustomId('character_description')
      .setLabel('Character Description')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Describe your character\'s appearance, personality, and backstory...')
      .setRequired(true)
      .setMaxLength(1000);

    const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput);
    const secondActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(classInput);
    const thirdActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(raceInput);
    const fourthActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(backgroundInput);
    const fifthActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput);

    modal.addComponents(firstActionRow, secondActionRow, thirdActionRow, fourthActionRow, fifthActionRow);

    await interaction.showModal(modal);
  } catch (error) {
    logger.error('Error in join session button:', error);
    await interaction.reply({
      content: 'There was an error creating the character form. Please try again.',
      flags: 64 // Ephemeral flag
    });
  }
}

async function handleShowStats(interaction: ButtonInteraction) {
  try {
    const userId = interaction.customId.replace('show_stats_', '');
    const sessionId = interaction.channelId;
    const openaiService = new OpenAIService();
    
    const character = openaiService.getCharacter(sessionId, userId);
    
    if (!character) {
      await interaction.reply({
        content: '❌ Character not found.',
        flags: 64 // Ephemeral flag
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x4B0082)
      .setTitle(`📊 ${character.name}'s Character Sheet`)
      .addFields(
        { name: 'Class', value: `${character.race} ${character.class}`, inline: true },
        { name: 'Level', value: character.level.toString(), inline: true },
        { name: 'Background', value: character.background, inline: true },
        { name: 'Hit Points', value: character.hitPoints.toString(), inline: true },
        { name: 'Armor Class', value: character.armorClass.toString(), inline: true },
        { name: 'Alignment', value: character.alignment, inline: true },
        { name: 'Strength', value: `${character.stats.strength} (${character.stats.strength >= 10 ? '+' : ''}${Math.floor((character.stats.strength - 10) / 2)})`, inline: true },
        { name: 'Dexterity', value: `${character.stats.dexterity} (${character.stats.dexterity >= 10 ? '+' : ''}${Math.floor((character.stats.dexterity - 10) / 2)})`, inline: true },
        { name: 'Constitution', value: `${character.stats.constitution} (${character.stats.constitution >= 10 ? '+' : ''}${Math.floor((character.stats.constitution - 10) / 2)})`, inline: true },
        { name: 'Intelligence', value: `${character.stats.intelligence} (${character.stats.intelligence >= 10 ? '+' : ''}${Math.floor((character.stats.intelligence - 10) / 2)})`, inline: true },
        { name: 'Wisdom', value: `${character.stats.wisdom} (${character.stats.wisdom >= 10 ? '+' : ''}${Math.floor((character.stats.wisdom - 10) / 2)})`, inline: true },
        { name: 'Charisma', value: `${character.stats.charisma} (${character.stats.charisma >= 10 ? '+' : ''}${Math.floor((character.stats.charisma - 10) / 2)})`, inline: true },
        { name: 'Description', value: character.description, inline: false }
      )
      .setFooter({ text: `Player: ${character.username}` });

    await interaction.reply({
      embeds: [embed],
      flags: 64 // Ephemeral flag
    });
  } catch (error) {
    logger.error('Error showing character stats:', error);
    await interaction.reply({
      content: 'There was an error showing character stats. Please try again.',
      flags: 64 // Ephemeral flag
    });
  }
} 