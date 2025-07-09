import { Events, ModalSubmitInteraction, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import { logger } from '../utils/logger';
import { OpenAIService } from '../services/openai';

export const name = Events.InteractionCreate;
export const once = false;

export const execute = async (interaction: any) => {
  if (!interaction.isModalSubmit()) return;

  try {
    if (interaction.customId === 'character_creation_modal') {
      await handleCharacterCreation(interaction);
    }
  } catch (error) {
    logger.error('Error handling modal submit:', error);
    await interaction.reply({
      content: 'There was an error processing your character creation.',
      flags: 64 // Ephemeral flag
    });
  }
};

async function handleCharacterCreation(interaction: ModalSubmitInteraction) {
  try {
    const sessionId = interaction.channelId;
    const openaiService = new OpenAIService();
    const username = interaction.user.username || 'Unknown User';
    const userId = interaction.user.id;
    
    logger.info(`Character creation modal submitted in channel ${sessionId} by user ${userId}`);
    
    if (!userId) {
      await interaction.reply({
        content: '❌ Unable to identify user. Please try again.',
        flags: 64 // Ephemeral flag
      });
      return;
    }
    
    // Get session status
    const session = openaiService.getSessionStatus(sessionId);
    
    if (!session) {
      logger.warn(`No session found for channel ${sessionId}`);
      await interaction.reply({
        content: '❌ No active session found. Please start a session first.',
        flags: 64 // Ephemeral flag
      });
      return;
    }

    if (session.players.has(userId)) {
      await interaction.reply({
        content: '❌ You have already created a character for this session.',
        flags: 64 // Ephemeral flag
      });
      return;
    }

    // Get form data
    const name = interaction.fields.getTextInputValue('character_name');
    const characterClass = interaction.fields.getTextInputValue('character_class');
    const race = interaction.fields.getTextInputValue('character_race');
    const background = interaction.fields.getTextInputValue('character_background');
    const description = interaction.fields.getTextInputValue('character_description');

    logger.info(`Creating character ${name} (${race} ${characterClass}) for user ${userId} in session ${sessionId}`);

    // Validate inputs
    const validClasses = [
      'Barbarian', 'Bard', 'Cleric', 'Druid', 'Fighter', 'Monk', 
      'Paladin', 'Ranger', 'Rogue', 'Sorcerer', 'Warlock', 'Wizard'
    ];
    
    const validRaces = [
      'Dragonborn', 'Dwarf', 'Elf', 'Gnome', 'Half-Elf', 'Half-Orc', 
      'Halfling', 'Human', 'Tiefling'
    ];
    
    const validBackgrounds = [
      'Acolyte', 'Criminal', 'Folk Hero', 'Noble', 'Sage', 'Soldier'
    ];

    if (!validClasses.includes(characterClass)) {
      await interaction.reply({
        content: `❌ Invalid class. Please choose from: ${validClasses.join(', ')}`,
        flags: 64 // Ephemeral flag
      });
      return;
    }

    if (!validRaces.includes(race)) {
      await interaction.reply({
        content: `❌ Invalid race. Please choose from: ${validRaces.join(', ')}`,
        flags: 64 // Ephemeral flag
      });
      return;
    }

    if (!validBackgrounds.includes(background)) {
      await interaction.reply({
        content: `❌ Invalid background. Please choose from: ${validBackgrounds.join(', ')}`,
        flags: 64 // Ephemeral flag
      });
      return;
    }

    // Add character using the correct method signature
    const result = await openaiService.addCharacter(
      sessionId,
      userId,
      username,
      name,
      characterClass,
      race,
      background,
      description
    );

    if (!result.success) {
      logger.error(`Failed to add character: ${result.message}`);
      await interaction.reply({
        content: `❌ ${result.message}`,
        flags: 64 // Ephemeral flag
      });
      return;
    }

    logger.info(`Character ${name} created successfully in session ${sessionId}`);

    // Create character embed with stats
    const character = result.character!;
    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle(`🎭 ${name} has joined the adventure!`)
      .addFields(
        { name: 'Class', value: characterClass, inline: true },
        { name: 'Race', value: race, inline: true },
        { name: 'Background', value: background, inline: true },
        { name: 'Level', value: character.level.toString(), inline: true },
        { name: 'Hit Points', value: character.hitPoints.toString(), inline: true },
        { name: 'Armor Class', value: character.armorClass.toString(), inline: true },
        { name: 'Strength', value: `${character.stats.strength} (${character.stats.strength >= 10 ? '+' : ''}${Math.floor((character.stats.strength - 10) / 2)})`, inline: true },
        { name: 'Dexterity', value: `${character.stats.dexterity} (${character.stats.dexterity >= 10 ? '+' : ''}${Math.floor((character.stats.dexterity - 10) / 2)})`, inline: true },
        { name: 'Constitution', value: `${character.stats.constitution} (${character.stats.constitution >= 10 ? '+' : ''}${Math.floor((character.stats.constitution - 10) / 2)})`, inline: true },
        { name: 'Intelligence', value: `${character.stats.intelligence} (${character.stats.intelligence >= 10 ? '+' : ''}${Math.floor((character.stats.intelligence - 10) / 2)})`, inline: true },
        { name: 'Wisdom', value: `${character.stats.wisdom} (${character.stats.wisdom >= 10 ? '+' : ''}${Math.floor((character.stats.wisdom - 10) / 2)})`, inline: true },
        { name: 'Charisma', value: `${character.stats.charisma} (${character.stats.charisma >= 10 ? '+' : ''}${Math.floor((character.stats.charisma - 10) / 2)})`, inline: true },
        { name: 'Alignment', value: character.alignment, inline: true },
        { name: 'Description', value: description, inline: false }
      )
      .setFooter({ text: `Player: ${username}` });

    // Create character stats button
    const statsButton = new ButtonBuilder()
      .setCustomId(`show_stats_${userId}`)
      .setLabel('Show Character Stats')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📊');

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(statsButton);

    await interaction.reply({
      embeds: [embed],
      components: [row],
      flags: 64 // Ephemeral flag
    });

    // Notify the channel about the new character
    const channelEmbed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('🎭 New Character Joined!')
      .setDescription(`${name} (${race} ${characterClass}) has joined the party!`)
      .addFields(
        { name: 'Player', value: username, inline: true },
        { name: 'Background', value: background, inline: true }
      );

    if (interaction.channel && 'send' in interaction.channel) {
      await (interaction.channel as any).send({ embeds: [channelEmbed] });
    }

    // If the game is starting, send a public message
    if (result.message.includes('Game started')) {
      logger.info(`Game starting in session ${sessionId} - all players have joined`);
      const gameStartEmbed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('🎭 Adventure Begins!')
        .setDescription(result.message)
        .addFields(
          { name: 'Party Members', value: openaiService.getSessionCharacters(sessionId).map(c => `- ${c.name} (${c.race} ${c.class})`).join('\n'), inline: false }
        )
        .setFooter({ text: 'Use /dm action to describe what your character does' });

      if (interaction.channel && 'send' in interaction.channel) {
        await (interaction.channel as any).send({ embeds: [gameStartEmbed] });
      }
    }

  } catch (error) {
    logger.error('Error in character creation modal:', error);
    await interaction.reply({
      content: 'There was an error creating your character. Please try again.',
      flags: 64 // Ephemeral flag
    });
  }
} 