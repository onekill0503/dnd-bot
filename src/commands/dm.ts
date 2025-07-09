import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import type { Command } from '../types';
import { OpenAIService } from '../services/openai';
import { logger } from '../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('dm')
  .setDescription('Dungeon Master commands for managing D&D sessions')
  .addSubcommand(subcommand =>
    subcommand
      .setName('start')
      .setDescription('Start a new D&D session (must be in a voice channel)')
      .addIntegerOption(option =>
        option
          .setName('level')
          .setDescription('Party level')
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(20)
      )
      .addIntegerOption(option =>
        option
          .setName('size')
          .setDescription('Party size')
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(8)
      )
      .addStringOption(option =>
        option
          .setName('theme')
          .setDescription('Campaign theme')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('action')
      .setDescription('Describe your character\'s action')
      .addStringOption(option =>
        option
          .setName('action')
          .setDescription('What your character does')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('dice')
          .setDescription('Dice roll results (optional)')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('encounter')
      .setDescription('Generate an encounter')
      .addStringOption(option =>
        option
          .setName('type')
          .setDescription('Type of encounter')
          .setRequired(true)
          .addChoices(
            { name: 'Combat', value: 'combat' },
            { name: 'Social', value: 'social' },
            { name: 'Exploration', value: 'exploration' },
            { name: 'Puzzle', value: 'puzzle' }
          )
      )
      .addStringOption(option =>
        option
          .setName('difficulty')
          .setDescription('Encounter difficulty')
          .setRequired(false)
          .addChoices(
            { name: 'Easy', value: 'easy' },
            { name: 'Medium', value: 'medium' },
            { name: 'Hard', value: 'hard' },
            { name: 'Deadly', value: 'deadly' }
          )
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('status')
      .setDescription('Check current session status')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('end')
      .setDescription('End the current session')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('debug')
      .setDescription('Debug session information (DM only)')
  );

export const execute: Command['execute'] = async (interaction: ChatInputCommandInteraction) => {
  try {
    const subcommand = interaction.options.getSubcommand();
    const openaiService = new OpenAIService();
    const sessionId = interaction.channelId; // Use channel ID as session ID
    
    logger.info(`DM command executed: ${subcommand} in channel ${sessionId}`);

    switch (subcommand) {
      case 'start': {
        // Check if user is in a voice channel
        const member = interaction.member;
        if (!member || !('voice' in member) || !member.voice.channel) {
          await interaction.reply({
            content: '❌ You must be in a voice channel to start a D&D session!',
            flags: 64 // Ephemeral flag
          });
          return;
        }

        const level = interaction.options.getInteger('level', true);
        const size = interaction.options.getInteger('size', true);
        const theme = interaction.options.getString('theme') || 'fantasy adventure';
        const voiceChannel = member.voice.channel;

        await interaction.deferReply();

        logger.info(`Starting session in channel ${sessionId} with level ${level}, size ${size}, theme ${theme}`);

        const openingScene = await openaiService.startSession(sessionId, level, size, theme, voiceChannel.id);

        const embed = new EmbedBuilder()
          .setColor(0x8B4513)
          .setTitle('🎭 Dungeon Master Session Started')
          .setDescription(openingScene)
          .addFields(
            { name: 'Party Level', value: level.toString(), inline: true },
            { name: 'Party Size', value: size.toString(), inline: true },
            { name: 'Theme', value: theme, inline: true },
            { name: 'Voice Channel', value: voiceChannel.name, inline: true }
          )
          .setFooter({ text: 'Click "Join Session" to create your character' });

        const joinButton = new ButtonBuilder()
          .setCustomId('join_session')
          .setLabel('Join Session')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🎭');

        const row = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(joinButton);

        await interaction.editReply({ embeds: [embed], components: [row] });
        break;
      }

      case 'action': {
        const action = interaction.options.getString('action', true);
        const diceResults = interaction.options.getString('dice');

        await interaction.deferReply();

        logger.info(`Processing action in session ${sessionId}: ${action}`);

        const response = await openaiService.continueStory(sessionId, action, diceResults || undefined);

        const embed = new EmbedBuilder()
          .setColor(0x4B0082)
          .setTitle('🎭 Dungeon Master Response')
          .setDescription(response)
          .addFields(
            { name: 'Player Action', value: action, inline: false }
          );

        if (diceResults) {
          embed.addFields({ name: 'Dice Results', value: diceResults, inline: false });
        }

        await interaction.editReply({ embeds: [embed] });
        break;
      }

      case 'encounter': {
        const type = interaction.options.getString('type', true) as 'combat' | 'social' | 'exploration' | 'puzzle';
        const difficulty = (interaction.options.getString('difficulty') || 'medium') as 'easy' | 'medium' | 'hard' | 'deadly';

        await interaction.deferReply();

        logger.info(`Generating ${type} encounter in session ${sessionId}`);

        const encounter = await openaiService.generateEncounter(sessionId, type, difficulty);

        const embed = new EmbedBuilder()
          .setColor(0xFF4500)
          .setTitle(`⚔️ ${type.charAt(0).toUpperCase() + type.slice(1)} Encounter`)
          .setDescription(encounter)
          .addFields(
            { name: 'Type', value: type, inline: true },
            { name: 'Difficulty', value: difficulty, inline: true }
          );

        await interaction.editReply({ embeds: [embed] });
        break;
      }

      case 'status': {
        logger.info(`Checking status for session ${sessionId}`);
        const session = openaiService.getSessionStatus(sessionId);

        if (!session) {
          await interaction.reply({
            content: '❌ No active session found. Use `/dm start` to begin a new session.',
            flags: 64 // Ephemeral flag
          });
          return;
        }

        const characters = openaiService.getSessionCharacters(sessionId);
        const characterList = characters.length > 0 
          ? characters.map(c => `- ${c.name} (${c.race} ${c.class})`).join('\n')
          : 'No characters created yet';

        const embed = new EmbedBuilder()
          .setColor(0x32CD32)
          .setTitle('📊 Session Status')
          .addFields(
            { name: 'Status', value: session.status, inline: true },
            { name: 'Party Level', value: session.partyLevel.toString(), inline: true },
            { name: 'Players', value: `${session.players.size}/${session.maxPlayers}`, inline: true },
            { name: 'Current Location', value: session.currentLocation, inline: true },
            { name: 'Characters', value: characterList, inline: false }
          );

        if (session.status === 'active') {
          embed.addFields(
            { name: 'Active Quests', value: session.activeQuests.length > 0 ? session.activeQuests.join(', ') : 'None', inline: false },
            { name: 'Recent Events', value: session.recentEvents.slice(-3).join('\n') || 'None', inline: false }
          );
        }

        await interaction.reply({ embeds: [embed] });
        break;
      }

      case 'end': {
        logger.info(`Ending session ${sessionId}`);
        const ended = openaiService.endSession(sessionId);

        if (ended) {
          await interaction.reply({
            content: '🏁 Session ended successfully. Use `/dm start` to begin a new adventure!',
            flags: 64 // Ephemeral flag
          });
        } else {
          await interaction.reply({
            content: '❌ No active session found to end.',
            flags: 64 // Ephemeral flag
          });
        }
        break;
      }

      case 'debug': {
        logger.info(`Debug command executed in channel ${sessionId}`);
        
        // Get all sessions for debugging
        const allSessions = openaiService.getAllSessionIds();
        const currentSession = openaiService.getSessionStatus(sessionId);
        
        let debugInfo = `**Debug Information:**\n`;
        debugInfo += `**Channel ID:** ${sessionId}\n`;
        debugInfo += `**All Sessions:** ${allSessions.join(', ') || 'None'}\n`;
        
        if (currentSession) {
          debugInfo += `**Current Session:**\n`;
          debugInfo += `- Status: ${currentSession.status}\n`;
          debugInfo += `- Players: ${currentSession.players.size}/${currentSession.maxPlayers}\n`;
          debugInfo += `- Level: ${currentSession.partyLevel}\n`;
          debugInfo += `- Theme: ${currentSession.storyContext}\n`;
        } else {
          debugInfo += `**Current Session:** Not found\n`;
        }
        
        await interaction.reply({
          content: debugInfo,
          flags: 64 // Ephemeral flag
        });
        break;
      }
    }
  } catch (error) {
    logger.error('Error in DM command:', error);
    const errorMessage = 'There was an error processing your request.';
    
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, flags: 64 }); // Ephemeral flag
    }
  }
}; 